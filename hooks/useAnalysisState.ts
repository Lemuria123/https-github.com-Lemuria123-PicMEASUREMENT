import { useState, useEffect, useCallback } from 'react';
import { DxfMatchSettings } from '../types';

export function useAnalysisState() {
  // DXF 分析相关 UI 状态
  const [analysisTab, setAnalysisTab] = useState<'objects' | 'components' | 'detail' | 'matches'>('components');
  const [selectedComponentId, _setSelectedComponentId] = useState<string | null>(null);
  const [selectedObjectGroupKey, _setSelectedObjectGroupKey] = useState<string | null>(null);
  const [inspectComponentId, setInspectComponentId] = useState<string | null>(null);
  const [inspectMatchesParentId, setInspectMatchesParentId] = useState<string | null>(null);
  const [selectedInsideEntityIds, _setSelectedInsideEntityIds] = useState<Set<string>>(new Set());
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [hoveredObjectGroupKey, setHoveredObjectGroupKey] = useState<string | null>(null);

  // 工序模块专用状态 (Weld Sequence)
  const [hoveredSequenceNum, setHoveredSequenceNum] = useState<number | null>(null);
  const [selectedWeldPointId, setSelectedWeldPointId] = useState<string | null>(null);

  // DXF Fuzzy Match Settings
  const [showDxfSettings, setShowDxfSettings] = useState(false);
  const [dxfMatchSettings, setDxfMatchSettings] = useState<DxfMatchSettings>({
    geometryTolerance: 0.5,
    positionFuzziness: 1.0, 
    angleTolerance: 1.0,
    minMatchDistance: 0
  });

  // AI 特征搜索状态
  const [selectedAiGroupId, _setSelectedAiGroupId] = useState<string | null>(null);
  const [inspectAiMatchesParentId, setInspectAiMatchesParentId] = useState<string | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<{resolution: number, quality: number, threshold: number}>({
    resolution: 800,
    quality: 0.4,
    threshold: 0.8
  });

  const [matchStatus, setMatchStatus] = useState<{text: string, type: 'success' | 'info'} | null>(null);
  const [dialogUnit, setDialogUnit] = useState<string>('mm');

  const clearAllSelections = useCallback(() => {
    _setSelectedComponentId(null);
    _setSelectedObjectGroupKey(null);
    _setSelectedInsideEntityIds(new Set());
    _setSelectedAiGroupId(null);
    setSelectedWeldPointId(null);
    setHoveredComponentId(null);
    setHoveredEntityId(null);
    setHoveredFeatureId(null);
    setHoveredObjectGroupKey(null);
    setHoveredSequenceNum(null);
  }, []);

  const setSelectedComponentId = useCallback((id: string | null) => {
    if (id !== null) clearAllSelections();
    _setSelectedComponentId(id);
  }, [clearAllSelections]);

  const setSelectedObjectGroupKey = useCallback((key: string | null) => {
    if (key !== null) clearAllSelections();
    _setSelectedObjectGroupKey(key);
  }, [clearAllSelections]);

  const setSelectedInsideEntityIds = useCallback((setter: any) => {
    _setSelectedInsideEntityIds(prev => {
        const next = typeof setter === 'function' ? setter(prev) : setter;
        if (next.size > 0 && prev.size === 0) {
            _setSelectedComponentId(null);
            _setSelectedObjectGroupKey(null);
            _setSelectedAiGroupId(null);
        }
        return next;
    });
  }, []);

  const setSelectedAiGroupId = useCallback((id: string | null) => {
    if (id !== null) clearAllSelections();
    _setSelectedAiGroupId(id);
  }, [clearAllSelections]);

  useEffect(() => {
    if (matchStatus) {
      const t = setTimeout(() => setMatchStatus(null), 3000);
      return () => clearTimeout(t);
    }
  }, [matchStatus]);

  return {
    analysisTab, setAnalysisTab,
    selectedComponentId, setSelectedComponentId,
    selectedObjectGroupKey, setSelectedObjectGroupKey,
    inspectComponentId, setInspectComponentId,
    inspectMatchesParentId, setInspectMatchesParentId,
    selectedInsideEntityIds, setSelectedInsideEntityIds,
    hoveredEntityId, setHoveredEntityId,
    hoveredComponentId, setHoveredComponentId,
    hoveredObjectGroupKey, setHoveredObjectGroupKey,
    selectedAiGroupId, setSelectedAiGroupId,
    inspectAiMatchesParentId, setInspectAiMatchesParentId,
    hoveredFeatureId, setHoveredFeatureId,
    showAiSettings, setShowAiSettings,
    aiSettings, setAiSettings,
    showDxfSettings, setShowDxfSettings,
    dxfMatchSettings, setDxfMatchSettings,
    matchStatus, setMatchStatus,
    dialogUnit, setDialogUnit,
    clearAllSelections,
    hoveredSequenceNum, setHoveredSequenceNum,
    selectedWeldPointId, setSelectedWeldPointId
  };
}
