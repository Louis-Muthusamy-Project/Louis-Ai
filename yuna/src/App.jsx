import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ChatView from './views/ChatView/ChatView';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/chat" element={<ChatView />} />
    </Routes>
  );
}

