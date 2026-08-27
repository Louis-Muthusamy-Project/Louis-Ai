import { Typography } from "antd";
import { palette } from "../../theme/yunaTheme";

const { Title, Text } = Typography;

/**
 * Shared shell for LoginView/SignupView. Kept intentionally plain -
 * a centered glowing card on the app's dark background, no extra
 * animation - per the "don't over-design it" note in the auth spec.
 */
export default function AuthCard({ title, subtitle, children, footer }) {
    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `radial-gradient(circle at 50% 20%, ${palette.accentPrimary}22, transparent 60%), ${palette.bgApp}`,
                padding: 24
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 380,
                    background: palette.bgSurface,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 16,
                    padding: "36px 32px",
                    boxShadow: `0 0 60px -20px ${palette.accentGlow}55`
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <Title level={3} style={{ color: palette.textPrimary, marginBottom: 4 }}>
                        {title}
                    </Title>
                    {subtitle && (
                        <Text style={{ color: palette.textTertiary }}>{subtitle}</Text>
                    )}
                </div>

                {children}

                {footer && (
                    <div style={{ textAlign: "center", marginTop: 20 }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
