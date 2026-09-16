const fs = require("fs");
const path = require("path");
const { app } = require("electron");

/**
 * ==========================================
 * wakeSettingsStore
 * ------------------------------------------
 * Tiny, dependency-free persistence for the one real setting the wake
 * system needs: whether it's enabled. Plain JSON file in Electron's
 * userData directory (no electron-store dependency exists in this repo -
 * see electron/package.json - so this uses the same fs-based approach
 * rather than adding a new dependency for a single boolean).
 *
 * Deliberately does NOT persist microphone permission / engine status -
 * those are live, per-process facts (see wakeStatus.js) that would go
 * stale the moment they're written to disk; only the user's own on/off
 * choice is durable.
 * ==========================================
 */
function getFilePath() {
    return path.join(app.getPath("userData"), "wake-settings.json");
}

const DEFAULTS = {
    enabled: true
};

function readSettings() {
    try {
        const raw = fs.readFileSync(getFilePath(), "utf8");
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, enabled: parsed.enabled !== false };
    } catch {
        // No file yet (first run) or corrupt - fall back to defaults
        // rather than throwing, since this must never block startup.
        return { ...DEFAULTS };
    }
}

function writeSettings(next) {
    const merged = { ...readSettings(), ...next };
    try {
        fs.mkdirSync(path.dirname(getFilePath()), { recursive: true });
        fs.writeFileSync(getFilePath(), JSON.stringify(merged, null, 2), "utf8");
    } catch (error) {
        console.warn("[wakeSettingsStore] Failed to persist wake settings:", error.message);
    }
    return merged;
}

module.exports = { readSettings, writeSettings };
