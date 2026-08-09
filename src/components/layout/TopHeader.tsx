import React, { useState, useRef, useEffect } from 'react';
import {
  SquaresFour,
  Database,
  SignOut,
  Plus,
  MagnifyingGlass,
  ShareNetwork,
} from '@phosphor-icons/react';
import { UserAvatar } from '../common/UserAvatar';
import { ICON_SIZE } from '../common/iconTypes';

interface TopHeaderProps {
  onOpenIntake: () => void;
  onSearchQuery?: (query: string) => void;
  dbConnected?: boolean | null;
  usingCrdb?: boolean;
  userName?: string;
  userId?: string;
  memberId?: string;
  userRole?: string;
  onLogout?: () => void;
  onOpenAccess?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenIntake,
  onSearchQuery,
  dbConnected,
  usingCrdb,
  userName = 'Yash',
  userId,
  memberId,
  userRole,
  onLogout,
  onOpenAccess,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-ops-border bg-white">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <div className="hidden md:flex items-center gap-2 shrink-0 pr-2 border-r border-ops-border mr-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white">
            <SquaresFour size={18} weight="bold" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-ops-text">OpsRelay</span>
        </div>

        <div className="relative flex-1 max-w-xl">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ops-muted"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search incidents by title, ID, service, or owner…"
            onChange={(e) => onSearchQuery?.(e.target.value)}
            className="ops-input h-9 pl-9 text-sm bg-ops-bg"
            aria-label="Global search"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {usingCrdb && (
            <span
              title={dbConnected ? 'Database connected' : 'Database offline'}
              className={`hidden lg:inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                dbConnected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <Database size={14} weight="regular" aria-hidden />
              {dbConnected ? 'Connected' : 'Offline'}
            </span>
          )}
          <button type="button" onClick={onOpenIntake} className="ops-btn-primary h-9 px-3.5">
            <Plus size={16} weight="bold" aria-hidden />
            <span className="hidden sm:inline">New incident</span>
          </button>

          <div className="relative hidden sm:block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border border-ops-border px-2 py-1.5 hover:bg-ops-cardHover min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(1,118,211,0.25)]"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <UserAvatar name={userName} size="sm" />
              <span className="hidden lg:inline text-xs font-medium text-ops-subtext max-w-[5rem] truncate">{userName}</span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-ops-border bg-white py-1 shadow-modal"
              >
                <div className="px-3 py-2 border-b border-ops-border">
                  <p className="text-sm font-medium text-ops-text truncate">{userName}</p>
                  {memberId && (
                    <p className="text-[11px] font-mono text-brand mt-0.5">{memberId}</p>
                  )}
                  {userId && (
                    <p className="text-[11px] text-ops-muted">Login ID: {userId}</p>
                  )}
                  {userRole && (
                    <p className="text-[11px] text-ops-muted capitalize mt-0.5">{userRole}</p>
                  )}
                </div>
                {memberId && onOpenAccess && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onOpenAccess(); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ops-subtext hover:bg-ops-cardHover min-h-[40px]"
                  >
                    <ShareNetwork size={16} aria-hidden />
                    Share access
                  </button>
                )}
                {onLogout && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onLogout(); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ops-subtext hover:bg-ops-cardHover min-h-[40px]"
                  >
                    <SignOut size={16} aria-hidden />
                    Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
