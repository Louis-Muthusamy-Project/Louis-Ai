const BaseTool = require("../BaseTool");
const browserCapability = require("../../capabilities/BrowserCapability");

class BrowserTool extends BaseTool {
    constructor() {
        super(
            "browser",
            "Controls the browser agent. Actions include: navigate, readText, search, newTab, switchTab, closeTab, getHistory, addBookmark, getBookmarks, getCookies, setCookie, fillForm, submitForm, enableDownloads, setMemory, getMemory."
        );
    }

    async execute(args) {
        const { action, params = {} } = args;

        try {
            switch (action) {
                case "navigate":
                    return await browserCapability.navigate(params.url);
                case "readText":
                    return await browserCapability.readText();
                case "search":
                    return await browserCapability.search(params.query);
                case "newTab":
                    return await browserCapability.newTab();
                case "switchTab":
                    return await browserCapability.switchTab(params.index);
                case "closeTab":
                    return await browserCapability.closeTab(params.index);
                case "getHistory":
                    return await browserCapability.getHistory();
                case "addBookmark":
                    return await browserCapability.addBookmark(params.url);
                case "getBookmarks":
                    return await browserCapability.getBookmarks();
                case "getCookies":
                    return await browserCapability.getCookies();
                case "setCookie":
                    return await browserCapability.setCookie(params.cookie);
                case "fillForm":
                    return await browserCapability.fillForm(params.selector, params.value);
                case "submitForm":
                    return await browserCapability.submitForm(params.selector);
                case "enableDownloads":
                    return await browserCapability.enableDownloads(params.downloadPath);
                case "setMemory":
                    return await browserCapability.setMemory(params.key, params.value);
                case "getMemory":
                    return await browserCapability.getMemory(params.key);
                default:
                    return { success: false, message: `Unknown browser action: ${action}` };
            }
        } catch (error) {
            return { success: false, message: `Browser action failed: ${error.message}` };
        }
    }
}

module.exports = new BrowserTool();
