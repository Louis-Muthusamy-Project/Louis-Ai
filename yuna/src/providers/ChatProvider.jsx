import { useEffect } from "react";
import { App as AntApp } from "antd";

import SocketService from "../services/socketService";
import VoiceService from "../services/voiceService";
import CharacterStateMachine from "../core/CharacterStateMachine";
import EmotionEngine from "../core/EmotionEngine";
import useChatStore from "../store/chatStore";
import useAuthStore from "../store/authStore";

export default function ChatProvider({ children }) {

    const { message } = AntApp.useApp();
    const token = useAuthStore((state) => state.token);

    useEffect(() => {

        if (!token) return undefined;

        CharacterStateMachine.idle();

        SocketService.connect(token);

        // Initialize cognitive emotion engine (subscribes to yuna:emotion:update)
        EmotionEngine.init();

        const onConnect = () => {

            useChatStore.setState({
                connected: true
            });

        };

        const onDisconnect = () => {

            useChatStore.setState({
                connected: false
            });

            CharacterStateMachine.idle();

            VoiceService.stop();

        };

        const onThinkingStart = () => {

            useChatStore.getState().setThinking(true);

            CharacterStateMachine.thinking();

        };

        const onThinkingEnd = () => {

            useChatStore.getState().setThinking(false);

            CharacterStateMachine.idle();

        };

        const onStreamStart = () => {

            useChatStore.getState().setTyping(true);

            useChatStore.getState().setStreamingText("");

            CharacterStateMachine.talking();

        };

        const onStreamChunk = (data) => {

            if (typeof data === "string") {

                useChatStore.getState().setStreamingText(data);

                return;

            }

            const text =
                data.fullText ??
                data.text ??
                "";

            useChatStore
                .getState()
                .setStreamingText(text);

        };

        const onStreamEnd = () => {

            useChatStore.getState().setTyping(false);

            useChatStore.getState().setStreamingText("");

        };

        const onReply = (reply) => {

            const chat = useChatStore.getState();

            chat.setTyping(false);

            chat.setStreamingText("");

            chat.addMessage(reply);

            chat.setEmotion(reply.emotion);

            CharacterStateMachine.emotion(reply.emotion);

        };

        const onError = (err) => {

            console.error(err);

            useChatStore.getState().setThinking(false);

            useChatStore.getState().setTyping(false);

            CharacterStateMachine.idle();

            message.error("Yuna couldn't complete that request. Please try again.");

        };

        // data.audio is a playable "data:audio/mpeg;base64,..." URI generated
        // fully in-memory on the backend (see EdgeTTSProvider/voiceService) -
        // no server temp files, no extra fetch needed. AudioQueue (behind
        // VoiceService) already drives Live2D speaking/lip-sync from this.
        const onVoiceAudio = (data) => {

            if (!data || !data.audio) return;

            VoiceService.speak(data.audio);

        };

        const onVoiceError = (err) => {

            console.warn("[ChatProvider] Voice synthesis failed:", err && err.error);

        };

        // Correlates by "the currently-loading image message", since
        // ImageGenerationCapability only allows one in-flight generation
        // per user at a time (see server-side duplicate-request guard) -
        // there's at most one candidate to update.
        const findLoadingImageMessageId = () => {
            const messages = useChatStore.getState().messages;
            const found = [...messages].reverse().find(m => m.image && m.image.status === "loading");
            return found ? found.id : null;
        };

        const onImageResult = (data) => {
            const id = findLoadingImageMessageId();
            if (!id) return;
            useChatStore.getState().updateMessage(id, {
                image: { status: "done", data: data.data, mimeType: data.mimeType, prompt: data.prompt }
            });
        };

        const onImageError = (data) => {
            const id = findLoadingImageMessageId();
            if (!id) {
                message.error(data?.message || "Image generation failed.");
                return;
            }
            useChatStore.getState().updateMessage(id, {
                image: { status: "error", prompt: data?.prompt, error: data?.message }
            });
        };

        SocketService.on("connect", onConnect);

        SocketService.on("disconnect", onDisconnect);

        SocketService.on("yuna:thinking:start", onThinkingStart);

        SocketService.on("yuna:thinking:end", onThinkingEnd);

        SocketService.on("yuna:stream:start", onStreamStart);

        SocketService.on("yuna:stream:chunk", onStreamChunk);

        SocketService.on("yuna:stream:end", onStreamEnd);

        SocketService.on("yuna:message:reply", onReply);

        SocketService.on("yuna:message:error", onError);

        SocketService.on("yuna:voice:chunk", onVoiceAudio);

        SocketService.on("yuna:voice:error", onVoiceError);

        SocketService.on("yuna:image:result", onImageResult);

        SocketService.on("yuna:image:error", onImageError);

        return () => {

            SocketService.off("connect", onConnect);

            SocketService.off("disconnect", onDisconnect);

            SocketService.off("yuna:thinking:start", onThinkingStart);

            SocketService.off("yuna:thinking:end", onThinkingEnd);

            SocketService.off("yuna:stream:start", onStreamStart);

            SocketService.off("yuna:stream:chunk", onStreamChunk);

            SocketService.off("yuna:stream:end", onStreamEnd);

            SocketService.off("yuna:message:reply", onReply);

            SocketService.off("yuna:message:error", onError);

            SocketService.off("yuna:voice:chunk", onVoiceAudio);

            SocketService.off("yuna:voice:error", onVoiceError);

            SocketService.off("yuna:image:result", onImageResult);

            SocketService.off("yuna:image:error", onImageError);

        };

    }, [message, token]);

    return children;

}