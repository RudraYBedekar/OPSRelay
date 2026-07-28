import React from 'react';
import { Database, Menu, Search, Plus } from 'lucide-react';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onOpenIntake: () => void;
  onSearchQuery?: (query: string) => void;
  dbConnected?: boolean | null;
  usingCrdb?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onOpenIntake,
  onSearchQuery,
  dbConnected,
  usingCrdb,
}) => (
  <header className="sticky top-0 z-30 h-16 border-b border-ops-border bg-white/80 backdrop-blur-md">
    <div className="flex h-full items-center gap-4 px-4 md:px-8 max-w-7xl mx-auto">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-ops-border text-ops-subtext"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative flex-1 max-w-md hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ops-muted pointer-events-none" />
        <input
          type="search"
          placeholder="Search incidents by ID, service, or title…"
          onChange={(e) => onSearchQuery?.(e.target.value)}
          className="ops-input pl-9 py-2 bg-ops-bg/50"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {usingCrdb && (
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
              dbConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            {dbConnected ? 'Live' : 'Offline'}
          </span>
        )}
        <button type="button" onClick={onOpenIntake} className="ops-btn-primary h-9 px-4">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New incident</span>
        </button>
      </div>
    </div>
  </header>
);
