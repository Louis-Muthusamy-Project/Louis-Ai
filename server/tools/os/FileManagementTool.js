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
            // Path normalization and security checks
            const normalizedPath = path.normalize(path.resolve(targetPath));
            
            // Blocked directories
            const blockedDirs = [
                'C:\\Windows', 'C:\\Program Files', '/etc', '/var', '/usr/bin'
            ].map(p => path.normalize(path.resolve(p)).toLowerCase());

            const lowerPath = normalizedPath.toLowerCase();
            if (blockedDirs.some(blocked => lowerPath.startsWith(blocked))) {
                return "Error: Access to system directories is blocked for security reasons.";
            }

            // Prevent operations on .env or hidden critical files
            if (normalizedPath.includes('.env') || normalizedPath.includes('.ssh')) {
                return "Error: Access to secrets or sensitive files is blocked.";
            }
            switch (action) {
                case "read":
                    return await fs.readFile(normalizedPath, "utf-8");
                case "write":
                    await fs.writeFile(normalizedPath, content || "", "utf-8");
                    return `Successfully wrote to ${normalizedPath}`;
                case "list":
                    const files = await fs.readdir(normalizedPath);
                    return `Contents of ${normalizedPath}: \n${files.join("\n")}`;
                case "delete":
                    await fs.rm(normalizedPath, { recursive: true, force: true });
                    return `Successfully deleted ${normalizedPath}`;
                case "mkdir":
                    await fs.mkdir(normalizedPath, { recursive: true });
                    return `Successfully created directory ${normalizedPath}`;
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
