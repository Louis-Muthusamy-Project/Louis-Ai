const BaseTool = require("../BaseTool");
const si = require("systeminformation");
const PermissionService = require("../../services/permissionService");

class SystemMonitorTool extends BaseTool {
    constructor() {
        super(
            "SystemMonitor",
            "Retrieve system information like CPU usage, memory usage, battery status, and OS details."
        );
    }

    async execute(args) {
        if (!PermissionService.check("system_control")) {
            return "Error: System monitoring permission is denied.";
        }

        const { query } = args;

        try {
            switch (query) {
                case "cpu":
                    const cpu = await si.currentLoad();
                    return `CPU Usage: ${cpu.currentLoad.toFixed(2)}%`;
                case "memory":
                    const mem = await si.mem();
                    const usedMem = (mem.active / mem.total * 100).toFixed(2);
                    return `Memory Usage: ${usedMem}% (${(mem.active / 1024 / 1024 / 1024).toFixed(2)} GB / ${(mem.total / 1024 / 1024 / 1024).toFixed(2)} GB)`;
                case "battery":
                    const battery = await si.battery();
                    return `Battery: ${battery.percent}% (${battery.isCharging ? 'Charging' : 'Discharging'})`;
                case "os":
                    const osInfo = await si.osInfo();
                    return `OS: ${osInfo.distro} ${osInfo.release} (${osInfo.platform})`;
                case "all":
                    const [cpuAll, memAll, batAll] = await Promise.all([si.currentLoad(), si.mem(), si.battery()]);
                    return `CPU: ${cpuAll.currentLoad.toFixed(2)}%, RAM: ${(memAll.active / memAll.total * 100).toFixed(2)}%, Battery: ${batAll.percent}%`;
                default:
                    return "Error: Unknown query. Supported: cpu, memory, battery, os, all.";
            }
        } catch (error) {
            return `Error retrieving system info: ${error.message}`;
        }
    }

    schema() {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "What to check: cpu, memory, battery, os, all" }
                },
                required: ["query"]
            }
        };
    }
}

module.exports = new SystemMonitorTool();
