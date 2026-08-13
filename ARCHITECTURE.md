# Yuna AI Companion Architecture

Yuna is built on a highly modular, scalable **Multi-Agent Architecture** utilizing a central Event Bus, Dependency Injection (DI), and isolated Plugin sandboxing. This document provides a high-level overview of the core systems.

## 1. Dependency Injection (The Kernel)
Located in `server/core/Kernel.js`, the Kernel acts as a centralized service locator and DI container. Instead of passing instances around, components register themselves with the Kernel during `bootstrap()`.
- **Registration**: `Kernel.register("eventBus", new EventBus())`
- **Resolution**: `const eventBus = Kernel.get("eventBus")`

## 2. Multi-Agent Architecture
The system has evolved from a monolithic orchestrator to a decentralized Agent model.
- **AgentCoordinator**: The brain. Receives user messages, passes them to the Planner, and routes steps to specialized agents.
- **BaseAgent**: An abstract class that all agents extend. Provides methods for `broadcast`, `listen`, `readContext`, and `writeContext`.
- **Specialized Agents**:
  - `PlannerAgent`: Converts intents to actionable plans.
  - `CodingAgent`: Executes AI coding and file system tasks.
  - `BrowserAgent`: Controls a headless Puppeteer browser.
  - `VisionAgent`, `VoiceAgent`, `MemoryAgent`, `AutomationAgent`, `LearningAgent`, `ExecutorAgent`.

## 3. Communication & State
- **EventBus**: Agents communicate entirely asynchronously via the central EventBus (e.g., `agent:Planner:request`).
- **SharedContext**: An in-memory volatile Map where agents write large payloads or object references. Instead of sending a 10MB JSON over the EventBus, an agent sets the data in `SharedContext` and broadcasts the key.

## 4. Advanced Plugin System
Yuna supports third-party plugins loaded dynamically at runtime.
- **`PluginManager`**: Scans the `plugins/` directory. Uses `chokidar` to support **Hot-Reloading**. If a plugin file is modified, it is safely unloaded and rebooted without restarting the server.
- **`PluginSandbox`**: Uses Node's `vm` module. Plugins run in an isolated context and only have access to specific Kernel services or Node modules explicitly requested in their `manifest.json` `scopes` array.

## 5. Client-Server Architecture
- **Server (Node.js)**: Express for REST APIs (settings) and Socket.IO for real-time bidirectional communication (streaming text, emotion updates, vision processing).
- **Client (React/Electron)**: A desktop frontend featuring Live2D rendering, interactive chat, and dynamic emotion states synchronized with the server's AI outputs.
