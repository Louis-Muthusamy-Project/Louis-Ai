import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import ChatProvider from "./providers/ChatProvider";

ReactDOM.createRoot(

    document.getElementById("root")

).render(

    <React.StrictMode>
        <BrowserRouter>

            <ChatProvider>

                <App />

            </ChatProvider>
        </BrowserRouter>

    </React.StrictMode>

);