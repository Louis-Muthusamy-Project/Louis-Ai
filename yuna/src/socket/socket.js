import { io } from "socket.io-client";

// Backend URL (change if needed)
const SOCKET_URL = "http://localhost:5000";

export const socket = io(SOCKET_URL, {
    transports: ["websocket"],
});