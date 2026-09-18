const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const path = require("path");
const BaseCapability = require("./BaseCapability");

class CodingCapability extends BaseCapability {
    constructor() {
        super("coding", "AI Coding Agent tasks", {
            description: "Runs project shell commands (permission-gated) and AI-assisted code review/documentation/error-analysis for the requesting user.",
            permission: "shell",
            riskLevel: "high",
            timeoutMs: 30000
        });
        this.projectRoot = path.resolve(__dirname, "../../");
    }

    async initialize(kernel) {
        this.providerManager = kernel.get("providerManager");
    }

    async execute(input = {}) {
        const { action, params = {}, __ownerId } = input;

        if (!__ownerId) {
            return { success: false, message: "Internal error: coding capability invoked without an owning user." };
        }

        switch (action) {
            case "runCommand":
                return this.runCommand(params.command, params.cwd);
            case "openInVSCode":
                return this.openInVSCode(params.filePath);
            case "reviewCode":
                return this.reviewCode(__ownerId, params.fileContent);
            case "generateDocumentation":
                return this.generateDocumentation(__ownerId, params.fileContent);
            case "analyzeError":
                return this.analyzeError(__ownerId, params.errorText);
            case "reviewArchitecture":
                return this.reviewArchitecture(__ownerId, params.context);
            default:
                return { success: false, message: `Unknown coding action: ${action}` };
        }
    }

    async runCommand(command, cwd = this.projectRoot) {
        const PermissionService = require("../services/permissionService");
        if (!PermissionService.check("execute_shell")) {
            return { success: false, message: "Error: Shell execution permission denied." };
        }

        // Basic blocklist for extremely dangerous commands
        const blocked = ['rm -rf /', 'del /s /q c:\\', 'mkfs', 'format'];
        if (blocked.some(b => command.toLowerCase().includes(b))) {
            return { success: false, message: "Error: Command blocked by security policy." };
        }

        try {
            const { stdout, stderr } = await execPromise(command, { cwd });
            return { success: true, stdout, stderr };
        } catch (error) {
            return { success: false, stdout: error.stdout, stderr: error.stderr, message: error.message };
        }
    }

    // 2. VS Code
    async openInVSCode(filePath) {
        return this.runCommand(`code "${filePath}"`);
    }

    // 3. AI Tasks (Review, Docs, Error Analysis, Patch)
    // Resolves THIS user's own configured provider credential (never the
    // boot-time env-based singleton) for the "coding" capability, mirroring
    // the pattern used by AIOrchestrator/memoryService/intentDetector/
    // taskPlanner - see ProviderManager.resolveForUser.
    async _generateWithAI(userId, prompt) {
        try {
            const provider = await this.providerManager.resolveForUser(userId, "gemini", "coding");
            const reply = await provider.generate([
                { role: "user", parts: [{ text: prompt }] }
            ]);
            return { success: true, text: reply };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async reviewCode(userId, fileContent) {
        const prompt = `Review the following code for bugs, security issues, performance, and best practices. Provide your response in Markdown.\n\nCode:\n\`\`\`\n${fileContent}\n\`\`\``;
        return this._generateWithAI(userId, prompt);
    }

    async generateDocumentation(userId, fileContent) {
        const prompt = `Generate comprehensive Markdown documentation for the following code.\n\nCode:\n\`\`\`\n${fileContent}\n\`\`\``;
        return this._generateWithAI(userId, prompt);
    }

    async analyzeError(userId, errorText) {
        const prompt = `Analyze the following error message/stack trace and explain the likely root cause. Propose a solution.\n\nError:\n\`\`\`\n${errorText}\n\`\`\``;
        return this._generateWithAI(userId, prompt);
    }

    async reviewArchitecture(userId, context) {
        const prompt = `Review the following architectural context and provide insights, potential bottlenecks, and suggestions for improvement.\n\nContext:\n\`\`\`\n${context}\n\`\`\``;
        return this._generateWithAI(userId, prompt);
    }
}

module.exports = new CodingCapability();