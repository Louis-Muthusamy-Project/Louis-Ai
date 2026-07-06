
import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.VITE_SOCKET_URL || "https://louis-yuna.onrender.com",
  {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    transports: ["websocket"],
  }
);
