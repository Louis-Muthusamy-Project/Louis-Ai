import useChatStore from "../store/chatStore";

export function useMessages() {

    return useChatStore(state => state.messages);

}

export function useThinking() {

    return useChatStore(state => state.thinking);

}

export function useTyping() {

    return useChatStore(state => state.typing);

}

export function useChat() {

    return useChatStore();

}