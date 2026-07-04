const Kernel = require("./core/YunaKernel");
const ConversationModule = require("./modules/ConversationModule");
const VoiceModule = require("./modules/VoiceModule");
const MemoryModule = require("./modules/MemoryModule");
const CapabilityRegistry = require("./capabilities");
require("./tools");

async function bootstrap() {

    await CapabilityRegistry.initialize();

    console.log("Capabilities Loaded:");
    console.log(
        CapabilityRegistry
            .list()
            .map(c => c.name)
    );

    const ToolManager = require("./tools");

    const result = await ToolManager.execute(

        "time"

    );

    console.log(result);

    Kernel.register(
        "conversation",
        ConversationModule
    );

    Kernel.register(
        "voice",
        VoiceModule
    );

    Kernel.register(
        "memory",
        MemoryModule
    );

    for (const name of Kernel.list()) {

        const module = Kernel.get(name);

        await module.initialize();

    }

    console.log("================================");
    console.log("      YUNA KERNEL READY");
    console.log("================================");

}

module.exports = bootstrap;