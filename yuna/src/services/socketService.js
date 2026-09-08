import { io } from "socket.io-client";

class SocketService {

    constructor() {

        this.socket = null;

        this.listeners = {};

        this._currentToken = null;

    }

    connect(token) {

        if (!token) {
            console.warn("[SocketService] connect() called without a token - refusing to connect.");
            return null;
        }

        if (this.socket && this._currentToken === token) {
            if (this.socket.connected) {
                return this.socket;
            }
            this.socket.connect();
            return this.socket;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this._currentToken = token;

        const url =
            import.meta.env.VITE_SOCKET_URL ||
            "http://localhost:4000";

        this.socket = io(url, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            auth: { token }
        });

        this.socket.onAny((event, data) => {

            if (!this.listeners[event]) return;

            this.listeners[event].forEach(callback => {

                callback(data);

            });

        });

        this.socket.on("connect", () => {

            this.listeners["connect"]?.forEach(
                callback => callback()
            );

        });

        this.socket.on("disconnect", () => {

            this.listeners["disconnect"]?.forEach(
                callback => callback()
            );

        });

        this.socket.on("connect_error", (error) => {

            console.warn("[SocketService] connect_error:", error.message, error.data);

            this.listeners["connect_error"]?.forEach(
                callback => callback(error)
            );

        });

        return this.socket;

    }

    disconnect() {

        if (!this.socket) return;

        this.socket.disconnect();

        this.socket = null;

        this._currentToken = null;

    }

    emit(event, payload = {}) {

        if (!this.socket) return;

        this.socket.emit(event, payload);

    }

    /**
     * For request/response style events that expect a server ack callback
     * (see server/socket/socketHandler.js's CODING_CAPABILITY_ACTION),
     * rather than the fire-and-forget emit() above whose responses arrive
     * as separate later events. Resolves with whatever the server passed
     * to its ack callback, or a clean { success: false } if there's no
     * live connection or the server takes too long to respond - callers
     * never hang forever waiting on a dropped connection.
     */
    emitWithAck(event, payload = {}, timeoutMs = 15000) {

        if (!this.socket) {
            return Promise.resolve({ success: false, message: "Not connected." });
        }

        return new Promise((resolve) => {

            let settled = false;

            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                resolve({ success: false, message: "Request timed out." });
            }, timeoutMs);

            this.socket.emit(event, payload, (response) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(response);
            });

        });

    }

    on(event, callback) {

        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        if (!this.listeners[event].includes(callback)) {
            this.listeners[event].push(callback);
        }

    }

    off(event, callback) {

        if (!this.listeners[event]) return;

        this.listeners[event] =
            this.listeners[event].filter(
                item => item !== callback
            );

    }

    isConnected() {
        return this.socket?.connected || false;
    }

}

export default new SocketService();