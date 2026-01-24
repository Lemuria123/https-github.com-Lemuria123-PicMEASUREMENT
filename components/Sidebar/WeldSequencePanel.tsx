import React, { useMemo, useCallback } from 'react';
import { Layers, Trash2, Zap, Target, MousePointer2, ChevronRight, Hash, X, Play } from 'lucide-react';
import { Button } from '../Button';
import { DxfComponent } from '../../types';

export interface WeldSequencePanelProps {
  dxfComponents: DxfComponent[];
  updateComponentProperty: (id: string, prop: any, val: any) => void;
  selectedWeldPointId: string | null;
  setSelectedWeldPointId: (id: string | null) => void;
  hoveredSequenceNum: number | null;
  setHoveredSequenceNum: (num: number | null) => void;
  setHoveredComponentId: (id: string | null) => void;
  setMatchStatus: (status: any) => void;
}

export const WeldSequencePanel: React.FC<WeldSequencePanelProps> = ({
  dxfComponents,
  updateComponentProperty,
  selectedWeldPointId,
  setSelectedWeldPointId,
  hoveredSequenceNum,
  setHoveredSequenceNum,
  setHoveredComponentId,
  setMatchStatus
}) => {
  
  // 仅获取标记为 Weld 的组件
  const weldPoints = useMemo(() => dxfComponents.filter(c => c.isWeld), [dxfComponents]);
  
  // 按工序编号分组
  const sequenceGroups = useMemo(() => {
    const groups: Map<number, DxfComponent[]> = new Map();
    weldPoints.forEach(p => {
        const seq = p.sequence || 0;
        if (!groups.has(seq)) groups.set(seq, []);
        groups.get(seq)!.push(p);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [weldPoints]);

  const handleSetSequence = (id: string, seq: number) => {
    updateComponentProperty(id, 'sequence', seq);
    setMatchStatus({ text: `Assigned Sequence ${seq} to point.`, type: 'success' });
  };

  const clearSequence = (id: string) => {
    updateComponentProperty(id, 'sequence', 0);
  };

  const handleClearAll = useCallback(() => {
    weldPoints.forEach(p => updateComponentProperty(p.id, 'sequence', 0));
    setMatchStatus({ text: "All execution sequences cleared.", type: 'info' });
  }, [weldPoints, updateComponentProperty, setMatchStatus]);

  const handleAutoAssign = useCallback(() => {
    weldPoints.forEach((p, idx) => updateComponentProperty(p.id, 'sequence', idx + 1));
    setMatchStatus({ text: `Auto-assigned sequence to ${weldPoints.length} points.`, type: 'success' });
  }, [weldPoints, updateComponentProperty, setMatchStatus]);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3 animate-in fade-in">
      <div className="flex justify-between items-center px-1 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
           <Zap size={14} className="text-emerald-400" />
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Execution Order</span>
        </div>
        <span className="text-[10px] font-mono text-slate-600">{weldPoints.length} TOTAL POINTS</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar space-y-4">
        {sequenceGroups.length === 0 ? (
          <div className="text-center py-12 opacity-20 flex flex-col items-center gap-2">
            <Target size={24}/>
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">No Weld Points Defined</span>
          </div>
        ) : (
          sequenceGroups.map(([seq, points]) => (
            <div 
              key={seq} 
              className={`space-y-1.5 transition-all ${hoveredSequenceNum === seq ? 'scale-[1.01]' : ''}`}
              onMouseEnter={() => setHoveredSequenceNum(seq === 0 ? null : seq)}
              onMouseLeave={() => setHoveredSequenceNum(null)}
            >
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                   <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${seq === 0 ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 text-white shadow-sm'}`}>
                     {seq === 0 ? '?' : seq}
                   </div>
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                     {seq === 0 ? 'Unassigned' : `Sequence ${seq}`}
                   </span>
                </div>
                <span className="text-[9px] font-bold text-slate-600">{points.length} PTS</span>
              </div>

              <div className="grid grid-cols-1 gap-1 pl-1">
                {points.map(p => {
                  const isSelected = selectedWeldPointId === p.id;
                  return (
                    <div 
                      key={p.id}
                      onClick={() => setSelectedWeldPointId(isSelected ? null : p.id)}
                      onMouseEnter={() => setHoveredComponentId(p.id)}
                      onMouseLeave={() => setHoveredComponentId(null)}
                      className={`group flex items-center justify-between px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-emerald-500/10 border-emerald-500/50' 
                          : 'bg-slate-900/30 border-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className={`text-[10px] font-bold truncate tracking-tight ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                          {p.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {seq === 0 ? (
                           <div className="flex gap-1">
                             {[1, 2, 3].map(n => (
                               <button 
                                 key={n} 
                                 onClick={(e) => { e.stopPropagation(); handleSetSequence(p.id, n); }}
                                 className="w-4 h-4 rounded bg-slate-800 hover:bg-emerald-600 text-[8px] font-black transition-colors"
                               >
                                 {n}
                               </button>
                             ))}
                           </div>
                        ) : (
                           <button 
                             onClick={(e) => { e.stopPropagation(); clearSequence(p.id); }}
                             className="p-1 text-slate-600 hover:text-red-400"
                           >
                             <X size={10} />
                           </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2 bg-slate-900/40 rounded-xl border border-slate-800 shrink-0 space-y-2">
        <p className="text-[9px] text-slate-500 leading-tight px-1 italic">
          Tip: Hover a point and press 0-9 to assign sequence directly.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-8 text-[9px]" icon={<Play size={12} className="text-emerald-400" />} onClick={handleAutoAssign}>Auto Assign</Button>
          <Button variant="danger" className="h-8 text-[9px]" icon={<Trash2 size={12}/>} onClick={handleClearAll}>Clear All</Button>
        </div>
      </div>
    </div>
  );
};
