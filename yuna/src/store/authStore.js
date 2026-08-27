import { create } from "zustand";

import authService from "../services/authService";
import { registerTokenGetter } from "../services/apiClient";
import SocketService from "../services/socketService";
import useChatStore from "./chatStore";

const TOKEN_STORAGE_KEY = "yuna_auth_token";

/**
 * Small helper so "Remember me" has a real effect: checked -> localStorage
 * (survives app restarts), unchecked -> sessionStorage (cleared when the
 * window/app closes). Both are read on restoreSession() so either works.
 */
const tokenStorage = {
    save(token, remember) {
        if (remember) {
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
            sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        } else {
            sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
    },
    read() {
        return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
    },
    clear() {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
};

/**
 * ==========================================
 * useAuthStore
 * ------------------------------------------
 * Token storage: localStorage/sessionStorage (see tokenStorage
 * above), never a cookie. This is a local desktop Electron app
 * with contextIsolation/nodeIntegration left intact (no
 * secure-storage IPC channel exposed to the renderer) - see the
 * implementation report for why this tradeoff was taken instead
 * of building new IPC plumbing. Only the JWT + minimal profile
 * fields are stored; never the password.
 *
 * initialized: false until restoreSession() has resolved once.
 * ProtectedRoute/App must not render the authenticated app (or
 * connect the socket) while this is false.
 * ==========================================
 */
const useAuthStore = create((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    initialized: false,
    error: null,

    async restoreSession() {
        const storedToken = tokenStorage.read();

        if (!storedToken) {
            set({ initialized: true });
            return;
        }

        set({ token: storedToken, loading: true });

        try {
            const { user } = await authService.me();
            set({ user, isAuthenticated: true, loading: false, initialized: true, error: null });
            SocketService.connect(storedToken);
        } catch {
            // Token expired/invalid - clear it silently, send them to login.
            tokenStorage.clear();
            set({ user: null, token: null, isAuthenticated: false, loading: false, initialized: true });
        }
    },

    async login({ email, password, remember = true }) {
        set({ loading: true, error: null });
        try {
            const { user, token } = await authService.login({ email, password });
            tokenStorage.save(token, remember);
            set({ user, token, isAuthenticated: true, loading: false, error: null });
            SocketService.connect(token);
            return true;
        } catch (error) {
            set({ loading: false, error: error.message || "Login failed." });
            return false;
        }
    },

    async signup({ name, email, password }) {
        set({ loading: true, error: null });
        try {
            const { user, token } = await authService.signup({ name, email, password });
            tokenStorage.save(token, true);
            set({ user, token, isAuthenticated: true, loading: false, error: null });
            SocketService.connect(token);
            return true;
        } catch (error) {
            set({ loading: false, error: error.message || "Signup failed." });
            return false;
        }
    },

    async logout() {
        SocketService.disconnect();
        // Server-side is a no-op for stateless JWTs (see authService/report);
        // still call it so a future token-blocklist can hang off this path.
        await authService.logout();
        tokenStorage.clear();
        // Reset per-account UI state so a second account on the same
        // machine never sees the previous user's chat history in memory.
        useChatStore.getState().reset();
        set({ user: null, token: null, isAuthenticated: false, error: null });
    },

    clearError() {
        set({ error: null });
    }
}));

// SocketService/apiClient read the current token through this getter rather
// than importing the store directly, to keep them decoupled from Zustand.
registerTokenGetter(() => useAuthStore.getState().token);

export default useAuthStore;
