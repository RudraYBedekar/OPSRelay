import React, { useState } from 'react';
import { Pulse, Lock, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';

interface LoginPageProps {
  onSwitchToRegister?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-bg px-4 py-10">
      <div className="ops-card w-full max-w-md p-6 md:p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
            <Pulse size={24} weight="bold" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-ops-text">OpsRelay Dashboard</h1>
          <p className="mt-1 text-sm text-ops-subtext">Sign in with email or user ID</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-identifier" className="ops-label">Email or user ID</label>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="ops-input min-h-[44px]"
              placeholder="yash@opsrelay.io or yash"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="ops-label">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ops-input min-h-[44px]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
              <WarningCircle size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="ops-btn-primary flex w-full min-h-[44px] items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <CircleNotch size={16} weight="regular" className="animate-spin" aria-hidden />
                Signing in…
              </>
            ) : (
              <>
                <Lock size={16} weight="regular" aria-hidden />
                Sign in
              </>
            )}
          </button>
        </form>

        {onSwitchToRegister ? (
          <p className="mt-5 text-center text-sm text-ops-subtext">
            New here?{' '}
            <button type="button" onClick={onSwitchToRegister} className="font-medium text-brand hover:underline">
              Create an account
            </button>
          </p>
        ) : (
          <p className="mt-6 rounded-lg border border-ops-border bg-slate-50 px-3 py-2.5 text-xs text-ops-subtext leading-relaxed">
            Demo (after <code className="text-[11px]">npm run db:seed-secure</code>):
            <br />
            <strong>yash</strong> / <strong>yash@opsrelay.io</strong> — password <code className="text-[11px]">OpsRelay2026!</code>
          </p>
        )}
      </div>
    </div>
  );
};
