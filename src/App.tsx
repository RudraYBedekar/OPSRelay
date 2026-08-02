import React, { useState, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { NavTab } from './components/layout/Sidebar';
import { PageHeader } from './components/common/PageHeader';
import { MetricsGrid } from './components/dashboard/MetricsGrid';
import { HandoffCard } from './components/dashboard/HandoffCard';
import { IncidentTable } from './components/dashboard/IncidentTable';
import { IntakePanel } from './components/intake/IntakePanel';
import type { IntakeMode } from './components/intake/IntakePanel';
import { AgentConsole } from './components/agent/AgentConsole';
import { OpenTaskBoard } from './components/tasks/OpenTaskBoard';
import { IncidentDetailView } from './components/detail/IncidentDetailView';
import { LoadingSkeleton } from './components/common/LoadingSkeleton';
import { ErrorAlert } from './components/common/ErrorAlert';
import { AuthGate } from './components/auth/AuthGate';
import { AccessPanel } from './components/access/AccessPanel';
import { SendToEmployeePanel } from './components/share/SendToEmployeePanel';
import { TeamChatPanel } from './components/chat/TeamChatPanel';
import { AlertSuppressedBanner } from './components/alerts/AlertSuppressedBanner';
import { useToast } from './components/common/Toast';
import { useAuth } from './context/AuthContext';
import { firstName } from './utils/avatar';
import type {
  Incident,
  ActionItemTask,
  ShiftHandoff,
  DashboardMetrics,
  ExtractionResult,
  IncidentStatus,
  TaskStatus,
} from './types/incident';
import { apiService } from './services/apiService';
import { AlertSuppressedError, type AlertSuppressedResponse } from './types/alertFatigue';
import { deriveLiveMetrics, countOpenIncidents, countResolvedIncidents, buildLiveHandoffSummaries } from './utils/dashboardMetrics';

const PAGE: Record<NavTab, { title: string; description: string }> = {
  dashboard: {
    title: 'Operations dashboard',
    description: 'Metrics, shift handoff, and incident queue.',
  },
  intake: {
    title: 'New incident',
    description: 'Quick add with a name and few log lines, or use AI extract.',
  },
  share: {
    title: 'Send to employee',
    description: 'Share an incident with a teammate using their member ID.',
  },
  ask: {
    title: 'Ask AI',
    description: 'Search your incidents and any shared with you for recommended next steps.',
  },
  tasks: {
    title: 'Task board',
    description: 'Track action items across active incidents.',
  },
  chat: {
    title: 'Team chat',
    description: 'Direct messages between members — invite a third person for 15 or 30 minutes.',
  },
};

export const App: React.FC = () => {
  const { user, loading: authLoading, requiresAuth, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [dashboardSeverityFilter, setDashboardSeverityFilter] = useState('ALL');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('ALL');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [shiftHandoff, setShiftHandoff] = useState<ShiftHandoff | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tasks, setTasks] = useState<ActionItemTask[]>([]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('quick');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [lastRawNotes, setLastRawNotes] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [accessPanelOpen, setAccessPanelOpen] = useState(false);
  const [alertSuppression, setAlertSuppression] = useState<AlertSuppressedResponse | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    incident: Incident;
    shareWithMemberId?: string;
  } | null>(null);
  const [forceSaveBusy, setForceSaveBusy] = useState(false);

  const intakeStep: 1 | 2 | 3 = extractionResult ? 3 : isExtracting ? 2 : 1;

  const loadDashboardData = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) setIsRefreshing(true);
    else {
      setIsLoading(true);
      setError(null);
    }
    try {
      if (apiService.isUsingCrdb()) {
        const health = await apiService.checkDbHealth();
        setDbConnected(health.ok);
        if (!health.ok) throw new Error('API offline. Run npm run dev:all and check DATABASE_URL.');
      }
      const [m, h, incs, t] = await Promise.all([
        apiService.getMetrics(),
        apiService.getShiftHandoff(),
        apiService.getIncidents(),
        apiService.getTasks(),
      ]);
      setMetrics(m);
      setShiftHandoff(h);
      setIncidents(incs);
      setTasks(t);
      setLastRefreshedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (silent) setIsRefreshing(false);
      else setIsLoading(false);
    }
  };

  const refreshIncidents = async (saved?: Incident) => {
    if (saved) {
      setIncidents((prev) => [saved, ...prev.filter((i) => i.id !== saved.id)]);
      setDashboardSeverityFilter('ALL');
    }
    try {
      const incs = await apiService.getIncidents();
      setIncidents(incs);
      setDashboardSeverityFilter('ALL');
      setLastRefreshedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh incidents');
    }
  };

  const refreshTasks = async () => {
    try {
      setTasks(await apiService.getTasks());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh tasks');
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const id = window.setInterval(() => {
      void loadDashboardData({ silent: true });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  const handleAcknowledgeHandoff = async () => {
    try {
      const updated = await apiService.acknowledgeShiftHandoff(shiftHandoff?.shiftId || '');
      setShiftHandoff({ ...updated });
      toast('Shift handoff acknowledged', 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge handoff');
      toast('Failed to acknowledge handoff', 'error');
    }
  };

  const handleRunExtraction = async (rawNotes: string) => {
    setIsExtracting(true);
    setError(null);
    setExtractionResult(null);
    setLastRawNotes(rawNotes);
    try {
      setExtractionResult(await apiService.extractIncidentFromNotes(rawNotes));
      toast('AI extraction complete — review and save', 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      toast('Extraction failed', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const completeIncidentSave = async (
    saved: Incident,
    shareWithMemberId?: string,
  ) => {
    await refreshIncidents(saved);
    await refreshTasks();
    await loadDashboardData({ silent: true });
    setAlertSuppression(null);
    setPendingSave(null);
    toast(
      shareWithMemberId
        ? `Incident ${saved.id} saved and sent to ${shareWithMemberId}`
        : `Incident ${saved.id} saved`,
      'success',
    );
  };

  const handleSaveExtractedIncident = async (newIncident: Incident, shareWithMemberId?: string) => {
    try {
      const saved = await apiService.saveIncident(newIncident, shareWithMemberId);
      await refreshIncidents(saved);
      await refreshTasks();
      await loadDashboardData({ silent: true });
      setSelectedIncident(saved);
      setActiveTab('dashboard');
      setAlertSuppression(null);
      setPendingSave(null);
      toast(
        shareWithMemberId
          ? `Incident ${saved.id} saved and sent to ${shareWithMemberId}`
          : `Incident ${saved.id} saved`,
        'success',
      );
    } catch (err: unknown) {
      if (err instanceof AlertSuppressedError) {
        setAlertSuppression(err.payload);
        setPendingSave({ incident: newIncident, shareWithMemberId });
        toast('Duplicate alert suppressed', 'error');
        return;
      }
      setError(err instanceof Error ? err.message : 'Save failed');
      toast('Save failed', 'error');
      throw err;
    }
  };

  const handleQuickSaveIncident = async (newIncident: Incident, shareWithMemberId?: string) => {
    try {
      const saved = await apiService.saveIncident(newIncident, shareWithMemberId);
      await completeIncidentSave(saved, shareWithMemberId);
    } catch (err: unknown) {
      if (err instanceof AlertSuppressedError) {
        setAlertSuppression(err.payload);
        setPendingSave({ incident: newIncident, shareWithMemberId });
        toast('Duplicate alert suppressed', 'error');
        return;
      }
      setError(err instanceof Error ? err.message : 'Save failed');
      toast('Save failed', 'error');
      throw err;
    }
  };

  const handleForceDistinctSave = async () => {
    if (!pendingSave || !alertSuppression?.matchedAlert?.id) return;
    setForceSaveBusy(true);
    try {
      await apiService.overrideAlertDistinct(alertSuppression.matchedAlert.id);
      const saved = await apiService.saveIncident(
        pendingSave.incident,
        pendingSave.shareWithMemberId,
        { forceDistinct: true, overrideAlertId: alertSuppression.matchedAlert.id },
      );
      await completeIncidentSave(saved, pendingSave.shareWithMemberId);
      setActiveTab('dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      toast('Save failed', 'error');
    } finally {
      setForceSaveBusy(false);
    }
  };

  const handleSaveSampleLog = async (log: { title: string; content: string; category?: string }) => {
    await apiService.saveSampleLog(log);
    toast('Sample log saved for reuse', 'success');
  };

  const handleUpdateIncidentStatus = async (id: string, status: IncidentStatus) => {
    try {
      const updated = await apiService.updateIncidentStatus(id, status);
      setIncidents((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedIncident?.id === id) setSelectedIncident(updated);
      await refreshIncidents();
      await refreshTasks();
      setLastRefreshedAt(new Date());
      toast(`Status updated to ${status}`, 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
      toast('Status update failed', 'error');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await apiService.updateTaskStatus(taskId, newStatus);
      setTasks(await apiService.getTasks());
      toast('Task status updated', 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
      toast('Task update failed', 'error');
    }
  };

  const handleInspectIncidentById = (id: string) => {
    const inc = incidents.find((i) => i.id === id);
    if (inc) setSelectedIncident(inc);
  };

  const goTab = (tab: NavTab) => {
    setActiveTab(tab);
    setSelectedIncident(null);
    if (tab === 'dashboard') {
      void loadDashboardData({ silent: true });
    }
  };

  const incomingLead = shiftHandoff ? firstName(shiftHandoff.incomingLead) : 'Yash';
  const displayName = user?.name ?? incomingLead;

  const personalHandoff: ShiftHandoff | null = user?.memberId
    ? {
        shiftId: user.memberId,
        timestamp: new Date().toISOString(),
        outgoingLead: user.name,
        incomingLead: user.name,
        activeSevCount: 0,
        openTasksCount: 0,
        keySummaries: [],
        handshakeStatus: 'PENDING',
      }
    : null;

  const dashboardHandoff = personalHandoff ?? shiftHandoff;

  const liveMetrics = metrics ? deriveLiveMetrics(incidents, tasks, metrics) : null;
  const openIncidentCount = countOpenIncidents(incidents);
  const resolvedIncidentCount = countResolvedIncidents(incidents);
  const liveHandoffSummaries = buildLiveHandoffSummaries(incidents);
  const liveUpdatedLabel = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : undefined;

  const handleLogout = () => {
    logout();
    toast('Signed out', 'success');
  };

  if (requiresAuth && authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ops-bg">
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  if (requiresAuth && !user) {
    return <AuthGate />;
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={goTab}
      openTasksCount={tasks.filter((t) => t.status !== 'COMPLETED').length}
      activeSevCount={incidents.filter((i) => (i.severity === 'SEV-0' || i.severity === 'SEV-1') && i.status !== 'RESOLVED').length}
      isOpenMobile={isOpenMobile}
      setIsOpenMobile={setIsOpenMobile}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
      onOpenIntake={() => goTab('intake')}
      onSearchQuery={setGlobalSearchQuery}
      dbConnected={dbConnected}
      usingCrdb={apiService.isUsingCrdb()}
      userName={displayName}
      userId={user?.userId}
      memberId={user?.memberId}
      userRole={user?.role}
      onLogout={requiresAuth ? handleLogout : undefined}
      onOpenAccess={user?.memberId ? () => setAccessPanelOpen(true) : undefined}
    >
      {accessPanelOpen && user?.memberId && (
        <AccessPanel memberId={user.memberId} onClose={() => setAccessPanelOpen(false)} />
      )}
      {error && (
        <div className="mb-5">
          <ErrorAlert message={error} onRetry={loadDashboardData} />
        </div>
      )}

      {alertSuppression && (
        <div className="mb-5">
          <AlertSuppressedBanner
            suppression={alertSuppression}
            onCreateAnyway={() => void handleForceDistinctSave()}
            onDismiss={() => { setAlertSuppression(null); setPendingSave(null); }}
            busy={forceSaveBusy}
          />
        </div>
      )}

      {isLoading && !error ? (
        <LoadingSkeleton type="table" />
      ) : selectedIncident ? (
        <IncidentDetailView
          incident={selectedIncident}
          onBack={() => setSelectedIncident(null)}
          onUpdateStatus={handleUpdateIncidentStatus}
          onInspectIncident={handleInspectIncidentById}
        />
      ) : (
        <>
          <PageHeader
            title={
              activeTab === 'dashboard' && user?.name
                ? `${displayName}'s dashboard`
                : PAGE[activeTab].title
            }
            description={activeTab === 'ask' ? undefined : PAGE[activeTab].description}
          />

          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {dashboardHandoff && liveMetrics && (
                <HandoffCard
                  handoff={dashboardHandoff}
                  liveSummaries={liveHandoffSummaries}
                  openIncidentCount={openIncidentCount}
                  activeSevCount={liveMetrics.activeSev0Sev1}
                  openTasksCount={liveMetrics.openTasksCount}
                  lastUpdated={liveUpdatedLabel}
                  userName={user?.name}
                  memberId={user?.memberId}
                  onAcknowledge={handleAcknowledgeHandoff}
                />
              )}
              {liveMetrics && (
                <MetricsGrid
                  metrics={liveMetrics}
                  openIncidentCount={openIncidentCount}
                  resolvedIncidentCount={resolvedIncidentCount}
                  onCriticalClick={() => {
                    setDashboardSeverityFilter('CRITICAL');
                    setDashboardStatusFilter('ALL');
                  }}
                  onOpenClick={() => {
                    setDashboardSeverityFilter('ALL');
                    setDashboardStatusFilter('ACTIVE');
                  }}
                  onTasksClick={() => goTab('tasks')}
                />
              )}
              <IncidentTable
                incidents={incidents}
                onSelectIncident={setSelectedIncident}
                searchFilter={globalSearchQuery}
                initialSeverity={dashboardSeverityFilter}
                initialStatus={dashboardStatusFilter}
                isRefreshing={isRefreshing}
              />
            </div>
          )}

          {activeTab === 'intake' && (
            <IntakePanel
              mode={intakeMode}
              onModeChange={setIntakeMode}
              onExtract={handleRunExtraction}
              isExtracting={isExtracting}
              step={intakeStep}
              onQuickSave={handleQuickSaveIncident}
              onSaveSampleLog={handleSaveSampleLog}
              defaultOwner={displayName}
              senderMemberId={user?.memberId}
              extractionResult={extractionResult}
              lastRawNotes={lastRawNotes}
              onSaveExtracted={handleSaveExtractedIncident}
              onResetExtraction={() => setExtractionResult(null)}
            />
          )}

          {activeTab === 'share' && (
            <SendToEmployeePanel
              incidents={incidents}
              senderMemberId={user?.memberId}
              onShared={() => void loadDashboardData({ silent: true })}
            />
          )}

          {activeTab === 'ask' && (
            <AgentConsole
              incidents={incidents}
              onInspectIncident={handleInspectIncidentById}
            />
          )}

          {activeTab === 'tasks' && (
            <OpenTaskBoard
              tasks={tasks}
              incidents={incidents}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onInspectIncident={handleInspectIncidentById}
            />
          )}

          {activeTab === 'chat' && (
            <TeamChatPanel
              memberId={user?.memberId}
              userName={displayName}
            />
          )}
        </>
      )}
    </AppShell>
  );
};

export default App;
