import React from 'react';
import { Loader2, Check, Layers } from 'lucide-react';
import { ImageCanvas } from './components/ImageCanvas';
import { PromptModal } from './components/PromptModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { handleExportCSV } from './utils/exportUtils';
import { useAppLogic } from './hooks/useAppLogic';

export default function App() {
  const logic = useAppLogic();

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row text-slate-200 overflow-hidden font-sans">
      <input ref={logic.fileInputRef} type="file" accept="image/*,.dxf" onChange={logic.handleFileUpload} className="hidden" />
      
      <PromptModal 
        isOpen={logic.promptState.isOpen} 
        title={logic.promptState.title} 
        description={logic.promptState.description} 
        defaultValue={logic.promptState.defaultValue} 
        defaultUnit={logic.promptState.defaultUnit}
        showUnitSelector={logic.promptState.showUnitSelector}
        onConfirm={logic.promptState.onConfirm} 
        onCancel={() => logic.setPromptState(p => ({ ...p, isOpen: false }))} 
      />

      <AiSettingsModal 
        isOpen={logic.aState.showAiSettings} 
        onClose={() => logic.aState.setShowAiSettings(false)} 
        settings={logic.aState.aiSettings} 
        onSettingsChange={logic.aState.setAiSettings} 
      />

      {logic.aState.matchStatus && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 font-bold flex items-center gap-3 ${logic.aState.matchStatus.type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
          {logic.aState.matchStatus.type === 'success' ? <Check size={20}/> : <Layers size={20}/>}
          <span>{logic.aState.matchStatus.text}</span>
        </div>
      )}

      <Sidebar 
        mode={logic.mode} 
        setMode={logic.setMode} 
        setCurrentPoints={logic.setCurrentPoints}
        resetApp={() => {
          logic.setImageSrc(null); 
          logic.setMode('upload');
          logic.setCurrentPoints([]);
        }}
        calibrationData={logic.dState.calibrationData} showCalibration={logic.mState.showCalibration} setShowCalibration={logic.mState.setShowCalibration}
        showMeasurements={logic.mState.showMeasurements} setShowMeasurements={logic.mState.setShowMeasurements}
        changeGlobalUnit={() => {}} onImportClick={() => logic.fileInputRef.current?.click()} 
        exportCSV={() => handleExportCSV(logic.originalFileName, logic.dState.rawDxfData, logic.dState.manualOriginCAD, logic.dState.dxfComponents, logic.dState.aiFeatureGroups, logic.dState.getLogicCoords, logic.dState.getScaleInfo)}
        hasRawDxfData={!!logic.dState.rawDxfData} hasImageSrc={!!logic.imageSrc} manualOriginCAD={logic.dState.manualOriginCAD}
        analysisTab={logic.aState.analysisTab} setAnalysisTab={logic.aState.setAnalysisTab}
        topLevelComponents={logic.topLevelComponents} dxfComponents={logic.dState.dxfComponents} dxfEntities={logic.dState.dxfEntities}
        selectedComponentId={logic.aState.selectedComponentId} setSelectedComponentId={logic.aState.setSelectedComponentId}
        selectedObjectGroupKey={logic.aState.selectedObjectGroupKey} setSelectedObjectGroupKey={logic.aState.setSelectedObjectGroupKey}
        inspectComponentId={logic.aState.inspectComponentId} setInspectComponentId={logic.aState.setInspectComponentId}
        inspectMatchesParentId={logic.aState.inspectMatchesParentId} setInspectMatchesParentId={logic.aState.setInspectMatchesParentId}
        selectedInsideEntityIds={logic.aState.selectedInsideEntityIds} toggleEntityInSelection={logic.toggleEntityInSelection}
        setHoveredEntityId={logic.aState.setHoveredEntityId} setHoveredComponentId={logic.aState.setHoveredComponentId}
        entitySizeGroups={logic.entitySizeGroups} createAutoGroup={logic.createAutoGroup} handleAutoMatch={logic.handleAutoMatch}
        updateComponentProperty={logic.updateComponentProperty} updateComponentColor={logic.updateComponentColor} deleteComponent={logic.deleteComponent}
        handleMoveSelectionToNewGroup={logic.handleMoveSelectionToNewGroup} handleRemoveSingleEntity={logic.handleRemoveSingleEntity} handleRemoveChildGroup={logic.handleRemoveChildGroup}
        currentInspectedEntities={logic.currentInspectedEntities} 
        currentInspectedChildGroups={logic.currentInspectedChildGroups}
        currentMatchedGroups={logic.currentMatchedGroups}
        isProcessing={logic.isProcessing} rawDxfData={logic.dState.rawDxfData}
        setShowAiSettings={logic.aState.setShowAiSettings} topLevelAiGroups={logic.topLevelAiGroups} aiFeatureGroups={logic.dState.aiFeatureGroups}
        selectedAiGroupId={logic.aState.selectedAiGroupId} setSelectedAiGroupId={logic.aState.setSelectedAiGroupId}
        inspectAiMatchesParentId={logic.aState.inspectAiMatchesParentId} setInspectAiMatchesParentId={logic.aState.setInspectAiMatchesParentId}
        currentMatchedAiGroups={logic.currentMatchedAiGroups} 
        setHoveredFeatureId={logic.aState.setHoveredFeatureId}
        updateAiGroupColor={logic.updateAiGroupColor} updateAiGroupProperty={logic.updateAiGroupProperty} deleteAiGroup={logic.deleteAiGroup}
        isSearchingFeatures={logic.dState.isSearchingFeatures} performFeatureSearch={logic.performFeatureSearch} getLogicCoords={logic.dState.getLogicCoords}
        canFinish={logic.canFinish} finishShape={logic.finishShape}
      />

      <div className="flex-1 relative flex flex-col">
        <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-4 justify-between z-10 gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase flex-shrink-0">MODE: {logic.mode}</div>
            {logic.mouseNormPos && logic.dState.getLogicCoords(logic.mouseNormPos) && (
              <div className="flex gap-4 font-mono text-[11px] text-slate-400 animate-in fade-in slide-in-from-left-2 truncate">
                <span className="bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 shrink-0">X: {logic.dState.getLogicCoords(logic.mouseNormPos)!.x.toFixed(2)}</span>
                <span className="bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 shrink-0">Y: {logic.dState.getLogicCoords(logic.mouseNormPos)!.y.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 p-6 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {logic.isProcessing && <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-indigo-400 mb-2" size={48} /><p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Processing...</p></div>}
          <ImageCanvas key={logic.imageSrc || 'empty'} src={logic.imageSrc} mode={logic.mode} calibrationData={logic.dState.calibrationData} measurements={logic.mState.measurements} parallelMeasurements={logic.mState.parallelMeasurements} areaMeasurements={logic.mState.areaMeasurements} curveMeasurements={logic.mState.curveMeasurements} currentPoints={logic.currentPoints} onPointClick={logic.handlePointClick} onDeleteMeasurement={(id) => logic.mState.setMeasurements(m => m.filter(x => x.id !== id))} dxfOverlayEntities={logic.dxfOverlayEntities} originCanvasPos={logic.originCanvasPos} onMousePositionChange={logic.setMouseNormPos} onDimensionsChange={(w, h) => logic.dState.setImgDimensions({width: w, height: h})} initialTransform={logic.viewTransform} onViewChange={logic.setViewTransform} showCalibration={logic.mState.showCalibration} showMeasurements={logic.mState.showMeasurements} featureROI={logic.dState.featureROI} selectedComponentId={logic.aState.selectedComponentId} selectedObjectGroupKey={logic.aState.selectedObjectGroupKey} highlightedEntityIds={logic.aState.selectedInsideEntityIds} hoveredEntityId={logic.aState.hoveredEntityId} aiFeatureGroups={logic.dState.aiFeatureGroups} selectedAiGroupId={logic.aState.selectedAiGroupId} hoveredFeatureId={logic.aState.hoveredFeatureId} />
        </div>
      </div>
    </div>
  );
}
