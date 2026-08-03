import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { NotesForm } from './NotesForm';
import { QuickIntakeForm } from './QuickIntakeForm';
import { ExtractionResultView } from './ExtractionResultView';
import type { ExtractionResult, Incident } from '../../types/incident';
import type { AnalysisRun } from '../../types/alertFatigue';

export type IntakeMode = 'quick' | 'ai';

interface IntakePanelProps {
  mode: IntakeMode;
  onModeChange: (mode: IntakeMode) => void;
  onSaveAndAnalyze: (notes: string) => void;
  isAnalyzing: boolean;
  step: 1 | 2 | 3;
  onQuickSave: (incident: Incident, shareWithMemberId?: string) => Promise<void>;
  onSaveSampleLog?: (log: { title: string; content: string; category?: string }) => Promise<void>;
  defaultOwner?: string;
  senderMemberId?: string;
  extractionResult: ExtractionResult | null;
  savedIncidentId?: string;
  analysisRun?: AnalysisRun | null;
  analysisJobs?: Array<{ jobType: string; status: string }>;
  lastRawNotes: string;
  onApproveExtracted: (incidentId: string, runId: string, draft: ExtractionResult, shareWithMemberId?: string) => Promise<void>;
  onRetryAnalysis?: () => void;
  onResetExtraction: () => void;
  analysisFailed?: boolean;
}

export const IntakePanel: React.FC<IntakePanelProps> = ({
  mode,
  onModeChange,
  onSaveAndAnalyze,
  isAnalyzing,
  step,
  onQuickSave,
  onSaveSampleLog,
  defaultOwner,
  senderMemberId,
  extractionResult,
  savedIncidentId,
  analysisRun,
  analysisJobs,
  lastRawNotes,
  onApproveExtracted,
  onRetryAnalysis,
  onResetExtraction,
  analysisFailed,
}) => (
  <div className="space-y-5">
    <div className="flex rounded-xl border border-ops-border bg-slate-50/80 p-1">
      <button
        type="button"
        onClick={() => onModeChange('quick')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
          mode === 'quick' ? 'bg-white text-ops-text shadow-sm' : 'text-ops-subtext hover:text-ops-text'
        }`}
      >
        <Zap className="h-4 w-4" aria-hidden /> Quick add
      </button>
      <button
        type="button"
        onClick={() => onModeChange('ai')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
          mode === 'ai' ? 'bg-white text-ops-text shadow-sm' : 'text-ops-subtext hover:text-ops-text'
        }`}
      >
        <Sparkles className="h-4 w-4" aria-hidden /> AI extract
      </button>
    </div>

    {mode === 'quick' ? (
      <QuickIntakeForm
        onSave={onQuickSave}
        onSaveSampleLog={onSaveSampleLog}
        defaultOwner={defaultOwner}
        senderMemberId={senderMemberId}
      />
    ) : (
      <>
        <NotesForm onExtract={onSaveAndAnalyze} isExtracting={isAnalyzing} step={step} />
        {extractionResult && savedIncidentId && analysisRun && (
          <ExtractionResultView
            result={extractionResult}
            rawNotes={lastRawNotes}
            incidentId={savedIncidentId}
            runId={analysisRun.id}
            onApprove={onApproveExtracted}
            onRetryAnalysis={onRetryAnalysis}
            onReset={onResetExtraction}
            senderMemberId={senderMemberId}
            analysisFailed={analysisFailed}
            jobs={analysisJobs}
          />
        )}
      </>
    )}
  </div>
);
