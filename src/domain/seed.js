// Starter exercise library and routines. Seeded per profile; everything is editable afterwards.

// [name, equipment, region, muscles, substitutions(by name)]
export const EXERCISE_CATALOG = [
  // Lower, barbell
  ['Back Squat', 'barbell', 'lower', ['quads', 'glutes'], ['Leg Press', 'Hack Squat', 'Goblet Squat']],
  ['Front Squat', 'barbell', 'lower', ['quads'], ['Back Squat', 'Hack Squat']],
  ['Deadlift', 'barbell', 'lower', ['hamstrings', 'glutes', 'back'], ['Romanian Deadlift', 'Trap Bar Deadlift']],
  ['Trap Bar Deadlift', 'barbell', 'lower', ['hamstrings', 'glutes', 'quads'], ['Deadlift']],
  ['Romanian Deadlift', 'barbell', 'lower', ['hamstrings', 'glutes'], ['DB Romanian Deadlift', 'Leg Curl']],
  ['Barbell Hip Thrust', 'barbell', 'lower', ['glutes'], ['Leg Press']],
  // Lower, dumbbell
  ['Goblet Squat', 'dumbbell', 'lower', ['quads', 'glutes'], ['Leg Press']],
  ['DB Romanian Deadlift', 'dumbbell', 'lower', ['hamstrings', 'glutes'], ['Romanian Deadlift', 'Leg Curl']],
  ['DB Walking Lunge', 'dumbbell', 'lower', ['quads', 'glutes'], ['Bulgarian Split Squat', 'Leg Press']],
  ['Bulgarian Split Squat', 'dumbbell', 'lower', ['quads', 'glutes'], ['DB Walking Lunge', 'Leg Press']],
  ['DB Step-Up', 'dumbbell', 'lower', ['quads', 'glutes'], ['DB Walking Lunge']],
  // Lower, machine
  ['Leg Press', 'machine', 'lower', ['quads', 'glutes'], ['Hack Squat', 'Goblet Squat']],
  ['Hack Squat', 'machine', 'lower', ['quads'], ['Leg Press', 'Back Squat']],
  ['Leg Curl', 'machine', 'lower', ['hamstrings'], ['DB Romanian Deadlift']],
  ['Leg Extension', 'machine', 'lower', ['quads'], ['Leg Press']],
  ['Calf Raise', 'machine', 'lower', ['calves'], []],
  ['Hip Abduction', 'machine', 'lower', ['glutes'], []],
  // Upper push
  ['Bench Press', 'barbell', 'upper', ['chest', 'triceps'], ['DB Bench Press', 'Machine Chest Press']],
  ['Incline Bench Press', 'barbell', 'upper', ['chest', 'shoulders'], ['DB Incline Press']],
  ['Overhead Press', 'barbell', 'upper', ['shoulders', 'triceps'], ['DB Shoulder Press', 'Machine Shoulder Press']],
  ['DB Bench Press', 'dumbbell', 'upper', ['chest', 'triceps'], ['Bench Press', 'Machine Chest Press']],
  ['DB Incline Press', 'dumbbell', 'upper', ['chest', 'shoulders'], ['Incline Bench Press', 'Machine Chest Press']],
  ['DB Shoulder Press', 'dumbbell', 'upper', ['shoulders'], ['Overhead Press', 'Machine Shoulder Press']],
  ['DB Lateral Raise', 'dumbbell', 'upper', ['shoulders'], ['Cable Lateral Raise']],
  ['Cable Lateral Raise', 'cable', 'upper', ['shoulders'], ['DB Lateral Raise']],
  ['Machine Chest Press', 'machine', 'upper', ['chest', 'triceps'], ['Bench Press', 'DB Bench Press']],
  ['Machine Shoulder Press', 'machine', 'upper', ['shoulders'], ['DB Shoulder Press']],
  ['Pec Deck', 'machine', 'upper', ['chest'], ['DB Incline Press']],
  ['Cable Triceps Pushdown', 'cable', 'upper', ['triceps'], ['Skull Crushers', 'Dips']],
  ['Skull Crushers', 'barbell', 'upper', ['triceps'], ['Cable Triceps Pushdown']],
  ['Dips', 'bodyweight', 'upper', ['chest', 'triceps'], ['Cable Triceps Pushdown']],
  // Upper pull
  ['Barbell Row', 'barbell', 'upper', ['back', 'biceps'], ['Seated Cable Row', 'Machine Row', 'DB Row']],
  ['Lat Pulldown', 'cable', 'upper', ['back', 'biceps'], ['Pull-Up', 'Chin-Up']],
  ['Seated Cable Row', 'cable', 'upper', ['back', 'biceps'], ['Machine Row', 'DB Row']],
  ['Machine Row', 'machine', 'upper', ['back'], ['Seated Cable Row']],
  ['DB Row', 'dumbbell', 'upper', ['back', 'biceps'], ['Seated Cable Row']],
  ['Pull-Up', 'bodyweight', 'upper', ['back', 'biceps'], ['Lat Pulldown']],
  ['Chin-Up', 'bodyweight', 'upper', ['back', 'biceps'], ['Lat Pulldown']],
  ['Face Pull', 'cable', 'upper', ['rear delts', 'upper back'], ['DB Lateral Raise']],
  ['DB Curl', 'dumbbell', 'upper', ['biceps'], ['Cable Curl', 'Barbell Curl']],
  ['Hammer Curl', 'dumbbell', 'upper', ['biceps', 'forearms'], ['DB Curl']],
  ['Barbell Curl', 'barbell', 'upper', ['biceps'], ['DB Curl']],
  ['Cable Curl', 'cable', 'upper', ['biceps'], ['DB Curl']],
  // Core
  ['Plank', 'bodyweight', 'core', ['core'], ['Ab Wheel']],
  ['Cable Crunch', 'cable', 'core', ['core'], ['Hanging Knee Raise']],
  ['Hanging Knee Raise', 'bodyweight', 'core', ['core'], ['Cable Crunch']],
  ['Ab Wheel', 'bodyweight', 'core', ['core'], ['Plank']],
];

const EXERCISE_NOTES = {
  'Plank': 'Log seconds in the reps field.',
  'Deadlift': 'Reset each rep. Keep the bar close.',
  'Back Squat': 'Warm up with the bar, then 2 ramp-up sets.',
};

// Routine definitions reference exercises by name; resolved to ids at seed time.
// slot: [exerciseName, sets, repMin, repMax, restSec]
export const ROUTINE_TEMPLATES = [
  {
    key: 'fullbody3',
    name: '3-Day Full Body',
    mode: 'standard',
    trainingDays: [1, 2, 4],
    days: [
      {
        key: 'A', label: 'Full Body A',
        slots: [
          ['Back Squat', 3, 5, 8, 150],
          ['Bench Press', 3, 5, 8, 120],
          ['Seated Cable Row', 3, 8, 12, 90],
          ['Leg Curl', 2, 10, 15, 60],
          ['DB Lateral Raise', 2, 12, 15, 60],
          ['Cable Crunch', 2, 10, 15, 60],
        ],
        finisher: { kind: 'intervals', cardioType: 'bike', workSec: 30, restSec: 60, rounds: 8, note: 'Hard effort on work intervals.' },
      },
      {
        key: 'B', label: 'Full Body B',
        slots: [
          ['Deadlift', 3, 4, 6, 180],
          ['Overhead Press', 3, 6, 10, 120],
          ['Lat Pulldown', 3, 8, 12, 90],
          ['Leg Press', 3, 10, 15, 90],
          ['DB Incline Press', 2, 8, 12, 90],
          ['Plank', 2, 30, 60, 60],
        ],
        finisher: { kind: 'steady', cardioType: 'treadmill', durationMin: 12, note: 'Incline walk, 10-12% at 3.0-3.5 mph.' },
      },
    ],
    rotation: ['A', 'B'],
  },
  {
    key: 'upperlower4',
    name: 'Winter Upper / Lower',
    mode: 'winter',
    trainingDays: [1, 2, 4, 5],
    days: [
      {
        key: 'UA', label: 'Upper A',
        slots: [
          ['Bench Press', 3, 5, 8, 120],
          ['Barbell Row', 3, 6, 10, 120],
          ['DB Shoulder Press', 3, 8, 12, 90],
          ['Lat Pulldown', 2, 10, 12, 90],
          ['Cable Triceps Pushdown', 2, 10, 15, 60],
          ['DB Curl', 2, 10, 15, 60],
        ],
        finisher: { kind: 'intervals', cardioType: 'rower', workSec: 60, restSec: 60, rounds: 6 },
      },
      {
        key: 'LA', label: 'Lower A',
        slots: [
          ['Back Squat', 3, 5, 8, 150],
          ['Romanian Deadlift', 3, 6, 10, 120],
          ['Leg Press', 2, 10, 15, 90],
          ['Leg Curl', 2, 10, 15, 60],
          ['Calf Raise', 3, 10, 15, 60],
          ['Cable Crunch', 2, 10, 15, 60],
        ],
        finisher: { kind: 'steady', cardioType: 'treadmill', durationMin: 10, note: 'Incline walk.' },
      },
      {
        key: 'UB', label: 'Upper B',
        slots: [
          ['Overhead Press', 3, 6, 10, 120],
          ['Chin-Up', 3, 6, 10, 120],
          ['DB Incline Press', 3, 8, 12, 90],
          ['Seated Cable Row', 3, 8, 12, 90],
          ['DB Lateral Raise', 2, 12, 15, 60],
          ['Hammer Curl', 2, 10, 15, 60],
        ],
        finisher: { kind: 'intervals', cardioType: 'bike', workSec: 30, restSec: 60, rounds: 8 },
      },
      {
        key: 'LB', label: 'Lower B',
        slots: [
          ['Deadlift', 3, 4, 6, 180],
          ['Hack Squat', 3, 8, 12, 120],
          ['DB Walking Lunge', 2, 10, 12, 90],
          ['Leg Extension', 2, 12, 15, 60],
          ['Calf Raise', 3, 10, 15, 60],
          ['Hanging Knee Raise', 2, 10, 15, 60],
        ],
        finisher: { kind: 'steady', cardioType: 'elliptical', durationMin: 10 },
      },
      {
        key: 'C', label: 'Conditioning',
        slots: [],
        finisher: { kind: 'intervals', cardioType: 'rower', workSec: 60, restSec: 60, rounds: 10, note: 'Optional 5th day. Or 30-40 min steady on any machine.' },
        optional: true,
      },
    ],
    rotation: ['UA', 'LA', 'UB', 'LB'],
  },
];

export const DEFAULT_SETTINGS = {
  trainingDays: [1, 2, 4],
  mode: 'standard',
  activeRoutineId: null,
  restSec: 90,
  autoStartRest: true,
  increments: { lower: 5, upper: 2.5 },
  theme: 'system',
};

export const DEFAULT_PROFILES = [
  { name: 'Steven', startWeightLb: 200, goalWeightLb: 180 },
  { name: 'Abi', startWeightLb: null, goalWeightLb: null },
];

export function buildExercises(profileId, uid) {
  const byName = new Map();
  const list = EXERCISE_CATALOG.map(([name, equipment, region, muscles]) => {
    const ex = { id: uid(), profileId, name, equipment, region, muscles, notes: EXERCISE_NOTES[name] || '', substitutions: [], builtIn: true };
    byName.set(name, ex);
    return ex;
  });
  for (const [name, , , , subs] of EXERCISE_CATALOG) {
    byName.get(name).substitutions = subs.map((s) => byName.get(s)?.id).filter(Boolean);
  }
  return list;
}

export function buildRoutines(profileId, exercises, uid) {
  const idByName = new Map(exercises.map((e) => [e.name, e.id]));
  return ROUTINE_TEMPLATES.map((t) => {
    const days = t.days.map((d) => ({
      id: uid(),
      key: d.key,
      label: d.label,
      optional: !!d.optional,
      slots: d.slots.map(([name, sets, repMin, repMax, restSec]) => ({
        id: uid(), exerciseId: idByName.get(name), sets, repMin, repMax, restSec,
      })),
      finisher: d.finisher ? { ...d.finisher } : null,
    }));
    const keyToId = new Map(days.map((d) => [d.key, d.id]));
    return {
      id: uid(),
      profileId,
      name: t.name,
      mode: t.mode,
      trainingDays: t.trainingDays,
      days,
      rotation: t.rotation.map((k) => keyToId.get(k)),
      builtIn: true,
    };
  });
}
