
import { useState, useEffect } from 'react';

export function useAnalysisState() {
  // DXF 分析相关 UI 状态
  const [analysisTab, setAnalysisTab] = useState<'objects' | 'components' | 'detail' | 'matches'>('components');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedObjectGroupKey, setSelectedObjectGroupKey] = useState<string | null>(null);
  const [inspectComponentId, setInspectComponentId] = useState<string | null>(null);
  const [inspectMatchesParentId, setInspectMatchesParentId] = useState<string | null>(null);
  const [selectedInsideEntityIds, setSelectedInsideEntityIds] = useState<Set<string>>(new Set());
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);

  // AI 特征搜索相关 UI 状态
  const [selectedAiGroupId, setSelectedAiGroupId] = useState<string | null>(null);
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

  // 反馈消息自动清理逻辑 (从 App.tsx 迁移)
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
    selectedAiGroupId, setSelectedAiGroupId,
    inspectAiMatchesParentId, setInspectAiMatchesParentId,
    hoveredFeatureId, setHoveredFeatureId,
    showAiSettings, setShowAiSettings,
    aiSettings, setAiSettings,
    matchStatus, setMatchStatus,
    dialogUnit, setDialogUnit
  };
}
