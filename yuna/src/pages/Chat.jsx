import { useState } from "react";
import { useChat } from "../hooks/useChat";
import { useEmotionStore } from "../store/emotionStore";


const emotion = useEmotionStore((s) => s.emotion);
export default function Chat() {
    const { messages, sendMessage, isTyping } = useChat();
    const [input, setInput] = useState("");

    const handleSend = () => {
        sendMessage(input);
        setInput("");
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Yuna Chat 💜</h2>

            <div
                style={{
                    height: "400px",
                    overflowY: "auto",
                    border: "1px solid #ccc",
                    padding: "10px",
                }}
            >
                {messages.map((msg, index) => (
                    <div key={index}>
                        <b>{msg.role === "user" ? "You" : "Yuna"}:</b> {msg.text}
                    </div>
                ))}

                {/* 💜 Typing indicator */}
                {isTyping && (
                    <div style={{ color: "purple", marginTop: "10px" }}>
                        Yuna is thinking...
                    </div>
                )}

                <div style={{ marginTop: "10px" }}>
                    <b>Yuna Emotion:</b> {emotion}
                </div>
            </div>

            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type message..."
            />

            <button onClick={handleSend}>Send</button>
        </div>
    );
}