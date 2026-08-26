const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const { validateEnvironment } = require("./utils/envValidator");

validateEnvironment();

const initializeModules = require("./bootstrap");

const { createApp } = require("./config/server");
const { createSocketServer } = require("./config/socket");
const { registerSocketHandlers } = require("./socket/socketHandler");

const PORT = Number(process.env.PORT) || 4000;

async function startServer() {

    try {

        // Initialize all modules
        await initializeModules();

        // Create Express + HTTP server
        const { app, server } = createApp();

        // Create Socket.IO
        const io = createSocketServer(server);

        // Register socket handlers
        registerSocketHandlers(io);

        // Start HTTP Server
        server.listen(PORT, () => {

            console.log("");
            console.log("==================================");
            console.log("      YUNA AI SERVER STARTED");
            console.log("==================================");
            console.log(`Server      : http://localhost:${PORT}`);
            console.log(`Environment : ${process.env.NODE_ENV || "development"}`);
            console.log(`Process ID  : ${process.pid}`);
            console.log(`Started At  : ${new Date().toLocaleString()}`);
            console.log("==================================");
            console.log("");

        });

        /**
         * Graceful Shutdown
         * Closes, in order: Socket.IO, plugin file watchers, the MongoDB
         * connection (if connected), then the HTTP server.
         */

        const shutdown = (signal) => {

            console.log("");
            console.log("==================================");
            console.log(`Received ${signal}`);
            console.log("Stopping Yuna Server...");
            console.log("==================================");

            (async () => {
                try {
                    io.close();
                    console.log("Socket.IO Closed.");
                } catch (error) {
                    console.error("Error closing Socket.IO:", error.message);
                }

                try {
                    const Kernel = require("./core/Kernel");
                    const pluginManager = Kernel.get("pluginManager");
                    if (pluginManager && typeof pluginManager.shutdown === "function") {
                        await pluginManager.shutdown();
                        console.log("Plugin Watchers Closed.");
                    }
                } catch (error) {
                    console.error("Error stopping plugin watchers:", error.message);
                }

                try {
                    const mongoose = require("mongoose");
                    if (mongoose.connection.readyState === 1) {
                        await mongoose.disconnect();
                        console.log("MongoDB Connection Closed.");
                    }
                } catch (error) {
                    console.error("Error closing MongoDB connection:", error.message);
                }

                server.close(() => {

                    console.log("HTTP Server Closed.");
                    process.exit(0);

                });
            })();

        };

        process.on("SIGINT", () => shutdown("SIGINT"));

        process.on("SIGTERM", () => shutdown("SIGTERM"));

    }

    catch (error) {

        console.error("");
        console.error("==================================");
        console.error("YUNA FAILED TO START");
        console.error("==================================");
        console.error(error);
        console.error("");

        process.exit(1);

    }

}

/**
 * Global Error Handlers
 */

process.on("unhandledRejection", (reason) => {

    console.error("");
    console.error("==================================");
    console.error("UNHANDLED PROMISE REJECTION");
    console.error("==================================");
    console.error(reason);
    console.error("");

});

process.on("uncaughtException", (error) => {

    console.error("");
    console.error("==================================");
    console.error("UNCAUGHT EXCEPTION");
    console.error("==================================");
    console.error(error);
    console.error("");

    process.exit(1);

});

startServer();