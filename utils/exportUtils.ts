import { DxfComponent, AiFeatureGroup, Point } from '../types';

export const handleExportCSV = (
    originalFileName: string | null,
    rawDxfData: any,
    manualOriginCAD: {x: number, y: number} | null,
    dxfComponents: DxfComponent[],
    aiFeatureGroups: AiFeatureGroup[],
    getLogicCoords: (p: Point) => any,
    getScaleInfo: () => any,
    onNotify?: (text: string, type: 'success' | 'info') => void
) => {
    // CSV Header: ID, Name, Type, Sequence, X, Y, Angle_Deg, Angle_Rad
    let csvContent = "ID,Name,Type,Sequence,X,Y,Angle_Deg,Angle_Rad\n";
    let exportCount = 0;

    if (rawDxfData) {
        // --- DXF 模式导出 ---
        const { defaultCenterX, defaultCenterY } = rawDxfData;
        const ox = manualOriginCAD ? manualOriginCAD.x : defaultCenterX; 
        const oy = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;

        // 仅导出标记为 Weld 或 Mark 的组件，并按 Sequence 排序
        const targetComponents = dxfComponents
            .filter(c => c.isWeld || c.isMark)
            .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

        targetComponents.forEach((comp) => {
            exportCount++;
            const typeLabel = comp.isWeld ? "Weld" : "Mark";
            const x = comp.centroid.x - ox;
            const y = comp.centroid.y - oy;
            const seqNum = comp.sequence || 0;
            
            const angDeg = ((comp.rotationDeg || 0) % 360 + 360) % 360;
            const angRad = ((comp.rotation || 0) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);
            
            csvContent += `${exportCount},"${comp.name}",${typeLabel},${seqNum},${x.toFixed(4)},${y.toFixed(4)},${angDeg.toFixed(2)},${angRad.toFixed(6)}\n`;
        });
    } else {
        // --- AI (图片) 模式导出 ---
        const scaleInfo = getScaleInfo();
        const hasOrigin = !!manualOriginCAD;

        if (!scaleInfo || !hasOrigin) {
            onNotify?.("Please complete calibration and set origin before exporting logic coordinates.", 'info');
            return;
        }

        const targetGroups = aiFeatureGroups.filter(g => g.isWeld || g.isMark);

        targetGroups.forEach((group) => {
            const typeLabel = group.isWeld ? "Weld" : "Mark";
            const angDeg = ((group.rotationDeg || 0) % 360 + 360) % 360;
            const angRad = ((group.rotation || 0) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);
            
            group.features.forEach((feat) => {
                const cx = (feat.minX + feat.maxX) / 2;
                const cy = (feat.minY + feat.maxY) / 2;
                const coords = getLogicCoords({ x: cx, y: cy });

                if (coords) {
                    exportCount++;
                    // AI 模式暂时不支持单个 Feature 的 Sequence，使用 Group 级别或 0
                    csvContent += `${exportCount},"${group.name}",${typeLabel},0,${coords.x.toFixed(4)},${coords.y.toFixed(4)},${angDeg.toFixed(2)},${angRad.toFixed(6)}\n`;
                }
            });
        });
    }

    if (exportCount > 0) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${originalFileName?.split('.')[0] || 'mark_weld'}_production_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onNotify?.(`Successfully exported ${exportCount} production points.`, 'success');
    } else {
        onNotify?.("No items marked as 'Weld' or 'Mark' found for export.", 'info');
    }
};
