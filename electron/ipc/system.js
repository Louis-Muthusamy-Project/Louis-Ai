const { ipcMain, desktopCapturer } = require("electron");

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

ipcMain.handle("system:getSources", async (event, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        display_id: source.display_id,
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
});