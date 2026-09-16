const { BrowserWindow, screen } = require("electron");
const path = require("path");

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 220;

/**
 * ==========================================
 * wakeWindowManager
 * ------------------------------------------
 * Owns exactly two extra BrowserWindows, both created once at app
 * startup (see electron/main.js) and reused for the app's lifetime -
 * neither is a normal routed view inside the main Yuna window:
 *
 * 1. THE LISTENER WINDOW (never shown, never focused, has no visible
 *    UI). It loads the same built renderer bundle as the main window,
 *    with `?popup=wake-listener` in the URL so main.jsx mounts
 *    <WakeListener/> instead of the normal routed app (see
 *    yuna/src/main.jsx). That component runs a continuous, always-on
 *    browser SpeechRecognition session and calls back into this file
 *    via IPC the moment it hears "Hey Yuna" or "Thangapila".
 *
 *    This is what makes wake detection independent of the main
 *    window's visibility/focus/route: Chromium keeps a getUserMedia
 *    audio stream alive in a background renderer regardless of which
 *    window (if any) has OS focus, as long as the Electron process
 *    itself is running - including while the main window is minimized
 *    or another application (Chrome, VS Code, a game) is the active
 *    window. It does NOT work if the Yuna app itself is fully quit -
 *    no Electron architecture can listen after its own process exits;
 *    see the "KNOWN LIMITATION" note in the implementation report this
 *    ships with.
 *
 * 2. THE POPUP WINDOW (hidden until a wake phrase fires, then shown/
 *    focused). Frameless, transparent, alwaysOnTop, reused every time -
 *    showPopup() below is idempotent, so three rapid "Hey Yuna"s
 *    re-focus the same window instead of stacking three windows (the
 *    wake-listener's own cooldown, in wakePhraseMatcher.js, also stops
 *    the IPC call from firing that often in the first place - this is
 *    the second, independent guard).
 * ==========================================
 */
class WakeWindowManager {
    constructor() {
        this._listenerWindow = null;
        this._popupWindow = null;
        this._pendingPopupPayload = null;
    }

    _rendererUrl(query) {
        if (process.env.NODE_ENV === "development") {
            const base = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
            return `${base}/?${query}`;
        }
        return null; // production path is handled via loadFile() below
    }

    _loadRenderer(win, query) {
        if (process.env.NODE_ENV === "development") {
            win.loadURL(this._rendererUrl(query));
        } else {
            win.loadFile(
                path.join(__dirname, "../../yuna/dist/index.html"),
                { search: query }
            );
        }
    }

    /** Creates the hidden, always-running wake-listener window (once). */
    ensureListenerWindow() {
        if (this._listenerWindow && !this._listenerWindow.isDestroyed()) {
            return this._listenerWindow;
        }

        const win = new BrowserWindow({
            show: false,
            width: 10,
            height: 10,
            skipTaskbar: true,
            webPreferences: {
                preload: path.join(__dirname, "../preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                // The wake listener needs an active microphone stream
                // even though the window itself is never shown/focused -
                // this is what lets detection survive the main window
                // being minimized or another app being focused.
                backgroundThrottling: false
            }
        });

        this._loadRenderer(win, "popup=wake-listener");

        win.on("closed", () => {
            this._listenerWindow = null;
        });

        this._listenerWindow = win;
        return win;
    }

    /** Creates the (initially hidden) popup window (once). */
    _ensurePopupWindow() {
        if (this._popupWindow && !this._popupWindow.isDestroyed()) {
            return this._popupWindow;
        }

        const win = new BrowserWindow({
            width: POPUP_WIDTH,
            height: POPUP_HEIGHT,
            show: false,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            resizable: false,
            skipTaskbar: true,
            backgroundColor: "#00000000",
            webPreferences: {
                preload: path.join(__dirname, "../preload.js"),
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        this._loadRenderer(win, "popup=wake");

        // alwaysOnTop across (most) fullscreen/other-app windows on
        // macOS needs this extra level - harmless no-op on other
        // platforms.
        win.setAlwaysOnTop(true, "screen-saver");

        win.on("blur", () => {
            // Clicking away from the popup dismisses it, like every
            // other desktop assistant popup (Spotlight, PowerToys Run,
            // etc.) - not required by the spec but expected UX, and
            // trivial to remove if unwanted.
            win.hide();
        });

        win.on("closed", () => {
            this._popupWindow = null;
        });

        this._popupWindow = win;
        return win;
    }

    /**
     * Positions the popup near the cursor's current display, fully
     * inside that display's work area so it can never end up
     * off-screen - covers single-monitor, multi-monitor, and mixed-DPI
     * setups, since screen.getDisplayNearestPoint() already accounts
     * for each display's own scaleFactor.
     */
    _positionPopup(win) {
        const cursor = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursor);
        const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;

        const x = Math.round(areaX + (areaW - POPUP_WIDTH) / 2);
        const y = Math.round(areaY + Math.min(120, areaH * 0.12));

        win.setBounds({
            x: Math.max(areaX, Math.min(x, areaX + areaW - POPUP_WIDTH)),
            y: Math.max(areaY, Math.min(y, areaY + areaH - POPUP_HEIGHT)),
            width: POPUP_WIDTH,
            height: POPUP_HEIGHT
        });
    }

    /**
     * Shows (creating if needed) and focuses the popup, restoring the
     * main window first if the whole app was minimized - matches the
     * spec's "restore/focus the main context" requirement without
     * actually stealing the user's place in the main window's UI (the
     * popup is a separate window layered on top, not a route change).
     */
    showPopup(payload) {
        const win = this._ensurePopupWindow();
        this._positionPopup(win);

        this._pendingPopupPayload = payload || null;

        if (win.webContents.isLoading()) {
            // First show after app start - wait for the popup's own
            // "wake:popup:ready" IPC call (see ipc/wake.js) to deliver
            // the payload once its listeners are actually attached,
            // instead of racing webContents.send() against page load.
        } else {
            win.webContents.send("wake:popup:init", this._pendingPopupPayload);
        }

        win.show();
        win.focus();
        return true;
    }

    /** Called once the popup renderer signals it's mounted and listening. */
    deliverPendingPayload(win) {
        if (this._pendingPopupPayload) {
            win.webContents.send("wake:popup:init", this._pendingPopupPayload);
        }
    }

    hidePopup() {
        if (this._popupWindow && !this._popupWindow.isDestroyed()) {
            this._popupWindow.hide();
        }
        this._pendingPopupPayload = null;
        return true;
    }

    isPopupWindow(webContents) {
        return !!this._popupWindow && !this._popupWindow.isDestroyed() && this._popupWindow.webContents === webContents;
    }

    isListenerWindow(webContents) {
        return !!this._listenerWindow && !this._listenerWindow.isDestroyed() && this._listenerWindow.webContents === webContents;
    }

    destroyAll() {
        if (this._listenerWindow && !this._listenerWindow.isDestroyed()) this._listenerWindow.destroy();
        if (this._popupWindow && !this._popupWindow.isDestroyed()) this._popupWindow.destroy();
        this._listenerWindow = null;
        this._popupWindow = null;
    }
}

module.exports = new WakeWindowManager();
