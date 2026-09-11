import { Navigate } from "react-router-dom";

import useAuthStore from "../../store/authStore";

/**
 * ==========================================
 * SuperAdminRoute
 * ------------------------------------------
 * Nested inside ProtectedRoute (already-authenticated app). Only
 * checks user.role - which only ever came from the server (see
 * server/services/authService.js) - never anything client-set.
 * This is convenience/UX only: every /api/admin/* call the
 * rendered page makes is independently re-checked by
 * requireSuperAdmin server-side, so even a tampered frontend
 * build gains nothing by rendering this page anyway.
 * ==========================================
 */
export default function SuperAdminRoute({ children }) {
    const user = useAuthStore((state) => state.user);

    if (!user || user.role !== "super_admin") {
        return <Navigate to="/chat" replace />;
    }

    return children;
}
