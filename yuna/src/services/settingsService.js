import axios from "axios";

const BASE_URL =
    (import.meta.env.VITE_API_URL || "http://localhost:3000") +
    "/api/settings";

class SettingsService {

    async getSettings() {

        const { data } = await axios.get(

            BASE_URL

        );

        return data.settings;

    }

    async saveSettings(settings) {

        const { data } = await axios.put(

            BASE_URL,

            settings

        );

        return data.settings;

    }

}

export default new SettingsService();