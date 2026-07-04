const {

    ipcMain,

    BrowserWindow

} = require("electron");

ipcMain.handle(

    "window:minimize",

    () => {

        BrowserWindow

            .getFocusedWindow()

            ?.minimize();

    }

);

ipcMain.handle(

    "window:maximize",

    () => {

        const win =

            BrowserWindow.getFocusedWindow();

        if (!win) return;

        if (win.isMaximized()) {

            win.unmaximize();

        } else {

            win.maximize();

        }

    }

);

ipcMain.handle(

    "window:close",

    () => {

        BrowserWindow

            .getFocusedWindow()

            ?.close();

    }

);