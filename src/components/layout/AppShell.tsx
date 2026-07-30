import React from 'react';
import { Sidebar } from './Sidebar';
import type { NavTab } from './Sidebar';
import { TopHeader } from './TopHeader';

interface AppShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  openTasksCount: number;
  activeSevCount: number;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
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
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  openTasksCount,
  activeSevCount,
  isOpenMobile,
  setIsOpenMobile,
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
  children,
}) => (
  <div className="flex min-h-screen bg-ops-bg">
    <Sidebar
      activeTab={activeTab}
      onTabChange={onTabChange}
      openTasksCount={openTasksCount}
      activeSevCount={activeSevCount}
      isOpenMobile={isOpenMobile}
      setIsOpenMobile={setIsOpenMobile}
      collapsed={sidebarCollapsed}
      onToggleCollapse={onToggleSidebar}
    />
    <div className="flex min-w-0 flex-1 flex-col">
      <TopHeader
        onOpenMobileSidebar={() => setIsOpenMobile(true)}
        onOpenIntake={onOpenIntake}
        onSearchQuery={onSearchQuery}
        dbConnected={dbConnected}
        usingCrdb={usingCrdb}
        userName={userName}
        userId={userId}
        memberId={memberId}
        userRole={userRole}
        onLogout={onLogout}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
    </div>
  </div>
);
