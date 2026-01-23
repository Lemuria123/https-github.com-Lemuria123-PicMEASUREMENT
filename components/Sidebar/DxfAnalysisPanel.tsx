
import React from 'react';
import { MousePointer2, Pentagon, Download, Search, Settings, Target, X, Zap, Layers } from 'lucide-react';
import { Button } from '../Button';
import { DxfComponent, DxfEntity, AppMode, Point } from '../../types';
import { DxfObjectList } from './DxfObjectList';
import { DxfGroupList } from './DxfGroupList';
import { DxfDetailView } from './DxfDetailView';
import { DxfMatchView } from './DxfMatchView';

export interface DxfAnalysisPanelProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  setCurrentPoints: (pts: Point[]) => void;
  analysisTab: 'objects' | 'components' | 'detail' | 'matches';
  setAnalysisTab: (tab: any) => void;
  topLevelComponents: DxfComponent[];
  dxfComponents: DxfComponent[];
  dxfEntities: DxfEntity[];
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  selectedObjectGroupKey: string | null;
  setSelectedObjectGroupKey: (key: string | null) => void;
  inspectComponentId: string | null;
  setInspectComponentId: (id: string | null) => void;
  inspectMatchesParentId: string | null;
  setInspectMatchesParentId: (id: string | null) => void;
  selectedInsideEntityIds: Set<string>;
  toggleEntityInSelection: (id: string) => void;
  setHoveredEntityId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;
  setHoveredObjectGroupKey: (key: string | null) => void;
  entitySizeGroups: any[];
  createAutoGroup: (key: string, type: 'weld' | 'mark') => void;
  handleAutoMatch: () => void;
  updateComponentProperty: (id: string, prop: any, val: boolean) => void;
  updateComponentColor: (id: string, color: string) => void;
  confirmDeleteComponent: (id: string) => void;
  confirmDeleteAllMatches: (parentId: string) => void;
  handleMoveSelectionToNewGroup: () => void;
  handleRemoveSingleEntity: (id: string) => void;
  handleRemoveChildGroup: (id: string) => void;
  currentInspectedEntities: DxfEntity[];
  currentInspectedChildGroups: DxfComponent[];
  currentMatchedGroups: DxfComponent[];
  isProcessing: boolean;
  exportCSV: () => void;
  setShowDxfSettings: (show: boolean) => void;
  dxfSearchROI: Point[];
  setDxfSearchROI: (pts: Point[]) => void;
}

export const DxfAnalysisPanel: React.FC<DxfAnalysisPanelProps> = (props) => {
  const {
    mode, setMode, setCurrentPoints, analysisTab, setAnalysisTab, 
    selectedComponentId, setSelectedComponentId, setSelectedObjectGroupKey, 
    inspectComponentId, setInspectComponentId, inspectMatchesParentId, setInspectMatchesParentId,
    isProcessing, exportCSV, setShowDxfSettings, dxfSearchROI, setDxfSearchROI
  } = props;

  // --- 分支渲染：Detail 视图 ---
  if (analysisTab === 'detail' && inspectComponentId) {
    return <DxfDetailView {...props} />;
  }

  // --- 分支渲染：Matches 视图 ---
  if (analysisTab === 'matches' && inspectMatchesParentId) {
    return <DxfMatchView {...props} />;
  }

  const hasSearchROI = dxfSearchROI && dxfSearchROI.length === 2;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-2.5 animate-in fade-in">
      <div className="flex justify-between items-center bg-slate-900/60 p-0.5 rounded-xl border border-slate-800">
        <button onClick={() => setShowDxfSettings(true)} className="p-1 text-slate-500 hover:text-emerald-400 transition-colors rounded-lg ml-0.5"><Settings size={14} /></button>
        <div className="flex gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800/50">
          <button onClick={() => { setAnalysisTab('objects'); setSelectedComponentId(null); }} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${analysisTab === 'objects' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Entities</button>
          <button onClick={() => { setAnalysisTab('components'); setSelectedObjectGroupKey(null); }} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${analysisTab === 'components' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Groups</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-950/20 rounded-xl border border-slate-900/50 overflow-y-auto scrollbar-none hide-scrollbar shadow-inner">
        {analysisTab === 'objects' ? (
          <DxfObjectList {...props} />
        ) : (
          <DxfGroupList {...props} />
        )}
      </div>

      <div className="space-y-2 shrink-0 pt-1">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'box_rect' ? 'primary' : 'secondary'} className="h-9" icon={<MousePointer2 size={13}/>} onClick={() => { if (mode === 'box_rect') setCurrentPoints([]); setMode(mode === 'box_rect' ? 'dxf_analysis' : 'box_rect'); }}>{mode === 'box_rect' ? 'CANCEL' : 'RECT'}</Button>
          <Button variant={mode === 'box_poly' ? 'primary' : 'secondary'} className="h-9" icon={<Pentagon size={13}/>} onClick={() => { if (mode === 'box_poly') setCurrentPoints([]); setMode(mode === 'box_poly' ? 'dxf_analysis' : 'box_poly'); }}>{mode === 'box_poly' ? 'CANCEL' : 'POLY'}</Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className={`h-9 ${selectedComponentId ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'opacity-40'}`} icon={<Search size={14} className={isProcessing ? "animate-spin" : ""}/>} disabled={!selectedComponentId || isProcessing} onClick={props.handleAutoMatch}>{isProcessing ? "FINDING..." : "FIND"}</Button>
          <Button variant={mode === 'box_find_roi' ? 'primary' : (hasSearchROI ? 'primary' : 'secondary')} className={`h-9 ${hasSearchROI && mode !== 'box_find_roi' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}`} onClick={() => { if (mode === 'box_find_roi') { setCurrentPoints([]); setMode('dxf_analysis'); } else if (hasSearchROI) { setDxfSearchROI([]); } else { setMode('box_find_roi'); } }}>{hasSearchROI && mode !== 'box_find_roi' ? <X size={16}/> : <Target size={16}/>}</Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant={mode === 'manual_weld' ? 'primary' : 'secondary'} 
            className={`h-9 ${mode === 'manual_weld' ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-800/40 border-slate-700/50 hover:border-emerald-500/40 text-emerald-400/80'}`} 
            icon={<Zap size={13}/>} 
            onClick={() => { if (mode === 'manual_weld') setCurrentPoints([]); setMode(mode === 'manual_weld' ? 'dxf_analysis' : 'manual_weld'); }}
          >
            {mode === 'manual_weld' ? 'CANCEL' : 'WELD PT'}
          </Button>
          <Button variant="ghost" className="h-9 text-slate-600 border border-slate-900/50 hover:text-slate-300" icon={<Download size={13}/>} onClick={exportCSV}>EXPORT</Button>
        </div>
      </div>
    </div>
  );
};
