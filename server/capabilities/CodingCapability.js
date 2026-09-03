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

    /**
     * Entry point used by the agent/plan pipeline. Previously this was a
     * stub that always returned {success:true} without doing anything -
     * runCommand/reviewCode/etc below were fully implemented but never
     * reachable from here.
     */
    async execute(input = {}) {
        const { action, params = {} } = input;

        switch (action) {
            case "runCommand":
                return this.runCommand(params.command, params.cwd);
            case "openInVSCode":
                return this.openInVSCode(params.filePath);
            case "reviewCode":
                return this.reviewCode(params.fileContent);
            case "generateDocumentation":
                return this.generateDocumentation(params.fileContent);
            case "analyzeError":
                return this.analyzeError(params.errorText);
            case "reviewArchitecture":
                return this.reviewArchitecture(params.context);
            default:
                return { success: false, message: `Unknown coding action: ${action}` };
        }
    }

    // 1. Terminal / Git / Run Project
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
    async _generateWithAI(prompt) {
        if (!this.providerManager) {
            return { success: false, message: "Provider Manager not initialized in CodingCapability." };
        }
        try {
            const reply = await this.providerManager.generate([
                { role: "user", parts: [{ text: prompt }] }
            ]);
            return { success: true, text: reply };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async reviewCode(fileContent) {
        const prompt = `Review the following code for bugs, security issues, performance, and best practices. Provide your response in Markdown.\n\nCode:\n\`\`\`\n${fileContent}\n\`\`\``;
        return this._generateWithAI(prompt);
    }

    async generateDocumentation(fileContent) {
        const prompt = `Generate comprehensive Markdown documentation for the following code.\n\nCode:\n\`\`\`\n${fileContent}\n\`\`\``;
        return this._generateWithAI(prompt);
    }

    async analyzeError(errorText) {
        const prompt = `Analyze the following error message/stack trace and explain the likely root cause. Propose a solution.\n\nError:\n\`\`\`\n${errorText}\n\`\`\``;
        return this._generateWithAI(prompt);
    }

    async reviewArchitecture(context) {
        const prompt = `Review the following architectural context and provide insights, potential bottlenecks, and suggestions for improvement.\n\nContext:\n\`\`\`\n${context}\n\`\`\``;
        return this._generateWithAI(prompt);
    }
}

module.exports = new CodingCapability();