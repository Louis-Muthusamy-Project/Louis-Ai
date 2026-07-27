const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * SettingsService - Service Layer Class
 * ==========================================
 */
class SettingsService {
    constructor(kernel) {
        this.kernel = kernel;
    }

    get store() {
        return this.kernel.get("settingsFileStore");
    }

    getSettings() {
        return this.store.read();
    }

    saveSettings(settings) {
        this.store.write(settings);
        return settings;
    }

    updateSettings(values) {
        const current = this.getSettings();
        const updated = {
            ...current,
            ...values
        };
        this.saveSettings(updated);
        return updated;
    }
}

const wrapper = {
    getSettings: () => Kernel.get("settingsService").getSettings(),
    saveSettings: (s) => Kernel.get("settingsService").saveSettings(s),
    updateSettings: (v) => Kernel.get("settingsService").updateSettings(v)
};

module.exports = Object.assign(wrapper, { SettingsService });