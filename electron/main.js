const { app } = require("electron");

const { createMainWindow } = require("./window");

require("./ipc");

app.whenReady().then(() => {

    createMainWindow();

});

app.on("window-all-closed", () => {

    if (process.platform !== "darwin") {

        app.quit();

    }

});