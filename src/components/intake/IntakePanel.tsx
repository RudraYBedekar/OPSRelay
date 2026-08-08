import React from 'react';
import { Sparkle, Lightning } from '@phosphor-icons/react';
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
    <div className="flex rounded-md border border-ops-border bg-ops-bg p-0.5">
      <button
        type="button"
        onClick={() => onModeChange('quick')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[6px] px-3 py-2 text-sm font-medium min-h-[40px] transition-colors duration-150 ${
          mode === 'quick' ? 'bg-white text-ops-text shadow-sm border border-ops-border/60' : 'text-ops-subtext hover:text-ops-text'
        }`}
      >
        <Lightning size={16} weight="regular" aria-hidden /> Quick add
      </button>
      <button
        type="button"
        onClick={() => onModeChange('ai')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[6px] px-3 py-2 text-sm font-medium min-h-[40px] transition-colors duration-150 ${
          mode === 'ai' ? 'bg-white text-ops-text shadow-sm border border-ops-border/60' : 'text-ops-subtext hover:text-ops-text'
        }`}
      >
        <Sparkle size={16} weight="regular" aria-hidden /> AI extract
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
        <NotesForm onExtract={onSaveAndAnalyze} isExtracting={isAnalyzing} step={step} savedIncidentId={savedIncidentId} />
        {savedIncidentId && analysisFailed && !extractionResult && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">
              Incident saved as <span className="font-mono">{savedIncidentId}</span>
            </p>
            <p className="text-sm text-amber-900/90">
              AI analysis failed or timed out. Your notes are already in the database — retry analysis or open the incident.
            </p>
            <div className="flex flex-wrap gap-2">
              {onRetryAnalysis && (
                <button type="button" onClick={onRetryAnalysis} className="ops-btn-primary text-sm min-h-[36px]">
                  Retry analysis
                </button>
              )}
              <button type="button" onClick={onResetExtraction} className="ops-btn-secondary text-sm min-h-[36px]">
                Start over
              </button>
            </div>
          </div>
        )}
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
