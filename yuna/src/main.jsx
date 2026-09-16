import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";

import "./index.css";
import { yunaThemeConfig } from "./theme/yunaTheme";

import App from "./App";
import WakeListener from "./wake/WakeListener";
import WakePopup from "./wake/WakePopup";

// Electron loads the SAME built renderer bundle into three different
// windows (see electron/wake/wakeWindowManager.js): the normal main
// window, a hidden always-on wake-listener window (?popup=wake-listener),
// and the floating wake popup (?popup=wake). This is the single branch
// point that decides which of the three actually mounts - deliberately
// checked here, before any router/AppShell/route exists, so neither
// wake window depends on ChatView (or any other route) being mounted,
// per the "must not depend on the current React route" requirement.
// In a plain browser tab (no Electron, no query param) this is always
// undefined and the app behaves exactly as before.
const popupMode = new URLSearchParams(window.location.search).get("popup");

function Root() {
    if (popupMode === "wake-listener") {
        return <WakeListener />;
    }
    if (popupMode === "wake") {
        return <WakePopup />;
    }
    return (
        <BrowserRouter>
            <App />
        </BrowserRouter>
    );
}

ReactDOM.createRoot(

    document.getElementById("root")

).render(

    <React.StrictMode>
        <ConfigProvider theme={yunaThemeConfig}>
            <AntApp>
                <Root />
            </AntApp>
        </ConfigProvider>
    </React.StrictMode>

);