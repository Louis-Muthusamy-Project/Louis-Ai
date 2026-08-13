const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const path = require("path");
const BaseCapability = require("./BaseCapability");

class CodingCapability extends BaseCapability {
    constructor() {
        super("coding", "AI Coding Agent tasks");
        this.projectRoot = path.resolve(__dirname, "../../");
    }

    async initialize(kernel) {
        this.providerManager = kernel.get("providerManager");
    }

    async execute(input) {
        return { success: true, message: "Coding capability active" };
    }

    // 1. Terminal / Git / Run Project
    async runCommand(command, cwd = this.projectRoot) {
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
