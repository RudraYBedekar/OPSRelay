import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  MessageSquare,
  Kanban,
  Activity,
  X,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'intake' | 'ask' | 'tasks';

const NAV: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'intake', label: 'New Incident', icon: FilePlus2 },
  { id: 'ask', label: 'Ask AI', icon: MessageSquare },
  { id: 'tasks', label: 'Tasks', icon: Kanban },
];

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  openTasksCount: number;
  activeSevCount: number;
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
  isOpenMobile,
  setIsOpenMobile,
  collapsed = false,
  onToggleCollapse,
}) => (
  <>
    {isOpenMobile && (
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 md:hidden"
        onClick={() => setIsOpenMobile(false)}
        aria-hidden
      />
    )}

    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-ops-border bg-white transition-all duration-200 md:static md:translate-x-0 ${
        collapsed ? 'w-[4.5rem]' : 'w-52'
      } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className={`flex h-14 items-center border-b border-ops-border ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <Activity className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-ops-text">OpsRelay</p>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Activity className="h-4 w-4" />
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpenMobile(false)}
          className="p-1.5 text-ops-muted hover:text-ops-text md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {activeSevCount > 0 && !collapsed && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
          <p className="text-xs font-medium text-red-800">{activeSevCount} critical</p>
        </div>
      )}
      {activeSevCount > 0 && collapsed && (
        <div className="mx-auto mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-brand" title={`${activeSevCount} critical incidents`}>
          {activeSevCount}
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          const badge = id === 'tasks' && openTasksCount > 0 ? openTasksCount : null;
          return (
            <button
              key={id}
              type="button"
              title={collapsed ? label : undefined}
              onClick={() => { onTabChange(id); setIsOpenMobile(false); }}
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 ${
                active
                  ? 'bg-red-50 text-brand before:absolute before:left-0 before:top-1/2 before:h-6 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand'
                  : 'text-ops-subtext hover:bg-slate-50 hover:text-ops-text'
              } ${collapsed ? 'justify-center px-2' : ''}`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand' : ''}`} aria-hidden />
              {!collapsed && (
                <>
                  <span className={`flex-1 text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                  {badge != null && (
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                      {badge}
                    </span>
                  )}
                </>
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
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-ops-muted hover:bg-slate-50 hover:text-ops-text min-h-[44px]"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </aside>
  </>
);
