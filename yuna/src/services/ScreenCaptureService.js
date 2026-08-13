class ScreenCaptureService {
    constructor() {
        this.isCapturing = false;
        this.captureInterval = null;
    }

    async getSources() {
        if (!window.yuna) {
            console.warn("Electron IPC (window.yuna) is not available.");
            return [];
        }
        return await window.yuna.invoke("system:getSources", { types: ["window", "screen"] });
    }

    async captureStream(sourceId) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                }
            });
            return stream;
        } catch (e) {
            console.error("Error capturing screen:", e);
            throw e;
        }
    }

    async captureImageFromStream(stream) {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
                stream.getTracks().forEach(track => track.stop());
            };
        });
    }

    async captureScreenThumbnail(sourceId) {
        // Quick thumbnail using getSources if we just want a fast snapshot
        const sources = await this.getSources();
        const source = sources.find(s => s.id === sourceId);
        return source ? source.thumbnail : null;
    }
}

export default new ScreenCaptureService();
