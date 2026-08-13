const Registry = require("./CapabilityRegistry");

Registry.register(
    require("./MemoryCapability")
);

Registry.register(
    require("./BrowserCapability")
);

Registry.register(
    require("./CodingCapability")
);

Registry.register(
    require("./ScheduleCapability")
);

module.exports = Registry;