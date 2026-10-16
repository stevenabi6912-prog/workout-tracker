import { describe, it, expect } from 'vitest';
import { planWeek, rotationPointer, nextRotationDay } from '../src/domain/schedule.js';

const routine = {
  id: 'r1',
  days: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
  rotation: ['A', 'B'],
};
// 2026-10-12 is a Monday
const monday = '2026-10-12';

describe('planWeek', () => {
  it('assigns A/B/A on Mon/Tue/Thu from a fresh start', () => {
    const plan = planWeek({ anchor: monday, routine, trainingDays: [1, 2, 4], today: monday });
    expect(plan.map((p) => p.kind)).toEqual(['planned', 'planned', 'rest', 'planned', 'rest', 'rest', 'rest']);
    expect(plan.filter((p) => p.routineDay).map((p) => p.routineDay.id)).toEqual(['A', 'B', 'A']);
  });
  it('continues the rotation across weeks', () => {
    const plan = planWeek({ anchor: '2026-10-19', routine, trainingDays: [1, 2, 4], rotationPointer: 3, today: '2026-10-19' });
    expect(plan.filter((p) => p.routineDay).map((p) => p.routineDay.id)).toEqual(['B', 'A', 'B']);
  });
  it('shows done workouts and does not consume rotation for them twice', () => {
    const workouts = [{ id: 'w1', date: monday, status: 'done', routineId: 'r1', routineDayId: 'A' }];
    const plan = planWeek({ anchor: monday, routine, trainingDays: [1, 2, 4], workouts, rotationPointer: rotationPointer(routine, workouts), today: '2026-10-13' });
    expect(plan[0].kind).toBe('done');
    expect(plan[1].routineDay.id).toBe('B');
    expect(plan[3].routineDay.id).toBe('A');
  });
  it('respects overrides: moved workout and explicit rest', () => {
    const plans = [{ date: monday, routineDayId: null }, { date: '2026-10-14', routineDayId: 'A' }];
    const plan = planWeek({ anchor: monday, routine, trainingDays: [1, 2, 4], plans, today: monday });
    expect(plan[0].kind).toBe('rest');
    expect(plan[2].kind).toBe('planned');
    expect(plan[2].routineDay.id).toBe('A');
    expect(plan[1].routineDay.id).toBe('B');
    expect(plan[3].routineDay.id).toBe('A');
  });
  it('marks past unplanned training days as missed without consuming rotation', () => {
    const plan = planWeek({ anchor: monday, routine, trainingDays: [1, 2, 4], today: '2026-10-15' });
    expect(plan[0].kind).toBe('missed');
    expect(plan[1].kind).toBe('missed');
    expect(plan[3].routineDay.id).toBe('A');
  });
  it('nextRotationDay follows completed count', () => {
    expect(nextRotationDay(routine, []).id).toBe('A');
    expect(nextRotationDay(routine, [{ status: 'done', routineId: 'r1', routineDayId: 'A' }]).id).toBe('B');
  });
});
