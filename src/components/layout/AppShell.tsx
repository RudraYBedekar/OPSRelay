import React from 'react';
import { Sidebar } from './Sidebar';
import type { NavTab } from './Sidebar';
import { TopHeader } from './TopHeader';

interface AppShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  openTasksCount: number;
  activeSevCount: number;
  unreadChatCount?: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenIntake: () => void;
  onSearchQuery: (q: string) => void;
  dbConnected: boolean | null;
  usingCrdb: boolean;
  userName?: string;
  userId?: string;
  memberId?: string;
  userRole?: string;
  onLogout?: () => void;
  onOpenAccess?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  openTasksCount,
  activeSevCount,
  unreadChatCount = 0,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenIntake,
  onSearchQuery,
  dbConnected,
  usingCrdb,
  userName,
  userId,
  memberId,
  userRole,
  onLogout,
  onOpenAccess,
  children,
}) => (
  <div className="flex h-dvh w-full overflow-hidden bg-ops-bg">
    <Sidebar
      activeTab={activeTab}
      onTabChange={onTabChange}
      openTasksCount={openTasksCount}
      activeSevCount={activeSevCount}
      unreadChatCount={unreadChatCount}
      collapsed={sidebarCollapsed}
      onToggleCollapse={onToggleSidebar}
    />
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <TopHeader
        onOpenIntake={onOpenIntake}
        onSearchQuery={onSearchQuery}
        dbConnected={dbConnected}
        usingCrdb={usingCrdb}
        userName={userName}
        userId={userId}
        memberId={memberId}
        userRole={userRole}
        onLogout={onLogout}
        onOpenAccess={onOpenAccess}
      />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  </div>
);
