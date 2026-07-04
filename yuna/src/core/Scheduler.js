class Scheduler {

    constructor() {

        this.tasks = new Map();

    }

    every(name, callback, ms) {

        this.stop(name);

        const id = setInterval(callback, ms);

        this.tasks.set(name, id);

    }

    after(name, callback, ms) {

        this.stop(name);

        const id = setTimeout(() => {

            callback();

            this.tasks.delete(name);

        }, ms);

        this.tasks.set(name, id);

    }

    stop(name) {

        const id = this.tasks.get(name);

        if (!id) return;

        clearInterval(id);

        clearTimeout(id);

        this.tasks.delete(name);

    }

    clear() {

        this.tasks.forEach(id => {

            clearInterval(id);

            clearTimeout(id);

        });

        this.tasks.clear();

    }

}

export default new Scheduler();