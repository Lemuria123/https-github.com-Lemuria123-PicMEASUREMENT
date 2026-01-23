
import React, { useMemo } from 'react';
import { RenderableDxfEntity, RenderableAiFeature, Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement } from '../types';
import { getPhysDist, getPerpendicularPoint, getPolygonArea, getPolylineLength, getPathData, getCatmullRomPath } from '../utils/geometry';

interface ExtendedRenderableDxf extends RenderableDxfEntity {
  isManualPoint?: boolean;
}

/**
 * DXF Layer: Renders CAD entities using bundled paths for performance and dynamic SVG elements for active/hovered ones.
 */
export const DxfLayer: React.FC<{
  entities: ExtendedRenderableDxf[];
  imgWidth: number;
  imgHeight: number;
  uiBase: number;
  scale: number;
}> = ({ entities, imgWidth, imgHeight, uiBase, scale }) => {
  
  const { normalBundles, selectedBundles, dynamicEntities } = useMemo(() => {
    const normalMap = new Map<string, string>();
    const selectedMap = new Map<string, string>();
    const dynamic: ExtendedRenderableDxf[] = [];

    // Helper to append path data string
    const appendGeometry = (d: string, entity: ExtendedRenderableDxf) => {
        const { geometry } = entity;
        if (geometry.type === 'line') { return d + `M${geometry.props.x1},${geometry.props.y1} L${geometry.props.x2},${geometry.props.y2} `; } 
        else if (geometry.type === 'polyline' && geometry.props.points) {
          const pts = geometry.props.points.split(' ');
          if (pts.length > 0) { 
              let polyStr = `M${pts[0]} `; 
              for (let i = 1; i < pts.length; i++) polyStr += `L${pts[i]} `;
              return d + polyStr; 
          }
        } else if (geometry.type === 'path' && geometry.props.d) { return d + `${geometry.props.d} `; } 
        else if (geometry.type === 'circle') {
          const cx = geometry.props.cx!; const cy = geometry.props.cy!;
          const rx = geometry.props.rx ?? geometry.props.r!; const ry = geometry.props.ry ?? geometry.props.r!;
          return d + `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 `;
        }
        return d;
    };

    entities.forEach(entity => {
      if (entity.isVisible === false) return;
      
      // 优化：高亮状态 (Priority 100+) 或 手动点位 视为动态 DOM 节点，以支持复杂准星渲染
      if (entity.isHovered || entity.isManualPoint) { 
          dynamic.push(entity); 
          return; 
      }

      const color = entity.strokeColor || "rgba(6, 182, 212, 0.4)";
      
      if (entity.isSelected) {
          selectedMap.set(color, appendGeometry(selectedMap.get(color) || "", entity));
      } else {
          normalMap.set(color, appendGeometry(normalMap.get(color) || "", entity));
      }
    });

    return { 
        normalBundles: Array.from(normalMap.entries()).map(([color, d]) => ({ color, d })), 
        selectedBundles: Array.from(selectedMap.entries()).map(([color, d]) => ({ color, d })), 
        dynamicEntities: dynamic 
    };
  }, [entities]);

  return (
    <g transform={`scale(${imgWidth}, ${imgHeight})`}>
      {/* 1. Background/Passive Layer */}
      {normalBundles.map(({ color, d }, i) => (
        <path key={`norm-${color}-${i}`} d={d} stroke={color} fill="none" strokeWidth={uiBase * 0.5 / scale} vectorEffect="non-scaling-stroke" />
      ))}
      
      {/* 2. Selected Layer (Bundled for performance, higher Z-index) */}
      {selectedBundles.map(({ color, d }, i) => (
        <path key={`sel-${color}-${i}`} d={d} stroke={color} fill="none" strokeWidth={uiBase * 1.2 / scale} vectorEffect="non-scaling-stroke" />
      ))}

      {/* 3. Hovered/Manual Layer (Highest Z-index) */}
      {dynamicEntities.map(entity => {
          const { geometry } = entity;
          const strokeW = (uiBase * (entity.isHovered ? 2.2 : 1.2)) / scale; 
          const strokeC = entity.strokeColor;
          const style: React.CSSProperties = { vectorEffect: 'non-scaling-stroke' };
          
          // --- 手动焊点特有的“精密准星环 (Reticle)”渲染逻辑 ---
          if (entity.isManualPoint && geometry.type === 'circle') {
             const cx = geometry.props.cx!; const cy = geometry.props.cy!;
             const rx = geometry.props.rx!; const ry = geometry.props.ry!;
             const haloRMult = entity.isHovered ? 2.5 : 2.0;
             const crosshairLen = 4.0;
             
             return (
               <g key={entity.id}>
                  {/* 外层热区/范围环 (Halo) */}
                  <ellipse cx={cx} cy={cy} rx={rx * haloRMult} ry={ry * haloRMult} fill={entity.isHovered ? "rgba(250, 204, 21, 0.1)" : "none"} stroke={strokeC} strokeWidth={strokeW * 0.5} strokeDasharray={`${strokeW * 4},${strokeW * 4}`} style={style} />
                  
                  {/* 水平十字线 - 使用固定比例扩大范围以便于在缩小后观察 */}
                  <line x1={cx - rx * crosshairLen} y1={cy} x2={cx + rx * crosshairLen} y2={cy} stroke={strokeC} strokeWidth={strokeW * 0.4} style={style} />
                  
                  {/* 垂直十字线 */}
                  <line x1={cx} y1={cy - ry * crosshairLen} x2={cx} y2={cy + ry * crosshairLen} stroke={strokeC} strokeWidth={strokeW * 0.4} style={style} />
                  
                  {/* 中心核心点 */}
                  <ellipse cx={cx} cy={cy} rx={rx * 0.4} ry={ry * 0.4} fill={strokeC} style={style} />
                  
                  {/* 高亮状态下的额外边框 */}
                  {entity.isHovered && <ellipse cx={cx} cy={cy} rx={rx * 3.5} ry={ry * 3.5} fill="none" stroke={strokeC} strokeWidth={strokeW * 0.2} opacity="0.3" style={style} />}
               </g>
             );
          }

          if (geometry.type === 'line') return <line key={entity.id} x1={geometry.props.x1} y1={geometry.props.y1} x2={geometry.props.x2} y2={geometry.props.y2} stroke={strokeC} fill="none" strokeWidth={strokeW} style={style} />;
          if (geometry.type === 'polyline') return <polyline key={entity.id} points={geometry.props.points} fill="none" stroke={strokeC} strokeWidth={strokeW} style={style} />;
          if (geometry.type === 'path') return <path key={entity.id} d={geometry.props.d} fill="none" stroke={strokeC} strokeWidth={strokeW} style={style} />;
          if (geometry.type === 'circle') return <ellipse key={entity.id} cx={geometry.props.cx} cy={geometry.props.cy} rx={geometry.props.rx ?? geometry.props.r} ry={geometry.props.ry ?? geometry.props.r} fill="none" stroke={strokeC} strokeWidth={strokeW} style={style} />;
          return null;
      })}
    </g>
  );
};

/**
 * AI Layer: Renders bounding boxes found via feature search.
 */
export const AiLayer: React.FC<{
  entities: RenderableAiFeature[];
  imgWidth: number;
  imgHeight: number;
}> = ({ entities, imgWidth, imgHeight }) => {
  return (
    <g>
      {entities.map(feat => (
        <rect
          key={feat.id}
          x={feat.minX * imgWidth}
          y={feat.minY * imgHeight}
          width={(feat.maxX - feat.minX) * imgWidth}
          height={(feat.maxY - feat.minY) * imgHeight}
          fill="none"
          stroke={feat.strokeColor}
          strokeWidth={feat.strokeWidth}
          style={{ vectorEffect: 'non-scaling-stroke' }}
        />
      ))}
    </g>
  );
};

/**
 * Measurement Layer: Renders all established measurements.
 */
export const MeasurementLayer: React.FC<{
  measurements: LineSegment[];
  parallelMeasurements: ParallelMeasurement[];
  areaMeasurements: AreaMeasurement[];
  curveMeasurements: CurveMeasurement[];
  imgWidth: number;
  imgHeight: number;
  mmPerPixel: number;
  unitLabel: string;
  uiBase: number;
  scale: number;
  getS: (m?: number) => number;
  getR: (m?: number) => number;
  getF: (m?: number) => number;
}> = ({ 
  measurements, parallelMeasurements, areaMeasurements, curveMeasurements, 
  imgWidth, imgHeight, mmPerPixel, unitLabel, getS, getF 
}) => {
  return (
    <g>
      {measurements.map(m => (
        <g key={m.id}>
          <line x1={m.start.x * imgWidth} y1={m.start.y * imgHeight} x2={m.end.x * imgWidth} y2={m.end.y * imgHeight} stroke="#6366f1" fill="none" strokeWidth={getS(0.8)} strokeLinecap="round" />
          <text x={(m.start.x + m.end.x)/2 * imgWidth} y={(m.start.y + m.end.y)/2 * imgHeight} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
            {getPhysDist(m.start, m.end, imgWidth, imgHeight, mmPerPixel).toFixed(2)}{unitLabel}
          </text>
        </g>
      ))}
      {parallelMeasurements.map(pm => {
        const proj = getPerpendicularPoint(pm.offsetPoint, pm.baseStart, pm.baseEnd, imgWidth, imgHeight);
        const dist = getPhysDist(pm.offsetPoint, proj, imgWidth, imgHeight, mmPerPixel);
        return (
          <g key={pm.id}>
            <line x1={pm.baseStart.x * imgWidth} y1={pm.baseStart.y * imgHeight} x2={pm.baseEnd.x * imgWidth} y2={pm.baseEnd.y * imgHeight} stroke="#6366f1" strokeWidth={getS(1)} />
            <line x1={pm.offsetPoint.x * imgWidth} y1={pm.offsetPoint.y * imgHeight} x2={proj.x * imgWidth} y2={proj.y * imgHeight} stroke="#fbbf24" strokeWidth={getS(0.6)} strokeDasharray={`${getS(2)} ${getS(2)}`} />
            <text x={pm.offsetPoint.x * imgWidth} y={pm.offsetPoint.y * imgHeight} fill="#fbbf24" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>D: {dist.toFixed(2)}{unitLabel}</text>
          </g>
        );
      })}
      {areaMeasurements.map(am => (
        <g key={am.id}>
          <path d={getPathData(am.points, imgWidth, imgHeight) + ' Z'} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth={getS(0.8)} />
          <text x={(am.points.reduce((s,p)=>s+p.x,0)/am.points.length)*imgWidth} y={(am.points.reduce((s,p)=>s+p.y,0)/am.points.length)*imgHeight} fill="white" fontSize={getF(10)} fontWeight="bold" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
            {getPolygonArea(am.points, imgWidth, imgHeight, mmPerPixel).toFixed(2)}{unitLabel}²
          </text>
        </g>
      ))}
      {curveMeasurements.map(cm => (
        <g key={cm.id}>
          <path d={getCatmullRomPath(cm.points, imgWidth, imgHeight)} fill="none" stroke="#a855f7" strokeWidth={getS(1)} />
          <text x={cm.points[Math.floor(cm.points.length/2)].x * imgWidth} y={cm.points[Math.floor(cm.points.length/2)].y * imgHeight} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
            {getPolylineLength(cm.points, imgWidth, imgHeight, mmPerPixel).toFixed(2)}{unitLabel}
          </text>
        </g>
      ))}
    </g>
  );
};
