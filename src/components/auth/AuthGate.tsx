import React, { useState } from 'react';
import { RegisterPage } from './RegisterPage';
import { LoginPage } from './LoginPage';

/** Shows registration first, with option to switch to sign-in */
export const AuthGate: React.FC = () => {
  const [mode, setMode] = useState<'register' | 'login'>('register');

  if (mode === 'login') {
    return <LoginPage onSwitchToRegister={() => setMode('register')} />;
  }

  return <RegisterPage onSwitchToLogin={() => setMode('login')} />;
};
