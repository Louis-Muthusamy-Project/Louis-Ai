const BaseCapability = require("./BaseCapability");

// Simple per-user rate limit for this expensive, real-money AI operation.
// Not shared with express-rate-limit (this capability isn't behind a REST
// route - it's invoked from socket handlers/agent dispatch), so it's a
// small self-contained limiter here.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 5;

class ImageGenerationCapability extends BaseCapability {
    constructor() {
        super("image", "Gemini Image Generation", {
            description: "Generates an image from a text prompt using the configured Gemini image model, for the requesting user.",
            permission: "network",
            // riskLevel is deliberately "low", not "medium": AgentCoordinator
            // routes any non-"low" capability through PermissionService,
            // which emits a "permission.requested" EventBus event that
            // nothing forwards to the frontend and nothing ever answers
            // (no socket bridge, no approval UI listens for it) - so at
            // "medium" every natural-language image request silently hung
            // for the full 60s timeout and was then denied. Image generation
            // is a user-requested, user-authorized AI operation, not an
            // ambient/background action the user needs to separately approve
            // - it already has its own real user-scoped protections below
            // (ownership via __ownerId, per-user rate limiting, and
            // duplicate-in-flight rejection), which are the correct controls
            // for this capability. Reserve "medium"/"high" for capabilities
            // that need an actual approval UI (e.g. terminal/system control),
            // and build that real socket-bridged approval flow before using
            // those levels for anything else.
            riskLevel: "low",
            timeoutMs: 45000
        });
        this._requestTimestamps = new Map(); // ownerId -> number[]
        this._inFlight = new Set(); // ownerId - prevents duplicate concurrent requests per user
    }

    async initialize(kernel) {
        this.providerManager = kernel.get("providerManager");
        this.eventBus = kernel.get("eventBus");
    }

    _checkRateLimit(ownerId) {
        const now = Date.now();
        const timestamps = (this._requestTimestamps.get(ownerId) || []).filter(
            (t) => now - t < RATE_LIMIT_WINDOW_MS
        );
        if (timestamps.length >= RATE_LIMIT_MAX_PER_WINDOW) {
            return false;
        }
        timestamps.push(now);
        this._requestTimestamps.set(ownerId, timestamps);
        return true;
    }

    /**
     * Entry point used by the agent/plan pipeline, mirroring
     * ScheduleCapability/BrowserCapability/CodingCapability - __ownerId is
     * injected server-side by AgentCoordinator from the authenticated
     * socket/user identity and can never be supplied by the AI's own plan
     * args or by the client.
     */
    async execute(input = {}) {
        const { action, params = {}, __ownerId } = input;

        if (!__ownerId) {
            return { success: false, message: "Image generation requires an authenticated owner." };
        }

        if (action !== "generate") {
            return { success: false, message: `Unknown image action: ${action}` };
        }

        return this.generate(__ownerId, params.prompt);
    }

    async generate(ownerId, prompt) {
        if (!ownerId) {
            throw new Error("ImageGenerationCapability.generate requires an authenticated ownerId.");
        }
        if (!prompt || !prompt.trim()) {
            return { success: false, message: "A prompt is required to generate an image." };
        }

        if (this._inFlight.has(ownerId)) {
            return { success: false, message: "An image is already being generated for you - please wait for it to finish." };
        }

        if (!this._checkRateLimit(ownerId)) {
            return { success: false, message: "Image generation rate limit reached. Please wait a minute before trying again." };
        }

        this._inFlight.add(ownerId);
        if (this.eventBus) this.eventBus.emit("image:start", { ownerId, prompt });
        try {
            // Resolve THIS user's own configured Gemini credential/image
            // model (never the boot-time env-based singleton) - see
            // ProviderManager.resolveForUser / providerCredentialService.js.
            // Throws a clear config error if the user hasn't added a
            // Gemini key in Settings, caught below like any other failure.
            const provider = await this.providerManager.resolveForUser(ownerId, "gemini", "image");
            const result = await provider.generateImage(prompt);
            const payload = {
                success: true,
                // base64 image data only - never a filesystem path, never
                // written to disk. See ImageGenerationCapability.js docs.
                data: result.data,
                mimeType: result.mimeType,
                prompt
            };
            if (this.eventBus) this.eventBus.emit("image:result", { ownerId, ...payload });
            return payload;
        } catch (error) {
            const payload = {
                success: false,
                message: error.message || "Image generation failed."
            };
            if (this.eventBus) this.eventBus.emit("image:error", { ownerId, prompt, ...payload });
            return payload;
        } finally {
            this._inFlight.delete(ownerId);
        }
    }
}

module.exports = new ImageGenerationCapability();
