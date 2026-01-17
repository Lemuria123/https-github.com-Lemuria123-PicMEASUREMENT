import React, { useRef } from 'react';
import { Scale, Check, Save, RefreshCw } from 'lucide-react';
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
  saveProject: () => void;
  loadProject: (file: File) => void;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { mode, setMode, resetApp, canFinish, finishShape, saveProject, loadProject } = props;
  const reloadInputRef = useRef<HTMLInputElement>(null);
  
  const isDxfMode = mode === 'dxf_analysis' || mode === 'box_group';
  const isAiMode = mode === 'feature_analysis' || mode === 'feature';

  return (
    <div className="w-full md:w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
        <h1 className="font-bold text-sm text-white tracking-tight flex items-center gap-2">
          <Scale className="text-indigo-400" size={16}/> Mark & Weld
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

      {/* Save & Reload Toolbar at bottom */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/80 space-y-3">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase px-1">Save & Reload</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-9 text-[11px]" icon={<Save size={14}/>} onClick={saveProject}>Save</Button>
          <Button variant="secondary" className="h-9 text-[11px]" icon={<RefreshCw size={14}/>} onClick={() => reloadInputRef.current?.click()}>Reload</Button>
          <input 
            type="file" 
            ref={reloadInputRef} 
            accept=".json" 
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadProject(file);
              // 重置以允许重复选择同一文件
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
};