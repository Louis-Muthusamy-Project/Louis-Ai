class ElectronService {

    get available() {

        return !!window.yuna;

    }

    async invoke(channel, data = {}) {

        if (!this.available) {

            console.warn("Electron API unavailable.");

            return null;

        }

        return window.yuna.invoke(channel, data);

    }

    on(channel, callback) {

        if (!this.available) return;

        window.yuna.on(channel, callback);

    }

    async getSystemInfo() {

        return this.invoke("system:info");

    }

    async minimize() {

        return this.invoke("window:minimize");

    }

    async maximize() {

        return this.invoke("window:maximize");

    }

    async close() {

        return this.invoke("window:close");

    }

}

export default new ElectronService();