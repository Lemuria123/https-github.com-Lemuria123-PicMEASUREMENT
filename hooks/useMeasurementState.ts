
import { useState } from 'react';
import { LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement } from '../types';

export function useMeasurementState() {
  const [measurements, setMeasurements] = useState<LineSegment[]>([]);
  const [parallelMeasurements, setParallelMeasurements] = useState<ParallelMeasurement[]>([]);
  const [areaMeasurements, setAreaMeasurements] = useState<AreaMeasurement[]>([]);
  const [curveMeasurements, setCurveMeasurements] = useState<CurveMeasurement[]>([]);
  
  // 可视化开关状态
  const [showCalibration, setShowCalibration] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);

  return {
    measurements,
    setMeasurements,
    parallelMeasurements,
    setParallelMeasurements,
    areaMeasurements,
    setAreaMeasurements,
    curveMeasurements,
    setCurveMeasurements,
    showCalibration,
    setShowCalibration,
    showMeasurements,
    setShowMeasurements,
  };
}
