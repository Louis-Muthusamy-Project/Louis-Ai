import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Typography } from "antd";
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons";

import AuthCard from "../../../components/Auth/AuthCard";
import useAuthStore from "../../../store/authStore";

const { Text } = Typography;

export default function SignupView() {
    const navigate = useNavigate();
    const signup = useAuthStore((state) => state.signup);
    const loading = useAuthStore((state) => state.loading);
    const [formError, setFormError] = useState(null);

    const handleSubmit = async ({ name, email, password }) => {
        setFormError(null);
        const success = await signup({ name, email, password });
        if (success) {
            navigate("/chat", { replace: true });
        } else {
            setFormError(useAuthStore.getState().error || "Could not create your account.");
        }
    };

    return (
        <AuthCard
            title="Create your account"
            subtitle="Set up Yuna in a minute"
            footer={
                <Text style={{ color: "rgba(255,255,255,0.5)" }}>
                    Already have an account? <Link to="/login">Log in</Link>
                </Text>
            }
        >
            {formError && (
                <Alert
                    type="error"
                    message={formError}
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Form layout="vertical" onFinish={handleSubmit} disabled={loading} requiredMark={false}>
                <Form.Item
                    name="name"
                    label="Name"
                    rules={[{ required: true, message: "Please enter your name." }]}
                >
                    <Input prefix={<UserOutlined />} placeholder="Your name" size="large" autoComplete="name" />
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                        { required: true, message: "Please enter your email." },
                        { type: "email", message: "Please enter a valid email." }
                    ]}
                >
                    <Input
                        prefix={<MailOutlined />}
                        placeholder="you@example.com"
                        autoComplete="email"
                        size="large"
                    />
                </Form.Item>

                <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                        { required: true, message: "Please enter a password." },
                        { min: 8, message: "Password must be at least 8 characters." }
                    ]}
                    hasFeedback
                >
                    <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        size="large"
                    />
                </Form.Item>

                <Form.Item
                    name="confirmPassword"
                    label="Confirm password"
                    dependencies={["password"]}
                    hasFeedback
                    rules={[
                        { required: true, message: "Please confirm your password." },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue("password") === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error("Passwords do not match."));
                            }
                        })
                    ]}
                >
                    <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        size="large"
                    />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        size="large"
                        loading={loading}
                    >
                        Sign up
                    </Button>
                </Form.Item>
            </Form>
        </AuthCard>
    );
}
