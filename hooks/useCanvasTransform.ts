
import { useState, useCallback, useRef } from 'react';
import { ViewTransform, Point } from '../types';

interface UseCanvasTransformProps {
  initialTransform?: ViewTransform | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  layoutSize: { width: number, height: number };
  onViewChange?: (transform: ViewTransform) => void;
}

export function useCanvasTransform({
  initialTransform,
  containerRef,
  layoutSize,
  onViewChange
}: UseCanvasTransformProps) {
  const [scale, setScale] = useState(initialTransform?.scale || 1);
  const [position, setPosition] = useState({ x: initialTransform?.x || 0, y: initialTransform?.y || 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const getNormalizedPoint = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current || layoutSize.width === 0 || layoutSize.height === 0) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    const centerY = containerRect.top + containerRect.height / 2;
    
    // 逆变换：屏幕坐标 -> 画布坐标
    const unscaledX = (clientX - centerX - position.x) / scale;
    const unscaledY = (clientY - centerY - position.y) / scale;
    
    // 归一化：-0.5 到 0.5 映射回 0 到 1
    const normX = (unscaledX / layoutSize.width) + 0.5;
    const normY = (unscaledY / layoutSize.height) + 0.5;
    
    // 允许微小的边缘溢出以便于吸附，但进行边界裁剪
    if (normX >= -0.05 && normX <= 1.05 && normY >= -0.05 && normY <= 1.05) {
        return { x: Math.max(0, Math.min(1, normX)), y: Math.max(0, Math.min(1, normY)) };
    }
    return null;
  }, [containerRef, layoutSize, position, scale]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta)), 100);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const relX = e.clientX - centerX;
    const relY = e.clientY - centerY;
    
    // 以鼠标位置为缩放中心
    setPosition(prev => ({
      x: relX - (relX - prev.x) * (newScale / scale),
      y: relY - (relY - prev.y) * (newScale / scale)
    }));
    setScale(newScale);
    onViewChange?.({ x: position.x, y: position.y, scale: newScale });
  }, [scale, containerRef, onViewChange, position.x, position.y]);

  const startDragging = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX - position.x, y: clientY - position.y };
  }, [position]);

  const updateDragging = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const newPos = { x: clientX - dragStartRef.current.x, y: clientY - dragStartRef.current.y };
    setPosition(newPos);
    onViewChange?.({ ...newPos, scale });
  }, [isDragging, scale, onViewChange]);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onViewChange?.({ x: 0, y: 0, scale: 1 });
  }, [onViewChange]);

  return {
    scale, setScale, position, setPosition, isDragging,
    getNormalizedPoint, handleWheel, startDragging, updateDragging, stopDragging, resetTransform
  };
}
