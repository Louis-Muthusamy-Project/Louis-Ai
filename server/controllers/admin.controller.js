const Kernel = require("../core/Kernel");
const { ROLES } = require("../config/roles");

function userRepository() {
    return Kernel.get("userRepository");
}

/** Strips passwordHash (and anything else sensitive) before it ever reaches a response. */
function toAdminSafeUser(user) {
    if (!user) return null;
    const {
        passwordHash, // never expose
        ...safe
    } = user;
    return safe;
}

/**
 * GET /api/admin/users
 * Super Admin only (enforced by requireSuperAdmin in the route).
 */
async function listUsers(req, res) {
    try {
        const users = await userRepository().list();
        return res.status(200).json({
            success: true,
            users: users.map(toAdminSafeUser)
        });
    } catch (error) {
        console.error("[admin.controller] listUsers failed:", error);
        return res.status(500).json({ success: false, message: "Failed to load users.", code: "INTERNAL_ERROR" });
    }
}

/**
 * PATCH /api/admin/users/:userId/modules
 * Body: { chat?: boolean, character?: boolean, coding?: boolean }
 */
async function updateUserModules(req, res) {
    try {
        const { userId } = req.params;
        const body = req.body || {};

        const features = {};
        for (const key of ["chat", "character", "coding"]) {
            if (typeof body[key] === "boolean") {
                features[key] = body[key];
            }
        }

        if (Object.keys(features).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one of chat/character/coding as a boolean.",
                code: "VALIDATION_ERROR"
            });
        }

        const updated = await userRepository().updateFeatures(userId, features);
        if (!updated) {
            return res.status(404).json({ success: false, message: "User not found.", code: "NOT_FOUND" });
        }

        return res.status(200).json({ success: true, user: toAdminSafeUser(updated) });
    } catch (error) {
        console.error("[admin.controller] updateUserModules failed:", error);
        return res.status(500).json({ success: false, message: "Failed to update modules.", code: "INTERNAL_ERROR" });
    }
}

/**
 * DELETE /api/admin/users/:userId
 * - Super Admin only (route-level)
 * - A Super Admin may never delete their own account through this endpoint
 *   (prevents accidental total lockout / matches Part 1's "prevent a normal
 *   user from deleting themselves" intent applied symmetrically here).
 */
async function deleteUser(req, res) {
    try {
        const { userId } = req.params;

        if (req.user && String(req.user.id) === String(userId)) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account from the admin panel.",
                code: "CANNOT_DELETE_SELF"
            });
        }

        const target = await userRepository().findById(userId);
        if (!target) {
            return res.status(404).json({ success: false, message: "User not found.", code: "NOT_FOUND" });
        }

        // Clean up user-owned data across the modules that key data by
        // ownerId/userId, mirroring the isolation contract those services
        // already enforce (see conversationService/memoryService/
        // codingSessionService/scheduleService). Best-effort: a failure
        // here still lets the account itself be removed, but is logged so
        // it isn't silently swallowed.
        await cleanupUserOwnedData(userId).catch((error) => {
            console.error(`[admin.controller] Cleanup for user ${userId} failed (continuing with account deletion):`, error.message);
        });

        const deleted = await userRepository().deleteById(userId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "User not found.", code: "NOT_FOUND" });
        }

        // Best-effort: drop any pending password-reset record for the user too.
        try {
            const passwordResetRepository = Kernel.get("passwordResetRepository");
            await passwordResetRepository.deleteByUserId(userId);
        } catch (_) { /* non-fatal */ }

        return res.status(200).json({ success: true, message: "User deleted." });
    } catch (error) {
        console.error("[admin.controller] deleteUser failed:", error);
        return res.status(500).json({ success: false, message: "Failed to delete user.", code: "INTERNAL_ERROR" });
    }
}

/**
 * Best-effort deletion of data owned by a deleted user, using each
 * service's existing per-user repository methods where available.
 * Never touches shared/system data - only records keyed to this userId.
 */
async function cleanupUserOwnedData(userId) {
    const tasks = [];

    try {
        const conversationService = Kernel.get("conversationService");
        if (conversationService && typeof conversationService.deleteAllForUser === "function") {
            tasks.push(conversationService.deleteAllForUser(userId));
        }
    } catch (_) { /* service not available */ }

    try {
        const memoryService = Kernel.get("memoryService");
        if (memoryService && typeof memoryService.deleteAllForUser === "function") {
            tasks.push(memoryService.deleteAllForUser(userId));
        }
    } catch (_) { /* service not available */ }

    try {
        const codingSessionService = Kernel.get("codingSessionService");
        if (codingSessionService && typeof codingSessionService.deleteAllForUser === "function") {
            tasks.push(codingSessionService.deleteAllForUser(userId));
        }
    } catch (_) { /* service not available */ }

    try {
        const scheduleService = Kernel.get("scheduleService");
        if (scheduleService && typeof scheduleService.deleteAllForUser === "function") {
            tasks.push(scheduleService.deleteAllForUser(userId));
        }
    } catch (_) { /* service not available */ }

    await Promise.all(tasks);
}

module.exports = { listUsers, updateUserModules, deleteUser };
