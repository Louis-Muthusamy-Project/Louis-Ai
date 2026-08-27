import { Navigate } from "react-router-dom";

import useAuthStore from "../../store/authStore";
import ChatProvider from "../../providers/ChatProvider";

/**
 * ==========================================
 * ProtectedRoute
 * ------------------------------------------
 * Guards the authenticated part of the app. ChatProvider (and
 * therefore the Socket.IO connection) is mounted HERE, nested
 * inside the auth check, so a socket connection is never
 * attempted before we know a valid token exists - see Phase 4/9
 * of the implementation report.
 *
 * Assumes AppInitializer (see App.jsx) has already resolved
 * restoreSession() before this ever renders - it does not
 * re-check `initialized` itself.
 * ==========================================
 */
export default function ProtectedRoute({ children }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <ChatProvider>{children}</ChatProvider>;
}
