import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";

import "./index.css";
import { yunaThemeConfig } from "./theme/yunaTheme";

import App from "./App";

ReactDOM.createRoot(

    document.getElementById("root")

).render(

    <React.StrictMode>
        <ConfigProvider theme={yunaThemeConfig}>
            <AntApp>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </AntApp>
        </ConfigProvider>
    </React.StrictMode>

);