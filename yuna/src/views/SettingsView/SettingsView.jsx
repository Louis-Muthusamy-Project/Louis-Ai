import { useState } from "react";

import useSettings from "../../hooks/useSettings";
import useSettingsStore from "../../store/settingsStore";

import styles from "./settingsView.module.css";

export default function SettingsView() {

    const { save } = useSettings();

    const settings = useSettingsStore(

        state => state.settings

    );

    const updateSetting = useSettingsStore(

        state => state.updateSetting

    );

    const [saving, setSaving] = useState(false);

    async function handleSave() {

        try {

            setSaving(true);

            await save();

        }

        catch (error) {

            console.error(error);

        }

        finally {

            setSaving(false);

        }

    }

    return (

        <div className={styles.container}>

            <div className={styles.group}>

                <h3>AI</h3>

                <label>Provider</label>

                <select

                    value={settings.provider}

                    onChange={(e) =>
                        updateSetting(
                            "provider",
                            e.target.value
                        )
                    }

                >
                    <option value="gemini">
                        Gemini
                    </option>
                </select>

                <label>Model</label>

                <input

                    value={settings.model}

                    onChange={(e) =>
                        updateSetting(
                            "model",
                            e.target.value
                        )
                    }

                />

            </div>

            <div className={styles.group}>

                <h3>Voice</h3>

                <label>Provider</label>

                <select

                    value={settings.voice}

                    onChange={(e) =>
                        updateSetting(
                            "voice",
                            e.target.value
                        )
                    }

                >
                    <option value="edge">

                        Edge TTS

                    </option>

                </select>

                <label>Voice</label>

                <input

                    value={settings.voiceName}

                    onChange={(e) =>
                        updateSetting(
                            "voiceName",
                            e.target.value
                        )
                    }

                />

            </div>

            <div className={styles.group}>

                <h3>Streaming</h3>

                <label>

                    Speed

                </label>

                <input

                    type="range"

                    min="10"

                    max="100"

                    value={settings.streamSpeed}

                    onChange={(e) =>
                        updateSetting(

                            "streamSpeed",

                            Number(e.target.value)

                        )
                    }

                />

                <span>

                    {settings.streamSpeed} ms

                </span>

            </div>

            <div className={styles.group}>

                <h3>Features</h3>

                <label className={styles.switchRow}>

                    <span>

                        Memory

                    </span>

                    <input

                        type="checkbox"

                        checked={settings.memory}

                        onChange={(e) =>
                            updateSetting(

                                "memory",

                                e.target.checked

                            )
                        }

                    />

                </label>

                <label className={styles.switchRow}>

                    <span>

                        Debug Mode

                    </span>

                    <input

                        type="checkbox"

                        checked={settings.debug}

                        onChange={(e) =>
                            updateSetting(

                                "debug",

                                e.target.checked

                            )
                        }

                    />

                </label>

            </div>

            <button

                className={styles.saveButton}

                disabled={saving}

                onClick={handleSave}

            >

                {

                    saving

                        ? "Saving..."

                        : "Save Settings"

                }

            </button>

        </div>

    );

}