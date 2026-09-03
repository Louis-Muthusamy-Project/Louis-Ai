const { ipcMain, clipboard, Notification, shell } = require("electron");

ipcMain.handle("automation:clipboard:read", async () => {
    return clipboard.readText();
});

ipcMain.handle("automation:clipboard:write", async (event, text) => {
    clipboard.writeText(text);
    return true;
});

ipcMain.handle("automation:notification:send", async (event, { title, body }) => {
    if (Notification.isSupported()) {
        const notification = new Notification({ title, body });
        notification.show();
        return true;
    }
    return false;
});

// Both of these hand a renderer-supplied string straight to a destructive
// (trashItem) or execute-capable (openPath can launch whatever application
// is registered for the file type) OS API. There was no validation at all
// previously - any string, including empty/non-string values, was accepted.
// This is the smallest safe fix: reject anything that isn't a real,
// non-empty path string before it reaches Electron's shell APIs. It does
// NOT restrict *which* paths are allowed (this app doesn't currently have
// a defined "safe directory" concept to scope to) - see audit notes for
// the broader point that preload.js exposes every ipcMain.handle channel
// generically with no allowlist, which is a separate, larger change.
function isValidPath(p) {
    return typeof p === "string" && p.trim().length > 0;
}

ipcMain.handle("automation:recycle:trashItem", async (event, path) => {
    if (!isValidPath(path)) {
        console.warn("[IPC] automation:recycle:trashItem rejected invalid path argument.");
        return false;
    }
    try {
        await shell.trashItem(path);
        return true;
    } catch (e) {
        console.error("Failed to trash item:", e);
        return false;
    }
});

ipcMain.handle("automation:shell:open", async (event, path) => {
    if (!isValidPath(path)) {
        console.warn("[IPC] automation:shell:open rejected invalid path argument.");
        return false;
    }
    try {
        const error = await shell.openPath(path);
        if (error) throw new Error(error);
        return true;
    } catch (e) {
        console.error("Failed to open path:", e);
        return false;
    }
});
