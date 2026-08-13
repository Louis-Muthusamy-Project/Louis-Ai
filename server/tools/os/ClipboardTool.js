const BaseTool = require("../BaseTool");
const PermissionService = require("../../services/permissionService");
// Using dynamic import because clipboardy is an ESM package in newer versions, 
// but assuming commonjs or compatible version was installed. If it fails, we can fallback to powershell.

class ClipboardTool extends BaseTool {
    constructor() {
        super(
            "Clipboard",
            "Read or write text to the system clipboard."
        );
    }

    async execute(args) {
        if (!PermissionService.check("clipboard")) {
            return "Error: Clipboard permission is denied.";
        }

        const { action, text } = args;

        try {
            const clipboardy = (await import('clipboardy')).default;
            
            if (action === "read") {
                const content = await clipboardy.read();
                return `Clipboard contents:\n${content}`;
            } else if (action === "write") {
                if (!text) return "Error: text is required for write action.";
                await clipboardy.write(text);
                return "Successfully copied text to clipboard.";
            } else {
                return `Error: Unknown action '${action}'. Supported: read, write.`;
            }
        } catch (error) {
            return `Error accessing clipboard: ${error.message}`;
        }
    }

    schema() {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", description: "Action to perform: read, write" },
                    text: { type: "string", description: "Text to write (only for 'write' action)" }
                },
                required: ["action"]
            }
        };
    }
}

module.exports = new ClipboardTool();
