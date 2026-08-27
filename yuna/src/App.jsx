import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';

import ChatView from './views/ChatView/ChatView';
import LoginView from './views/Auth/LoginView/LoginView';
import SignupView from './views/Auth/SignupView/SignupView';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PublicOnlyRoute from './components/Auth/PublicOnlyRoute';
import useAuthStore from './store/authStore';
import { palette } from './theme/yunaTheme';

export default function App() {
  const initialized = useAuthStore((state) => state.initialized);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (!initialized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: palette.bgApp
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />

      <Route path="/login" element={<PublicOnlyRoute><LoginView /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignupView /></PublicOnlyRoute>} />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatView />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}