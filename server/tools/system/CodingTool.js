const BaseTool = require("../BaseTool");
const codingCapability = require("../../capabilities/CodingCapability");

class CodingTool extends BaseTool {
    constructor() {
        super(
            "coding",
            "Controls the AI Coding Agent. Actions include: runCommand, openInVSCode, reviewCode, generateDocumentation, analyzeError, reviewArchitecture."
        );
    }

    async execute(args) {
        const { action, params = {} } = args;

        try {
            switch (action) {
                case "runCommand":
                    return await codingCapability.runCommand(params.command, params.cwd);
                case "openInVSCode":
                    return await codingCapability.openInVSCode(params.filePath);
                case "reviewCode":
                    return await codingCapability.reviewCode(params.fileContent);
                case "generateDocumentation":
                    return await codingCapability.generateDocumentation(params.fileContent);
                case "analyzeError":
                    return await codingCapability.analyzeError(params.errorText);
                case "reviewArchitecture":
                    return await codingCapability.reviewArchitecture(params.context);
                default:
                    return { success: false, message: `Unknown coding action: ${action}` };
            }
        } catch (error) {
            return { success: false, message: `Coding action failed: ${error.message}` };
        }
    }
}

module.exports = new CodingTool();
