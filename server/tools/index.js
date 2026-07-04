const ToolManager = require("./ToolManager");

ToolManager.register(

    require("./system/TimeTool")

);

ToolManager.register(

    require("./system/CalculatorTool")

);

module.exports = ToolManager;