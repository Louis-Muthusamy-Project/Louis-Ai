class PermissionService {
    constructor() {
        // In a real app, this would load from settings db.
        // For now, we will default to globally allowing basic os scopes.
        this.scopes = {
            clipboard: true,
            notifications: true,
            files: true,
            system_control: true, // volume, brightness, power
            process: true // app launching
        };
    }

    /**
     * Checks if a specific automation scope is allowed.
     * @param {string} scope - The permission scope to check.
     * @returns {boolean}
     */
    check(scope) {
        if (this.scopes[scope] === undefined) {
            console.warn(`[PermissionService] Unknown scope checked: ${scope}`);
            return false;
        }
        return this.scopes[scope] === true;
    }

    /**
     * Updates permission scopes (e.g., from user settings).
     * @param {Object} newScopes 
     */
    updateScopes(newScopes) {
        this.scopes = { ...this.scopes, ...newScopes };
    }
}

module.exports = new PermissionService();
