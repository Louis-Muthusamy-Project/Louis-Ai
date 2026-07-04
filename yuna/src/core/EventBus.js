class EventBus {

    constructor() {

        this.events = {};

    }

    on(name, callback) {

        if (!this.events[name]) {

            this.events[name] = [];

        }

        this.events[name].push(callback);

    }

    off(name, callback) {

        if (!this.events[name]) return;

        this.events[name] = this.events[name].filter(

            fn => fn !== callback

        );

    }

    emit(name, payload) {

        if (!this.events[name]) return;

        this.events[name].forEach(fn => fn(payload));

    }

    once(name, callback) {

        const wrapper = (payload) => {

            callback(payload);

            this.off(name, wrapper);

        };

        this.on(name, wrapper);

    }

}

export default new EventBus();