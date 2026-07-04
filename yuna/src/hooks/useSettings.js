import { useEffect } from "react";

import SettingsService from "../services/settingsService";

import useSettingsStore from "../store/settingsStore";

export default function useSettings() {

    const settings = useSettingsStore(

        state => state.settings

    );

    const setSettings = useSettingsStore(

        state => state.setSettings

    );

    const setLoading = useSettingsStore(

        state => state.setLoading

    );

    async function load() {

        try {

            setLoading(true);

            const result =

                await SettingsService.getSettings();

            setSettings(result);

        }

        finally {

            setLoading(false);

        }

    }

    async function save() {

        await SettingsService.saveSettings(

            settings

        );

    }

    useEffect(() => {

        load();

    }, []);

    return {

        settings,

        save,

        reload: load

    };

}