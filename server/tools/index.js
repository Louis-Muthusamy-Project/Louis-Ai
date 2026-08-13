const ToolManager = require("./ToolManager");

ToolManager.register(

    require("./system/TimeTool")

);

ToolManager.register(
    require("./system/CalculatorTool")
);

ToolManager.register(
    require("./system/BrowserTool")
);

ToolManager.register(
    require("./system/CodingTool")
);

ToolManager.register(
    require("./system/ScheduleTool")
);

ToolManager.register(require("./os/ClipboardTool"));
ToolManager.register(require("./os/NotificationTool"));
ToolManager.register(require("./os/FileManagementTool"));
ToolManager.register(require("./os/SystemControlTool"));
ToolManager.register(require("./os/SystemMonitorTool"));
ToolManager.register(require("./os/AppLauncherTool"));

module.exports = ToolManager;