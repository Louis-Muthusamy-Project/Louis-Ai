const Registry = require("./CapabilityRegistry");

Registry.register(

    require("./MemoryCapability")

);

module.exports = Registry;