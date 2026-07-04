import { useEffect } from "react";

import SocketService from "../services/socketService";
import CharacterStateMachine from "../core/CharacterStateMachine";
import useChatStore from "../store/chatStore";

export default function ChatProvider({ children }) {
    
    CharacterStateMachine.idle();

    useEffect(() => {

        const store = useChatStore.getState();

        SocketService.connect();

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

            useChatStore.getState().setEmotion(reply.emotion);

            CharacterStateMachine.emotion(reply.emotion);

        };

        const onError = (err) => {

            console.error(err);

            useChatStore.getState().setThinking(false);

            useChatStore.getState().setTyping(false);

            CharacterStateMachine.idle();

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

        };

    }, []);

    return children;

}