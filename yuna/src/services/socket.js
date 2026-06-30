
import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.VITE_SOCKET_URL || "http://localhost:4000",
  {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    transports: ["websocket"],
  }
);
