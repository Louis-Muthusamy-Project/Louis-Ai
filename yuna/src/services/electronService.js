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

    // --- Wake word / popup -------------------------------------------

    async getWakeSettings() {
        return this.invoke("wake:settings:get");
    }

    async setWakeEnabled(enabled) {
        return this.invoke("wake:settings:set", { enabled });
    }

    async reportWakeListenerStatus(status) {
        return this.invoke("wake:listener:status", status);
    }

    async requestWakePopup(payload) {
        return this.invoke("wake:popup:show", payload);
    }

    async signalWakePopupReady() {
        return this.invoke("wake:popup:ready");
    }

    async hideWakePopup() {
        return this.invoke("wake:popup:hide");
    }

    onWakePopupInit(callback) {
        this.on("wake:popup:init", callback);
    }

    onWakeStatusUpdate(callback) {
        this.on("wake:status:update", callback);
    }

    onWakeSettingsChanged(callback) {
        this.on("wake:settings:changed", callback);
    }

    /**
     * Tells the hidden wake-listener window to pause (busy=true) or
     * resume (busy=false) its own continuous SpeechRecognition session -
     * call this around any manual mic use in the main window (Chat/
     * Character voice input, the Coding Agent panel's mic). Safe/no-op
     * outside Electron (this.available guards it, same as every other
     * method here) - a browser-only dev session simply has no wake
     * listener to pause in the first place.
     */
    async setWakeMicBusy(busy) {
        return this.invoke("wake:mic:busy", { busy });
    }

    onWakeMicBusyChanged(callback) {
        this.on("wake:mic:busy:changed", callback);
    }

}

export default new ElectronService();