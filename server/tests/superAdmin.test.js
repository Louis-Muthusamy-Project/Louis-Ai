const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";
process.env.SUPER_ADMIN_EMAIL = "louismuthusamy5@gmail.com";

const FileUserRepository = require("../infrastructure/FileUserRepository");
const { AuthService } = require("../services/authService");
const { requireFeature, requireSuperAdmin, userHasFeature } = require("../middleware/featureMiddleware");
const { ROLES } = require("../config/roles");

function makeIsolatedAuthService() {
    const repo = new FileUserRepository();
    repo.filePath = path.join(os.tmpdir(), `yuna-test-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    const fakeKernel = { get: (name) => (name === "userRepository" ? repo : undefined) };
    const authService = new AuthService(fakeKernel);
    return { authService, repo };
}

function makeRes() {
    const res = {
        statusCode: null,
        body: null,
        status(code) { res.statusCode = code; return res; },
        json(payload) { res.body = payload; return res; }
    };
    return res;
}

// -------------------------------------------------------------------
// Role assignment (Part 1 / Part 15)
// -------------------------------------------------------------------

test("signup with the exact Super Admin email is assigned role=super_admin", async () => {
    const { authService } = makeIsolatedAuthService();
    const { user } = await authService.signup({
        name: "Louis",
        email: "louismuthusamy5@gmail.com",
        password: "correcthorse123"
    });
    assert.equal(user.role, ROLES.SUPER_ADMIN);
});

test("signup with any other email is assigned role=user, never super_admin", async () => {
    const { authService } = makeIsolatedAuthService();
    const { user } = await authService.signup({
        name: "Someone Else",
        email: "notadmin@example.com",
        password: "correcthorse123"
    });
    assert.equal(user.role, ROLES.USER);
});

test("a client cannot self-promote to super_admin by sending role in the signup body", async () => {
    const { authService } = makeIsolatedAuthService();
    const { user } = await authService.signup({
        name: "Attacker",
        email: "attacker@example.com",
        password: "correcthorse123",
        role: "super_admin" // authService.signup only destructures {name,email,password} - this must be ignored
    });
    assert.equal(user.role, ROLES.USER);
});

test("default features for a brand-new account are all true", async () => {
    const { authService } = makeIsolatedAuthService();
    const { user } = await authService.signup({
        name: "New User",
        email: "newuser@example.com",
        password: "correcthorse123"
    });
    assert.deepEqual(user.features, { chat: true, character: true, coding: true });
});

// -------------------------------------------------------------------
// requireFeature / requireSuperAdmin middleware
// -------------------------------------------------------------------

test("requireFeature blocks a request when the feature is explicitly disabled", () => {
    const req = { user: { id: "u1", role: ROLES.USER, features: { chat: true, character: false, coding: true } } };
    const res = makeRes();
    let nextCalled = false;

    requireFeature("character")(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "FEATURE_DISABLED");
});

test("requireFeature allows a request when the feature is enabled", () => {
    const req = { user: { id: "u1", role: ROLES.USER, features: { chat: true, character: true, coding: true } } };
    const res = makeRes();
    let nextCalled = false;

    requireFeature("chat")(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
});

test("requireFeature never blocks a super_admin, even if the flag is off", () => {
    const req = { user: { id: "admin1", role: ROLES.SUPER_ADMIN, features: { chat: true, character: false, coding: false } } };
    const res = makeRes();
    let nextCalled = false;

    requireFeature("coding")(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
});

test("requireFeature rejects with 401 when there is no authenticated user", () => {
    const req = { user: null };
    const res = makeRes();
    let nextCalled = false;

    requireFeature("chat")(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
});

test("requireSuperAdmin rejects a normal user with 403", () => {
    const req = { user: { id: "u1", role: ROLES.USER } };
    const res = makeRes();
    let nextCalled = false;

    requireSuperAdmin(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "FORBIDDEN");
});

test("requireSuperAdmin allows a super_admin user", () => {
    const req = { user: { id: "admin1", role: ROLES.SUPER_ADMIN } };
    const res = makeRes();
    let nextCalled = false;

    requireSuperAdmin(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
});

test("requireSuperAdmin can never be satisfied by a client-supplied role on req.body - only req.user (server-derived) is checked", () => {
    // Simulates an attacker sending { role: "super_admin" } in the request
    // body: requireSuperAdmin never looks at req.body at all.
    const req = { user: { id: "u1", role: ROLES.USER }, body: { role: "super_admin" } };
    const res = makeRes();
    let nextCalled = false;

    requireSuperAdmin(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});

// -------------------------------------------------------------------
// userHasFeature (Socket.IO gate)
// -------------------------------------------------------------------

test("userHasFeature: disabled feature returns false for a normal user", () => {
    const user = { role: ROLES.USER, features: { chat: false, character: true, coding: true } };
    assert.equal(userHasFeature(user, "chat"), false);
});

test("userHasFeature: super_admin bypasses a disabled flag", () => {
    const user = { role: ROLES.SUPER_ADMIN, features: { chat: false } };
    assert.equal(userHasFeature(user, "chat"), true);
});

test("userHasFeature: no user at all returns false", () => {
    assert.equal(userHasFeature(null, "chat"), false);
});

// -------------------------------------------------------------------
// Feature toggle persistence via the repository (admin panel backing)
// -------------------------------------------------------------------

test("updateFeatures persists a partial toggle and leaves other flags untouched", async () => {
    const { authService, repo } = makeIsolatedAuthService();
    const { user } = await authService.signup({
        name: "Toggle Test",
        email: "toggle@example.com",
        password: "correcthorse123"
    });

    const updated = await repo.updateFeatures(user.id, { character: false, coding: false });

    assert.equal(updated.features.chat, true);
    assert.equal(updated.features.character, false);
    assert.equal(updated.features.coding, false);
});

test("deleteById removes the user so a subsequent login fails", async () => {
    const { authService, repo } = makeIsolatedAuthService();
    const { user } = await authService.signup({
        name: "Delete Test",
        email: "deleteme@example.com",
        password: "correcthorse123"
    });

    const deleted = await repo.deleteById(user.id);
    assert.equal(deleted, true);

    await assert.rejects(
        () => authService.login({ email: "deleteme@example.com", password: "correcthorse123" }),
        (err) => err.code === "INVALID_CREDENTIALS"
    );
});

test("a legacy user record with no role/features field gets safe defaults on read (Part 15 migration)", async () => {
    const { repo } = makeIsolatedAuthService();
    // Simulate a pre-migration record by writing straight through the
    // repository's internal file, bypassing create() (which always sets
    // role/features) - mirrors what an old users.json would contain.
    const fs = require("fs");
    repo._ensureDirExists();
    fs.writeFileSync(repo.filePath, JSON.stringify([
        { id: "legacy-1", name: "Legacy User", email: "legacy@example.com", passwordHash: "x", createdAt: "2020-01-01", updatedAt: "2020-01-01" }
    ], null, 4));

    const found = await repo.findByEmail("legacy@example.com");
    assert.equal(found.role, ROLES.USER);
    assert.deepEqual(found.features, { chat: true, character: true, coding: true });
});
