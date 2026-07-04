const { ipcMain } = require("electron");

const os = require("os");

ipcMain.handle(

    "system:info",

    async () => {

        return {

            platform: process.platform,

            arch: process.arch,

            hostname: os.hostname(),

            cpus: os.cpus().length,

            memory: os.totalmem()

        };

    }

);