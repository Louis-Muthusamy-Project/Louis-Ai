const AIService = require("../services/aiService");
const Events = require("../socket/socketEvents");


async function handleChatMessage(socket, payload = {}) {

    try {

        const text =
            typeof payload.text === "string"
                ? payload.text.trim()
                : "";

        if (!text) {

            socket.emit(Events.MESSAGE_ERROR, {

                message: "Message cannot be empty.",

                createdAt: new Date().toISOString()

            });

            return;

        }

        const result = await AIService.streamReply(

            socket.id,

            text,

            {

                onStart: async () => {

                    socket.emit(Events.THINKING_START);

                    socket.emit(Events.TYPING_START);

                    socket.emit(Events.STREAM_START);

                },

                onChunk: async (chunk) => {

                    socket.emit("yuna:stream:chunk", chunk);

                },

                onComplete: async (finalText) => {

                    socket.emit(Events.STREAM_END);

                    socket.emit(Events.TYPING_STOP);

                    socket.emit(Events.THINKING_END);

                }

            }

        );

        socket.emit(Events.MESSAGE_REPLY, result);

    }

    catch (error) {

        console.error(error);

        socket.emit(Events.THINKING_END);

        socket.emit(Events.MESSAGE_ERROR, {

            message: error.message,

            createdAt: new Date().toISOString()

        });

    }

}

module.exports = {

    handleChatMessage

};