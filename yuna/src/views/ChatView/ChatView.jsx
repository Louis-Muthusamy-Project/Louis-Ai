import React from "react";

import DesktopTitleBar from "../../components/Desktop/DesktopTitleBar";
import "../../components/Desktop/DesktopTitleBar.css";

import ChatHeader from "../../components/Chat/ChatHeader";
import ChatMessages from "../../components/Chat/ChatMessages";
import ChatComposer from "../../components/Chat/ChatComposer";

import CharacterPanel from "../../components/CharacterPanel/CharacterPanel";

import RightDrawer from "../../components/Layout/RightDrawer";

import useChatStore from "../../store/chatStore";

import styles from "./chatView.module.css";

export default function ChatView() {

    const typing = useChatStore(

        state => state.typing

    );

    const thinking = useChatStore(

        state => state.thinking

    );

    return (

        <div className={styles.appRoot}>

            <DesktopTitleBar />

            <ChatHeader />

            <div className={styles.mainSplit}>

                <CharacterPanel

                    isSpeaking={typing}

                    thinking={thinking}

                />

                <div className={styles.chatPanel}>

                    <ChatMessages />

                    <ChatComposer />

                </div>

            </div>

            <RightDrawer />

        </div>

    );

}