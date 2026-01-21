
import React, { useMemo } from 'react';
import { ImageCanvas } from '../../components/ImageCanvas';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { LandingPage } from '../../components/LandingPage';
import { PromptModal } from '../../components/PromptModal';
import { AiSettingsModal } from '../../components/AiSettingsModal';
import { DxfMatchSettingsModal } from '../../components/DxfMatchSettingsModal';
import { useAppLogic } from '../../hooks/useAppLogic';
import { handleExportCSV } from '../../utils/exportUtils';
import { Loader2, AlertCircle, Crosshair, Target, RotateCw } from 'lucide-react';

/**
 * DesignApp is the main application component for the "Measurement & Design" module.
 * It integrates state management hooks, canvas rendering, and the sidebar control panel.
 */
const DesignApp: React.FC = () => {
  const {
    imageSrc,
    setImageSrc,
    mode,
    setMode,
    isProcessing,
    fileInputRef,
    viewTransform,
    setViewTransform,
    mouseNormPos,
    setMouseNormPos,
    mState,
    aState,
    dState,
    promptState,
    setPromptState,
    dxfOverlayEntities,
    aiOverlayEntities,
    originCanvasPos,
    handleFileUpload,
    saveProject,
    loadProject,
    handlePointClick,
    canFinish,
    finishShape,
    // Dxf Analysis Spread
    entitySizeGroups,
    topLevelComponents,
    currentInspectedEntities,
    currentInspectedChildGroups,
    currentMatchedGroups,
    createAutoGroup,
    handleAutoMatch,
    updateComponentProperty,
    updateComponentColor,
    deleteComponent,
    confirmDeleteComponent,
    deleteAllMatches,
    confirmDeleteAllMatches,
    handleMoveSelectionToNewGroup,
    handleRemoveSingleEntity,
    handleRemoveChildGroup,
    // Ai Analysis Spread
    topLevelAiGroups,
    currentMatchedAiGroups,
    performFeatureSearch,
    updateAiGroupProperty,
    updateAiGroupColor,
    deleteAiGroup,
    // Interaction State
    currentPoints,
    setCurrentPoints,
    originalFileName,
    setOriginalFileName,
    toggleEntityInSelection
  } = useAppLogic();

  /**
   * Wrapper for exporting measurement and component data to CSV.
   */
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

  /**
   * Calculates the real-time status bar data and hovered marker position
   */
  const statusBarData = useMemo(() => {
    // 1. Current cursor logic coordinates
    const coords = mouseNormPos ? dState.getLogicCoords(mouseNormPos) : null;
    
    let hoveredInfo = null;

    // 2. Handle DXF Component Hover
    if (aState.hoveredComponentId && dState.rawDxfData) {
      const comp = dState.dxfComponents.find((c: any) => c.id === aState.hoveredComponentId);
      if (comp) {
        const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
        // Origin logic matches the item list algorithm
        const ox = dState.manualOriginCAD ? dState.manualOriginCAD.x : defaultCenterX;
        const oy = dState.manualOriginCAD ? dState.manualOriginCAD.y : defaultCenterY;
        
        // Logical relative coordinates
        const lx = comp.centroid.x - ox;
        const ly = comp.centroid.y - oy;

        // Convert absolute CAD centroid back to normalized canvas 0-1 for the marker
        const normX = (comp.centroid.x - (minX - padding)) / totalW;
        const normY = ((maxY + padding) - comp.centroid.y) / totalH;

        hoveredInfo = {
          name: comp.name,
          x: lx,
          y: ly,
          r: comp.rotationDeg ?? 0,
          color: comp.color,
          normCenter: { x: normX, y: normY }
        };
      }
    } 
    // 3. Handle AI Feature Hover
    else if (aState.hoveredFeatureId) {
      const group = dState.aiFeatureGroups.find((g: any) => g.features.some((f: any) => f.id === aState.hoveredFeatureId));
      const feat = group?.features.find((f: any) => f.id === aState.hoveredFeatureId);
      if (feat && group) {
        const cx = (feat.minX + feat.maxX) / 2;
        const cy = (feat.minY + feat.maxY) / 2;
        const featCoords = dState.getLogicCoords({ x: cx, y: cy });
        
        hoveredInfo = {
          name: group.name,
          x: featCoords?.x ?? 0,
          y: featCoords?.y ?? 0,
          r: group.rotationDeg ?? 0,
          color: group.color,
          normCenter: { x: cx, y: cy }
        };
      }
    }

    return { coords, hoveredInfo };
  }, [mouseNormPos, aState.hoveredComponentId, aState.hoveredFeatureId, dState]);

  const resetApp = () => {
    setImageSrc(null);
    setOriginalFileName(null);
    setMode('upload');
    setCurrentPoints([]);
    setViewTransform(null);
    setMouseNormPos(null);
    dState.setCalibrationData(null);
    dState.setManualOriginCAD(null);
    dState.setRawDxfData(null);
    dState.setDxfEntities([]);
    dState.setDxfComponents([]);
    dState.setAiFeatureGroups([]);
    dState.setDxfSearchROI([]);
    mState.setMeasurements([]);
    mState.setParallelMeasurements([]);
    mState.setAreaMeasurements([]);
    mState.setCurveMeasurements([]);
    aState.clearAllSelections();
    aState.setInspectComponentId(null);
    aState.setInspectMatchesParentId(null);
    aState.setInspectAiMatchesParentId(null);
  };

  if (!imageSrc) {
    return (
      <>
        <LandingPage onUpload={() => fileInputRef.current?.click()} />
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".png,.jpg,.jpeg,.dxf"
          onChange={handleFileUpload}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar
        mode={mode}
        setMode={setMode}
        resetApp={resetApp}
        canFinish={canFinish}
        finishShape={finishShape}
        saveProject={saveProject}
        loadProject={loadProject}
        calibrationData={dState.calibrationData}
        showCalibration={mState.showCalibration}
        setShowCalibration={mState.setShowCalibration}
        showMeasurements={mState.showMeasurements}
        setShowMeasurements={mState.setShowMeasurements}
        changeGlobalUnit={() => {}} 
        onImportClick={() => fileInputRef.current?.click()}
        exportCSV={onExportCSV}
        hasRawDxfData={!!dState.rawDxfData}
        hasImageSrc={!!imageSrc}
        manualOriginCAD={dState.manualOriginCAD}
        analysisTab={aState.analysisTab}
        setAnalysisTab={aState.setAnalysisTab}
        topLevelComponents={topLevelComponents}
        dxfComponents={dState.dxfComponents}
        dxfEntities={dState.dxfEntities}
        selectedComponentId={aState.selectedComponentId}
        setSelectedComponentId={aState.setSelectedComponentId}
        selectedObjectGroupKey={aState.selectedObjectGroupKey}
        setSelectedObjectGroupKey={aState.setSelectedObjectGroupKey}
        inspectComponentId={aState.inspectComponentId}
        setInspectComponentId={aState.setInspectComponentId}
        inspectMatchesParentId={aState.inspectMatchesParentId}
        setInspectMatchesParentId={aState.setInspectMatchesParentId}
        selectedInsideEntityIds={aState.selectedInsideEntityIds}
        toggleEntityInSelection={toggleEntityInSelection}
        setHoveredEntityId={aState.setHoveredEntityId}
        setHoveredComponentId={aState.setHoveredComponentId}
        setHoveredObjectGroupKey={aState.setHoveredObjectGroupKey}
        entitySizeGroups={entitySizeGroups}
        createAutoGroup={createAutoGroup}
        handleAutoMatch={handleAutoMatch}
        updateComponentProperty={updateComponentProperty}
        updateComponentColor={updateComponentColor}
        deleteComponent={deleteComponent}
        confirmDeleteComponent={confirmDeleteComponent}
        deleteAllMatches={deleteAllMatches}
        confirmDeleteAllMatches={confirmDeleteAllMatches}
        handleMoveSelectionToNewGroup={handleMoveSelectionToNewGroup}
        handleRemoveSingleEntity={handleRemoveSingleEntity}
        handleRemoveChildGroup={handleRemoveChildGroup}
        currentInspectedEntities={currentInspectedEntities}
        currentInspectedChildGroups={currentInspectedChildGroups}
        currentMatchedGroups={currentMatchedGroups}
        isProcessing={isProcessing}
        rawDxfData={dState.rawDxfData}
        setShowDxfSettings={aState.setShowDxfSettings}
        setCurrentPoints={setCurrentPoints}
        setShowAiSettings={aState.setShowAiSettings}
        topLevelAiGroups={topLevelAiGroups}
        aiFeatureGroups={dState.aiFeatureGroups}
        selectedAiGroupId={aState.selectedAiGroupId}
        setSelectedAiGroupId={aState.setSelectedAiGroupId}
        inspectAiMatchesParentId={aState.inspectAiMatchesParentId}
        setInspectAiMatchesParentId={aState.setInspectAiMatchesParentId}
        currentMatchedAiGroups={currentMatchedAiGroups}
        setHoveredFeatureId={aState.setHoveredFeatureId}
        updateAiGroupColor={updateAiGroupColor}
        updateAiGroupProperty={updateAiGroupProperty}
        deleteAiGroup={deleteAiGroup}
        isSearchingFeatures={dState.isSearchingFeatures}
        performFeatureSearch={performFeatureSearch}
        getLogicCoords={dState.getLogicCoords}
        dxfSearchROI={dState.dxfSearchROI}
        setDxfSearchROI={dState.setDxfSearchROI}
      />

      <main className="flex-1 relative flex flex-col min-w-0">
        <div className="h-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Crosshair size={14} className="text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Cursor</span>
            </div>
            {statusBarData.coords ? (
              <div className="flex gap-3 font-mono text-[11px]">
                <div className="flex gap-1"><span className="text-slate-500">X:</span><span className="text-white w-[60px]">{statusBarData.coords.x.toFixed(3)}</span></div>
                <div className="flex gap-1"><span className="text-slate-500">Y:</span><span className="text-white w-[60px]">{statusBarData.coords.y.toFixed(3)}</span></div>
              </div>
            ) : (
              <span className="text-[10px] text-slate-600 italic">Outside active area</span>
            )}
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
                  <div className="flex gap-1 items-center ml-1">
                    <RotateCw size={10} className="text-amber-400" />
                    <span className="text-amber-400">{statusBarData.hoveredInfo.r.toFixed(1)}°</span>
                  </div>
                </div>
              </div>
            )}
            <div className="text-[10px] font-black text-slate-700 select-none uppercase tracking-[0.2em]">
              {originalFileName || "NO PROJECT"}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <ImageCanvas
            src={imageSrc}
            mode={mode}
            calibrationData={dState.calibrationData}
            measurements={mState.measurements}
            parallelMeasurements={mState.parallelMeasurements}
            areaMeasurements={mState.areaMeasurements}
            curveMeasurements={mState.curveMeasurements}
            currentPoints={currentPoints}
            onPointClick={handlePointClick}
            onDeleteMeasurement={(id) => {
               mState.setMeasurements(prev => prev.filter(m => m.id !== id));
            }}
            dxfOverlayEntities={dxfOverlayEntities}
            aiOverlayEntities={aiOverlayEntities}
            originCanvasPos={originCanvasPos}
            onMousePositionChange={setMouseNormPos}
            onDimensionsChange={(w, h) => dState.setImgDimensions({ width: w, height: h })}
            initialTransform={viewTransform}
            onViewChange={setViewTransform}
            showCalibration={mState.showCalibration}
            showMeasurements={mState.showMeasurements}
            hoveredMarker={statusBarData.hoveredInfo ? {
              x: statusBarData.hoveredInfo.normCenter.x,
              y: statusBarData.hoveredInfo.normCenter.y,
              color: statusBarData.hoveredInfo.color
            } : null}
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
            <div className={`px-6 py-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-3 ${
              aState.matchStatus.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            }`}>
              <AlertCircle size={18} />
              <span className="text-sm font-bold tracking-tight">{aState.matchStatus.text}</span>
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".png,.jpg,.jpeg,.dxf"
          onChange={handleFileUpload}
        />
      </main>

      <PromptModal
        isOpen={promptState.isOpen}
        title={promptState.title}
        description={promptState.description}
        defaultValue={promptState.defaultValue}
        defaultUnit={promptState.defaultUnit}
        showUnitSelector={promptState.showUnitSelector}
        hideInput={promptState.hideInput}
        onConfirm={promptState.onConfirm}
        onCancel={() => setPromptState(prev => ({ ...prev, isOpen: false }))}
      />

      <AiSettingsModal
        isOpen={aState.showAiSettings}
        onClose={() => aState.setShowAiSettings(false)}
        settings={aState.aiSettings}
        onSettingsChange={aState.setAiSettings}
      />

      <DxfMatchSettingsModal
        isOpen={aState.showDxfSettings}
        onClose={() => aState.setShowDxfSettings(false)}
        settings={aState.dxfMatchSettings}
        onSettingsChange={aState.setDxfMatchSettings}
      />
    </div>
  );
};

export default DesignApp;
