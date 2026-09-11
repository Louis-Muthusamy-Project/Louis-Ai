import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Typography, Steps } from "antd";
import { MailOutlined, LockOutlined, NumberOutlined } from "@ant-design/icons";

import AuthCard from "../../../components/Auth/AuthCard";
import authService from "../../../services/authService";

const { Text } = Typography;

/**
 * ==========================================
 * ForgotPasswordView
 * ------------------------------------------
 * Real 3-step flow against the backend OTP endpoints (see
 * server/services/passwordResetService.js) - no fake/hardcoded/
 * frontend-generated OTP anywhere here.
 *
 *   Step 1: email -> POST /auth/forgot-password (always shows the
 *           same generic message, whether or not the account exists)
 *   Step 2: 6-digit code -> POST /auth/verify-otp -> receives a
 *           short-lived resetToken (proof of OTP ownership)
 *   Step 3: new password + confirm -> POST /auth/reset-password,
 *           requires the resetToken from step 2 - this can never be
 *           reached with only an email.
 * ==========================================
 */
export default function ForgotPasswordView() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState(null);

    const [email, setEmail] = useState("");
    const [resetToken, setResetToken] = useState(null);

    async function handleRequestReset({ email: submittedEmail }) {
        setError(null);
        setLoading(true);
        try {
            const result = await authService.forgotPassword(submittedEmail);
            setEmail(submittedEmail);
            setInfoMessage(result.message);
            setStep(1);
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleVerifyOtp({ otp }) {
        setError(null);
        setLoading(true);
        try {
            const result = await authService.verifyOtp({ email, otp });
            setResetToken(result.resetToken);
            setStep(2);
        } catch (err) {
            setError(err.message || "Invalid or expired verification code.");
        } finally {
            setLoading(false);
        }
    }

    async function handleResetPassword({ newPassword, confirmPassword }) {
        setError(null);
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        setLoading(true);
        try {
            await authService.resetPassword({ email, resetToken, newPassword, confirmPassword });
            navigate("/login", { replace: true, state: { passwordResetSuccess: true } });
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthCard
            title="Reset your password"
            subtitle="We'll email you a 6-digit verification code."
            footer={
                <Text style={{ color: "rgba(255,255,255,0.5)" }}>
                    Remembered it? <Link to="/login">Back to login</Link>
                </Text>
            }
        >
            <Steps
                current={step}
                size="small"
                items={[{ title: "Email" }, { title: "Verify" }, { title: "New password" }]}
                style={{ marginBottom: 24 }}
            />

            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
            {step === 1 && infoMessage && !error && (
                <Alert type="info" message={infoMessage} showIcon style={{ marginBottom: 16 }} />
            )}

            {step === 0 && (
                <Form layout="vertical" onFinish={handleRequestReset} disabled={loading} requiredMark={false}>
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: "Please enter your email." },
                            { type: "email", message: "Please enter a valid email." }
                        ]}
                    >
                        <Input prefix={<MailOutlined />} placeholder="you@example.com" autoComplete="email" size="large" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Send verification code
                        </Button>
                    </Form.Item>
                </Form>
            )}

            {step === 1 && (
                <Form layout="vertical" onFinish={handleVerifyOtp} disabled={loading} requiredMark={false}>
                    <Form.Item
                        name="otp"
                        label="6-digit code"
                        rules={[
                            { required: true, message: "Please enter the code." },
                            { pattern: /^\d{6}$/, message: "The code is exactly 6 digits." }
                        ]}
                    >
                        <Input
                            prefix={<NumberOutlined />}
                            placeholder="123456"
                            maxLength={6}
                            size="large"
                            autoComplete="one-time-code"
                        />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 12 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Verify code
                        </Button>
                    </Form.Item>
                    <Button type="link" block onClick={() => setStep(0)} disabled={loading}>
                        Use a different email / resend
                    </Button>
                </Form>
            )}

            {step === 2 && (
                <Form layout="vertical" onFinish={handleResetPassword} disabled={loading} requiredMark={false}>
                    <Form.Item
                        name="newPassword"
                        label="New password"
                        rules={[
                            { required: true, message: "Please enter a new password." },
                            { min: 8, message: "Password must be at least 8 characters." }
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        label="Confirm password"
                        dependencies={["newPassword"]}
                        rules={[
                            { required: true, message: "Please confirm your new password." },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                                    return Promise.reject(new Error("Passwords do not match."));
                                }
                            })
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Set new password
                        </Button>
                    </Form.Item>
                </Form>
            )}
        </AuthCard>
    );
}
