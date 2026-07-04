class YunaEngine {

    constructor() {

        this.state = "idle";

        this.listeners = {};

    }

    getState() {

        return this.state;

    }

    setState(state) {

        this.state = state;

        this.emit("state", state);

    }

    on(event, callback) {

        if (!this.listeners[event]) {

            this.listeners[event] = [];

        }

        this.listeners[event].push(callback);

    }

    off(event, callback) {

        if (!this.listeners[event]) return;

        this.listeners[event] = this.listeners[event].filter(

            item => item !== callback

        );

    }

    emit(event, data) {

        if (!this.listeners[event]) return;

        this.listeners[event].forEach(callback => {

            callback(data);

        });

    }

}

const engine = new YunaEngine();

export default engine;