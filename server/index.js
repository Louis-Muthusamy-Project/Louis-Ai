const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const initializeModules = require("./bootstrap");

const { createApp } = require("./config/server");
const { createSocketServer } = require("./config/socket");
const { registerSocketHandlers } = require("./socket/socketHandler");

const PORT = Number(process.env.PORT) || 4000;

async function startServer() {

    try {

        // Initialize Yuna modules
        await initializeModules();

        // Create Express + HTTP server
        const { app, server } = createApp();

        // Create Socket.IO
        const io = createSocketServer(server);

        // Register socket handlers
        registerSocketHandlers(io);

        // Start server
        server.listen(PORT, () => {

            console.log("==================================");
            console.log("      YUNA AI SERVER STARTED");
            console.log("==================================");
            console.log(`Server : http://localhost:${PORT}`);
            console.log(`Mode   : ${process.env.NODE_ENV || "development"}`);
            console.log("==================================");

        });

    }

    catch (error) {

        console.error("Failed to start server");
        console.error(error);

        process.exit(1);

    }

}

startServer();