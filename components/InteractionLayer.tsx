import React from 'react';
import { Point, AppMode } from '../types';
import { getPhysDist, getPerpendicularPoint, getPolygonArea, getPolylineLength, getPathData, getCatmullRomPath } from '../utils/geometry';

interface InteractionLayerProps {
  mode: AppMode | string;
  currentPoints: Point[];
  mousePos: Point | null;
  snappedPos: Point | null;
  imgSize: { width: number; height: number };
  mmPerPixel: number;
  unitLabel: string;
  getS: (m?: number) => number;
  getF: (m?: number) => number;
  getR: (m?: number) => number;
}

export const InteractionLayer: React.FC<InteractionLayerProps> = ({
  mode, currentPoints, mousePos, snappedPos, imgSize, mmPerPixel, unitLabel, getS, getF, getR
}) => {
  if (currentPoints.length === 0) return null;

  const targetPos = snappedPos || mousePos;

  return (
    <g>
      {/* Box Selection / Feature Selection Preview */}
      {(mode === 'box_group' || mode === 'feature') && (
        currentPoints.length === 1 && targetPos ? (
          <rect 
            x={Math.min(currentPoints[0].x, targetPos.x) * imgSize.width} 
            y={Math.min(currentPoints[0].y, targetPos.y) * imgSize.height} 
            width={Math.abs(currentPoints[0].x - targetPos.x) * imgSize.width} 
            height={Math.abs(currentPoints[0].y - targetPos.y) * imgSize.height} 
            fill="rgba(99, 102, 241, 0.1)" stroke="#6366f1" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} 
          />
        ) : currentPoints.length === 2 ? (
          <rect 
            x={Math.min(currentPoints[0].x, currentPoints[1].x) * imgSize.width} 
            y={Math.min(currentPoints[0].y, currentPoints[1].y) * imgSize.height} 
            width={Math.abs(currentPoints[0].x - currentPoints[1].x) * imgSize.width} 
            height={Math.abs(currentPoints[0].y - currentPoints[1].y) * imgSize.height} 
            fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth={getS(0.8)} strokeDasharray={getS(3)} 
          />
        ) : null
      )}

      {/* Distance Measurement Preview */}
      {mode === 'measure' && currentPoints.length === 1 && targetPos && (
        <g>
          {(() => {
            const dist = getPhysDist(currentPoints[0], targetPos, imgSize.width, imgSize.height, mmPerPixel);
            return (
              <>
                <line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={targetPos.x * imgSize.width} y2={targetPos.y * imgSize.height} stroke="#6366f1" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} />
                <text x={((currentPoints[0].x + targetPos.x) / 2) * imgSize.width} y={((currentPoints[0].y + targetPos.y) / 2) * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
                  {dist.toFixed(2)}{unitLabel}
                </text>
              </>
            );
          })()}
        </g>
      )}

      {/* Parallel Measurement Preview */}
      {mode === 'parallel' && (
        <g>
          {currentPoints.length >= 2 && (
            <line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={currentPoints[1].x * imgSize.width} y2={currentPoints[1].y * imgSize.height} stroke="#6366f1" strokeWidth={getS(1)} />
          )}
          {(currentPoints.length === 3 || (currentPoints.length === 2 && targetPos)) && (
            <g>
              {(() => {
                const p3 = currentPoints.length === 3 ? currentPoints[2] : targetPos!; 
                const proj = getPerpendicularPoint(p3, currentPoints[0], currentPoints[1], imgSize.width, imgSize.height); 
                const dist = getPhysDist(p3, proj, imgSize.width, imgSize.height, mmPerPixel);
                return (
                  <>
                    <line x1={p3.x * imgSize.width} y1={p3.y * imgSize.height} x2={proj.x * imgSize.width} y2={proj.y * imgSize.height} stroke="#fbbf24" strokeWidth={getS(0.6)} strokeDasharray={`${getS(2)} ${getS(2)}`} />
                    <text x={p3.x * imgSize.width} y={p3.y * imgSize.height} fill="#fbbf24" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
                      D: {dist.toFixed(2)}{unitLabel}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </g>
      )}

      {/* Area Measurement Preview */}
      {mode === 'area' && (
        <g>
          <path d={getPathData(currentPoints, imgSize.width, imgSize.height) + (currentPoints.length > 2 ? ' Z' : '')} fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" strokeWidth={getS(0.8)} strokeDasharray={getS(2)} />
          {currentPoints.length > 2 && (
            <text x={(currentPoints.reduce((s,p)=>s+p.x,0)/currentPoints.length)*imgSize.width} y={(currentPoints.reduce((s,p)=>s+p.y,0)/currentPoints.length)*imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
              {getPolygonArea(currentPoints, imgSize.width, imgSize.height, mmPerPixel).toFixed(2)}{unitLabel}²
            </text>
          )}
        </g>
      )}

      {/* Curve Measurement Preview */}
      {mode === 'curve' && (
        <g>
          <path d={getCatmullRomPath(currentPoints, imgSize.width, imgSize.height)} fill="none" stroke="#a855f7" strokeWidth={getS(1.2)} strokeDasharray={`${getS(3)} ${getS(3)}`} />
          {currentPoints.length > 1 && (
            <text x={currentPoints[currentPoints.length-1].x * imgSize.width} y={currentPoints[currentPoints.length-1].y * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
              {getPolylineLength(currentPoints, imgSize.width, imgSize.height, mmPerPixel).toFixed(2)}{unitLabel}
            </text>
          )}
        </g>
      )}

      {/* Common Point Markers */}
      {currentPoints.map((p, i) => (
        <circle key={`pt-${i}`} cx={p.x * imgSize.width} cy={p.y * imgSize.height} r={getR(1.3)} fill="#6366f1" stroke="white" strokeWidth={getS(0.6)} />
      ))}
    </g>
  );
};