import { Navigate } from "react-router-dom";

import useAuthStore from "../../store/authStore";

/**
 * Inverse of ProtectedRoute - keeps an already-logged-in user from
 * landing back on /login or /signup (e.g. via browser back button).
 */
export default function PublicOnlyRoute({ children }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (isAuthenticated) {
        return <Navigate to="/chat" replace />;
    }

    return children;
}
