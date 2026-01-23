
import { useCallback } from 'react';
import { generateId, getRandomColor } from '../utils';
import { isPointInPolygon } from '../utils/matrixUtils';
import { DxfComponent, DxfEntity, AiFeatureGroup, Point, AppMode } from '../types';

interface FinisherProps {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  currentPoints: Point[];
  setCurrentPoints: (pts: Point[]) => void;
  dState: any;
  mState: any;
  aState: any;
  setPromptState: (state: any) => void;
}

export function useShapeFinisher({
  mode, setMode, currentPoints, setCurrentPoints, dState, mState, aState, setPromptState
}: FinisherProps) {

  const finishShape = useCallback(() => {
    if (currentPoints.length < 1) return;

    // --- 1. 物理校准结算 ---
    if (mode === 'calibrate' && currentPoints.length === 2) {
      setPromptState({
        isOpen: true, title: "Calibration", description: "Enter real-world distance.", defaultValue: "10.0", defaultUnit: dState.calibrationData?.unit || 'mm', showUnitSelector: true,
        onConfirm: (val: string, unit?: string) => {
          const dist = parseFloat(val);
          if (!isNaN(dist) && dist > 0) {
            dState.setCalibrationData({ start: currentPoints[0], end: currentPoints[1], realWorldDistance: dist, unit: unit || 'mm' });
            setMode('measure'); setCurrentPoints([]); setPromptState((p: any) => ({ ...p, isOpen: false }));
          }
        }
      });
      return;
    }

    // --- 2. 测量工具结算 ---
    if (mode === 'measure' && currentPoints.length === 2) {
      mState.setMeasurements((prev: any) => [...prev, { id: generateId(), start: currentPoints[0], end: currentPoints[1] }]);
      setCurrentPoints([]); return;
    }
    if (mode === 'parallel' && currentPoints.length === 3) {
      mState.setParallelMeasurements((prev: any) => [...prev, { id: generateId(), baseStart: currentPoints[0], baseEnd: currentPoints[1], offsetPoint: currentPoints[2] }]);
      setCurrentPoints([]); return;
    }
    if (mode === 'area' && currentPoints.length > 2) {
      mState.setAreaMeasurements((prev: any) => [...prev, { id: generateId(), points: currentPoints }]);
      setCurrentPoints([]); return;
    }
    if (mode === 'curve' && currentPoints.length > 1) {
      mState.setCurveMeasurements((prev: any) => [...prev, { id: generateId(), points: currentPoints }]);
      setCurrentPoints([]); return;
    }

    // --- 3. 逻辑坐标与原点 ---
    if (mode === 'origin' && currentPoints.length === 1) {
      const p = currentPoints[0]; const s = dState.getScaleInfo();
      if (s) {
        if (s.isDxf) dState.setManualOriginCAD({ x: p.x * dState.rawDxfData.totalW + dState.rawDxfData.minX - dState.rawDxfData.padding, y: dState.rawDxfData.maxY + dState.rawDxfData.padding - p.y * dState.rawDxfData.totalH });
        else dState.setManualOriginCAD({ x: p.x * s.totalWidthMM, y: p.y * s.totalHeightMM });
        setMode('measure'); 
      }
      setCurrentPoints([]); return;
    }

    // --- 4. DXF 框选与组件创建 ---
    if (mode === 'box_find_roi' && currentPoints.length === 2) {
      dState.setDxfSearchROI([currentPoints[0], currentPoints[1]]);
      setMode('dxf_analysis'); setCurrentPoints([]); return;
    }

    if ((mode === 'box_rect' || mode === 'box_poly') && currentPoints.length >= 2) {
      if (!dState.rawDxfData) return;
      const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
      const cadVertices = currentPoints.map(p => ({ x: (p.x * totalW) + (minX - padding), y: (maxY + padding) - (p.y * totalH) }));
      let polyMinX = Infinity, polyMaxX = -Infinity, polyMinY = Infinity, polyMaxY = -Infinity;
      cadVertices.forEach(v => { polyMinX = Math.min(polyMinX, v.x); polyMaxX = Math.max(polyMaxX, v.x); polyMinY = Math.min(polyMinY, v.y); polyMaxY = Math.max(polyMaxY, v.y); });

      const isPolygon = mode === 'box_poly';
      const eps = (polyMaxX - polyMinX) * 0.001;
      const isEntityEnclosed = (ent: DxfEntity) => {
          if (ent.minX < polyMinX - eps || ent.maxX > polyMaxX + eps || ent.minY < polyMinY - eps || ent.maxY > polyMaxY + eps) return false;
          if (!isPolygon) return true;
          const samples = ent.type === 'CIRCLE' ? [{x: ent.rawEntity.center.x, y: ent.rawEntity.center.y}] : ent.rawEntity.vertices;
          return samples.every((v:any) => isPointInPolygon(v.x, v.y, cadVertices, eps));
      };

      const enclosedEntities = dState.dxfEntities.filter((ent: any) => isEntityEnclosed(ent)).map((e: any) => e.id);
      if (enclosedEntities.length > 0) {
        setPromptState({
          isOpen: true, title: "Create Group", description: `Selected ${enclosedEntities.length} entities.`, defaultValue: `Group ${dState.dxfComponents.length + 1}`,
          onConfirm: (val: string) => {
            const newComp: DxfComponent = {
                id: generateId(), name: val.trim(), isVisible: true, isWeld: false, isMark: false, color: getRandomColor(),
                entityIds: enclosedEntities, seedSize: enclosedEntities.length,
                centroid: { x: (polyMinX + polyMaxX) / 2, y: (polyMinY + polyMaxY) / 2 }, bounds: { minX: polyMinX, minY: polyMinY, maxX: polyMaxX, maxY: polyMaxY },
                rotation: 0, rotationDeg: 0
            };
            dState.setDxfComponents((prev: any) => [...prev, newComp]);
            aState.setSelectedComponentId(newComp.id); aState.setAnalysisTab('components'); setMode('dxf_analysis'); setCurrentPoints([]);
            setPromptState((p: any) => ({ ...p, isOpen: false }));
          }
        });
      }
      return;
    }

    // --- 5. 手动点位与 AI 特征 ---
    if (mode === 'manual_weld' && currentPoints.length === 1) {
      if (!dState.rawDxfData) return;
      const p = currentPoints[0];
      const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
      const cadCentroid = { x: (p.x * totalW) + (minX - padding), y: (maxY + padding) - (p.y * totalH) };
      const existingSeed = dState.dxfComponents.find((c: any) => c.isManual && !c.parentGroupId);

      if (existingSeed) {
          const matchCount = dState.dxfComponents.filter((c: any) => c.parentGroupId === existingSeed.id).length;
          dState.setDxfComponents((prev: any) => [...prev, {
              id: generateId(), name: `Manual Match ${matchCount + 1}`, isVisible: true, isWeld: true, isMark: false, isManual: true, color: existingSeed.color,
              entityIds: [], seedSize: 1, centroid: cadCentroid, bounds: { minX: cadCentroid.x - 0.1, maxX: cadCentroid.x + 0.1, minY: cadCentroid.y - 0.1, maxY: cadCentroid.y + 0.1 },
              parentGroupId: existingSeed.id, rotation: 0, rotationDeg: 0
          }]);
          setCurrentPoints([]);
      } else {
          setPromptState({
            isOpen: true, title: "Manual Weld Group", description: "Create a new manual welding group.", defaultValue: "Manual Seed",
            onConfirm: (val: string) => {
              const newSeed: DxfComponent = {
                  id: generateId(), name: val.trim() || "Manual Seed", isVisible: true, isWeld: true, isMark: false, isManual: true, color: '#10b981',
                  entityIds: [], seedSize: 1, centroid: cadCentroid, bounds: { minX: cadCentroid.x - 0.1, maxX: cadCentroid.x + 0.1, minY: cadCentroid.y - 0.1, maxY: cadCentroid.y + 0.1 },
                  rotation: 0, rotationDeg: 0
              };
              dState.setDxfComponents((prev: any) => [...prev, newSeed]);
              aState.setSelectedComponentId(newSeed.id); aState.setAnalysisTab('components'); setCurrentPoints([]); setMode('dxf_analysis');
              setPromptState((p: any) => ({ ...p, isOpen: false }));
            }
          });
      }
      return;
    }

    if (mode === 'feature' && currentPoints.length === 2) {
      setPromptState({
          isOpen: true, title: "Define Feature Area", description: "Name the visual feature.", defaultValue: `Feature ${dState.aiFeatureGroups.length + 1}`,
          onConfirm: (val: string) => {
              const g: AiFeatureGroup = { id: generateId(), name: val.trim(), isVisible: true, isWeld: false, isMark: false, color: getRandomColor(), features: [{ id: generateId(), minX: Math.min(currentPoints[0].x, currentPoints[1].x), maxX: Math.max(currentPoints[0].x, currentPoints[1].x), minY: Math.min(currentPoints[0].y, currentPoints[1].y), maxY: Math.max(currentPoints[0].y, currentPoints[1].y) }] };
              dState.setAiFeatureGroups((prev: any) => [...prev, g]); aState.setSelectedAiGroupId(g.id); setCurrentPoints([]); setMode('feature_analysis');
              setPromptState((p: any) => ({ ...p, isOpen: false }));
          }
      });
    }
  }, [mode, setMode, currentPoints, setCurrentPoints, dState, mState, aState, setPromptState]);

  return { finishShape };
}
