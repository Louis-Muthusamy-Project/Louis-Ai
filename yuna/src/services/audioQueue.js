class AudioQueue {
    constructor() {
        this.queue = [];
        this.playing = false;
        this.audio = new Audio();
        this.audio.crossOrigin = "anonymous";

        // Web Audio API setup (lazy initialized on first user gesture / audio play)
        this.audioCtx = null;
        this.analyser = null;
        this.sourceNode = null;
        this.listeners = new Set();

        this.audio.onended = () => {
            this.playing = false;
            this._notifyState(false);
            this.playNext();
        };

        this.audio.onplay = () => {
            this.playing = true;
            this._notifyState(true);
        };

        // Previously missing entirely - a decode/playback failure mid-track
        // (e.g. malformed base64 audio data) left `playing` stuck true
        // forever and stalled the whole queue. Treat it like `ended`: clear
        // state and move on to the next queued track.
        this.audio.onerror = () => {
            console.warn("[AudioQueue] Playback error - skipping this track.", this.audio.error);
            this.playing = false;
            this._notifyState(false);
            this.playNext();
        };
    }

    _initAudioContext() {
        if (!this.audioCtx && typeof window !== "undefined") {
            try {
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                if (AudioCtxClass) {
                    this.audioCtx = new AudioCtxClass();
                    this.analyser = this.audioCtx.createAnalyser();
                    this.analyser.fftSize = 256;
                    this.analyser.smoothingTimeConstant = 0.4;
                    this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
                    this.sourceNode.connect(this.analyser);
                    this.analyser.connect(this.audioCtx.destination);
                }
            } catch (err) {
                console.warn("[AudioQueue] Web Audio API init note:", err.message);
            }
        }
        if (this.audioCtx && this.audioCtx.state === "suspended") {
            this.audioCtx.resume().catch(() => {});
        }
    }

    getAnalyserNode() {
        if (!this.analyser) {
            this._initAudioContext();
        }
        return this.analyser;
    }

    onStateChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _notifyState(isPlaying) {
        this.listeners.forEach((cb) => {
            try {
                cb(isPlaying);
            } catch (e) {
                console.error(e);
            }
        });
    }

    add(url) {
        this.queue.push(url);
        this.playNext();
    }

    async playNext() {
        if (this.playing) return;
        if (!this.queue.length) return;

        this._initAudioContext();
        this.playing = true;
        const url = this.queue.shift();
        this.audio.src = url;

        try {
            await this.audio.play();
        } catch (e) {
            console.error("[AudioQueue] Playback failed:", e);
            this.playing = false;
            this._notifyState(false);
            this.playNext();
        }
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        // Release whatever the element was holding (previously left the
        // last track's src in place after stop(), keeping it decoded/
        // buffered). No object URLs are used here (audio is delivered as
        // base64 data: URIs, not Blob/createObjectURL), so there's nothing
        // to revoke - clearing src is the equivalent cleanup for this case.
        this.audio.removeAttribute("src");
        this.audio.load();
        this.queue = [];
        this.playing = false;
        this._notifyState(false);
    }

    isPlaying() {
        return this.playing;
    }
}

export default new AudioQueue();