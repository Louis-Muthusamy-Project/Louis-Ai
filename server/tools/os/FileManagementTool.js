const BaseTool = require("../BaseTool");
const fs = require("fs").promises;
const path = require("path");
const PermissionService = require("../../services/permissionService");

class FileManagementTool extends BaseTool {
    constructor() {
        super(
            "FileManagement",
            "Read, write, list, or delete files and folders on the user's computer."
        );
    }

    async execute(args) {
        if (!PermissionService.check("files")) {
            return "Error: File management permission is denied by the user.";
        }

        const { action, targetPath, content } = args;
        
        if (!targetPath) {
            return "Error: targetPath is required.";
        }

        try {
            switch (action) {
                case "read":
                    return await fs.readFile(targetPath, "utf-8");
                case "write":
                    await fs.writeFile(targetPath, content || "", "utf-8");
                    return `Successfully wrote to ${targetPath}`;
                case "list":
                    const files = await fs.readdir(targetPath);
                    return `Contents of ${targetPath}: \n${files.join("\n")}`;
                case "delete":
                    await fs.rm(targetPath, { recursive: true, force: true });
                    return `Successfully deleted ${targetPath}`;
                case "mkdir":
                    await fs.mkdir(targetPath, { recursive: true });
                    return `Successfully created directory ${targetPath}`;
                default:
                    return `Error: Unknown action '${action}'. Supported: read, write, list, delete, mkdir.`;
            }
        } catch (error) {
            return `Error executing file action: ${error.message}`;
        }
    }

    schema() {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", description: "Action to perform: read, write, list, delete, mkdir" },
                    targetPath: { type: "string", description: "Absolute path to the file or directory" },
                    content: { type: "string", description: "Content to write (only for 'write' action)" }
                },
                required: ["action", "targetPath"]
            }
        };
    }
}

module.exports = new FileManagementTool();
