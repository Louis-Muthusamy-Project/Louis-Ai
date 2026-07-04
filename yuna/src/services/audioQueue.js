class AudioQueue {

    constructor() {

        this.queue = [];

        this.playing = false;

        this.audio = new Audio();

        this.audio.onended = () => {

            this.playing = false;

            this.playNext();

        };

    }

    add(url) {

        this.queue.push(url);

        this.playNext();

    }

    async playNext() {

        if (this.playing) return;

        if (!this.queue.length) return;

        this.playing = true;

        const url = this.queue.shift();

        this.audio.src = url;

        try {

            await this.audio.play();

        }

        catch (e) {

            console.error(e);

            this.playing = false;

            this.playNext();

        }

    }

    stop() {

        this.audio.pause();

        this.audio.currentTime = 0;

        this.queue = [];

        this.playing = false;

    }

    isPlaying() {

        return this.playing;

    }

}

export default new AudioQueue();