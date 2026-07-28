import React, { useState, useRef, useEffect } from 'react';

import { Activity, Database, LogOut, Menu, Plus, Search } from 'lucide-react';

import { UserAvatar } from '../common/UserAvatar';



interface TopHeaderProps {

  onOpenMobileSidebar: () => void;

  onOpenIntake: () => void;

  onSearchQuery?: (query: string) => void;

  dbConnected?: boolean | null;

  usingCrdb?: boolean;

  userName?: string;

  userRole?: string;

  onLogout?: () => void;

}



export const TopHeader: React.FC<TopHeaderProps> = ({

  onOpenMobileSidebar,

  onOpenIntake,

  onSearchQuery,

  dbConnected,

  usingCrdb,

  userName = 'Yash',

  userRole,

  onLogout,

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

    <header className="sticky top-0 z-30 border-b border-ops-border bg-white/95 backdrop-blur-sm">

      <div className="flex h-14 items-center gap-3 px-4 md:px-6">

        <button

          type="button"

          onClick={onOpenMobileSidebar}

          className="flex h-10 w-10 items-center justify-center rounded-lg border border-ops-border text-ops-subtext md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"

          aria-label="Open navigation"

        >

          <Menu className="h-5 w-5" />

        </button>



        <div className="hidden md:flex items-center gap-2 shrink-0">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">

            <Activity className="h-4 w-4" aria-hidden />

          </div>

          <span className="text-sm font-semibold text-ops-text">OpsRelay</span>

        </div>



        <div className="relative flex-1 max-w-xl mx-auto">

          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ops-muted" />

          <input

            type="search"

            placeholder="Search incidents by title, ID, service, or owner…"

            onChange={(e) => onSearchQuery?.(e.target.value)}

            className="ops-input h-10 pl-9 text-sm bg-slate-50/80"

            aria-label="Global search"

          />

        </div>



        <div className="flex items-center gap-2 shrink-0">

          {usingCrdb && (

            <span

              title={dbConnected ? 'Database connected' : 'Database offline'}

              className={`hidden lg:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${

                dbConnected

                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

                  : 'border-red-200 bg-red-50 text-red-700'

              }`}

            >

              <Database className="h-3.5 w-3.5" aria-hidden />

              {dbConnected ? 'Live' : 'Offline'}

            </span>

          )}

          <button type="button" onClick={onOpenIntake} className="ops-btn-primary h-10 min-h-[44px] px-4">

            <Plus className="h-4 w-4" aria-hidden />

            <span className="hidden sm:inline">New incident</span>

          </button>



          <div className="relative hidden sm:block" ref={menuRef}>

            <button

              type="button"

              onClick={() => setMenuOpen((o) => !o)}

              className="flex items-center gap-2 rounded-lg border border-ops-border px-2 py-1.5 hover:bg-slate-50 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"

              aria-expanded={menuOpen}

              aria-haspopup="menu"

            >

              <UserAvatar name={userName} size="sm" />

              <span className="hidden lg:inline text-xs font-medium text-ops-subtext max-w-[5rem] truncate">{userName}</span>

            </button>

            {menuOpen && (

              <div

                role="menu"

                className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-ops-border bg-white py-1 shadow-lg"

              >

                <div className="px-3 py-2 border-b border-ops-border">

                  <p className="text-sm font-medium text-ops-text truncate">{userName}</p>

                  {userRole && (

                    <p className="text-[11px] text-ops-muted capitalize">{userRole}</p>

                  )}

                </div>

                {onLogout && (

                  <button

                    type="button"

                    role="menuitem"

                    onClick={() => { setMenuOpen(false); onLogout(); }}

                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ops-subtext hover:bg-slate-50 min-h-[44px]"

                  >

                    <LogOut className="h-4 w-4" aria-hidden />

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

