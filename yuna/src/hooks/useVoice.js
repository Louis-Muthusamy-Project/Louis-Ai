import useChatStore from "../store/chatStore";

export default function useVoice() {

    return {

        speaking:

            useChatStore(

                s => s.voiceState === "speaking"

            )

    };

}