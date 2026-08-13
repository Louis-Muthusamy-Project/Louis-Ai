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

ipcMain.handle("automation:recycle:trashItem", async (event, path) => {
    try {
        await shell.trashItem(path);
        return true;
    } catch (e) {
        console.error("Failed to trash item:", e);
        return false;
    }
});

ipcMain.handle("automation:shell:open", async (event, path) => {
    try {
        const error = await shell.openPath(path);
        if (error) throw new Error(error);
        return true;
    } catch (e) {
        console.error("Failed to open path:", e);
        return false;
    }
});
