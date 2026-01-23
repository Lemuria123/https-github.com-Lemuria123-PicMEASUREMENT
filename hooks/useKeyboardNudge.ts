
import { useEffect } from 'react';
import { Point } from '../types';

interface UseKeyboardNudgeProps {
  currentPoints: Point[];
  setCurrentPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  getScaleInfo: () => any;
  imgDimensions: { width: number, height: number } | null;
}

/**
 * 键盘微调逻辑 Hook
 * 处理 ArrowUp/Down/Left/Right 键对当前选定点位的精密移动
 */
export function useKeyboardNudge({ 
  currentPoints, 
  setCurrentPoints, 
  getScaleInfo, 
  imgDimensions 
}: UseKeyboardNudgeProps) {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (currentPoints.length === 0) return;
        e.preventDefault();
        
        const scaleInfo = getScaleInfo();
        const nudgeAmount = e.shiftKey ? 10 : 1;
        
        // 基础步长：如果已标定，单次按键 0.01mm，否则 1px
        const stepBase = (scaleInfo ? 0.01 : 1) * nudgeAmount;
        const dx = (e.key === 'ArrowLeft' ? -stepBase : e.key === 'ArrowRight' ? stepBase : 0);
        const dy = (e.key === 'ArrowUp' ? -stepBase : e.key === 'ArrowDown' ? stepBase : 0);

        const lastIdx = currentPoints.length - 1;
        const lastPt = currentPoints[lastIdx];
        
        // 将物理位移转换为归一化坐标位移
        let normDx = dx;
        let normDy = dy;
        
        if (scaleInfo && imgDimensions) {
            normDx = dx / scaleInfo.totalWidthMM;
            normDy = dy / scaleInfo.totalHeightMM;
        } else if (imgDimensions) {
            normDx = dx / imgDimensions.width;
            normDy = dy / imgDimensions.height;
        }

        setCurrentPoints(prev => {
            const next = [...prev];
            next[lastIdx] = { 
                x: Math.max(0, Math.min(1, lastPt.x + normDx)), 
                y: Math.max(0, Math.min(1, lastPt.y + normDy)) 
            };
            return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPoints, getScaleInfo, imgDimensions, setCurrentPoints]);
}
