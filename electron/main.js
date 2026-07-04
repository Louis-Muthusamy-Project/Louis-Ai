const { app } = require("electron");

const { createMainWindow } = require("./window");


require("./ipc");

console.log("Electron app:", electron.app);
console.log("Electron ipcMain:", electron.ipcMain);

app.whenReady().then(() => {

    createMainWindow();

});

app.on("window-all-closed", () => {

    if (process.platform !== "darwin") {

        app.quit();

    }

});