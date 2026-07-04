import React from "react";

import { FiSettings } from "react-icons/fi";

import useChatStore from "../../store/chatStore";
import useLayoutStore from "../../store/layoutStore";

import styles from "./chatHeader.module.css";

export default function ChatHeader() {

    const connected = useChatStore(

        state => state.connected

    );

    const thinking = useChatStore(

        state => state.thinking

    );

    const toggleDrawer = useLayoutStore(

        state => state.toggleDrawer

    );

    return (

        <header className={styles.header}>

            <div className={styles.left}>

                <div className={styles.avatar} />

                <div>

                    <h2>

                        Yuna

                    </h2>

                    <span>

                        {

                            connected

                                ? "🟢 Connected"

                                : "🔴 Disconnected"

                        }

                    </span>

                </div>

            </div>

            <div className={styles.center}>

                {

                    thinking

                        ? "🧠 Thinking..."

                        : "🎤 Ready"

                }

            </div>

            <button

                className={styles.settingsButton}

                onClick={() =>

                    toggleDrawer("settings")

                }

            >

                <FiSettings />

            </button>

        </header>

    );

}