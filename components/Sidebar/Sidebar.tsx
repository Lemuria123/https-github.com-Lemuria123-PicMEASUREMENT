
import React from 'react';
import { Scale, Check } from 'lucide-react';
import { Button } from '../Button';
import { MeasurementToolsPanel, MeasurementToolsPanelProps } from './MeasurementToolsPanel';
import { DxfAnalysisPanel, DxfAnalysisPanelProps } from './DxfAnalysisPanel';
import { AiAnalysisPanel, AiAnalysisPanelProps } from './AiAnalysisPanel';
import { AppMode } from '../../types';

export interface SidebarProps extends 
  MeasurementToolsPanelProps, 
  DxfAnalysisPanelProps, 
  AiAnalysisPanelProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  resetApp: () => void;
  canFinish: boolean;
  finishShape: () => void;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { mode, setMode, resetApp, canFinish, finishShape } = props;
  
  const isDxfMode = mode === 'dxf_analysis' || mode === 'box_group';
  const isAiMode = mode === 'feature_analysis' || mode === 'feature';

  return (
    <div className="w-full md:w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
        <h1 className="font-bold text-sm text-white tracking-tight flex items-center gap-2">
          <Scale className="text-indigo-400" size={16}/> MetricMate
        </h1>
        <button onClick={resetApp} className="text-[9px] text-slate-500 hover:text-red-400 font-bold uppercase transition-colors">RESET</button>
      </div>

      <div className="p-3 space-y-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {isDxfMode ? (
          <DxfAnalysisPanel {...props} />
        ) : isAiMode ? (
          <AiAnalysisPanel {...props} />
        ) : (
          <MeasurementToolsPanel {...props} />
        )}
        
        {canFinish && (
          <Button 
            variant="primary" 
            className="h-9 text-[11px] w-full bg-emerald-600 shadow-emerald-500/20" 
            onClick={finishShape} 
            icon={<Check size={16}/>}
          >
            CONFIRM (ENTER)
          </Button>
        )}
      </div>
    </div>
  );
};
