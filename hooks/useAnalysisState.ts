
import { useState, useEffect, useCallback } from 'react';

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

  // AI 特征搜索相关 UI 状态
  const [selectedAiGroupId, _setSelectedAiGroupId] = useState<string | null>(null);
  const [inspectAiMatchesParentId, setInspectAiMatchesParentId] = useState<string | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<{resolution: number, quality: number, threshold: number}>({
    resolution: 800,
    quality: 0.4,
    threshold: 0.8
  });

  // 反馈与弹窗单位状态
  const [matchStatus, setMatchStatus] = useState<{text: string, type: 'success' | 'info'} | null>(null);
  const [dialogUnit, setDialogUnit] = useState<string>('mm');

  // --- Exclusive Selection Wrappers ---
  
  const clearAllSelections = useCallback(() => {
    _setSelectedComponentId(null);
    _setSelectedObjectGroupKey(null);
    _setSelectedInsideEntityIds(new Set());
    _setSelectedAiGroupId(null);
    // Also clear hovers to satisfy requirement 6
    setHoveredComponentId(null);
    setHoveredEntityId(null);
    setHoveredFeatureId(null);
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
    // If we are adding to selection, clear other categories
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

  // 反馈消息自动清理逻辑
  useEffect(() => {
    if (matchStatus) {
      const t = setTimeout(() => setMatchStatus(null), 3000);
      return () => clearTimeout(t);
    }
  }, [matchStatus]);

  // Handle Tab changes to clear hovers
  useEffect(() => {
    setHoveredComponentId(null);
    setHoveredEntityId(null);
    setHoveredFeatureId(null);
  }, [analysisTab]);

  return {
    analysisTab, setAnalysisTab,
    selectedComponentId, setSelectedComponentId,
    selectedObjectGroupKey, setSelectedObjectGroupKey,
    inspectComponentId, setInspectComponentId,
    inspectMatchesParentId, setInspectMatchesParentId,
    selectedInsideEntityIds, setSelectedInsideEntityIds,
    hoveredEntityId, setHoveredEntityId,
    hoveredComponentId, setHoveredComponentId,
    selectedAiGroupId, setSelectedAiGroupId,
    inspectAiMatchesParentId, setInspectAiMatchesParentId,
    hoveredFeatureId, setHoveredFeatureId,
    showAiSettings, setShowAiSettings,
    aiSettings, setAiSettings,
    matchStatus, setMatchStatus,
    dialogUnit, setDialogUnit,
    clearAllSelections
  };
}
