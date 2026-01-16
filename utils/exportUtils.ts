
import { DxfComponent, AiFeatureGroup, Point } from '../types';

export const handleExportCSV = (
    originalFileName: string | null,
    rawDxfData: any,
    manualOriginCAD: {x: number, y: number} | null,
    dxfComponents: DxfComponent[],
    aiFeatureGroups: AiFeatureGroup[],
    getLogicCoords: (p: Point) => any,
    getScaleInfo: () => any
) => {
    let csvContent = "ID,Name,Mark,Weld,Count,X,Y\n";
    let dataToExport: {name: string, isMark: boolean, isWeld: boolean, count: number, x: number, y: number}[] = [];
    
    if (rawDxfData) {
        const { defaultCenterX, defaultCenterY } = rawDxfData;
        const ox = manualOriginCAD ? manualOriginCAD.x : defaultCenterX; 
        const oy = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
        dataToExport = dxfComponents.map(comp => ({
            name: comp.name,
            isMark: comp.isMark,
            isWeld: comp.isWeld,
            count: comp.entityIds.length,
            x: comp.centroid.x - ox,
            y: comp.centroid.y - oy
        }));
    } else {
        const scaleInfo = getScaleInfo();
        dataToExport = aiFeatureGroups.map(group => {
            let sx = 0, sy = 0;
            group.features.forEach(f => {
                sx += (f.minX + f.maxX) / 2;
                sy += (f.minY + f.maxY) / 2;
            });
            const cx = sx / Math.max(1, group.features.length);
            const cy = sy / Math.max(1, group.features.length);
            
            const coords = getLogicCoords({ x: cx, y: cy });
            
            return {
                name: group.name,
                isMark: group.isMark,
                isWeld: group.isWeld,
                count: group.features.length,
                x: coords?.x || 0,
                y: coords?.y || 0
            };
        });
    }

    if (dataToExport.length > 0) {
        dataToExport.forEach((item, idx) => { 
            csvContent += `${idx+1},${item.name},${item.isMark},${item.isWeld},${item.count},${item.x.toFixed(4)},${item.y.toFixed(4)}\n`; 
        });
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' })); 
        a.download = `${originalFileName?.split('.')[0] || 'export'}.csv`; 
        a.click();
    } else { 
        alert("Nothing to export."); 
    }
};
