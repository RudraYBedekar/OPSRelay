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
  onOpenAccess?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  openTasksCount,
  activeSevCount,
  unreadChatCount = 0,
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
  onOpenAccess,
  children,
}) => (
  <div className="flex min-h-screen bg-ops-bg">
    <Sidebar
      activeTab={activeTab}
      onTabChange={onTabChange}
      openTasksCount={openTasksCount}
      activeSevCount={activeSevCount}
      unreadChatCount={unreadChatCount}
      isOpenMobile={isOpenMobile}
      setIsOpenMobile={setIsOpenMobile}
      collapsed={sidebarCollapsed}
      onToggleCollapse={onToggleSidebar}
    />
    <div className="flex min-w-0 flex-1 flex-col">
      <TopHeader
        onToggleMobileSidebar={() => setIsOpenMobile(!isOpenMobile)}
        isMobileSidebarOpen={isOpenMobile}
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
