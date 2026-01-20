import { DxfComponent, AiFeatureGroup, Point } from '../types';
import { CoordinateTransformer } from './geometry';

export const handleExportCSV = (
    originalFileName: string | null,
    rawDxfData: any,
    transformer: CoordinateTransformer,
    dxfComponents: DxfComponent[],
    aiFeatureGroups: AiFeatureGroup[],
    getLogicCoords: (p: Point) => any,
    getScaleInfo: () => any,
    onNotify?: (text: string, type: 'success' | 'info') => void
) => {
    let csvContent = "ID,Name,Type,X,Y,Angle_Deg,Angle_Rad\n";
    let exportCount = 0;

    if (rawDxfData) {
        // --- DXF MODE ---
        const targetComponents = dxfComponents.filter(c => c.isWeld || c.isMark);
        targetComponents.forEach((comp) => {
            // CRITICAL FIX: Direct conversion from Absolute CAD centroid to Logic via the shared transformer
            const coords = transformer.absoluteToLogic(comp.centroid);
            
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
        if (!scaleInfo) {
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
                const coords = getLogicCoords({ x: cx, y: cy });
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