import React from "react";

import ChatHeader from "../../components/Chat/ChatHeader";
import ChatMessages from "../../components/Chat/ChatMessages";
import ChatComposer from "../../components/Chat/ChatComposer";

import CharacterPanel from "../../components/CharacterPanel/CharacterPanel";

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

        </div>

    );

}