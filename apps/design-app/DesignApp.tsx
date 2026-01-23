
import React, { useMemo } from 'react';
import { ImageCanvas } from '../../components/ImageCanvas';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { LandingPage } from '../../components/LandingPage';
import { PromptModal } from '../../components/PromptModal';
import { AiSettingsModal } from '../../components/AiSettingsModal';
import { DxfMatchSettingsModal } from '../../components/DxfMatchSettingsModal';
import { StatusBar } from '../../components/StatusBar';
import { ProcessingOverlay } from '../../components/ProcessingOverlay';
import { useAppLogic } from '../../hooks/useAppLogic';
import { handleExportCSV } from '../../utils/exportUtils';
import { AlertCircle } from 'lucide-react';

/**
 * DesignApp - Orchestrates the measurement and design module.
 * Refactored in Stage 3 to use modular components and hooks.
 */
const DesignApp: React.FC = () => {
  const {
    imageSrc, setImageSrc, mode, setMode, isProcessing, fileInputRef,
    viewTransform, setViewTransform, mouseNormPos, setMouseNormPos,
    mState, aState, dState, promptState, setPromptState,
    dxfOverlayEntities, aiOverlayEntities, originCanvasPos,
    handleFileUpload, saveProject, loadProject, handlePointClick,
    canFinish, finishShape, entitySizeGroups, topLevelComponents,
    currentInspectedEntities, currentInspectedChildGroups, currentMatchedGroups,
    createAutoGroup, handleAutoMatch, updateComponentProperty, updateComponentColor,
    confirmDeleteComponent, confirmDeleteAllMatches, handleMoveSelectionToNewGroup,
    handleRemoveSingleEntity, handleRemoveChildGroup, topLevelAiGroups,
    currentMatchedAiGroups, performFeatureSearch, updateAiGroupProperty,
    updateAiGroupColor, deleteAiGroup, currentPoints, setCurrentPoints,
    originalFileName, setOriginalFileName, toggleEntityInSelection
  } = useAppLogic();

  const onExportCSV = () => {
    handleExportCSV(originalFileName, dState.rawDxfData, dState.manualOriginCAD, dState.dxfComponents, dState.aiFeatureGroups, dState.getLogicCoords, dState.getScaleInfo, (text, type) => aState.setMatchStatus({ text, type }));
  };

  const statusBarInfo = useMemo(() => {
    const coords = mouseNormPos ? dState.getLogicCoords(mouseNormPos) : null;
    let hoveredInfo = null;

    if (aState.hoveredComponentId && dState.rawDxfData) {
      const comp = dState.dxfComponents.find((c: any) => c.id === aState.hoveredComponentId);
      if (comp) {
        const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
        const ox = dState.manualOriginCAD ? dState.manualOriginCAD.x : defaultCenterX;
        const oy = dState.manualOriginCAD ? dState.manualOriginCAD.y : defaultCenterY;
        const normX = (comp.centroid.x - (minX - padding)) / totalW;
        const normY = ((maxY + padding) - comp.centroid.y) / totalH;
        hoveredInfo = { name: comp.name, x: comp.centroid.x - ox, y: comp.centroid.y - oy, r: comp.rotationDeg ?? 0, color: comp.color, normCenter: { x: normX, y: normY } };
      }
    } else if (aState.hoveredFeatureId) {
      const group = dState.aiFeatureGroups.find((g: any) => g.features.some((f: any) => f.id === aState.hoveredFeatureId));
      const feat = group?.features.find((f: any) => f.id === aState.hoveredFeatureId);
      if (feat && group) {
        const cx = (feat.minX + feat.maxX) / 2, cy = (feat.minY + feat.maxY) / 2;
        const featCoords = dState.getLogicCoords({ x: cx, y: cy });
        hoveredInfo = { name: group.name, x: featCoords?.x ?? 0, y: featCoords?.y ?? 0, r: group.rotationDeg ?? 0, color: group.color, normCenter: { x: cx, y: cy } };
      }
    }
    return { coords, hoveredInfo };
  }, [mouseNormPos, aState.hoveredComponentId, aState.hoveredFeatureId, dState]);

  const resetApp = () => {
    setImageSrc(null); setOriginalFileName(null); setMode('upload'); setCurrentPoints([]); setViewTransform(null); setMouseNormPos(null);
    dState.setCalibrationData(null); dState.setManualOriginCAD(null); dState.setRawDxfData(null); dState.setDxfEntities([]); dState.setDxfComponents([]); dState.setAiFeatureGroups([]); dState.setDxfSearchROI([]);
    mState.setMeasurements([]); mState.setParallelMeasurements([]); mState.setAreaMeasurements([]); mState.setCurveMeasurements([]);
    aState.clearAllSelections(); aState.setInspectComponentId(null); aState.setInspectMatchesParentId(null); aState.setInspectAiMatchesParentId(null);
  };

  if (!imageSrc) {
    return (
      <>
        <LandingPage onUpload={() => fileInputRef.current?.click()} onResume={loadProject} />
        <input type="file" ref={fileInputRef} className="hidden" accept=".png,.jpg,.jpeg,.dxf" onChange={handleFileUpload} />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar
        mode={mode} setMode={setMode} resetApp={resetApp} canFinish={canFinish} finishShape={finishShape} saveProject={saveProject} loadProject={loadProject}
        calibrationData={dState.calibrationData} showCalibration={mState.showCalibration} setShowCalibration={mState.setShowCalibration}
        showMeasurements={mState.showMeasurements} setShowMeasurements={mState.setShowMeasurements}
        changeGlobalUnit={() => {}} onImportClick={() => fileInputRef.current?.click()} exportCSV={onExportCSV}
        hasRawDxfData={!!dState.rawDxfData} hasImageSrc={!!imageSrc} manualOriginCAD={dState.manualOriginCAD}
        analysisTab={aState.analysisTab} setAnalysisTab={aState.setAnalysisTab} topLevelComponents={topLevelComponents} dxfComponents={dState.dxfComponents} dxfEntities={dState.dxfEntities}
        selectedComponentId={aState.selectedComponentId} setSelectedComponentId={aState.setSelectedComponentId} selectedObjectGroupKey={aState.selectedObjectGroupKey} setSelectedObjectGroupKey={aState.setSelectedObjectGroupKey}
        inspectComponentId={aState.inspectComponentId} setInspectComponentId={aState.setInspectComponentId} inspectMatchesParentId={aState.inspectMatchesParentId} setInspectMatchesParentId={aState.setInspectMatchesParentId}
        selectedInsideEntityIds={aState.selectedInsideEntityIds} toggleEntityInSelection={toggleEntityInSelection} setHoveredEntityId={aState.setHoveredEntityId} setHoveredComponentId={aState.setHoveredComponentId} setHoveredObjectGroupKey={aState.setHoveredObjectGroupKey}
        entitySizeGroups={entitySizeGroups} createAutoGroup={createAutoGroup} handleAutoMatch={handleAutoMatch} updateComponentProperty={updateComponentProperty} updateComponentColor={updateComponentColor}
        confirmDeleteComponent={confirmDeleteComponent} confirmDeleteAllMatches={confirmDeleteAllMatches} handleMoveSelectionToNewGroup={handleMoveSelectionToNewGroup} handleRemoveSingleEntity={handleRemoveSingleEntity} handleRemoveChildGroup={handleRemoveChildGroup}
        currentInspectedEntities={currentInspectedEntities} currentInspectedChildGroups={currentInspectedChildGroups} currentMatchedGroups={currentMatchedGroups} isProcessing={isProcessing}
        setShowDxfSettings={aState.setShowDxfSettings} setCurrentPoints={setCurrentPoints} setShowAiSettings={aState.setShowAiSettings}
        topLevelAiGroups={topLevelAiGroups} aiFeatureGroups={dState.aiFeatureGroups} selectedAiGroupId={aState.selectedAiGroupId} setSelectedAiGroupId={aState.setSelectedAiGroupId}
        inspectAiMatchesParentId={aState.inspectAiMatchesParentId} setInspectAiMatchesParentId={aState.setInspectAiMatchesParentId}
        currentMatchedAiGroups={currentMatchedAiGroups} setHoveredFeatureId={aState.setHoveredFeatureId} updateAiGroupColor={updateAiGroupColor} updateAiGroupProperty={updateAiGroupProperty} deleteAiGroup={deleteAiGroup}
        isSearchingFeatures={dState.isSearchingFeatures} performFeatureSearch={performFeatureSearch} getLogicCoords={dState.getLogicCoords} dxfSearchROI={dState.dxfSearchROI} setDxfSearchROI={dState.setDxfSearchROI}
      />

      <main className="flex-1 relative flex flex-col min-w-0">
        <StatusBar coords={statusBarInfo.coords} hoveredInfo={statusBarInfo.hoveredInfo} originalFileName={originalFileName} />

        <div className="flex-1 min-h-0 relative">
          <ImageCanvas
            src={imageSrc} mode={mode} calibrationData={dState.calibrationData} measurements={mState.measurements} parallelMeasurements={mState.parallelMeasurements} areaMeasurements={mState.areaMeasurements} curveMeasurements={mState.curveMeasurements}
            currentPoints={currentPoints} onPointClick={handlePointClick} onDeleteMeasurement={(id) => mState.setMeasurements((prev:any) => prev.filter((m:any) => m.id !== id))}
            dxfOverlayEntities={dxfOverlayEntities} aiOverlayEntities={aiOverlayEntities} originCanvasPos={originCanvasPos} onMousePositionChange={setMouseNormPos}
            onDimensionsChange={(w, h) => dState.setImgDimensions({ width: w, height: h })} initialTransform={viewTransform} onViewChange={setViewTransform}
            showCalibration={mState.showCalibration} showMeasurements={mState.showMeasurements}
            hoveredMarker={statusBarInfo.hoveredInfo ? { x: statusBarInfo.hoveredInfo.normCenter.x, y: statusBarInfo.hoveredInfo.normCenter.y, color: statusBarInfo.hoveredInfo.color } : null}
            dxfSearchROI={dState.dxfSearchROI}
          />
        </div>

        <ProcessingOverlay 
          isVisible={isProcessing || dState.isSearchingFeatures} 
          title={isProcessing ? "Analyzing Geometry..." : "Searching Features..."} 
          subtitle={isProcessing ? "Extracting primitives and calculating centroids" : "Running vision models to find visual patterns"} 
        />

        {aState.matchStatus && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-4">
            <div className={`px-6 py-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-3 ${aState.matchStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'}`}>
              <AlertCircle size={18} />
              <span className="text-sm font-bold tracking-tight">{aState.matchStatus.text}</span>
            </div>
          </div>
        )}

        <input type="file" ref={fileInputRef} className="hidden" accept=".png,.jpg,.jpeg,.dxf" onChange={handleFileUpload} />
      </main>

      <PromptModal isOpen={promptState.isOpen} title={promptState.title} description={promptState.description} defaultValue={promptState.defaultValue} defaultUnit={promptState.defaultUnit} showUnitSelector={promptState.showUnitSelector} hideInput={promptState.hideInput} onConfirm={promptState.onConfirm} onCancel={() => setPromptState(prev => ({ ...prev, isOpen: false }))} />
      <AiSettingsModal isOpen={aState.showAiSettings} onClose={() => aState.setShowAiSettings(false)} settings={aState.aiSettings} onSettingsChange={aState.setAiSettings} />
      <DxfMatchSettingsModal isOpen={aState.showDxfSettings} onClose={() => aState.setShowDxfSettings(false)} settings={aState.dxfMatchSettings} onSettingsChange={aState.setDxfMatchSettings} />
    </div>
  );
};

export default DesignApp;
