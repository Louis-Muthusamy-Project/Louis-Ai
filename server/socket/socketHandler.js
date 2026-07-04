const { handleChatMessage } = require("../controllers/chatController");
const Events = require("./socketEvents");

function registerSocketHandlers(io) {
    io.on("connection", (socket) => {
        console.log("=================================");
        console.log("🟢 New Client Connected");
        console.log(`Socket ID : ${socket.id}`);
        console.log("=================================");

        socket.emit(
            Events.CONNECTION_READY,
            {
                ok: true,
                socketId: socket.id,
                time: new Date().toISOString()
            }
        );

        socket.on(

            Events.MESSAGE_SEND,

            async payload => {

                try {

                    await handleChatMessage(

                        socket,

                        payload

                    );

                }

                catch (error) {

                    console.error(error);

                    socket.emit(

                        Events.MESSAGE_ERROR,

                        {

                            message: error.message

                        }

                    );

                }

            }

        );

        socket.on("disconnect", (reason) => {
            console.log("=================================");
            console.log("🔴 Client Disconnected");
            console.log(`Socket ID : ${socket.id}`);
            console.log(`Reason : ${reason}`);
            console.log("=================================");
        });
    });
}

module.exports = {
    registerSocketHandlers,
};