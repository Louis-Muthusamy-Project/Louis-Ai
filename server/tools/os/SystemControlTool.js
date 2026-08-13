const BaseTool = require("../BaseTool");
const { exec } = require("child_process");
const PermissionService = require("../../services/permissionService");
const util = require("util");
const execPromise = util.promisify(exec);

class SystemControlTool extends BaseTool {
    constructor() {
        super(
            "SystemControl",
            "Control OS volume and power state (sleep). Windows only for now."
        );
    }

    async execute(args) {
        if (!PermissionService.check("system_control")) {
            return "Error: System control permission is denied.";
        }

        const { action, value } = args;

        if (process.platform !== 'win32') {
            return "Error: SystemControlTool currently only supports Windows.";
        }

        try {
            switch (action) {
                case "mute":
                    // Naive PowerShell volume mute toggle
                    const muteCmd = `powershell -c "(new-object -com wscript.shell).SendKeys([char]173)"`;
                    await execPromise(muteCmd);
                    return "Toggled volume mute.";
                
                case "volume_up":
                    // Volume Up keystroke
                    const volUpCmd = `powershell -c "(new-object -com wscript.shell).SendKeys([char]175)"`;
                    await execPromise(volUpCmd);
                    return "Increased volume.";

                case "volume_down":
                    // Volume Down keystroke
                    const volDownCmd = `powershell -c "(new-object -com wscript.shell).SendKeys([char]174)"`;
                    await execPromise(volDownCmd);
                    return "Decreased volume.";

                case "sleep":
                    // Sleep
                    await execPromise(`rundll32.exe powrprof.dll,SetSuspendState 0,1,0`);
                    return "System going to sleep.";

                default:
                    return `Error: Unknown action '${action}'. Supported: mute, volume_up, volume_down, sleep.`;
            }
        } catch (error) {
            return `Error executing system control: ${error.message}`;
        }
    }

    schema() {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", description: "Action to perform: mute, volume_up, volume_down, sleep" },
                    value: { type: "number", description: "Optional value (not currently used for volume keys)" }
                },
                required: ["action"]
            }
        };
    }
}

module.exports = new SystemControlTool();
