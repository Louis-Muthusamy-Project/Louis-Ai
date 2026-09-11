import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';

import ChatView from './views/ChatView/ChatView';
import CharacterView from './views/CharacterView/CharacterView';
import CodingView from './views/CodingView/CodingView';
import AdminView from './views/AdminView/AdminView';
import LoginView from './views/Auth/LoginView/LoginView';
import SignupView from './views/Auth/SignupView/SignupView';
import ForgotPasswordView from './views/Auth/ForgotPasswordView/ForgotPasswordView';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PublicOnlyRoute from './components/Auth/PublicOnlyRoute';
import SuperAdminRoute from './components/Auth/SuperAdminRoute';
import AppShell from './components/Layout/AppShell';
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
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordView /></PublicOnlyRoute>} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Exactly 3 primary tabs - see components/Layout/MainNav.jsx - plus
            /admin, only ever reachable/rendered for the real Super Admin
            account (SuperAdminRoute + MainNav both gate on user.role, which
            only ever comes from the server). */}
        <Route path="/chat" element={<ChatView />} />
        <Route path="/character" element={<CharacterView />} />
        <Route path="/coding" element={<CodingView />} />
        <Route path="/admin" element={<SuperAdminRoute><AdminView /></SuperAdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}