import { io } from "socket.io-client";

class SocketService {

    constructor() {

        this.socket = null;

        this.listeners = {};

    }

    connect() {

        if (this.socket) {

            if (this.socket.connected) {

                return this.socket;

            }

            this.socket.connect();

            return this.socket;

        }

        this.socket = io("https://louis-yuna.onrender.com", {

            transports: ["websocket"],

            autoConnect: true,

            reconnection: true,

            reconnectionAttempts: Infinity,

            reconnectionDelay: 1000

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

        return this.socket;

    }

    disconnect() {

        if (!this.socket) return;

        this.socket.disconnect();

        this.socket = null;

    }

    emit(event, payload = {}) {

        if (!this.socket) return;

        this.socket.emit(event, payload);

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