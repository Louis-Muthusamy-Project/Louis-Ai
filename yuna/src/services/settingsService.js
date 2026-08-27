import apiClient from "./apiClient";

const SETTINGS_PATH = "/settings";

class SettingsService {

    async getSettings() {

        const { data } = await apiClient.get(
            SETTINGS_PATH
        );

        return data.settings;

    }

    async saveSettings(settings) {

        const { data } = await apiClient.put(
            SETTINGS_PATH,
            settings
        );

        return data.settings;

    }

}

export default new SettingsService();