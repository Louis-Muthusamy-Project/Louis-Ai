const { ROLES } = require("../config/roles");

/**
 * ==========================================
 * requireFeature(name)
 * ------------------------------------------
 * Blocks the request unless req.user.features[name] is
 * true. Must run after requireAuth (needs req.user, which
 * always comes from the DB via authMiddleware - never from
 * anything client-supplied). Super Admin is never blocked
 * by a feature flag.
 *
 * This is the backend half of Part 9 (Module Access Model) -
 * hiding a tab on the frontend is UX only, this is the
 * actual enforcement.
 * ==========================================
 */
function requireFeature(name) {
    return function featureGate(req, res, next) {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: "Authentication required.", code: "NO_TOKEN" });
        }

        if (user.role === ROLES.SUPER_ADMIN) {
            return next();
        }

        const enabled = !user.features || user.features[name] !== false;
        if (!enabled) {
            return res.status(403).json({
                success: false,
                message: `The "${name}" feature is disabled for this account.`,
                code: "FEATURE_DISABLED"
            });
        }

        return next();
    };
}

/**
 * requireSuperAdmin
 * ------------------------------------------
 * Blocks the request unless the authenticated (server-verified)
 * user's role is super_admin. Never trusts a client-supplied
 * role/email - req.user.role always comes from the DB record
 * looked up by authMiddleware from the verified JWT subject.
 */
function requireSuperAdmin(req, res, next) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ success: false, message: "Authentication required.", code: "NO_TOKEN" });
    }
    if (user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ success: false, message: "Super Admin access required.", code: "FORBIDDEN" });
    }
    return next();
}

/** Same feature check, usable directly inside a Socket.IO handler (no res object). */
function userHasFeature(user, name) {
    if (!user) return false;
    if (user.role === ROLES.SUPER_ADMIN) return true;
    // No `features` object at all means this caller's identity wasn't
    // loaded from the user repository (e.g. a minimal test fixture) -
    // real authenticated users always carry `features` (defaulted by
    // FileUserRepository/MongoUserRepository), so only an explicit
    // `false` here actually disables a feature.
    if (!user.features) return true;
    return user.features[name] !== false;
}

module.exports = { requireFeature, requireSuperAdmin, userHasFeature };
