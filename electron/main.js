const electron = require("electron");
const { app } = electron;

const { createMainWindow } = require("./window");


require("./ipc");

console.log("Electron app:", electron.app);
console.log("Electron ipcMain:", electron.ipcMain);

if (!app.isPackaged) {
    process.env.NODE_ENV = "development";
    process.env.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
}

app.whenReady().then(() => {

    createMainWindow();

});

app.on("window-all-closed", () => {

    if (process.platform !== "darwin") {

        app.quit();

    }

});