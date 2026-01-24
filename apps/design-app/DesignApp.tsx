
import React, { useMemo, useEffect } from 'react';
import { ImageCanvas } from '../../components/ImageCanvas';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { LandingPage } from '../../components/LandingPage';
import { PromptModal } from '../../components/PromptModal';
import { AiSettingsModal } from '../../components/AiSettingsModal';
import { DxfMatchSettingsModal } from '../../components/DxfMatchSettingsModal';
import { useAppLogic } from '../../hooks/useAppLogic';
import { useWeldSequenceOverlay } from '../../hooks/useWeldSequenceOverlay';
import { handleExportCSV } from '../../utils/exportUtils';
import { Loader2, AlertCircle, Crosshair, Target, RotateCw, Zap } from 'lucide-react';

const DesignApp: React.FC = () => {
  const {
    imageSrc, setImageSrc, mode, setMode, isProcessing, fileInputRef, viewTransform, setViewTransform, mouseNormPos, setMouseNormPos,
    mState, aState, dState, promptState, setPromptState, dxfOverlayEntities, dxfStaticCache, aiOverlayEntities, originCanvasPos, handleFileUpload, saveProject, loadProject,
    handlePointClick, canFinish, finishShape, entitySizeGroups, topLevelComponents, currentInspectedEntities, currentInspectedChildGroups, currentMatchedGroups,
    createAutoGroup, handleAutoMatch, updateComponentProperty, updateComponentColor, deleteComponent, confirmDeleteComponent, deleteAllMatches, confirmDeleteAllMatches,
    handleMoveSelectionToNewGroup, handleRemoveSingleEntity, handleRemoveChildGroup, topLevelAiGroups, currentMatchedAiGroups, performFeatureSearch,
    updateAiGroupProperty, updateAiGroupColor, deleteAiGroup, currentPoints, setCurrentPoints, originalFileName, setOriginalFileName, toggleEntityInSelection
  } = useAppLogic();

  // --- Weld Sequence 隔离渲染 ---
  // 复用 useAppLogic 中已经计算好的 staticCache，不再依赖 window Hack
  const weldSequenceEntities = useWeldSequenceOverlay({
    mode, 
    rawDxfData: dState.rawDxfData, 
    dxfEntities: dState.dxfEntities, 
    dxfComponents: dState.dxfComponents,
    hoveredSequenceNum: aState.hoveredSequenceNum,
    selectedWeldPointId: aState.selectedWeldPointId,
    hoveredComponentId: aState.hoveredComponentId,
    staticCache: dxfStaticCache
  });

  // --- 快捷键工序分配 ---
  useEffect(() => {
    const handleSeqKey = (e: KeyboardEvent) => {
      if (mode !== 'weld_sequence' || !aState.hoveredComponentId) return;
      if (e.key >= '0' && e.key <= '9') {
        const seqNum = parseInt(e.key);
        updateComponentProperty(aState.hoveredComponentId, 'sequence', seqNum);
        aState.setMatchStatus({ text: `Assigned S${seqNum} to ${aState.hoveredComponentId.slice(0,5)}`, type: 'success' });
      }
    };
    window.addEventListener('keydown', handleSeqKey);
    return () => window.removeEventListener('keydown', handleSeqKey);
  }, [mode, aState.hoveredComponentId, updateComponentProperty, aState]);

  const onExportCSV = () => {
    handleExportCSV(
      originalFileName,
      dState.rawDxfData,
      dState.manualOriginCAD,
      dState.dxfComponents,
      dState.aiFeatureGroups,
      dState.getLogicCoords,
      dState.getScaleInfo,
      (text, type) => aState.setMatchStatus({ text, type })
    );
  };

  const statusBarData = useMemo(() => {
    const coords = mouseNormPos ? dState.getLogicCoords(mouseNormPos) : null;
    let hoveredInfo = null;

    if (aState.hoveredComponentId && dState.rawDxfData) {
      const comp = dState.dxfComponents.find((c: any) => c.id === aState.hoveredComponentId);
      if (comp) {
        const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
        const ox = dState.manualOriginCAD ? dState.manualOriginCAD.x : defaultCenterX;
        const oy = dState.manualOriginCAD ? dState.manualOriginCAD.y : defaultCenterY;
        const lx = comp.centroid.x - ox;
        const ly = comp.centroid.y - oy;
        const normX = (comp.centroid.x - (minX - padding)) / totalW;
        const normY = ((maxY + padding) - comp.centroid.y) / totalH;

        hoveredInfo = {
          name: comp.name,
          x: lx, y: ly, r: comp.rotationDeg ?? 0,
          color: comp.color,
          normCenter: { x: normX, y: normY },
          sequence: comp.sequence
        };
      }
    } else if (aState.hoveredFeatureId) {
      const group = dState.aiFeatureGroups.find((g: any) => g.features.some((f: any) => f.id === aState.hoveredFeatureId));
      const feat = group?.features.find((f: any) => f.id === aState.hoveredFeatureId);
      if (feat && group) {
        const cx = (feat.minX + feat.maxX) / 2;
        const cy = (feat.minY + feat.maxY) / 2;
        const featCoords = dState.getLogicCoords({ x: cx, y: cy });
        hoveredInfo = {
          name: group.name, x: featCoords?.x ?? 0, y: featCoords?.y ?? 0, r: group.rotationDeg ?? 0,
          color: group.color, normCenter: { x: cx, y: cy }
        };
      }
    }
    return { coords, hoveredInfo };
  }, [mouseNormPos, aState.hoveredComponentId, aState.hoveredFeatureId, dState]);

  const resetApp = () => {
    setImageSrc(null); setOriginalFileName(null); setMode('upload'); setCurrentPoints([]); setViewTransform(null); setMouseNormPos(null);
    dState.setCalibrationData(null); dState.setManualOriginCAD(null); dState.setRawDxfData(null); dState.setDxfEntities([]);
    dState.setDxfComponents([]); dState.setAiFeatureGroups([]); dState.setDxfSearchROI([]);
    mState.setMeasurements([]); mState.setParallelMeasurements([]); mState.setAreaMeasurements([]); mState.setCurveMeasurements([]);
    aState.clearAllSelections(); aState.setInspectComponentId(null); aState.setInspectMatchesParentId(null); aState.setInspectAiMatchesParentId(null);
  };

  if (!imageSrc) {
    return (
      <>
        <LandingPage onUpload={() => fileInputRef.current?.click()} />
        <input type="file" ref={fileInputRef} className="hidden" accept=".png,.jpg,.jpeg,.dxf" onChange={handleFileUpload} />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar
        {...aState} // Spread analysis states
        mode={mode} setMode={setMode} resetApp={resetApp} canFinish={canFinish} finishShape={finishShape} saveProject={saveProject} loadProject={loadProject}
        calibrationData={dState.calibrationData} showCalibration={mState.showCalibration} setShowCalibration={mState.setShowCalibration}
        showMeasurements={mState.showMeasurements} setShowMeasurements={mState.setShowMeasurements} changeGlobalUnit={() => {}} onImportClick={() => fileInputRef.current?.click()}
        exportCSV={onExportCSV} hasRawDxfData={!!dState.rawDxfData} hasImageSrc={!!imageSrc} manualOriginCAD={dState.manualOriginCAD}
        topLevelComponents={topLevelComponents} dxfComponents={dState.dxfComponents} dxfEntities={dState.dxfEntities}
        selectedInsideEntityIds={aState.selectedInsideEntityIds} toggleEntityInSelection={toggleEntityInSelection}
        entitySizeGroups={entitySizeGroups} createAutoGroup={createAutoGroup} handleAutoMatch={handleAutoMatch}
        updateComponentProperty={updateComponentProperty} updateComponentColor={updateComponentColor} deleteComponent={deleteComponent}
        confirmDeleteComponent={confirmDeleteComponent} deleteAllMatches={deleteAllMatches} confirmDeleteAllMatches={confirmDeleteAllMatches}
        handleMoveSelectionToNewGroup={handleMoveSelectionToNewGroup} handleRemoveSingleEntity={handleRemoveSingleEntity} handleRemoveChildGroup={handleRemoveChildGroup}
        currentInspectedEntities={currentInspectedEntities} currentInspectedChildGroups={currentInspectedChildGroups} currentMatchedGroups={currentMatchedGroups}
        isProcessing={isProcessing} rawDxfData={dState.rawDxfData} setCurrentPoints={setCurrentPoints} topLevelAiGroups={topLevelAiGroups}
        aiFeatureGroups={dState.aiFeatureGroups} currentMatchedAiGroups={currentMatchedAiGroups} isSearchingFeatures={dState.isSearchingFeatures}
        performFeatureSearch={performFeatureSearch} getLogicCoords={dState.getLogicCoords} dxfSearchROI={dState.dxfSearchROI} setDxfSearchROI={dState.setDxfSearchROI}
        setMatchStatus={aState.setMatchStatus} setHoveredComponentId={aState.setHoveredComponentId}
        // Fix: Pass missing AI group manipulation props to the Sidebar component
        updateAiGroupColor={updateAiGroupColor} updateAiGroupProperty={updateAiGroupProperty} deleteAiGroup={deleteAiGroup}
      />

      <main className="flex-1 relative flex flex-col min-w-0">
        <div className="h-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500"><Crosshair size={14} className="text-indigo-400" /><span className="text-[10px] font-bold uppercase tracking-wider">Cursor</span></div>
            {statusBarData.coords ? (
              <div className="flex gap-3 font-mono text-[11px]">
                <div className="flex gap-1"><span className="text-slate-500">X:</span><span className="text-white w-[60px]">{statusBarData.coords.x.toFixed(3)}</span></div>
                <div className="flex gap-1"><span className="text-slate-500">Y:</span><span className="text-white w-[60px]">{statusBarData.coords.y.toFixed(3)}</span></div>
              </div>
            ) : <span className="text-[10px] text-slate-600 italic">Outside active area</span>}
          </div>

          <div className="flex items-center gap-6">
            {statusBarData.hoveredInfo && (
              <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-2">
                  <Target size={14} style={{ color: statusBarData.hoveredInfo.color }} />
                  <span className="text-[10px] font-bold text-white uppercase truncate max-w-[120px]">{statusBarData.hoveredInfo.name}</span>
                </div>
                <div className="flex gap-3 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  <div className="flex gap-1"><span className="text-slate-500">X:</span><span className="text-emerald-400">{statusBarData.hoveredInfo.x.toFixed(3)}</span></div>
                  <div className="flex gap-1"><span className="text-slate-500">Y:</span><span className="text-emerald-400">{statusBarData.hoveredInfo.y.toFixed(3)}</span></div>
                  <div className="flex gap-1 items-center ml-1"><RotateCw size={10} className="text-amber-400" /><span className="text-amber-400">{statusBarData.hoveredInfo.r.toFixed(1)}°</span></div>
                  {statusBarData.hoveredInfo.sequence !== undefined && statusBarData.hoveredInfo.sequence > 0 && (
                    <div className="flex gap-1 items-center ml-1 border-l border-white/10 pl-2"><Zap size={10} className="text-emerald-400" /><span className="text-emerald-400 font-black">S{statusBarData.hoveredInfo.sequence}</span></div>
                  )}
                </div>
              </div>
            )}
            <div className="text-[10px] font-black text-slate-700 select-none uppercase tracking-[0.2em]">{originalFileName || "NO PROJECT"}</div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <ImageCanvas
            src={imageSrc} mode={mode} calibrationData={dState.calibrationData} measurements={mState.measurements} parallelMeasurements={mState.parallelMeasurements}
            areaMeasurements={mState.areaMeasurements} curveMeasurements={mState.curveMeasurements} currentPoints={currentPoints} onPointClick={handlePointClick}
            onDeleteMeasurement={(id) => mState.setMeasurements(prev => prev.filter(m => m.id !== id))}
            dxfOverlayEntities={dxfOverlayEntities} aiOverlayEntities={aiOverlayEntities} weldSequenceEntities={weldSequenceEntities}
            originCanvasPos={originCanvasPos} onMousePositionChange={setMouseNormPos} onDimensionsChange={(w, h) => dState.setImgDimensions({ width: w, height: h })}
            initialTransform={viewTransform} onViewChange={setViewTransform} showCalibration={mState.showCalibration} showMeasurements={mState.showMeasurements}
            hoveredMarker={statusBarData.hoveredInfo ? { x: statusBarData.hoveredInfo.normCenter.x, y: statusBarData.hoveredInfo.normCenter.y, color: statusBarData.hoveredInfo.color } : null}
            dxfSearchROI={dState.dxfSearchROI}
          />
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="text-lg font-bold text-white uppercase tracking-tighter">Analyzing Geometry...</p>
            <p className="text-slate-400 text-xs mt-1">Extracting primitives and calculating centroids</p>
          </div>
        )}

        {aState.matchStatus && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-4">
            <div className={`px-6 py-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-3 ${aState.matchStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'}`}>
              <AlertCircle size={18} /><span className="text-sm font-bold tracking-tight">{aState.matchStatus.text}</span>
            </div>
          </div>
        )}
      </main>

      <PromptModal {...promptState} onCancel={() => setPromptState(prev => ({ ...prev, isOpen: false }))} />
      <AiSettingsModal isOpen={aState.showAiSettings} onClose={() => aState.setShowAiSettings(false)} settings={aState.aiSettings} onSettingsChange={aState.setAiSettings} />
      <DxfMatchSettingsModal isOpen={aState.showDxfSettings} onClose={() => aState.setShowDxfSettings(false)} settings={aState.dxfMatchSettings} onSettingsChange={aState.setDxfMatchSettings} />
    </div>
  );
};

export default DesignApp;
