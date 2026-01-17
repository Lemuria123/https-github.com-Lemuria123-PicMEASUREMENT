
import { DxfEntityType } from '../types';

export const getDxfEntityPathData = (
  entity: { type: DxfEntityType; rawEntity: any },
  toNormX: (x: number) => number,
  toNormY: (y: number) => number,
  totalW: number,
  totalH: number
) => {
  const { type, rawEntity } = entity;

  if (type === 'LINE') {
    const v = rawEntity.vertices;
    return {
      type: 'line' as const,
      props: {
        x1: toNormX(v[0].x),
        y1: toNormY(v[0].y),
        x2: toNormX(v[1].x),
        y2: toNormY(v[1].y)
      }
    };
  }

  if (type === 'LWPOLYLINE') {
    return {
      type: 'polyline' as const,
      props: {
        points: rawEntity.vertices.map((v: any) => `${toNormX(v.x)},${toNormY(v.y)}`).join(' ')
      }
    };
  }

  if (type === 'ARC') {
    const { center, radius, startAngle, endAngle } = rawEntity;
    const sx = center.x + radius * Math.cos(startAngle);
    const sy = center.y + radius * Math.sin(startAngle);
    const ex = center.x + radius * Math.cos(endAngle);
    const ey = center.y + radius * Math.sin(endAngle);
    const largeArcFlag = ((endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI)) > Math.PI ? 1 : 0;
    const d = `M ${toNormX(sx)} ${toNormY(sy)} A ${radius / totalW} ${radius / totalH} 0 ${largeArcFlag} 0 ${toNormX(ex)} ${toNormY(ey)}`;
    return {
      type: 'path' as const,
      props: { d }
    };
  }

  if (type === 'CIRCLE') {
    return {
      type: 'circle' as const,
      props: {
        cx: toNormX(rawEntity.center.x),
        cy: toNormY(rawEntity.center.y),
        r: rawEntity.radius / totalW,
        rx: rawEntity.radius / totalW,
        ry: rawEntity.radius / totalH
      }
    };
  }

  return null;
};
