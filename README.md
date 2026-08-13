# Yuna AI Companion Platform

Yuna is a scalable, modular, production-ready AI Companion platform designed for high performance, deep customization, and advanced capabilities via a Multi-Agent architecture.

## Features
- **Multi-Agent Architecture**: Built on a centralized EventBus, featuring specialized, asynchronous agents (Planner, Browser, Coder, Vision, Voice, Automation, etc.).
- **Plugin Ecosystem**: Secure, sandboxed plugin loader featuring hot-reloading. Build completely independent capabilities that hook right into the core AI.
- **Dependency Injection**: Powered by a robust Kernel acting as a centralized service locator.
- **Stateful Memory**: Short-term conversational memory paired with cognitive analysis for dynamic Live2D emotional responses.
- **Live2D Frontend**: An Electron/React client providing a fully animated, responsive avatar.

## Quick Start

### 1. Prerequisites
- Node.js (v18 or higher)
- NPM or Yarn
- Valid API keys (e.g. Google Gemini API)

### 2. Installation
Clone the repository, then install both server and client dependencies:

```bash
# Install Server Dependencies
cd server
npm install

# Install Client Dependencies
cd ../yuna
npm install
```

### 3. Environment Variables
Create a `.env` file in the `server` directory and add your keys:
```env
PORT=3000
NODE_ENV=development
GEMINI_API_KEY=your_api_key_here
```

### 4. Running the Platform
Start the server and the Electron app:

```bash
# Terminal 1: Start the Backend Server
cd server
node index.js

# Terminal 2: Start the Electron Frontend
cd yuna
npm run dev
```

## Documentation
- See `ARCHITECTURE.md` for a deep dive into the Multi-Agent system, EventBus, and DI Kernel.
- Check out the `server/plugins` directory for examples of how to build secure, sandboxed extensions.
