import { theme as antdTheme } from "antd";

// Raw palette (single source of truth)
export const palette = {
    bgApp: "#0f0f13",
    bgSurface: "#17171c",
    bgSurfaceRaised: "#1c1c24",
    bgElevated: "#121218",
    border: "rgba(255,255,255,0.08)",
    borderSubtle: "rgba(255,255,255,0.06)",
    textPrimary: "rgba(255,255,255,0.92)",
    textSecondary: "#d1d5db",
    textTertiary: "#9ca3af",
    accentPrimary: "#7c3aed", // violet-600 — matches existing send/settings buttons
    accentPrimaryHover: "#8b5cf6",
    accentSecondary: "#3b82f6", // blue-500 — assistant bubble accent
    accentGlow: "#a855f7", // purple-500 — thinking indicator / character glow
    success: "#10b981",
    danger: "#dc2626",
};

export const yunaThemeConfig = {
    algorithm: antdTheme.darkAlgorithm,
    token: {
        colorPrimary: palette.accentPrimary,
        colorInfo: palette.accentSecondary,
        colorSuccess: palette.success,
        colorError: palette.danger,
        colorBgBase: palette.bgApp,
        colorBgContainer: palette.bgSurface,
        colorBgElevated: palette.bgSurfaceRaised,
        colorBorder: palette.border,
        colorBorderSecondary: palette.borderSubtle,
        colorText: palette.textPrimary,
        colorTextSecondary: palette.textSecondary,
        colorTextTertiary: palette.textTertiary,
        borderRadius: 12,
        controlHeight: 40,
        fontFamily:
            "YunaSystem, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    components: {
        Button: {
            borderRadius: 12,
            controlHeight: 42,
        },
        Input: {
            borderRadius: 12,
        },
        Drawer: {
            colorBgElevated: palette.bgSurface,
        },
        Modal: {
            colorBgElevated: palette.bgSurface,
        },
        Tabs: {
            itemSelectedColor: palette.accentGlow,
        },
    },
};