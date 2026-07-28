import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { NotesForm } from './NotesForm';
import { QuickIntakeForm } from './QuickIntakeForm';
import { ExtractionResultView } from './ExtractionResultView';
import type { ExtractionResult, Incident } from '../../types/incident';

export type IntakeMode = 'quick' | 'ai';

interface IntakePanelProps {
  mode: IntakeMode;
  onModeChange: (mode: IntakeMode) => void;
  onExtract: (notes: string) => void;
  isExtracting: boolean;
  step: 1 | 2 | 3;
  onQuickSave: (incident: Incident) => Promise<void>;
  onSaveSampleLog?: (log: { title: string; content: string; category?: string }) => Promise<void>;
  defaultOwner?: string;
  extractionResult: ExtractionResult | null;
  lastRawNotes: string;
  onSaveExtracted: (incident: Incident) => void;
  onResetExtraction: () => void;
}

export const IntakePanel: React.FC<IntakePanelProps> = ({
  mode,
  onModeChange,
  onExtract,
  isExtracting,
  step,
  onQuickSave,
  onSaveSampleLog,
  defaultOwner,
  extractionResult,
  lastRawNotes,
  onSaveExtracted,
  onResetExtraction,
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
      />
    ) : (
      <>
        <NotesForm onExtract={onExtract} isExtracting={isExtracting} step={step} />
        {extractionResult && (
          <ExtractionResultView
            result={extractionResult}
            rawNotes={lastRawNotes}
            onSave={onSaveExtracted}
            onReset={onResetExtraction}
          />
        )}
      </>
    )}
  </div>
);
