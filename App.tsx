
import React, { useMemo } from 'react';
import { Loader2, Check, Layers, Target, Compass } from 'lucide-react';
import { ImageCanvas } from './components/ImageCanvas';
import { PromptModal } from './components/PromptModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { DxfMatchSettingsModal } from './components/DxfMatchSettingsModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { LandingPage } from './components/LandingPage';
import { handleExportCSV } from './utils/exportUtils';
import { useAppLogic } from './hooks/useAppLogic';

export default function App() {
  const logic = useAppLogic();

  // --- NEW: Derive Hover Info for Dashboard ---
  const hoveredInfo = useMemo(() => {
    if (logic.aState.hoveredComponentId) {
      const comp = logic.dState.dxfComponents.find(c => c.id === logic.aState.hoveredComponentId);
      if (comp) {
        const ox = logic.dState.manualOriginCAD ? logic.dState.manualOriginCAD.x : (logic.dState.rawDxfData?.defaultCenterX || 0);
        const oy = logic.dState.manualOriginCAD ? logic.dState.manualOriginCAD.y : (logic.dState.rawDxfData?.defaultCenterY || 0);
        
        // Normalize rotation to positive values
        const normDeg = ((comp.rotationDeg || 0) % 360 + 360) % 360;
        const normRad = ((comp.rotation || 0) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);

        return {
          name: comp.name,
          x: comp.centroid.x - ox,
          y: comp.centroid.y - oy,
          r: normRad,
          rd: normDeg,
          color: comp.color
        };
      }
    }
    if (logic.aState.hoveredFeatureId) {
      const group = logic.dState.aiFeatureGroups.find(g => g.features.some(f => f.id === logic.aState.hoveredFeatureId));
      if (group) {
        const feat = group.features.find(f => f.id === logic.aState.hoveredFeatureId);
        if (!feat) return null;

        const center = { x: (feat.minX + feat.maxX) / 2, y: (feat.minY + feat.maxY) / 2 };
        const coords = logic.dState.getLogicCoords(center);

        // Normalize rotation to positive values
        const normDeg = ((group.rotationDeg || 0) % 360 + 360) % 360;
        const normRad = ((group.rotation || 0) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);

        return {
          name: group.name,
          x: coords?.x || 0,
          y: coords?.y || 0,
          r: normRad,
          rd: normDeg,
          color: group.color
        };
      }
    }
    return null;
  }, [logic.aState.hoveredComponentId, logic.aState.hoveredFeatureId, logic.dState.dxfComponents, logic.dState.aiFeatureGroups, logic.dState.manualOriginCAD, logic.dState.getLogicCoords]);

  // --- NEW: Calculate Hover Marker for Canvas Overlay (normalized coordinates) ---
  const hoveredMarker = useMemo(() => {
    // 1. Check DXF Components
    if (logic.aState.hoveredComponentId) {
      const comp = logic.dState.dxfComponents.find(c => c.id === logic.aState.hoveredComponentId);
      if (comp) {
        const { rawDxfData } = logic.dState;

        // Calculate Normalized Coordinates for Canvas positioning (0-1)
        let normX = 0, normY = 0;
        if (rawDxfData && rawDxfData.totalW && rawDxfData.totalH) {
            normX = (comp.centroid.x - (rawDxfData.minX - rawDxfData.padding)) / rawDxfData.totalW;
            normY = ((rawDxfData.maxY + rawDxfData.padding) - comp.centroid.y) / rawDxfData.totalH;
        }

        return {
          x: normX,
          y: normY,
          color: comp.color
        };
      }
    }

    // 2. Check AI Feature Groups
    if (logic.aState.hoveredFeatureId) {
      const group = logic.dState.aiFeatureGroups.find(g => g.features.some(f => f.id === logic.aState.hoveredFeatureId));
      if (group) {
        const feat = group.features.find(f => f.id === logic.aState.hoveredFeatureId);
        if (!feat) return null;
        
        // Center of the bounding box (features use 0-1 norm coordinates)
        const normX = (feat.minX + feat.maxX) / 2;
        const normY = (feat.minY + feat.maxY) / 2;
        
        return {
          x: normX,
          y: normY,
          color: group.color
        };
      }
    }

    return null;
  }, [logic.aState.hoveredComponentId, logic.aState.hoveredFeatureId, logic.dState.dxfComponents, logic.dState.aiFeatureGroups, logic.dState.rawDxfData]);

  // If no image is loaded, show the perfect Landing Page
  if (!logic.imageSrc && logic.mode === 'upload') {
    return (
      <>
        <input ref={logic.fileInputRef} type="file" accept="image/*,.dxf" onChange={logic.handleFileUpload} className="hidden" />
        <LandingPage onUpload={() => logic.fileInputRef.current?.click()} />
      </>
    );
  }

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
        hideInput={logic.promptState.hideInput}
        onConfirm={logic.promptState.onConfirm} 
        onCancel={() => logic.setPromptState(p => ({ ...p, isOpen: false }))} 
      />

      <AiSettingsModal 
        isOpen={logic.aState.showAiSettings} 
        onClose={() => logic.aState.setShowAiSettings(false)} 
        settings={logic.aState.aiSettings} 
        onSettingsChange={logic.aState.setAiSettings} 
      />

      <DxfMatchSettingsModal
        isOpen={logic.aState.showDxfSettings}
        onClose={() => logic.aState.setShowDxfSettings(false)}
        settings={logic.aState.dxfMatchSettings}
        onSettingsChange={logic.aState.setDxfMatchSettings}
      />

      {logic.aState.matchStatus && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 font-bold flex items-center gap-3 max-w-lg text-center ${logic.aState.matchStatus.type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
          {logic.aState.matchStatus.type === 'success' ? <Check size={20}/> : <Layers size={20}/>}
          <span className="text-sm">{logic.aState.matchStatus.text}</span>
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
          logic.aState.clearAllSelections();
          logic.dState.setDxfComponents([]);
          logic.dState.setDxfEntities([]);
          logic.dState.setAiFeatureGroups([]);
          logic.dState.setRawDxfData(null);
        }}
        calibrationData={logic.dState.calibrationData} showCalibration={logic.mState.showCalibration} setShowCalibration={logic.mState.setShowCalibration}
        showMeasurements={logic.mState.showMeasurements} setShowMeasurements={logic.mState.setShowMeasurements}
        changeGlobalUnit={() => {}} onImportClick={() => logic.fileInputRef.current?.click()} 
        exportCSV={() => handleExportCSV(
          logic.originalFileName, 
          logic.dState.rawDxfData, 
          logic.dState.manualOriginCAD, 
          logic.dState.dxfComponents, 
          logic.dState.aiFeatureGroups, 
          logic.dState.getLogicCoords, 
          logic.dState.getScaleInfo,
          (text, type) => logic.aState.setMatchStatus({ text, type })
        )}
        hasRawDxfData={!!logic.dState.rawDxfData} hasImageSrc={!!logic.imageSrc} manualOriginCAD={logic.dState.manualOriginCAD}
        analysisTab={logic.aState.analysisTab} setAnalysisTab={logic.aState.setAnalysisTab}
        topLevelComponents={logic.topLevelComponents} dxfComponents={logic.dState.dxfComponents} dxfEntities={logic.dState.dxfEntities}
        selectedComponentId={logic.aState.selectedComponentId} setSelectedComponentId={logic.aState.setSelectedComponentId}
        selectedObjectGroupKey={logic.aState.selectedObjectGroupKey} setSelectedObjectGroupKey={logic.aState.setSelectedObjectGroupKey}
        inspectComponentId={logic.aState.inspectComponentId} setInspectComponentId={logic.aState.setInspectComponentId}
        inspectMatchesParentId={logic.aState.inspectMatchesParentId} setInspectMatchesParentId={logic.aState.setInspectMatchesParentId}
        selectedInsideEntityIds={logic.aState.selectedInsideEntityIds} toggleEntityInSelection={logic.toggleEntityInSelection}
        setHoveredEntityId={logic.aState.setHoveredEntityId} setHoveredComponentId={logic.aState.setHoveredComponentId}
        setHoveredObjectGroupKey={logic.aState.setHoveredObjectGroupKey}
        entitySizeGroups={logic.entitySizeGroups} createAutoGroup={logic.createAutoGroup} handleAutoMatch={logic.handleAutoMatch}
        updateComponentProperty={logic.updateComponentProperty} 
        updateComponentColor={logic.updateComponentColor} 
        deleteComponent={logic.deleteComponent}
        confirmDeleteComponent={logic.confirmDeleteComponent}
        deleteAllMatches={logic.deleteAllMatches}
        confirmDeleteAllMatches={logic.confirmDeleteAllMatches}
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
        saveProject={logic.saveProject}
        loadProject={logic.loadProject}
        setShowDxfSettings={logic.aState.setShowDxfSettings}
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

          {/* NEW: Hover Info Dashboard (Top Right) - Styled to match mouse display */}
          {hoveredInfo && (
            <div className="hidden lg:flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="flex items-center gap-2 border-r border-slate-700 pr-3">
                 <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredInfo.color, boxShadow: `0 0 8px ${hoveredInfo.color}` }} />
                 <span className="text-[10px] font-black text-slate-100 uppercase tracking-widest truncate max-w-[140px]">{hoveredInfo.name}</span>
               </div>
               <div className="flex gap-2 font-mono text-[11px] text-slate-400">
                 <span className="bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 shrink-0">X: {hoveredInfo.x.toFixed(2)}</span>
                 <span className="bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 shrink-0">Y: {hoveredInfo.y.toFixed(2)}</span>
                 <span className="bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 shrink-0 font-bold flex items-center gap-1.5">
                    <Compass size={12} className="text-indigo-400" />
                    R: {hoveredInfo.rd.toFixed(1)}° 
                    <span className="text-[9px] opacity-60 font-normal">({hoveredInfo.r.toFixed(3)} Rad)</span>
                 </span>
               </div>
            </div>
          )}
        </div>
        <div className="flex-1 p-6 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {logic.isProcessing && <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-indigo-400 mb-2" size={48} /><p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Processing...</p></div>}
          <ImageCanvas 
            key={logic.imageSrc || 'empty'} 
            src={logic.imageSrc} 
            mode={logic.mode} 
            calibrationData={logic.dState.calibrationData} 
            measurements={logic.mState.measurements} 
            parallelMeasurements={logic.mState.parallelMeasurements} 
            areaMeasurements={logic.mState.areaMeasurements} 
            curveMeasurements={logic.mState.curveMeasurements} 
            currentPoints={logic.currentPoints} 
            onPointClick={logic.handlePointClick} 
            onDeleteMeasurement={(id) => logic.mState.setMeasurements(m => m.filter(x => x.id !== id))} 
            dxfOverlayEntities={logic.dxfOverlayEntities} 
            aiOverlayEntities={logic.aiOverlayEntities}
            originCanvasPos={logic.originCanvasPos} 
            onMousePositionChange={logic.setMouseNormPos} 
            onDimensionsChange={(w, h) => logic.dState.setImgDimensions({width: w, height: h})} 
            initialTransform={logic.viewTransform} 
            onViewChange={logic.setViewTransform} 
            showCalibration={logic.mState.showCalibration} 
            showMeasurements={logic.mState.showMeasurements} 
            hoveredMarker={hoveredMarker}
          />
        </div>
      </div>
    </div>
  );
}
