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
    let csvContent = "ID,Name,Type,X,Y,Angle_Deg,Angle_Rad\n";
    let exportCount = 0;

    // Use unified getLogicCoords for BOTH modes to ensure consistency
    const processLogicPoint = (p: Point) => {
        const coords = getLogicCoords(p);
        return coords ? { x: coords.x, y: coords.y } : null;
    };

    if (rawDxfData) {
        // --- DXF MODE ---
        const targetComponents = dxfComponents.filter(c => c.isWeld || c.isMark);
        targetComponents.forEach((comp) => {
            // Need to convert Absolute CAD to Logic via Normalized intermediate for simplicity 
            // OR use transformer directly. Since getLogicCoords is passed in, we use that.
            const { minX, maxY, totalW, totalH, padding } = rawDxfData;
            const normX = (comp.centroid.x - (minX - padding)) / totalW;
            const normY = ((maxY + padding) - comp.centroid.y) / totalH;
            
            const coords = processLogicPoint({ x: normX, y: normY });
            if (coords) {
                exportCount++;
                const typeLabel = comp.isWeld ? "Weld" : "Mark";
                const angDeg = ((comp.rotationDeg || 0) % 360 + 360) % 360;
                const angRad = ((comp.rotation || 0) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);
                csvContent += `${exportCount},"${comp.name}",${typeLabel},${coords.x.toFixed(4)},${coords.y.toFixed(4)},${angDeg.toFixed(2)},${angRad.toFixed(6)}\n`;
            }
        });
    } else {
        // --- AI (IMAGE) MODE ---
        const scaleInfo = getScaleInfo();
        if (!scaleInfo || !manualOriginCAD) {
            onNotify?.("Please calibrate and set origin before export.", 'info');
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
                const coords = processLogicPoint({ x: cx, y: cy });
                if (coords) {
                    exportCount++;
                    csvContent += `${exportCount},"${group.name}",${typeLabel},${coords.x.toFixed(4)},${coords.y.toFixed(4)},${angDeg.toFixed(2)},${angRad.toFixed(6)}\n`;
                }
            });
        });
    }

    if (exportCount > 0) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${originalFileName?.split('.')[0] || 'measurements'}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        onNotify?.("No items marked for export found.", 'info');
    }
};