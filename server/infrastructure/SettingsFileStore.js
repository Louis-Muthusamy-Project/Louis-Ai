const fs = require("fs");
const path = require("path");

/**
 * ==========================================
 * SettingsFileStore - Infrastructure Adapter
 * ==========================================
 */
class SettingsFileStore {
    constructor() {
        this.filePath = path.join(__dirname, "..", "data", "settings.json");
    }

    read() {
        if (!fs.existsSync(this.filePath)) {
            return {};
        }
        try {
            const raw = fs.readFileSync(this.filePath, "utf8");
            return JSON.parse(raw);
        } catch (error) {
            console.error("[SettingsFileStore] Error reading settings file:", error);
            return {};
        }
    }

    write(data) {
        try {
            // Ensure data directory exists
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 4), "utf8");
            return true;
        } catch (error) {
            console.error("[SettingsFileStore] Error writing settings file:", error);
            return false;
        }
    }
}

module.exports = SettingsFileStore;
