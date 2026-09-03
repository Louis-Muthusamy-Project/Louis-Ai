const {

    contextBridge,

    ipcRenderer

} = require("electron");

// Explicit channel allowlist. Previously invoke()/on() forwarded ANY
// channel string straight through to ipcRenderer with no restriction -
// contextIsolation kept Node out of the renderer, but nothing stopped
// renderer code (e.g. a future XSS, a malicious dependency, or simply a
// typo'd channel) from invoking or listening on a channel this app never
// intended to expose. Keep this in sync with electron/ipc/*.js's
// ipcMain.handle() registrations.
const ALLOWED_INVOKE_CHANNELS = new Set([
    "system:info",
    "system:getSources",
    "window:minimize",
    "window:maximize",
    "window:close",
    "automation:clipboard:read",
    "automation:clipboard:write",
    "automation:notification:send",
    "automation:recycle:trashItem",
    "automation:shell:open"
]);

// No main -> renderer push channels are wired up (webContents.send) as of
// this writing, so this starts empty rather than open. Add a channel here
// deliberately if/when a real push event is introduced.
const ALLOWED_LISTEN_CHANNELS = new Set([]);

contextBridge.exposeInMainWorld(

    "yuna",

    {

        invoke(channel, data) {

            if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
                console.warn(`[preload] Blocked invoke() for unallowed channel: ${channel}`);
                return Promise.reject(new Error(`Channel not allowed: ${channel}`));
            }

            return ipcRenderer.invoke(
                channel,
                data
            );

        },

        on(channel, callback) {

            if (!ALLOWED_LISTEN_CHANNELS.has(channel)) {
                console.warn(`[preload] Blocked on() for unallowed channel: ${channel}`);
                return;
            }

            ipcRenderer.on(
                channel,
                (_, data) => callback(data)
            );

        }

    }

);
