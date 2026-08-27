import axios from "axios";

/**
 * ==========================================
 * apiClient
 * ------------------------------------------
 * Single axios instance shared by every service that talks to
 * the backend. Attaches the current JWT (if any) to every
 * request via a request interceptor, so individual services
 * (settingsService, authService) never have to remember to do
 * it themselves.
 * ==========================================
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const apiClient = axios.create({
    baseURL: API_BASE_URL
});

// Lazily required to avoid a circular import (authStore doesn't need
// apiClient at module-eval time, only inside its actions).
let getToken = () => null;
export function registerTokenGetter(fn) {
    getToken = fn;
}

apiClient.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;
export { API_BASE_URL };
