/**
 * ==========================================
 * ID Sanitizer
 * ------------------------------------------
 * Used anywhere a user id is turned into a filesystem
 * path segment (per-user memory/profile files). Never
 * pass raw user input (e.g. email) directly into a path -
 * always go through this first.
 * ==========================================
 */

const FALLBACK_ID = "unscoped";

/**
 * Reduces an id to a safe [a-zA-Z0-9_-] token, bounded in length.
 * Mongo ObjectIds and our own generated file-mode ids already match
 * this shape, so this is a no-op for the normal case and a hard
 * safety net against path traversal for anything unexpected.
 */
function sanitizeUserId(id) {
    if (id === undefined || id === null) return FALLBACK_ID;

    const str = String(id).trim();
    if (!str) return FALLBACK_ID;

    const cleaned = str.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!cleaned) return FALLBACK_ID;

    return cleaned.slice(0, 128);
}

module.exports = { sanitizeUserId, FALLBACK_ID };
