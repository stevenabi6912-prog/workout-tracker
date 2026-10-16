// Map Apple Health elements to app records.
import { parseHKDate, parseWorkoutStatistics } from './health-parse.js';
import { LB_PER_KG, MI_PER_KM, round } from '../domain/units.js';

export const HK = {
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
  restingHR: 'HKQuantityTypeIdentifierRestingHeartRate',
  distanceWalkRun: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  distanceCycling: 'HKQuantityTypeIdentifierDistanceCycling',
  distanceRowing: 'HKQuantityTypeIdentifierDistanceRowing',
};

const ACTIVITY_MAP = {
  HKWorkoutActivityTypeRunning: { kind: 'cardio', type: 'run', name: 'Run' },
  HKWorkoutActivityTypeWalking: { kind: 'cardio', type: 'other', name: 'Walk' },
  HKWorkoutActivityTypeHiking: { kind: 'cardio', type: 'other', name: 'Hike' },
  HKWorkoutActivityTypeCycling: { kind: 'cardio', type: 'bike', name: 'Cycling' },
  HKWorkoutActivityTypeRowing: { kind: 'cardio', type: 'rower', name: 'Rowing' },
  HKWorkoutActivityTypeElliptical: { kind: 'cardio', type: 'elliptical', name: 'Elliptical' },
  HKWorkoutActivityTypeStairClimbing: { kind: 'cardio', type: 'other', name: 'Stair climbing' },
  HKWorkoutActivityTypeSwimming: { kind: 'cardio', type: 'other', name: 'Swimming' },
  HKWorkoutActivityTypeHighIntensityIntervalTraining: { kind: 'cardio', type: 'other', name: 'HIIT' },
  HKWorkoutActivityTypeMixedCardio: { kind: 'cardio', type: 'other', name: 'Mixed cardio' },
  HKWorkoutActivityTypeTraditionalStrengthTraining: { kind: 'strength', name: 'Strength training' },
  HKWorkoutActivityTypeFunctionalStrengthTraining: { kind: 'strength', name: 'Functional strength' },
  HKWorkoutActivityTypeCoreTraining: { kind: 'strength', name: 'Core training' },
  HKWorkoutActivityTypeCrossTraining: { kind: 'strength', name: 'Cross training' },
};

export function activityInfo(type) {
  if (ACTIVITY_MAP[type]) return ACTIVITY_MAP[type];
  const name = (type || '').replace('HKWorkoutActivityType', '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'Workout';
  return { kind: 'cardio', type: 'other', name };
}

export function toLb(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (!unit || unit === 'lb') return v;
  if (unit === 'kg') return v * LB_PER_KG;
  if (unit === 'st') return v * 14;
  return v;
}
export function toMi(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (!unit || unit === 'mi') return v;
  if (unit === 'km') return v * MI_PER_KM;
  if (unit === 'm') return (v / 1000) * MI_PER_KM;
  if (unit === 'yd') return v / 1760;
  return v;
}
export function toSec(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (unit === 'min') return v * 60;
  if (unit === 'hr') return v * 3600;
  return v;
}

// Builds app records from scanner callbacks. Call finish() to get the result.
export function createHealthMapper(profileId) {
  const bodyweight = [];
  const hrDays = new Map(); // date -> { sum, n, min, max, resting }
  const workouts = [];
  const cardio = [];
  const counts = { bodyMass: 0, heartRate: 0, restingHR: 0, workouts: 0, skipped: 0 };

  function onRecord(a) {
    if (a.type === HK.bodyMass) {
      const d = parseHKDate(a.startDate);
      const lb = toLb(a.value, a.unit);
      if (!d || lb == null) { counts.skipped++; return; }
      counts.bodyMass++;
      bodyweight.push({ id: null, profileId, date: d.date, at: new Date(d.ms).toISOString(), weightLb: round(lb, 1), source: 'apple_health', externalId: `ah:bm:${a.startDate}:${round(lb, 1)}` });
    } else if (a.type === HK.heartRate) {
      const d = parseHKDate(a.startDate);
      const v = Number(a.value);
      if (!d || !Number.isFinite(v)) { counts.skipped++; return; }
      counts.heartRate++;
      const day = hrDays.get(d.date) || { sum: 0, n: 0, min: Infinity, max: -Infinity, resting: null };
      day.sum += v; day.n++; day.min = Math.min(day.min, v); day.max = Math.max(day.max, v);
      hrDays.set(d.date, day);
    } else if (a.type === HK.restingHR) {
      const d = parseHKDate(a.startDate);
      const v = Number(a.value);
      if (!d || !Number.isFinite(v)) { counts.skipped++; return; }
      counts.restingHR++;
      const day = hrDays.get(d.date) || { sum: 0, n: 0, min: Infinity, max: -Infinity, resting: null };
      day.resting = Math.round(v);
      hrDays.set(d.date, day);
    }
  }

  function onWorkout(a) {
    const start = parseHKDate(a.startDate);
    const end = parseHKDate(a.endDate);
    if (!start) { counts.skipped++; return; }
    counts.workouts++;
    const info = activityInfo(a.workoutActivityType);
    const stats = parseWorkoutStatistics(a.__inner);
    let durationSec = toSec(a.duration, a.durationUnit);
    if (durationSec == null && end) durationSec = (end.ms - start.ms) / 1000;
    let distanceMi = a.totalDistance != null ? toMi(a.totalDistance, a.totalDistanceUnit) : null;
    if (distanceMi == null) {
      const ds = stats[HK.distanceWalkRun] || stats[HK.distanceCycling] || stats[HK.distanceRowing];
      if (ds?.sum != null) distanceMi = toMi(ds.sum, ds.unit);
    }
    const hr = stats[HK.heartRate];
    const avgHr = hr?.average != null ? Math.round(Number(hr.average)) : null;
    const externalId = `ah:wk:${a.workoutActivityType}:${a.startDate}:${a.endDate}`;
    const base = { profileId, date: start.date, source: 'apple_health', externalId, device: a.sourceName || null };
    if (info.kind === 'strength') {
      workouts.push({ ...base, id: null, startedAt: new Date(start.ms).toISOString(), endedAt: end ? new Date(end.ms).toISOString() : null, status: 'done', routineId: null, routineDayId: null, label: `${info.name} (Apple Health)`, finisher: null, entries: [], notes: a.sourceName ? `From ${a.sourceName}` : '', durationSec: durationSec != null ? Math.round(durationSec) : null, avgHr });
    } else {
      cardio.push({ ...base, id: null, at: new Date(start.ms).toISOString(), type: info.type, durationSec: durationSec != null ? Math.round(durationSec) : 0, distanceMi: distanceMi != null && distanceMi > 0 ? round(distanceMi, 2) : null, intensity: null, incline: null, resistance: null, avgHr, notes: info.type === 'other' ? info.name : '', intervals: null, workoutId: null });
    }
  }

  function finish() {
    const hrDaily = [...hrDays.entries()].map(([date, d]) => ({
      id: `${profileId}:${date}`, profileId, date,
      avg: d.n ? Math.round(d.sum / d.n) : null, min: d.n ? Math.round(d.min) : null, max: d.n ? Math.round(d.max) : null, samples: d.n, resting: d.resting, source: 'apple_health',
    }));
    return { bodyweight, hrDaily, workouts, cardio, counts };
  }

  return { onRecord, onWorkout, finish };
}
