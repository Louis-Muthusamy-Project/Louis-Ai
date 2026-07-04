import { AnimatePresence, motion } from "framer-motion";

import useLayoutStore from "../../store/layoutStore";

import SettingsView from "../../views/SettingsView/SettingsView";

import styles from "./rightDrawer.module.css";

export default function RightDrawer() {

    const open = useLayoutStore(

        state => state.rightDrawerOpen

    );

    const activeDrawer = useLayoutStore(

        state => state.activeDrawer

    );

    const closeDrawer = useLayoutStore(

        state => state.closeDrawer

    );

    return (

        <AnimatePresence>

            {

                open && (

                    <>

                        <motion.div

                            className={styles.overlay}

                            initial={{ opacity: 0 }}

                            animate={{ opacity: 1 }}

                            exit={{ opacity: 0 }}

                            onClick={closeDrawer}

                        />

                        <motion.aside

                            className={styles.drawer}

                            initial={{ x: 420 }}

                            animate={{ x: 0 }}

                            exit={{ x: 420 }}

                            transition={{

                                duration: 0.25

                            }}

                        >

                            <div className={styles.header}>

                                <h2>

                                    {

                                        activeDrawer === "settings"

                                            ? "Settings"

                                            : activeDrawer

                                    }

                                </h2>

                                <button

                                    onClick={closeDrawer}

                                >

                                    ✕

                                </button>

                            </div>

                            <div className={styles.content}>

                                {

                                    activeDrawer === "settings" && (

                                        <SettingsView />

                                    )

                                }

                            </div>

                        </motion.aside>

                    </>

                )

            }

        </AnimatePresence>

    );

}