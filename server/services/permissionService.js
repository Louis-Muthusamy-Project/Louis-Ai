const Kernel = require('../core/Kernel');

class PermissionService {
    constructor() {
        this.scopes = {
            clipboard: true,
            notifications: true,
            files: true,
            system_control: true,
            process: true
        };
        this.pendingRequests = new Map();
    }

    get eventBus() {
        return Kernel.get('eventBus');
    }

    /**
     * Initializes listener for permission responses.
     */
    initialize() {
        this.eventBus.on('permission.granted', (payload) => {
            const req = this.pendingRequests.get(payload.requestId);
            if (req) {
                this.pendingRequests.delete(payload.requestId);
                req.resolve(true);
            }
        });

        this.eventBus.on('permission.denied', (payload) => {
            const req = this.pendingRequests.get(payload.requestId);
            if (req) {
                this.pendingRequests.delete(payload.requestId);
                req.resolve(false);
            }
        });
    }

    check(scope) {
        if (this.scopes[scope] === undefined) {
            console.warn(`[PermissionService] Unknown scope checked: ${scope}`);
            return false;
        }
        return this.scopes[scope] === true;
    }

    /**
     * Requests permission from the user for a high-risk operation.
     */
    async requestPermission(socketId, capabilityId, riskLevel, details) {
        if (riskLevel === 'low') return true;

        const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        console.log(`[PermissionService] Requesting permission for ${capabilityId} (Risk: ${riskLevel})`);
        
        this.eventBus.emit('permission.requested', {
            socketId,
            requestId,
            capabilityId,
            riskLevel,
            details
        });

        return new Promise((resolve) => {
            this.pendingRequests.set(requestId, { resolve });

            // 60-second timeout for permission
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    console.warn(`[PermissionService] Permission request ${requestId} timed out.`);
                    resolve(false); // Deny on timeout
                }
            }, 60000);
        });
    }

    updateScopes(newScopes) {
        this.scopes = { ...this.scopes, ...newScopes };
    }
}

module.exports = new PermissionService();
