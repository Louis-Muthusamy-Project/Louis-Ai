const fs = require("fs");
const path = require("path");

class SettingsService {

    constructor() {

        this.file = path.join(

            __dirname,

            "..",

            "data",

            "settings.json"

        );

    }

    getSettings() {

        if (!fs.existsSync(this.file)) {

            return {};

        }

        const raw = fs.readFileSync(

            this.file,

            "utf8"

        );

        return JSON.parse(raw);

    }

    saveSettings(settings) {

        fs.writeFileSync(

            this.file,

            JSON.stringify(

                settings,

                null,

                4

            )

        );

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

module.exports = new SettingsService();