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

const PAGE: Record<NavTab, { title: string; description: string }> = {
  dashboard: {
    title: 'Operations dashboard',
    description: 'Metrics, shift handoff, and incident queue.',
  },
  intake: {
    title: 'New incident',
    description: 'Quick add with a name and few log lines, or use AI extract.',
  },
  ask: {
    title: 'Ask AI',
    description: 'Search incident memory and get recommended next steps.',
  },
  tasks: {
    title: 'Task board',
    description: 'Track action items across active incidents.',
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

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [shiftHandoff, setShiftHandoff] = useState<ShiftHandoff | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tasks, setTasks] = useState<ActionItemTask[]>([]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('quick');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [lastRawNotes, setLastRawNotes] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  const intakeStep: 1 | 2 | 3 = extractionResult ? 3 : isExtracting ? 2 : 1;

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

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

  const handleSaveExtractedIncident = async (newIncident: Incident) => {
    try {
      await apiService.saveIncident(newIncident);
      await loadDashboardData();
      setSelectedIncident(newIncident);
      toast(`Incident ${newIncident.id} saved`, 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      toast('Save failed', 'error');
    }
  };

  const handleQuickSaveIncident = async (newIncident: Incident) => {
    try {
      await apiService.saveIncident(newIncident);
      await loadDashboardData();
      toast(`Incident ${newIncident.id} saved to database`, 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      toast('Save failed', 'error');
      throw err;
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
  };

  const investigatingCount = incidents.filter((i) => i.status === 'INVESTIGATING').length;
  const incomingLead = shiftHandoff ? firstName(shiftHandoff.incomingLead) : 'Yash';
  const displayName = user?.name ?? incomingLead;

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
      userRole={user?.role}
      onLogout={requiresAuth ? handleLogout : undefined}
    >
      {error && (
        <div className="mb-5">
          <ErrorAlert message={error} onRetry={loadDashboardData} />
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
          <PageHeader title={PAGE[activeTab].title} description={PAGE[activeTab].description} />

          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {shiftHandoff && (
                <HandoffCard
                  handoff={shiftHandoff}
                  investigatingCount={investigatingCount}
                  onAcknowledge={handleAcknowledgeHandoff}
                />
              )}
              {metrics && (
                <MetricsGrid
                  metrics={metrics}
                  onCriticalClick={() => setDashboardSeverityFilter('SEV-1')}
                  onTasksClick={() => goTab('tasks')}
                />
              )}
              <IncidentTable
                incidents={incidents}
                onSelectIncident={setSelectedIncident}
                searchFilter={globalSearchQuery}
                initialSeverity={dashboardSeverityFilter}
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
              extractionResult={extractionResult}
              lastRawNotes={lastRawNotes}
              onSaveExtracted={handleSaveExtractedIncident}
              onResetExtraction={() => setExtractionResult(null)}
            />
          )}

          {activeTab === 'ask' && (
            <AgentConsole
              incidents={incidents}
              onInspectIncident={handleInspectIncidentById}
              onGoToTasks={() => goTab('tasks')}
            />
          )}

          {activeTab === 'tasks' && (
            <OpenTaskBoard
              tasks={tasks}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onInspectIncident={handleInspectIncidentById}
            />
          )}
        </>
      )}
    </AppShell>
  );
};

export default App;
