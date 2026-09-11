/**
 * ==========================================
 * Roles / Feature-flags constants
 * ------------------------------------------
 * Single source of truth so authService, the user
 * repositories, and any migration code all agree on:
 *   - which exact email is the Super Admin
 *   - what a brand-new account's feature flags look like
 *
 * The Super Admin email is intentionally NOT something a
 * client can influence - it is only ever compared against
 * the normalized email already stored server-side.
 * ==========================================
 */

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "louismuthusamy5@gmail.com")
    .trim()
    .toLowerCase();

const DEFAULT_FEATURES = Object.freeze({
    chat: true,
    character: true,
    coding: true
});

const ROLES = Object.freeze({
    USER: "user",
    SUPER_ADMIN: "super_admin"
});

/** @param {string} normalizedEmail already-lowercased/trimmed email */
function roleForEmail(normalizedEmail) {
    return normalizedEmail === SUPER_ADMIN_EMAIL ? ROLES.SUPER_ADMIN : ROLES.USER;
}

module.exports = {
    SUPER_ADMIN_EMAIL,
    DEFAULT_FEATURES,
    ROLES,
    roleForEmail
};
