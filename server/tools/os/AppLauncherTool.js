const BaseTool = require("../BaseTool");
const { exec } = require("child_process");
const PermissionService = require("../../services/permissionService");
const util = require("util");
const execPromise = util.promisify(exec);

class AppLauncherTool extends BaseTool {
    constructor() {
        super(
            "AppLauncher",
            "Launch an application or open a URL."
        );
    }

    async execute(args) {
        if (!PermissionService.check("process")) {
            return "Error: App launcher permission is denied.";
        }

        const { appName, url } = args;

        try {
            if (url) {
                // Windows start, macOS open, Linux xdg-open
                const command = process.platform === 'win32' ? `start "" "${url}"` : 
                              process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
                await execPromise(command);
                return `Successfully opened URL: ${url}`;
            }

            if (appName) {
                // VERY basic app launching. In a real environment, you'd want to look up common paths or use Start-Process.
                // This is a naive implementation for demonstration.
                const command = process.platform === 'win32' ? `start ${appName}` : 
                              process.platform === 'darwin' ? `open -a "${appName}"` : `${appName}`;
                await execPromise(command);
                return `Successfully launched ${appName}`;
            }

            return "Error: Must provide either appName or url.";
        } catch (error) {
            return `Error launching app: ${error.message}`;
        }
    }

    schema() {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: "object",
                properties: {
                    appName: { type: "string", description: "Name of the executable to launch (e.g., notepad, calc)" },
                    url: { type: "string", description: "URL to open in default browser" }
                }
            }
        };
    }
}

module.exports = new AppLauncherTool();
