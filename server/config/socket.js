const { Server } = require("socket.io");

function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },

    transports: ["websocket", "polling"],

    allowEIO3: false,

    pingTimeout: 60000,

    pingInterval: 25000,
  });

  io.engine.on("connection_error", (err) => {
    console.error("=================================");
    console.error("Socket.IO Connection Error");
    console.error("Code:", err.code);
    console.error("Message:", err.message);
    console.error("=================================");
  });

  io.on("connection", (socket) => {
    console.log(`✅ Socket Connected : ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket Disconnected : ${socket.id}`);
      console.log(`Reason : ${reason}`);
    });
  });

  return io;
}

module.exports = {
  createSocketServer,
};