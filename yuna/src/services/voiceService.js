import AudioQueue from "./audioQueue";

class VoiceService {

    async speak(audioUrl) {

        AudioQueue.add(audioUrl);

    }

    stop() {

        AudioQueue.stop();

    }

}

export default new VoiceService();