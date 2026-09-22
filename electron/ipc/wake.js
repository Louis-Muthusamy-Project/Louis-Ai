const { ipcMain, BrowserWindow, systemPreferences } = require("electron");

const wakeWindowManager = require("../wake/wakeWindowManager");
const wakeSettingsStore = require("../wake/wakeSettingsStore");

/**
 * ==========================================
 * IPC: wake:*
 * ------------------------------------------
 * The only channels the wake-listener window, the popup window, and the
 * main window's Settings screen use to talk to the main process. Kept
 * in one file so the full real contract (not just the popup-visible
 * half of it) is auditable in one place - see preload.js for the
 * matching allowlist.
 *
 * Live engine/mic/permission status is intentionally NOT persisted
 * (see wakeSettingsStore.js) - it's held here in memory, sourced only
 * from the listener window's own status reports, and broadcast to every
 * other window so Settings can show it live.
 * ==========================================
 */
let latestStatus = {
    // "granted" | "denied" | "unknown" - mirrors the Permissions API
    // state names so the renderer doesn't need a second vocabulary.
    permission: "unknown",
    // "initializing" | "listening" | "error" | "stopped"
    engineStatus: "initializing",
    microphoneAvailable: null, // true/false once known, null until reported
    error: null
};

function broadcastStatus() {
    for (const win of BrowserWindow.getAllWindows()) {
        if (win.isDestroyed()) continue;
        win.webContents.send("wake:status:update", latestStatus);
    }
}

ipcMain.handle("wake:settings:get", () => {
    return { ...wakeSettingsStore.readSettings(), ...latestStatus };
});

ipcMain.handle("wake:settings:set", (_event, patch = {}) => {
    const next = wakeSettingsStore.writeSettings({ enabled: !!patch.enabled });
    // The listener window is the one that actually starts/stops
    // SpeechRecognition - it listens for this push (see
    // WakeListener.jsx) rather than polling, so toggling this is what
    // actually turns the microphone on/off, not just a UI flag.
    for (const win of BrowserWindow.getAllWindows()) {
        if (win.isDestroyed()) continue;
        win.webContents.send("wake:settings:changed", next);
    }
    broadcastStatus();
    return { ...next, ...latestStatus };
});

ipcMain.handle("wake:listener:status", (event, status = {}) => {
    if (!wakeWindowManager.isListenerWindow(event.sender)) {
        // Only the dedicated hidden listener window is a legitimate
        // source of engine/mic status - anything else reporting this
        // channel is ignored rather than trusted.
        return latestStatus;
    }
    latestStatus = {
        permission: status.permission || latestStatus.permission,
        engineStatus: status.engineStatus || latestStatus.engineStatus,
        microphoneAvailable: typeof status.microphoneAvailable === "boolean" ? status.microphoneAvailable : latestStatus.microphoneAvailable,
        error: status.error || null
    };
    broadcastStatus();
    return latestStatus;
});

ipcMain.handle("wake:popup:show", (event, payload = {}) => {
    if (!wakeWindowManager.isListenerWindow(event.sender)) {
        // Only the hidden listener window is allowed to trigger the
        // popup this way - a compromised/renderer-XSS'd main window or
        // the popup itself asking to "show itself" is not a legitimate
        // trigger path.
        return false;
    }
    return wakeWindowManager.showPopup({
        phraseId: payload.phraseId || null,
        transcript: typeof payload.transcript === "string" ? payload.transcript.slice(0, 500) : ""
    });
});

ipcMain.handle("wake:popup:ready", (event) => {
    if (!wakeWindowManager.isPopupWindow(event.sender)) return false;
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) wakeWindowManager.deliverPendingPayload(win);
    return true;
});

ipcMain.handle("wake:popup:hide", (event) => {
    if (!wakeWindowManager.isPopupWindow(event.sender)) return false;
    return wakeWindowManager.hidePopup();
});

ipcMain.handle("wake:microphone:permission", async () => {
    // Only meaningful on macOS - Electron's systemPreferences media-access
    // API is macOS-only; Windows/Linux resolve permission implicitly the
    // first time getUserMedia() is actually called from the renderer, so
    // this reports "unknown" there rather than pretending to know.
    if (process.platform !== "darwin" || !systemPreferences.getMediaAccessStatus) {
        return { platform: process.platform, status: "unknown" };
    }
    return { platform: process.platform, status: systemPreferences.getMediaAccessStatus("microphone") };
});

// Sent by the MAIN window (any manual mic use - Chat/Character voice
// input, the Coding Agent panel's mic) whenever it starts/stops its own
// SpeechRecognition session, so the hidden wake-listener window can
// pause its continuous session for that duration instead of fighting it
// for the same microphone/speech-recognition resource (see
// wakeWindowManager.sendToListener's own comment for why that
// contention was causing the manual mic to immediately self-cancel).
// Any renderer may call this (it's not a privileged/status-reporting
// channel like wake:listener:status) - worst case a bogus call just
// pauses/resumes the wake listener needlessly, it can't be used to read
// or exfiltrate anything.
ipcMain.handle("wake:mic:busy", (_event, payload = {}) => {
    wakeWindowManager.sendToListener("wake:mic:busy:changed", { busy: !!payload.busy });
    return true;
});
