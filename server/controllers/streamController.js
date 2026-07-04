const AIService = require("../services/aiService");

class StreamController {

    async handle(socket, payload = {}) {

        try {

            const text = payload.text || "";

            if (!text.trim()) {
                return;
            }

            socket.emit("yuna:thinking:start");

            const result = await AIService.streamReply(
                socket.id,
                text,
                {

                    onStart: async () => {

                        socket.emit("yuna:stream:start");

                    },

                    onChunk: async (chunk) => {

                        socket.emit("yuna:stream:chunk", chunk);

                    },

                    onComplete: async () => {

                        socket.emit("yuna:stream:end");

                    }

                }
            );

            socket.emit("yuna:message:reply", result);

            socket.emit("yuna:thinking:end");

        }
        catch (err) {

            socket.emit("yuna:error", {

                message: err.message

            });

            socket.emit("yuna:thinking:end");

        }

    }

}

module.exports = new StreamController();