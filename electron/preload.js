const {

    contextBridge,

    ipcRenderer

} = require("electron");

contextBridge.exposeInMainWorld(

    "yuna",

    {

        invoke(channel, data) {

            return ipcRenderer.invoke(

                channel,

                data

            );

        },

        on(channel, callback) {

            ipcRenderer.on(

                channel,

                (_, data) => callback(data)

            );

        }

    }

);