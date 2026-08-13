const BaseCapability = require("./BaseCapability");
const puppeteer = require("puppeteer");

class BrowserCapability extends BaseCapability {
    constructor() {
        super("browser", "Browser Automation and Management");
        this.browser = null;
        this.pages = []; // Tabs
        this.activePageIndex = 0;
        this.history = []; // History
        this.bookmarks = []; // Bookmarks
        this.downloads = []; // Downloads
        this.memoryContext = {}; // Browser Memory
    }

    async ensureBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({ headless: true });
            const initialPage = await this.browser.newPage();
            this.pages.push(initialPage);
        }
    }

    async getActivePage() {
        await this.ensureBrowser();
        if (this.pages.length === 0) {
            const page = await this.browser.newPage();
            this.pages.push(page);
            this.activePageIndex = 0;
        }
        return this.pages[this.activePageIndex];
    }

    async execute(input) {
        return { success: true, message: "Browser capability active" };
    }

    // 1. Browser Automation & Reading
    async navigate(url) {
        const page = await this.getActivePage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        this.history.push(url);
        return { success: true, message: `Navigated to ${url}` };
    }

    async readText() {
        const page = await this.getActivePage();
        const text = await page.evaluate(() => document.body.innerText);
        return { success: true, data: text.substring(0, 5000) };
    }

    // 2. Searching
    async search(query) {
        const page = await this.getActivePage();
        await page.goto(`https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
        this.history.push(`search:${query}`);
        return this.readText();
    }

    // 3. Tabs
    async newTab() {
        await this.ensureBrowser();
        const newPage = await this.browser.newPage();
        this.pages.push(newPage);
        this.activePageIndex = this.pages.length - 1;
        return { success: true, message: `Opened new tab. Total tabs: ${this.pages.length}` };
    }
    
    async switchTab(index) {
        if (index >= 0 && index < this.pages.length) {
            this.activePageIndex = index;
            await this.pages[this.activePageIndex].bringToFront();
            return { success: true, message: `Switched to tab ${index}` };
        }
        return { success: false, message: 'Invalid tab index' };
    }
    
    async closeTab(index) {
        if (index >= 0 && index < this.pages.length) {
            await this.pages[index].close();
            this.pages.splice(index, 1);
            if (this.activePageIndex >= this.pages.length) {
                this.activePageIndex = Math.max(0, this.pages.length - 1);
            }
            return { success: true, message: `Closed tab ${index}` };
        }
        return { success: false, message: 'Invalid tab index' };
    }

    // 4. History & Bookmarks
    async getHistory() {
        return { success: true, data: this.history };
    }
    
    async addBookmark(url) {
        this.bookmarks.push(url);
        return { success: true, message: `Bookmarked ${url}` };
    }
    
    async getBookmarks() {
        return { success: true, data: this.bookmarks };
    }

    // 5. Cookies
    async getCookies() {
        const page = await this.getActivePage();
        const cookies = await page.cookies();
        return { success: true, data: cookies };
    }
    
    async setCookie(cookie) {
        const page = await this.getActivePage();
        await page.setCookie(cookie);
        return { success: true, message: 'Cookie set' };
    }

    // 6. Forms
    async fillForm(selector, value) {
        const page = await this.getActivePage();
        await page.type(selector, value);
        return { success: true, message: `Filled ${selector}` };
    }
    
    async submitForm(selector) {
        const page = await this.getActivePage();
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click(selector)
        ]);
        return { success: true, message: `Form submitted via ${selector}` };
    }

    // 7. Downloads
    async enableDownloads(downloadPath) {
        const page = await this.getActivePage();
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });
        return { success: true, message: `Downloads enabled to ${downloadPath}` };
    }

    // 8. Browser Memory
    async setMemory(key, value) {
        this.memoryContext[key] = value;
        return { success: true, message: 'Memory saved' };
    }
    
    async getMemory(key) {
        return { success: true, data: this.memoryContext[key] };
    }
}

module.exports = new BrowserCapability();
