import React from "react";
import { Outlet } from "react-router-dom";

import DesktopTitleBar from "../Desktop/DesktopTitleBar";
import "../Desktop/DesktopTitleBar.css";
import MainNav from "./MainNav";
import RightDrawer from "./RightDrawer";

import styles from "./appShell.module.css";

export default function AppShell() {
    return (
        <div className={styles.root}>
            <DesktopTitleBar />
            <MainNav />
            <div className={styles.content}>
                <Outlet />
            </div>
            <RightDrawer />
        </div>
    );
}
