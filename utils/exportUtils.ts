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
    // 定义标准的 CSV 表头
    let csvContent = "ID,Name,Type,X,Y\n";
    let exportCount = 0;

    if (rawDxfData) {
        // --- DXF 模式导出 ---
        const { defaultCenterX, defaultCenterY } = rawDxfData;
        const ox = manualOriginCAD ? manualOriginCAD.x : defaultCenterX; 
        const oy = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;

        // 仅导出标记为 Weld 或 Mark 的组件
        const targetComponents = dxfComponents.filter(c => c.isWeld || c.isMark);

        targetComponents.forEach((comp) => {
            exportCount++;
            const typeLabel = comp.isWeld ? "Weld" : "Mark";
            const x = comp.centroid.x - ox;
            const y = comp.centroid.y - oy;
            csvContent += `${exportCount},"${comp.name}",${typeLabel},${x.toFixed(4)},${y.toFixed(4)}\n`;
        });
    } else {
        // --- AI (图片) 模式导出 ---
        const scaleInfo = getScaleInfo();
        const hasOrigin = !!manualOriginCAD;

        // 校验：必须先标定且设置原点
        if (!scaleInfo || !hasOrigin) {
            onNotify?.("请先完成标定并设置坐标原点，否则无法导出逻辑坐标数据。", 'info');
            return;
        }

        // 仅处理标记为 Weld 或 Mark 的特征组
        const targetGroups = aiFeatureGroups.filter(g => g.isWeld || g.isMark);

        targetGroups.forEach((group) => {
            const typeLabel = group.isWeld ? "Weld" : "Mark";
            
            // 导出该组内的每一个特征实例
            group.features.forEach((feat) => {
                const cx = (feat.minX + feat.maxX) / 2;
                const cy = (feat.minY + feat.maxY) / 2;
                const coords = getLogicCoords({ x: cx, y: cy });

                if (coords) {
                    exportCount++;
                    csvContent += `${exportCount},"${group.name}",${typeLabel},${coords.x.toFixed(4)},${coords.y.toFixed(4)}\n`;
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
        onNotify?.("No items marked as 'Weld' or 'Mark' found for export.", 'info');
    }
};