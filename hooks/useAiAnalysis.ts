import { useMemo, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AiFeatureGroup, FeatureResult } from '../types';
import { generateId, optimizeImageForAPI, getRandomColor } from '../utils';

interface AiAnalysisProps {
  imageSrc: string | null;
  dState: any;
  aState: any;
}

export function useAiAnalysis({ imageSrc, dState, aState }: AiAnalysisProps) {
  
  // --- 计算属性 ---

  const topLevelAiGroups = useMemo(() => {
    return dState.aiFeatureGroups.filter((g: AiFeatureGroup) => !g.parentGroupId);
  }, [dState.aiFeatureGroups]);

  const currentMatchedAiGroups = useMemo(() => {
    if (!aState.inspectAiMatchesParentId) return [];
    return dState.aiFeatureGroups.filter((g: AiFeatureGroup) => g.parentGroupId === aState.inspectAiMatchesParentId);
  }, [aState.inspectAiMatchesParentId, dState.aiFeatureGroups]);

  // --- 业务方法 ---

  const performFeatureSearch = useCallback(async () => {
    if (!imageSrc || !aState.selectedAiGroupId) return;
    const seedGroup = dState.aiFeatureGroups.find((g: AiFeatureGroup) => g.id === aState.selectedAiGroupId);
    if (!seedGroup || seedGroup.features.length === 0) return;
    const seedFeature = seedGroup.features[0];
    
    const existingMatches = dState.aiFeatureGroups.filter((g: AiFeatureGroup) => g.parentGroupId === seedGroup.id);
    
    dState.setIsSearchingFeatures(true);

    const runSearch = async (res: number, qual: number, threshold: number) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const { data, mimeType } = await optimizeImageForAPI(imageSrc, res, qual);
        const ymin = Math.round(seedFeature.minY * 1000), xmin = Math.round(seedFeature.minX * 1000), ymax = Math.round(seedFeature.maxY * 1000), xmax = Math.round(seedFeature.maxX * 1000);
        const prompt = `Find ONLY other instances in this image that have at least ${Math.round(threshold * 100)}% visual similarity to the feature marked at [ymin, xmin, ymax, xmax]: [${ymin}, ${xmin}, ${ymax}, ${xmax}]. Return JSON with "boxes" list.`;
        return await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: [{ parts: [{ inlineData: { mimeType, data } }, { text: prompt }] }], 
            config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { boxes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { ymin: { type: Type.NUMBER }, xmin: { type: Type.NUMBER }, ymax: { type: Type.NUMBER }, xmax: { type: Type.NUMBER } } } } } } } 
        });
    };

    const calculateIoU = (boxA: any, boxB: any) => {
        const interXmin = Math.max(boxA.minX, boxB.minX);
        const interXmax = Math.min(boxA.maxX, boxB.maxX);
        const interYmin = Math.max(boxA.minY, boxB.minY);
        const interYmax = Math.min(boxA.maxY, boxB.maxY);

        const interArea = Math.max(0, interXmax - interXmin) * Math.max(0, interYmax - interYmin);
        const areaA = (boxA.maxX - boxA.minX) * (boxA.maxY - boxA.minY);
        const areaB = (boxB.maxX - boxB.minX) * (boxB.maxY - boxB.minY);
        const unionArea = areaA + areaB - interArea;
        return unionArea > 0 ? interArea / unionArea : 0;
    };

    try {
        let response; 
        try { 
            response = await runSearch(aState.aiSettings.resolution, aState.aiSettings.quality, aState.aiSettings.threshold); 
        } catch (e: any) { 
            if (e.message && (e.message.includes("413") || e.code === 500)) { 
                response = await runSearch(512, 0.2, aState.aiSettings.threshold); 
                aState.setAiSettings((prev: any) => ({ ...prev, resolution: 512, quality: 0.2 })); 
            } else throw e; 
        }

        if (response && response.text) {
            const data = JSON.parse(response.text);
            if (data.boxes && Array.isArray(data.boxes)) {
                const filteredBoxes = data.boxes.filter((box: any) => {
                    const currentBox = {
                        minX: box.xmin / 1000,
                        maxX: box.xmax / 1000,
                        minY: box.ymin / 1000,
                        maxY: box.ymax / 1000
                    };
                    if (calculateIoU(seedFeature, currentBox) > 0.8) return false;
                    for (const matchGroup of existingMatches) {
                        if (matchGroup.features.length > 0) {
                            if (calculateIoU(matchGroup.features[0], currentBox) > 0.8) return false;
                        }
                    }
                    return true;
                });

                const matchGroups: AiFeatureGroup[] = filteredBoxes.map((box: any, idx: number) => ({ 
                    id: generateId(), 
                    name: `${seedGroup.name} - Match ${existingMatches.length + idx + 1}`, 
                    isVisible: true, 
                    isWeld: seedGroup.isWeld, 
                    isMark: seedGroup.isMark, 
                    color: seedGroup.color, 
                    features: [{ 
                        id: generateId(), 
                        minX: box.xmin / 1000, 
                        minY: box.ymin / 1000, 
                        maxX: box.xmax / 1000, 
                        maxY: box.ymax / 1000, 
                        snapped: false 
                    }], 
                    parentGroupId: seedGroup.id 
                }));

                if (matchGroups.length > 0) { 
                    dState.setAiFeatureGroups((prev: AiFeatureGroup[]) => [...prev, ...matchGroups]); 
                    aState.setMatchStatus({ text: `Found ${matchGroups.length} new high-confidence matches!`, type: 'success' }); 
                    // NO AUTOMATIC DRILL DOWN: Stay in Figure 1 Overview.
                } else { 
                    aState.setMatchStatus({ text: `No new high-confidence matches found.`, type: 'info' }); 
                }
            }
        }
    } catch (e: any) { 
        alert(`Failed: ${e.message}`); 
    } finally { 
        dState.setIsSearchingFeatures(false); 
    }
  }, [imageSrc, dState, aState]);

  const updateAiGroupProperty = useCallback((id: string, prop: 'isWeld' | 'isMark', value: boolean) => 
    dState.setAiFeatureGroups((prev: AiFeatureGroup[]) => {
      const target = prev.find(g => g.id === id);
      if (!target) return prev;
      const isParent = !target.parentGroupId;
      return prev.map(g => {
        if (g.id === id) return { ...g, [prop]: value };
        if (isParent && g.parentGroupId === id) return { ...g, [prop]: value };
        return g;
      });
    }), [dState]);

  const updateAiGroupColor = useCallback((id: string, color: string) => 
    dState.setAiFeatureGroups((prev: AiFeatureGroup[]) => prev.map(g => (g.id === id || g.parentGroupId === id) ? { ...g, color } : g)), [dState]);

  const deleteAiGroup = useCallback((id: string) => {
    dState.setAiFeatureGroups((prev: AiFeatureGroup[]) => prev.filter(g => g.id !== id && g.parentGroupId !== id));
    if (aState.selectedAiGroupId === id) aState.setSelectedAiGroupId(null);
    if (aState.inspectAiMatchesParentId === id) aState.setInspectAiMatchesParentId(null);
  }, [dState, aState]);

  return {
    topLevelAiGroups,
    currentMatchedAiGroups,
    performFeatureSearch,
    updateAiGroupProperty,
    updateAiGroupColor,
    deleteAiGroup
  };
}