class MicrophoneService {

    constructor() {

        this.stream = null;

        this.recorder = null;

        this.chunks = [];

    }

    async start() {

        this.stream = await navigator.mediaDevices.getUserMedia({

            audio: true

        });

        this.chunks = [];

        this.recorder = new MediaRecorder(this.stream);

        this.recorder.ondataavailable = e => {

            if (e.data.size > 0) {

                this.chunks.push(e.data);

            }

        };

        this.recorder.start();

    }

    async stop() {

        return new Promise(resolve => {

            this.recorder.onstop = () => {

                const blob = new Blob(

                    this.chunks,

                    {

                        type: "audio/webm"

                    }

                );

                this.stream

                    ?.getTracks()

                    .forEach(track => track.stop());

                resolve(blob);

            };

            this.recorder.stop();

        });

    }

}

export default new MicrophoneService();