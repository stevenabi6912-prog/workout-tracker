import { describe, it, expect } from 'vitest';
import { createHealthScanner, parseHKDate, parseAttrs, unescapeXml } from '../src/import/health-parse.js';
import { createHealthMapper, toLb, toMi } from '../src/import/health-map.js';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary)*)>
]>
<HealthData locale="en_US">
 <ExportDate value="2026-10-01 08:00:00 -0400"/>
 <Me HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" unit="lb" creationDate="2026-09-01 07:00:00 -0400" startDate="2026-09-01 07:00:00 -0400" endDate="2026-09-01 07:00:00 -0400" value="201.4"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale &amp; Co" unit="kg" startDate="2026-09-02 07:00:00 -0400" endDate="2026-09-02 07:00:00 -0400" value="90.7">
  <MetadataEntry key="HKWasUserEntered" value="1"/>
 </Record>
 <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" startDate="2026-09-02 10:00:00 -0400" endDate="2026-09-02 10:00:00 -0400" value="70"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" startDate="2026-09-02 11:00:00 -0400" endDate="2026-09-02 11:00:00 -0400" value="90"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-09-02 23:00:00 -0400" endDate="2026-09-02 23:00:00 -0400" value="58"/>
 <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-09-02 11:00:00 -0400" endDate="2026-09-02 11:10:00 -0400" value="500"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30.5" durationUnit="min" totalDistance="3.1" totalDistanceUnit="mi" sourceName="Apple Watch" startDate="2026-09-03 06:00:00 -0400" endDate="2026-09-03 06:30:30 -0400">
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="2026-09-03 06:00:00 -0400" endDate="2026-09-03 06:30:30 -0400" average="152" minimum="120" maximum="171" unit="count/min"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeIndoorCycling" duration="20" durationUnit="min" sourceName="Apple Watch" startDate="2026-09-04 18:00:00 -0400" endDate="2026-09-04 18:20:00 -0400">
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceCycling" sum="8.2" unit="km"/>
  <WorkoutEvent type="HKWorkoutEventTypePause" date="2026-09-04 18:05:00 -0400"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="55" durationUnit="min" sourceName="Apple Watch" startDate="2026-09-05 17:00:00 -0400" endDate="2026-09-05 17:55:00 -0400"/>
</HealthData>`;

function runScanner(text, chunkSize) {
  const mapper = createHealthMapper('p1');
  const scanner = createHealthScanner({ onRecord: mapper.onRecord, onWorkout: mapper.onWorkout });
  for (let i = 0; i < text.length; i += chunkSize) scanner.push(text.slice(i, i + chunkSize));
  const totals = scanner.end();
  return { totals, result: mapper.finish() };
}

describe('health parser', () => {
  it('parses HK dates with offsets', () => {
    const d = parseHKDate('2026-09-01 07:00:00 -0400');
    expect(d.date).toBe('2026-09-01');
    expect(new Date(d.ms).toISOString()).toBe('2026-09-01T11:00:00.000Z');
  });
  it('parses attributes and entities', () => {
    expect(parseAttrs('a="1" b="x &amp; y"')).toEqual({ a: '1', b: 'x & y' });
    expect(unescapeXml('&lt;&#65;&#x42;&gt;')).toBe('<AB>');
  });
  it('converts units', () => {
    expect(toLb(90.7, 'kg')).toBeCloseTo(199.96, 1);
    expect(toMi(8.2, 'km')).toBeCloseTo(5.095, 2);
  });
  for (const size of [7, 64, 1000, 100000]) {
    it(`gives identical results with ${size}-char chunks`, () => {
      const { totals, result } = runScanner(SAMPLE, size);
      expect(totals).toEqual({ records: 6, workouts: 3 });
      expect(result.counts.bodyMass).toBe(2);
      expect(result.bodyweight.map((b) => b.weightLb)).toEqual([201.4, 200]);
      expect(result.bodyweight[0].externalId).toBe('ah:bm:2026-09-01 07:00:00 -0400:201.4');
      expect(result.hrDaily).toEqual([{ id: 'p1:2026-09-02', profileId: 'p1', date: '2026-09-02', avg: 80, min: 70, max: 90, samples: 2, resting: 58, source: 'apple_health' }]);
      expect(result.cardio).toHaveLength(2);
      const run = result.cardio[0];
      expect(run.type).toBe('run');
      expect(run.durationSec).toBe(1830);
      expect(run.distanceMi).toBe(3.1);
      expect(run.avgHr).toBe(152);
      expect(run.date).toBe('2026-09-03');
      const bike = result.cardio[1];
      expect(bike.type).toBe('other');
      expect(bike.notes).toBe('Indoor Cycling');
      expect(bike.distanceMi).toBeCloseTo(5.1, 1);
      expect(result.workouts).toHaveLength(1);
      expect(result.workouts[0].label).toBe('Strength training (Apple Health)');
      expect(result.workouts[0].durationSec).toBe(3300);
    });
  }
});
