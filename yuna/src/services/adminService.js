import apiClient from "./apiClient";

/**
 * ==========================================
 * adminService (frontend)
 * ------------------------------------------
 * Thin wrapper around /api/admin/*. Every call requires the
 * caller's JWT to belong to a super_admin account - apiClient's
 * interceptor already attaches the token; the backend
 * (requireSuperAdmin) is what actually enforces the role, this
 * file has no authorization logic of its own.
 * ==========================================
 */

function normalizeError(error) {
    if (error.response && error.response.data) {
        return error.response.data;
    }
    return {
        success: false,
        message: "Could not reach the server. Please check your connection.",
        code: "NETWORK_ERROR"
    };
}

async function listUsers() {
    try {
        const { data } = await apiClient.get("/admin/users");
        return data; // { success, users }
    } catch (error) {
        throw normalizeError(error);
    }
}

async function updateUserModules(userId, features) {
    try {
        const { data } = await apiClient.patch(`/admin/users/${userId}/modules`, features);
        return data; // { success, user }
    } catch (error) {
        throw normalizeError(error);
    }
}

async function deleteUser(userId) {
    try {
        const { data } = await apiClient.delete(`/admin/users/${userId}`);
        return data; // { success, message }
    } catch (error) {
        throw normalizeError(error);
    }
}

export default { listUsers, updateUserModules, deleteUser };
