const { Server } = require("socket.io");
const { verifyAccessToken } = require("../utils/jwt");
const authService = require("../services/authService");

function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: [process.env.CLIENT_URL, "http://localhost:5173", "http://localhost:3000", "file://"],
      methods: ["GET", "POST"],
      credentials: true,
    },

    transports: ["websocket", "polling"],

    allowEIO3: false,

    pingTimeout: 60000,

    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      const error = new Error("Authentication required.");
      error.data = { code: "NO_TOKEN" };
      return next(error);
    }

    try {
      const decoded = verifyAccessToken(token);
      // Fetch the full server-side user record (role/features/status) so
      // every socket event handler can enforce feature toggles/role the
      // same way HTTP routes do via requireFeature/requireSuperAdmin -
      // never trust a role/features value coming from the client itself.
      const user = await authService.getUserById(decoded.sub);
      socket.data.user = user; // { id, name, email, role, features, status, ... }
      return next();
    } catch (err) {
      const code = err.code === "ACCOUNT_DISABLED"
        ? "ACCOUNT_DISABLED"
        : (err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN");
      const error = new Error("Invalid or expired session.");
      error.data = { code };
      return next(error);
    }
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