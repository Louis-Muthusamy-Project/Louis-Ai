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
                // Validate URL to prevent command injection
                const parsedUrl = new URL(url);
                if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                    throw new Error("Only http/https URLs are allowed.");
                }
                const command = process.platform === 'win32' ? 'start' : 
                              process.platform === 'darwin' ? 'open' : 'xdg-open';
                
                // Using execFile equivalent or safe spawn for start requires cmd.exe on windows
                if (process.platform === 'win32') {
                    await execPromise(`start "" "${parsedUrl.toString().replace(/"/g, '""')}"`);
                } else {
                    await util.promisify(require("child_process").execFile)(command, [parsedUrl.toString()]);
                }
                return `Successfully opened URL: ${url}`;
            }

            if (appName) {
                // Basic validation: only alphanumeric and dashes allowed
                if (!/^[a-zA-Z0-9\-\._]+$/.test(appName)) {
                     throw new Error("Invalid appName format. Only alphanumeric characters allowed.");
                }
                
                if (process.platform === 'win32') {
                    await execPromise(`start "" "${appName}"`);
                } else {
                    const command = process.platform === 'darwin' ? 'open' : appName;
                    const args = process.platform === 'darwin' ? ['-a', appName] : [];
                    await util.promisify(require("child_process").execFile)(command, args);
                }
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
