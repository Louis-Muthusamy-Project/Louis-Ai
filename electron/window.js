const { BrowserWindow } = require("electron");
const path = require("path");

function createMainWindow() {

    const win = new BrowserWindow({

        width: 1400,

        height: 900,

        minWidth: 1200,

        minHeight: 700,

        backgroundColor: "#09090b",

        title: "Yuna",

        autoHideMenuBar: true,

        webPreferences: {

            preload: path.join(__dirname, "preload.js"),

            contextIsolation: true,

            nodeIntegration: false

        }

    });

    if (process.env.NODE_ENV === "development") {

        win.loadURL("http://localhost:5173");

        win.webContents.openDevTools();

    } else {

        win.loadFile(

            path.join(

                __dirname,

                "../client/dist/index.html"

            )

        );

    }

    return win;

}

module.exports = {

    createMainWindow

};