import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Checkbox, Typography } from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";

import AuthCard from "../../../components/Auth/AuthCard";
import useAuthStore from "../../../store/authStore";

const { Text } = Typography;

export default function LoginView() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const loading = useAuthStore((state) => state.loading);
    const [formError, setFormError] = useState(null);

    const handleSubmit = async ({ email, password, remember }) => {
        setFormError(null);
        const success = await login({ email, password, remember });
        if (success) {
            navigate("/chat", { replace: true });
        } else {
            setFormError(useAuthStore.getState().error || "Invalid email or password.");
        }
    };

    return (
        <AuthCard
            title="Welcome back"
            subtitle="Sign in to continue to Yuna"
            footer={
                <Text style={{ color: "rgba(255,255,255,0.5)" }}>
                    Don't have an account? <Link to="/signup">Sign up</Link>
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
                    rules={[{ required: true, message: "Please enter your password." }]}
                >
                    <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        size="large"
                    />
                </Form.Item>

                <Form.Item name="remember" valuePropName="checked" initialValue={true}>
                    <Checkbox>Remember me</Checkbox>
                </Form.Item>

                <Form.Item style={{ marginBottom: 0 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        size="large"
                        loading={loading}
                    >
                        Log in
                    </Button>
                </Form.Item>
            </Form>
        </AuthCard>
    );
}
