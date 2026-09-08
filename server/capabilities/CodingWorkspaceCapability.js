const BaseCapability = require("./BaseCapability");
const { CodingWorkspaceService, WorkspaceAccessError } = require("../services/codingWorkspaceService");
const { CodingTerminalService, TerminalCommandError } = require("../services/codingTerminalService");
const { CodingGitService, GitCommandError } = require("../services/codingGitService");
const CodingProviderRegistry = require("../services/coding/CodingProviderRegistry");
// NOTE: CodingAgentRuntime is required lazily (inside initialize() and the
// agent.* actions below), NOT at module top-level. CodingAgentRuntime.js
// itself requires THIS file at its own top level (to execute tool calls),
// so a top-level require here would be circular - whichever of the two
// finishes loading first would see an incomplete module.exports for the
// other (surfaced as "capability.execute is not a function" at runtime,
// not a load-time crash, which is what made this easy to miss until an
// actual agent.run test caught it).

/**
 * ==========================================
 * CodingWorkspaceCapability
 * ------------------------------------------
 * The real, working tool surface behind the Coding panel: workspace
 * inspection, file CRUD, search, a secure terminal, and a safe git subset -
 * all scoped to the authenticated user's configured coding workspace via
 * CodingWorkspaceService (see that file for the path-traversal / secret-file
 * protections every one of these actions goes through).
 *
 * This is registered as a normal capability (auto-discovered by
 * PluginLoader.loadCapabilities, id "codingWorkspace") so it's reachable
 * from the existing taskPlanner/AgentCoordinator flow like any other
 * capability, AND its individual methods (see the `tools` export below)
 * are the same functions the dedicated CodingAgent tool-calling loop
 * (native function-calling per provider) will call directly once that
 * loop exists - one implementation, two entry points, per the
 * "do not duplicate the tool implementation" requirement.
 *
 * Every action requires __ownerId, injected server-side by
 * AgentCoordinator from the authenticated identity - never trusted from
 * client/plan-supplied params. See ImageGenerationCapability.js for the
 * identical pattern this mirrors.
 * ==========================================
 */
class CodingWorkspaceCapability extends BaseCapability {
    constructor() {
        super("codingWorkspace", "Coding Workspace Tools", {
            description: "File, terminal, and git tools scoped to the authenticated user's configured coding workspace.",
            permission: "filesystem",
            riskLevel: "high",
            timeoutMs: 60000
        });
    }

    async initialize(kernel) {
        const { CodingAgentRuntime } = require("../services/coding/CodingAgentRuntime");
        this._runtime = CodingAgentRuntime;
        this.providerRegistry = new CodingProviderRegistry(kernel.get("providerManager"));
        const sessionService = kernel.has("codingSessionService") ? kernel.get("codingSessionService") : null;
        this._runtime.initialize(kernel.get("eventBus"), { sessionService, providerRegistry: this.providerRegistry });
    }

    async execute(input = {}) {
        const { action, params = {}, __ownerId } = input;

        if (!__ownerId) {
            return { success: false, message: "Coding workspace tools require an authenticated owner." };
        }

        try {
            switch (action) {
                case "workspace.inspect":
                    return { success: true, ...CodingWorkspaceService.inspect(__ownerId) };
                case "workspace.setRoot":
                    return { success: true, root: CodingWorkspaceService.setWorkspaceRoot(__ownerId, params.path) };
                case "workspace.list":
                    return { success: true, entries: CodingWorkspaceService.list(__ownerId, params.path || ".") };
                case "workspace.search":
                    return { success: true, results: CodingWorkspaceService.search(__ownerId, params.query, { includeContent: params.includeContent !== false }) };

                case "file.read":
                    return { success: true, ...CodingWorkspaceService.readFile(__ownerId, params.path, { acknowledgeSecret: !!params.acknowledgeSecret }) };
                case "file.write":
                    return { success: true, ...CodingWorkspaceService.writeFile(__ownerId, params.path, params.content, { acknowledgeSecret: !!params.acknowledgeSecret, create: true, expectedHash: params.expectedHash || null }) };
                case "file.create":
                    return { success: true, ...CodingWorkspaceService.writeFile(__ownerId, params.path, params.content || "", { acknowledgeSecret: !!params.acknowledgeSecret, create: true }) };
                case "file.delete":
                    if (!params.confirmed) {
                        return { success: false, message: "Deleting a file requires confirmed:true.", code: "CONFIRMATION_REQUIRED" };
                    }
                    return { success: true, ...CodingWorkspaceService.deleteFile(__ownerId, params.path, { acknowledgeSecret: !!params.acknowledgeSecret }) };
                case "file.rename":
                    return { success: true, ...CodingWorkspaceService.renameFile(__ownerId, params.from, params.to) };

                case "terminal.run":
                    return { success: true, ...await CodingTerminalService.run(__ownerId, params.command, {
                        cwd: params.cwd || ".",
                        timeoutMs: params.timeoutMs,
                        confirmed: !!params.confirmed,
                        onStart: params.onStart
                    }) };
                case "terminal.cancel":
                    return { success: true, cancelled: CodingTerminalService.cancel(params.runId) };

                case "git.status":
                    return { success: true, ...await CodingGitService.status(__ownerId, { cwd: params.cwd }) };
                case "git.diff":
                    return { success: true, ...await CodingGitService.diff(__ownerId, { file: params.file, staged: !!params.staged, cwd: params.cwd }) };
                case "git.log":
                    return { success: true, ...await CodingGitService.log(__ownerId, { limit: params.limit, cwd: params.cwd }) };
                case "git.stage":
                    return { success: true, ...await CodingGitService.stage(__ownerId, params.files, { cwd: params.cwd }) };
                case "git.unstage":
                    return { success: true, ...await CodingGitService.unstage(__ownerId, params.files, { cwd: params.cwd }) };
                case "git.commit":
                    return { success: true, ...await CodingGitService.commit(__ownerId, params.message, { cwd: params.cwd }) };
                case "git.branch":
                    return {
                        success: true,
                        current: await CodingGitService.currentBranch(__ownerId, { cwd: params.cwd }),
                        branches: await CodingGitService.listBranches(__ownerId, { cwd: params.cwd })
                    };

                case "agent.providers":
                    return { success: true, providers: this.providerRegistry.getProviderStatus() };

                case "agent.run": {
                    const provider = this.providerRegistry.getCodingProvider(params.provider);
                    const result = await this._runtime.run(__ownerId, params.task, provider, {
                        maxIterations: params.maxIterations,
                        maxToolCalls: params.maxToolCalls,
                        maxRuntimeMs: params.maxRuntimeMs
                    });
                    return { success: true, ...result };
                }

                case "agent.cancel":
                    return { success: true, cancelled: this._runtime.cancel(params.sessionId) };

                case "agent.resume": {
                    const result = await this._runtime.resume(__ownerId, params.sessionId, {
                        approved: !!params.approved,
                        approvalId: params.approvalId
                    });
                    return { success: true, ...result };
                }

                case "agent.sessions.list": {
                    if (!this._runtime.sessionService) {
                        return { success: true, sessions: [], persistenceEnabled: false };
                    }
                    const sessions = await this._runtime.sessionService.listForUser(__ownerId, { limit: params.limit });
                    // Never return the raw opaque provider history in a list
                    // view - it can be large and callers only need summaries
                    // here; agent.sessions.get returns the full record.
                    return {
                        success: true,
                        persistenceEnabled: true,
                        sessions: sessions.map(({ history, ...summary }) => summary)
                    };
                }

                case "agent.sessions.get": {
                    if (!this._runtime.sessionService) {
                        return { success: false, message: "Session persistence is not enabled." };
                    }
                    const record = await this._runtime.sessionService.getOwned(__ownerId, params.sessionId);
                    if (!record) {
                        return { success: false, message: "No session found with that id." };
                    }
                    return { success: true, session: record };
                }

                default:
                    return { success: false, message: `Unknown coding workspace action: ${action}` };
            }
        } catch (error) {
            if (error instanceof WorkspaceAccessError || error instanceof TerminalCommandError || error instanceof GitCommandError) {
                return { success: false, message: error.message, code: error.code };
            }
            return { success: false, message: error.message };
        }
    }
}

module.exports = new CodingWorkspaceCapability();
