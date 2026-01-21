
import React from 'react';
import { ScanFace, Settings, Check, ChevronLeft, Trash2, Target, Loader2, Search, Download } from 'lucide-react';
import { Button } from '../Button';
import { AiFeatureGroup, AppMode, Point } from '../../types';

export interface AiAnalysisPanelProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  setCurrentPoints: (pts: Point[]) => void;
  setShowAiSettings: (show: boolean) => void;
  topLevelAiGroups: AiFeatureGroup[];
  aiFeatureGroups: AiFeatureGroup[];
  selectedAiGroupId: string | null;
  setSelectedAiGroupId: (id: string | null) => void;
  inspectAiMatchesParentId: string | null;
  setInspectAiMatchesParentId: (id: string | null) => void;
  currentMatchedAiGroups: AiFeatureGroup[];
  setHoveredFeatureId: (id: string | null) => void;
  updateAiGroupColor: (id: string, color: string) => void;
  updateAiGroupProperty: (id: string, prop: any, val: boolean) => void;
  deleteAiGroup: (id: string) => void;
  isSearchingFeatures: boolean;
  performFeatureSearch: () => void;
  getLogicCoords: (p: any) => any;
  exportCSV: () => void;
}

export const AiAnalysisPanel: React.FC<AiAnalysisPanelProps> = ({
  mode,
  setMode,
  setCurrentPoints,
  setShowAiSettings,
  topLevelAiGroups,
  aiFeatureGroups,
  selectedAiGroupId,
  setSelectedAiGroupId,
  inspectAiMatchesParentId,
  setInspectAiMatchesParentId,
  currentMatchedAiGroups,
  setHoveredFeatureId,
  updateAiGroupColor,
  updateAiGroupProperty,
  deleteAiGroup,
  isSearchingFeatures,
  performFeatureSearch,
  getLogicCoords,
  exportCSV
}) => {
  if (inspectAiMatchesParentId) {
    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button onClick={() => { setInspectAiMatchesParentId(null); setSelectedAiGroupId(null); setHoveredFeatureId(null); }} className="p-1 text-slate-500 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
          <div className="flex-1 truncate"><h3 className="text-xs font-bold text-white truncate">Matches for {aiFeatureGroups.find(g => g.id === inspectAiMatchesParentId)?.name}</h3></div>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
          {currentMatchedAiGroups.map(match => {
            const feat = match.features[0];
            const centerPoint = { x: (feat.minX + feat.maxX) / 2, y: (feat.minY + feat.maxY) / 2 };
            const coords = getLogicCoords(centerPoint);
            return (
              <div key={match.id} onClick={() => setSelectedAiGroupId(match.id)} onMouseEnter={() => setHoveredFeatureId(match.features[0].id)} onMouseLeave={() => setHoveredFeatureId(null)} className={`p-2 rounded border cursor-pointer transition-all group flex flex-col gap-2 ${selectedAiGroupId === match.id ? 'bg-violet-500/10 border-violet-500/50' : 'bg-slate-800/20 border-slate-800 hover:bg-slate-800/40'}`}>
                <div className="flex justify-between items-center"><span className={`text-[11px] font-bold ${selectedAiGroupId === match.id ? 'text-white' : 'text-slate-300'}`}>{match.name}</span><button onClick={(e) => { e.stopPropagation(); deleteAiGroup(match.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 transition-opacity"><Trash2 size={10}/></button></div>
                <div className="flex justify-between items-center">{coords ? (<div className="flex gap-2 text-[10px] font-mono"><span className="text-violet-300/80 bg-violet-500/10 px-1 rounded">X:{coords.x.toFixed(2)}</span><span className="text-violet-300/80 bg-violet-500/10 px-1 rounded">Y:{coords.y.toFixed(2)}</span></div>) : <span className="text-[9px] text-slate-500 italic">No Origin Set</span>}<div className="flex gap-1.5"><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(match.id, 'isWeld', !match.isWeld); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${match.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>WELD</button><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(match.id, 'isMark', !match.isMark); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${match.isMark ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>MARK</button></div></div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
      <div className="flex items-center justify-between bg-violet-950/20 p-2 rounded-lg border border-violet-500/20">
        <div className="flex items-center gap-2"><ScanFace className="text-violet-400" size={16} /><span className="text-xs font-bold text-violet-100">AI Analysis</span></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAiSettings(true)} className="text-slate-500 hover:text-violet-400 transition-colors"><Settings size={14} /></button>
          <Button variant="ghost" onClick={() => { setCurrentPoints([]); setMode('measure'); }} className="h-6 text-[9px] px-2 hover:bg-violet-500/20"><span className="flex items-center gap-1"><Check size={11} strokeWidth={2.5} /><span>DONE</span></span></Button>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase px-1 border-b border-slate-800 pb-2">Feature Definitions</h3>
        <div className="bg-slate-900/50 rounded-lg p-1 min-h-[200px] border border-slate-800 overflow-y-auto max-h-[350px] scrollbar-thin">
          {topLevelAiGroups.length === 0 ? <div className="text-center py-8 opacity-50 flex flex-col items-center gap-2 font-bold"><ScanFace size={24}/><span className="text-[10px]">NO FEATURES</span></div> : 
            topLevelAiGroups.map(group => {
              const isSel = selectedAiGroupId === group.id;
              const matchCount = aiFeatureGroups.filter(g => g.parentGroupId === group.id).length;
              const feat = group.features[0];
              const centerPoint = { x: (feat.minX + feat.maxX) / 2, y: (feat.minY + feat.maxY) / 2 };
              const coords = getLogicCoords(centerPoint);
              return (
                <div key={group.id} onClick={() => setSelectedAiGroupId(group.id)} onMouseEnter={() => setHoveredFeatureId(group.features[0].id)} onMouseLeave={() => setHoveredFeatureId(null)} className={`p-2 rounded border cursor-pointer flex flex-col gap-2 transition-all ${isSel ? 'bg-violet-500/10 border-violet-500/50' : 'bg-slate-800/30 border-slate-800 hover:border-slate-600'}`}>
                  <div className="flex justify-between items-center gap-2"><div className="flex items-center gap-2 truncate"><input type="color" value={group.color} onChange={(e) => updateAiGroupColor(group.id, e.target.value)} className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent shrink-0" onClick={e => e.stopPropagation()} /><span className={`font-bold truncate ${isSel ? 'text-white' : 'text-slate-400'}`}>{group.name}</span></div><button onClick={(e) => { e.stopPropagation(); deleteAiGroup(group.id); }} className="text-slate-600 hover:text-red-400 shrink-0"><Trash2 size={12}/></button></div>
                  {coords && (<div className="flex gap-3 text-[9px] font-mono border-t border-slate-800/30 pt-1.5 opacity-80"><div className="flex gap-1"><span className="text-slate-500">X:</span><span className="text-violet-300">{coords.x.toFixed(2)}</span></div><div className="flex gap-1"><span className="text-slate-500">Y:</span><span className="text-violet-300">{coords.y.toFixed(2)}</span></div></div>)}
                  <div className="flex justify-between items-center border-t border-slate-800/50 pt-1"><div className="flex items-center gap-1.5">{matchCount > 0 && <span onClick={(e) => { e.stopPropagation(); setInspectAiMatchesParentId(group.id); setSelectedAiGroupId(null); }} className="text-[9px] text-violet-400 font-bold hover:text-violet-300 px-1.5 hover:bg-violet-500/10 rounded border border-violet-500/20 uppercase transition-colors">{matchCount} MATCHES</span>}</div><div className="flex gap-1.5 shrink-0"><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(group.id, 'isWeld', !group.isWeld); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${group.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>WELD</button><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(group.id, 'isMark', !group.isMark); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${group.isMark ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>MARK</button></div></div>
                </div>
              );
            })
          }
        </div>
      </div>
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <Button 
          variant={mode === 'feature' ? 'primary' : 'secondary'} 
          className="w-full h-9 text-[11px] bg-violet-600 shadow-none border-violet-500/50" 
          icon={<Target size={14}/>} 
          onClick={() => {
            if (mode === 'feature') setCurrentPoints([]);
            setMode(mode === 'feature' ? 'feature_analysis' : 'feature');
          }}
        >
          {mode === 'feature' ? 'Cancel' : 'Define Feature Area (Rect)'}
        </Button>
        
        <Button 
          variant="secondary" 
          className={`w-full h-10 text-[11px] font-black uppercase tracking-widest ${selectedAiGroupId ? 'bg-violet-600/10 text-violet-400 border-violet-500/30' : 'opacity-60 cursor-not-allowed'}`} 
          icon={isSearchingFeatures ? <Loader2 className="animate-spin" size={14}/> : <Search size={14}/>} 
          disabled={!selectedAiGroupId || isSearchingFeatures} 
          onClick={performFeatureSearch}
        >
          {isSearchingFeatures ? "Analyzing Image..." : "Find Similar Instances"}
        </Button>

        <Button 
          variant="secondary" 
          className="w-full h-9 text-[11px] font-bold text-slate-300 hover:text-white border-slate-700/50 shadow-none" 
          icon={<Download size={14}/>} 
          onClick={exportCSV}
        >
          Export CSV
        </Button>
      </div>
    </div>
  );
};
