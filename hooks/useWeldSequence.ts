
import { useCallback } from 'react';
import { DxfComponent } from '../types';

interface WeldSequenceProps {
  dState: any;
  aState: any;
}

export function useWeldSequence({ dState, aState }: WeldSequenceProps) {
  
  // 获取所有参与焊接的组件（按工序排序）
  const weldingQueue = dState.dxfComponents
    .filter((c: DxfComponent) => c.isWeld && c.isVisible)
    .sort((a: DxfComponent, b: DxfComponent) => (a.sequence || 9999) - (b.sequence || 9999));

  // 为组件分配工序
  const assignSequence = useCallback((id: string) => {
    dState.setDxfComponents((prev: DxfComponent[]) => {
      const target = prev.find(c => c.id === id);
      if (!target || !target.isWeld) return prev;

      // 如果已经有工序，则取消；否则分配当前最大序号+1
      const currentMax = Math.max(0, ...prev.map(c => c.sequence || 0));
      const nextSeq = target.sequence ? undefined : currentMax + 1;

      return prev.map(c => c.id === id ? { ...c, sequence: nextSeq } : c);
    });
  }, [dState]);

  // 重置所有工序
  const resetAllSequences = useCallback(() => {
    dState.setDxfComponents((prev: DxfComponent[]) => 
      prev.map(c => ({ ...c, sequence: undefined }))
    );
  }, [dState]);

  // 自动重新排序（基于当前列表位置）
  const reorderSequences = useCallback(() => {
    dState.setDxfComponents((prev: DxfComponent[]) => {
      let count = 1;
      const sortedWelders = [...prev]
        .filter(c => c.isWeld && c.sequence)
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        
      const sortedIds = new Map(sortedWelders.map(c => [c.id, count++]));
      
      return prev.map(c => ({
        ...c,
        sequence: sortedIds.get(c.id) || c.sequence
      }));
    });
  }, [dState]);

  return {
    weldingQueue,
    assignSequence,
    resetAllSequences,
    reorderSequences
  };
}
