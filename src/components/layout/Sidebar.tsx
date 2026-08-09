import React from 'react';
import {
  SquaresFour,
  PlusCircle,
  ChatsCircle,
  PaperPlaneTilt,
  Sparkle,
  ListChecks,
  X,
  SidebarSimple,
  Warning,
} from '@phosphor-icons/react';
import type { AppIcon } from '../common/iconTypes';
import { ICON_SIZE } from '../common/iconTypes';

export type NavTab = 'dashboard' | 'intake' | 'share' | 'ask' | 'tasks' | 'chat';

const NAV: { id: NavTab; label: string; icon: AppIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: SquaresFour },
  { id: 'intake', label: 'New Incident', icon: PlusCircle },
  { id: 'chat', label: 'Team Chat', icon: ChatsCircle },
  { id: 'share', label: 'Send to employee', icon: PaperPlaneTilt },
  { id: 'ask', label: 'Ask AI', icon: Sparkle },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
];

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  openTasksCount: number;
  activeSevCount: number;
  unreadChatCount?: number;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  openTasksCount,
  activeSevCount,
  unreadChatCount = 0,
  isOpenMobile,
  setIsOpenMobile,
  collapsed = false,
  onToggleCollapse,
}) => (
  <>
    {isOpenMobile && (
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 md:hidden"
        onClick={() => setIsOpenMobile(false)}
        aria-hidden
      />
    )}

    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-ops-border bg-ops-sidebar transition-all duration-150 md:static md:translate-x-0 md:pointer-events-auto ${
        collapsed ? 'w-[3.75rem]' : 'w-56'
      } ${isOpenMobile ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}`}
    >
      <div className={`flex h-14 w-full shrink-0 items-center border-b border-ops-border ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-white">
              <SquaresFour size={18} weight="bold" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ops-text leading-tight">OpsRelay</p>
              <p className="text-[11px] text-ops-muted truncate">Incident workspace</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white">
            <SquaresFour size={18} weight="bold" aria-hidden />
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpenMobile(false)}
          className="ops-icon-btn shrink-0 md:hidden relative z-10"
          aria-label="Close menu"
        >
          <X size={ICON_SIZE.button} aria-hidden />
        </button>
      </div>

      {activeSevCount > 0 && !collapsed && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
          <Warning size={14} weight="fill" className="text-red-600 shrink-0" aria-hidden />
          <p className="text-xs font-medium text-red-800">{activeSevCount} critical active</p>
        </div>
      )}
      {activeSevCount > 0 && collapsed && (
        <div
          className="mx-auto mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-700"
          title={`${activeSevCount} critical incidents`}
        >
          {activeSevCount}
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Main navigation">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          const badge =
            id === 'tasks' && openTasksCount > 0
              ? openTasksCount
              : id === 'chat' && unreadChatCount > 0
                ? unreadChatCount
                : null;
          return (
            <button
              key={id}
              type="button"
              title={collapsed ? label : undefined}
              onClick={() => { onTabChange(id); setIsOpenMobile(false); }}
              className={`relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(1,118,211,0.25)] ${
                active
                  ? 'bg-brand-light text-brand before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand'
                  : 'text-ops-subtext hover:bg-ops-cardHover hover:text-ops-text'
              } ${collapsed ? 'justify-center px-2' : ''}`}
            >
              <Icon
                size={ICON_SIZE.sidebar}
                weight={active ? 'fill' : 'regular'}
                className="shrink-0"
                aria-hidden
              />
              {!collapsed && (
                <>
                  <span className={`flex-1 text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                  {badge != null && (
                    <span className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1 text-[10px] font-semibold ${
                      id === 'chat' ? 'bg-brand text-white' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && badge != null && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {onToggleCollapse && (
        <div className="hidden border-t border-ops-border p-2 md:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs text-ops-muted hover:bg-ops-cardHover hover:text-ops-text min-h-[40px]"
          >
            <SidebarSimple size={16} aria-hidden />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </aside>
  </>
);
