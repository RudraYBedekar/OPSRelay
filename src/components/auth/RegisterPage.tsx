import React, { useMemo, useState } from 'react';
import { Activity, UserPlus, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  checkPasswordStrength,
  isValidEmail,
  isValidUserId,
  passwordStrengthLabel,
} from '../../utils/passwordStrength';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pwCheck = useMemo(() => checkPasswordStrength(password), [password]);
  const strength = passwordStrengthLabel(pwCheck.score);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidUserId(userId)) {
      setError('User ID must be 3–32 characters (letters, numbers, . _ -)');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email (Gmail, Outlook, Yahoo, etc.)');
      return;
    }
    if (!name.trim()) {
      setError('Display name is required');
      return;
    }
    if (!pwCheck.valid) {
      setError(`Password requirements: ${pwCheck.errors.join(', ')}`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({ userId, email, name, password, confirmPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-bg px-4 py-10">
      <div className="ops-card w-full max-w-lg p-6 md:p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
            <Activity className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-ops-text">Create your account</h1>
          <p className="mt-1 text-sm text-ops-subtext">
            Credentials are stored in an isolated SecureData database
          </p>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            A unique member ID (e.g. MEM-A3F9B2C1) is assigned automatically. Your user ID must not match an existing account.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-user-id" className="ops-label">User ID</label>
            <input
              id="reg-user-id"
              type="text"
              autoComplete="username"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="ops-input min-h-[44px]"
              placeholder="e.g. rudra.ops"
            />
            <p className="mt-1 text-[11px] text-ops-muted">Must be unique — 3–32 chars, letters/numbers/._-</p>
          </div>

          <div>
            <label htmlFor="reg-email" className="ops-label">Email</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ops-input min-h-[44px]"
              placeholder="you@gmail.com or name@outlook.com"
            />
          </div>

          <div>
            <label htmlFor="reg-name" className="ops-label">Display name</label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ops-input min-h-[44px]"
              placeholder="Your name on the dashboard"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="ops-label">Password</label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ops-input min-h-[44px] pr-10"
                placeholder="Strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ops-muted hover:text-ops-text"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all ${strength.color}`}
                      style={{ width: `${Math.min(100, (pwCheck.score / 6) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-ops-subtext">{strength.label}</span>
                </div>
                {pwCheck.errors.length > 0 && (
                  <p className="text-[11px] text-ops-muted">Needs: {pwCheck.errors.join(', ')}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="reg-confirm" className="ops-label">Confirm password</label>
            <input
              id="reg-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="ops-input min-h-[44px]"
              placeholder="Re-enter password"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ops-btn-primary flex w-full min-h-[44px] items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" aria-hidden />
                Create account
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ops-subtext">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin} className="font-medium text-brand hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
