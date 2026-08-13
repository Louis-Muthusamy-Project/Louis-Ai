import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

class CameraService {
    constructor() {
        this.stream = null;
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.faceLandmarker = null;
        this.isTracking = false;
        this.trackingInterval = null;
        
        this.onFaceDetected = null; // Callback for face data
    }

    async init() {
        if (!this.faceLandmarker) {
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
        }
    }

    async startCamera(deviceId = null) {
        try {
            const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : true,
                audio: false
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            return new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve(true);
                };
            });
        } catch (e) {
            console.error("Failed to start camera:", e);
            throw e;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.stopTracking();
    }

    async startTracking(callback) {
        if (!this.faceLandmarker) await this.init();
        if (!this.stream) await this.startCamera();
        
        this.onFaceDetected = callback;
        this.isTracking = true;
        
        let lastVideoTime = -1;
        const track = () => {
            if (!this.isTracking) return;
            
            if (this.videoElement.currentTime !== lastVideoTime) {
                lastVideoTime = this.videoElement.currentTime;
                const results = this.faceLandmarker.detectForVideo(this.videoElement, performance.now());
                if (this.onFaceDetected && results.faceBlendshapes.length > 0) {
                    this.onFaceDetected(results);
                }
            }
            requestAnimationFrame(track);
        };
        track();
    }

    stopTracking() {
        this.isTracking = false;
        this.onFaceDetected = null;
    }

    // Returns a base64 jpeg of the current frame
    captureFrame() {
        if (!this.stream) return null;
        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    }
}

export default new CameraService();
