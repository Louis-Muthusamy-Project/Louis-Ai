const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const socketHandler = require("./socket/socketHandler");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

// Attach socket layer
socketHandler(io);

app.get("/", (req, res) => {
    res.send("Yuna Server Running...");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});