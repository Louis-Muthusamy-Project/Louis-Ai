const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * SettingsService - Service Layer Class
 * ------------------------------------------
 * Every method requires an authenticated userId - there is no
 * "global" settings concept anymore. Callers must always derive
 * userId from req.user / the verified JWT, never from client input.
 * ==========================================
 */
class SettingsService {
    constructor(kernel) {
        this.kernel = kernel;
    }

    get store() {
        return this.kernel.get("settingsFileStore");
    }

    _requireUserId(userId) {
        if (!userId) {
            throw new Error("SettingsService requires an authenticated userId.");
        }
    }

    getSettings(userId) {
        this._requireUserId(userId);
        return this.store.read(userId);
    }

    saveSettings(userId, settings) {
        this._requireUserId(userId);
        this.store.write(userId, settings);
        return settings;
    }

    updateSettings(userId, values) {
        this._requireUserId(userId);
        const current = this.getSettings(userId);
        const updated = {
            ...current,
            ...values
        };
        this.saveSettings(userId, updated);
        return updated;
    }
}

const wrapper = {
    getSettings: (userId) => Kernel.get("settingsService").getSettings(userId),
    saveSettings: (userId, s) => Kernel.get("settingsService").saveSettings(userId, s),
    updateSettings: (userId, v) => Kernel.get("settingsService").updateSettings(userId, v)
};

module.exports = Object.assign(wrapper, { SettingsService });
