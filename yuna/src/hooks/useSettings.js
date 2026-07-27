import { useCallback, useEffect } from "react";

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

    const load = useCallback(async () => {

        try {

            setLoading(true);

            const result =

                await SettingsService.getSettings();

            setSettings(result);

        }

        finally {

            setLoading(false);

        }

    }, [setLoading, setSettings]);

    async function save() {

        await SettingsService.saveSettings(

            settings

        );

    }

    useEffect(() => {

        load();

    }, [load]);

    return {

        settings,

        save,

        reload: load

    };

}