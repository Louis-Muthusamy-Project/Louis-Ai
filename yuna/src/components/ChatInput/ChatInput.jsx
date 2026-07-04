import { useState } from "react";

import SocketService from "../../services/socketService";
import useChatStore from "../../store/chatStore";

export default function ChatInput() {

    const [text, setText] = useState("");

    const thinking = useChatStore(
        state => state.thinking
    );

    const typing = useChatStore(
        state => state.typing
    );

    const addMessage = useChatStore(
        state => state.addMessage
    );

    const send = () => {

        const value = text.trim();

        if (!value) return;

        if (thinking || typing) return;

        if (!SocketService.isConnected()) {

            console.warn("Socket disconnected");

            return;

        }

        const id = crypto.randomUUID();

        addMessage({

            id,

            role: "user",

            text: value,

            createdAt: new Date().toISOString()

        });

        SocketService.emit(

            "yuna:message:send",

            {

                id,

                text: value

            }

        );

        setText("");

    };

    const handleKeyDown = e => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            send();

        }

    };

    return (

        <div className="chat-input">

            <textarea

                value={text}

                placeholder={

                    thinking

                        ? "Yuna is thinking..."

                        : typing

                            ? "Yuna is replying..."

                            : "Talk with Yuna..."

                }

                onChange={e => setText(e.target.value)}

                onKeyDown={handleKeyDown}

            />

            <button

                onClick={send}

                disabled={thinking || typing}

            >

                Send

            </button>

        </div>

    );

}