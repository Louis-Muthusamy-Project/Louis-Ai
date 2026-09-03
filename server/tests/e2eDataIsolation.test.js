const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "1h";

const Kernel = require("../core/Kernel");
const FileUserRepository = require("../infrastructure/FileUserRepository");
const { AuthService } = require("../services/authService");
const { createApp } = require("../config/server");
const { createSocketServer } = require("../config/socket");

const FileMemoryRepository = require("../infrastructure/FileMemoryRepository");
const { MemoryService } = require("../services/memoryService");
const SettingsFileStore = require("../infrastructure/SettingsFileStore");
const { SettingsService } = require("../services/settingsService");
const ScheduleService = require("../services/scheduleService");

// Real (not mocked) settings/memory/schedule wiring, pointed at isolated
// tmp directories, so this test exercises the actual isolation logic
// rather than a stub.
const memoryRepo = new FileMemoryRepository();
memoryRepo.dataRoot = path.join(os.tmpdir(), `yuna-e2e-mem-${Date.now()}`);

const settingsStore = new SettingsFileStore();
settingsStore.dataRoot = path.join(os.tmpdir(), `yuna-e2e-settings-${Date.now()}`);
settingsStore.legacyPath = path.join(settingsStore.dataRoot, "__no_legacy__.json");

const testUserRepo = new FileUserRepository();
testUserRepo.filePath = path.join(os.tmpdir(), `yuna-test-users-e2e-${Date.now()}.json`);

Kernel.register("userRepository", testUserRepo);
Kernel.register("authService", new AuthService(Kernel));
Kernel.register("memoryRepository", memoryRepo);
Kernel.register("memoryService", new MemoryService(Kernel));
Kernel.register("settingsFileStore", settingsStore);
Kernel.register("settingsService", new SettingsService(Kernel));

let scheduleSvc;

async function withServer(fn) {
    const { app, server } = createApp();
    const io = createSocketServer(server);

    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const baseUrl = `http://localhost:${port}`;

    try {
        await fn({ baseUrl, io });
    } finally {
        io.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

async function signupAndLogin(baseUrl, email) {
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "E2E User", email, password: "correcthorse123" })
    });
    assert.equal(signupRes.status, 201);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "correcthorse123" })
    });
    assert.equal(loginRes.status, 200);
    const { token } = await loginRes.json();

    // The REAL, server-issued identity - never a value the test invents.
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const { user } = await meRes.json();

    return { token, userId: user.id };
}

test("full e2e: two real signed-up users get fully isolated settings, memory, and schedule data", async () => {
    await withServer(async ({ baseUrl }) => {
        const userA = await signupAndLogin(baseUrl, `e2e-a-${Date.now()}@example.com`);
        const userB = await signupAndLogin(baseUrl, `e2e-b-${Date.now()}@example.com`);

        assert.notEqual(userA.userId, userB.userId, "signup must produce distinct real user ids");

        // ── Settings, over real HTTP with real Authorization headers ──
        await fetch(`${baseUrl}/api/settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.token}` },
            body: JSON.stringify({ theme: "dark", favoriteColor: "violet" })
        });
        await fetch(`${baseUrl}/api/settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${userB.token}` },
            body: JSON.stringify({ theme: "light", favoriteColor: "blue" })
        });

        const settingsA = await (await fetch(`${baseUrl}/api/settings`, {
            headers: { Authorization: `Bearer ${userA.token}` }
        })).json();
        const settingsB = await (await fetch(`${baseUrl}/api/settings`, {
            headers: { Authorization: `Bearer ${userB.token}` }
        })).json();

        assert.equal(settingsA.settings.theme, "dark");
        assert.equal(settingsB.settings.theme, "light");
        assert.notEqual(settingsA.settings.favoriteColor, settingsB.settings.favoriteColor);

        // ── Memory, via the real MemoryService keyed on the real JWT-derived id ──
        const memSvc = Kernel.get("memoryService");
        Object.defineProperty(memSvc, "providerManager", { get: () => ({ embed: async () => [1, 0], generate: async () => "5" }) });

        await memSvc.saveLongTermMemory(userA.userId, "User A's private fact", "general", 5);
        await memSvc.saveLongTermMemory(userB.userId, "User B's private fact", "general", 5);

        const memA = await memSvc.repository.readMemories(userA.userId);
        const memB = await memSvc.repository.readMemories(userB.userId);
        assert.equal(memA.length, 1);
        assert.equal(memB.length, 1);
        assert.equal(memA[0].text, "User A's private fact");
        assert.equal(memB[0].text, "User B's private fact");

        // ── Schedules, via the real ScheduleService keyed on the real id ──
        if (!scheduleSvc) {
            scheduleSvc = new ScheduleService({ get: (n) => (n === "eventBus" ? new (require("events").EventEmitter)() : null) });
            scheduleSvc.dataRoot = path.join(os.tmpdir(), `yuna-e2e-schedule-${Date.now()}`);
            scheduleSvc.legacyPath = path.join(scheduleSvc.dataRoot, "__no_legacy__.json");
            await scheduleSvc.initialize();
        }

        const idA = await scheduleSvc.addReminder(userA.userId, new Date(Date.now() + 3600_000).toISOString(), "A's reminder");
        const idB = await scheduleSvc.addReminder(userB.userId, new Date(Date.now() + 3600_000).toISOString(), "B's reminder");

        const tasksA = scheduleSvc.listTasks(userA.userId);
        const tasksB = scheduleSvc.listTasks(userB.userId);
        assert.ok(tasksA[idA]);
        assert.ok(!tasksA[idB], "user A must not see user B's schedule");
        assert.ok(tasksB[idB]);
        assert.ok(!tasksB[idA], "user B must not see user A's schedule");

        // User B attempting to cancel user A's task id must be a silent no-op.
        await scheduleSvc.cancelTask(userB.userId, idA);
        assert.ok(scheduleSvc.listTasks(userA.userId)[idA], "cross-user cancel must not succeed");

        // Cleanup pending timers so the test process can exit promptly.
        await scheduleSvc.cancelTask(userA.userId, idA);
        await scheduleSvc.cancelTask(userB.userId, idB);
    });
});
