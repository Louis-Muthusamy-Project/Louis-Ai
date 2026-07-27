const Kernel = require("./core/Kernel");
const EventBus = require("./core/EventBus");
const ModuleRegistry = require("./core/ModuleRegistry");
const CapabilityRegistry = require("./core/CapabilityRegistry");
const PluginLoader = require("./core/PluginLoader");
const StateMachine = require("./core/StateMachine");

const SettingsFileStore = require("./infrastructure/SettingsFileStore");
const SessionStore = require("./infrastructure/SessionStore");
const MemoryFileStore = require("./infrastructure/MemoryFileStore");

const ProviderManager = require("./providers/ProviderManager");

const { SettingsService } = require("./services/settingsService");
const { ConversationService } = require("./services/conversationService");
const { MemoryService } = require("./services/memoryService");
const { ContextService } = require("./services/contextService");
const { EmotionService } = require("./services/emotionService");
const EmotionEngine = require("./services/EmotionEngine");
const { TTSService } = require("./services/ttsService");
const streamService = require("./services/streamService");
const { PromptBuilder } = require("./services/promptBuilder");
const { AIOrchestrator } = require("./services/AIOrchestrator");

// Setup bindings in Kernel
function registerBindings() {
    // Core Singletons
    Kernel.register("eventBus", EventBus);
    Kernel.register("moduleRegistry", ModuleRegistry);
    Kernel.register("capabilityRegistry", CapabilityRegistry);
    Kernel.register("pluginLoader", PluginLoader);
    Kernel.register("stateMachine", StateMachine);

    // Infrastructure
    Kernel.register("settingsFileStore", new SettingsFileStore());
    Kernel.register("sessionStore", new SessionStore());
    Kernel.register("memoryFileStore", new MemoryFileStore());
    
    // Providers
    Kernel.register("providerManager", ProviderManager);

    // Services
    Kernel.register("settingsService", SettingsService);
    Kernel.register("conversationService", ConversationService);
    Kernel.register("memoryService", MemoryService);
    Kernel.register("contextService", ContextService);
    // EmotionEngine registered first (singleton, no Kernel dep)
    Kernel.register("emotionEngine", EmotionEngine);
    Kernel.register("emotionService", new EmotionService(Kernel));
    Kernel.register("ttsService", TTSService);
    
    // Require and bind voiceService after ttsService is registered
    const voiceService = require("./services/voiceService");
    Kernel.register("voiceService", voiceService);
    
    Kernel.register("streamService", streamService);
    Kernel.register("promptBuilder", PromptBuilder);
    
    // New AI Core components (lazy loaded by AIOrchestrator)
    const IntentDetector = require("./services/intentDetector");
    const TaskPlanner = require("./services/taskPlanner");
    const ToolRouter = require("./services/toolRouter");
    
    Kernel.register("intentDetector", IntentDetector);
    Kernel.register("taskPlanner", TaskPlanner);
    Kernel.register("toolRouter", ToolRouter);

    // AI Orchestrator (class instance with Kernel DI)
    Kernel.register("aiOrchestrator", new AIOrchestrator(Kernel));
}

async function bootstrap() {
    console.log("Starting Yuna Kernel Boot Sequence...");
    
    // Bind all dependencies
    registerBindings();

    // Eagerly resolve and load plugins (tools, capabilities)
    const pluginLoader = Kernel.get("pluginLoader");
    const capabilityRegistry = Kernel.get("capabilityRegistry");
    const ToolManager = require("./tools"); // Legacy or active ToolManager instance

    await pluginLoader.loadTools(ToolManager);
    await pluginLoader.loadCapabilities(capabilityRegistry);

    // Run initialization lifecycle
    await capabilityRegistry.initializeAll(Kernel);
    await ModuleRegistry.initializeAll(Kernel);

    console.log("Capabilities Loaded:");
    console.log(capabilityRegistry.list().map(c => c.name));

    // Verify tools loading
    const timeToolResult = await ToolManager.execute("time");
    console.log("Verification Tool Call [time]:", timeToolResult);

    console.log("================================");
    console.log("      YUNA SERVER READY");
    console.log("================================");
}

module.exports = bootstrap;