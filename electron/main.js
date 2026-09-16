const electron = require("electron");
const { app, session } = electron;

const { createMainWindow } = require("./window");
const wakeWindowManager = require("./wake/wakeWindowManager");


require("./ipc");

console.log("Electron app:", electron.app);
console.log("Electron ipcMain:", electron.ipcMain);

if (!app.isPackaged) {
    process.env.NODE_ENV = "development";
    process.env.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
}

app.whenReady().then(() => {

    // Explicit, least-privilege permission policy for every window that
    // shares the default session (main window + the two wake windows -
    // none of them use webPreferences.partition, so this one handler
    // covers all three). "media" (microphone) is the only permission
    // this app actually needs from the browser Permissions API - the
    // wake listener's getUserMedia() call and the mic button in
    // Chat/Character both depend on this being granted; everything else
    // is denied by default rather than left to Electron's own default,
    // since setting any handler at all replaces that default entirely.
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(permission === "media");
    });

    const mainWindow = createMainWindow();

    // Started once at app launch, independent of the main window's
    // route/visibility/focus - this is what makes wake detection real
    // (not a React component that only exists while some view is
    // mounted). See wakeWindowManager.js for the full explanation.
    wakeWindowManager.ensureListenerWindow();

    // The hidden listener/popup windows are real open BrowserWindows on
    // purpose (so their renderers keep running while the main window is
    // minimized/backgrounded), which means Electron's window-all-closed
    // event would never fire once the main window closes - they'd keep
    // the app alive as an invisible background process the user never
    // asked to leave running. Closing the main Yuna window must still
    // quit the app like it always has; only actually minimizing/
    // backgrounding it should keep wake detection alive.
    mainWindow.on("closed", () => {
        wakeWindowManager.destroyAll();
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

});

app.on("window-all-closed", () => {
    // Handled by mainWindow's own "closed" listener above (see comment
    // there for why window-all-closed itself isn't reliable once the
    // wake windows exist) - kept as a harmless fallback for the case
    // where the main window was never created (e.g. an early startup
    // failure) so the app still doesn't hang open with no windows.
    if (process.platform !== "darwin" && BrowserWindow.getAllWindows().length === 0) {
        app.quit();
    }
});

app.on("before-quit", () => {
    wakeWindowManager.destroyAll();
});