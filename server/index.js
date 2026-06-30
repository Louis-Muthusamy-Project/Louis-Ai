const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

require("dotenv").config();
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const socketHandler = require("./socket/socketHandler");

const app = express();
const server = http.createServer(app);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: CLIENT_ORIGIN,
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
