// Built-in exercise library.
// pattern = movement pattern, used to suggest similar exercises to swap in on a plateau.

export const MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads',
  'Hamstrings', 'Glutes', 'Calves', 'Core', 'Forearms',
];

export const EQUIPMENT = [
  'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith Machine',
  'EZ Bar', 'Kettlebell', 'Bands', 'Bodyweight',
];

export const PATTERNS = {
  'h-push': 'Horizontal press',
  'incline-push': 'Incline press',
  'v-push': 'Overhead press',
  'fly': 'Chest fly',
  'dip': 'Dip',
  'h-pull': 'Row',
  'v-pull': 'Pull-up / pulldown',
  'pullover': 'Pullover',
  'shrug': 'Shrug',
  'lat-raise': 'Lateral raise',
  'front-raise': 'Front raise',
  'rear-delt': 'Rear delt',
  'curl': 'Curl',
  'tri-ext': 'Triceps extension',
  'tri-press': 'Close-grip press',
  'squat': 'Squat / leg press',
  'lunge': 'Lunge / split squat',
  'leg-ext': 'Leg extension',
  'hinge': 'Hip hinge',
  'leg-curl': 'Leg curl',
  'hip-thrust': 'Hip thrust / bridge',
  'abduct': 'Hip abduction',
  'calf': 'Calf raise',
  'core-flex': 'Crunch / leg raise',
  'core-stab': 'Core stability',
  'rotation': 'Rotation',
  'forearm': 'Wrist / forearm',
  'grip': 'Grip / carry',
};

// Patterns that get a +10 lb bump instead of +5.
export const LOWER_PATTERNS = new Set(['squat', 'lunge', 'hinge', 'leg-curl', 'leg-ext', 'hip-thrust', 'abduct', 'calf']);

// [name, muscle, equipment, pattern, unit?]
const RAW = [
  // Chest
  ['Barbell Bench Press', 'Chest', 'Barbell', 'h-push'],
  ['Incline Barbell Bench Press', 'Chest', 'Barbell', 'incline-push'],
  ['Decline Barbell Bench Press', 'Chest', 'Barbell', 'h-push'],
  ['Dumbbell Bench Press', 'Chest', 'Dumbbell', 'h-push'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbell', 'incline-push'],
  ['Dumbbell Fly', 'Chest', 'Dumbbell', 'fly'],
  ['Incline Dumbbell Fly', 'Chest', 'Dumbbell', 'fly'],
  ['Cable Crossover', 'Chest', 'Cable', 'fly'],
  ['Low-to-High Cable Fly', 'Chest', 'Cable', 'fly'],
  ['Machine Chest Press', 'Chest', 'Machine', 'h-push'],
  ['Incline Machine Press', 'Chest', 'Machine', 'incline-push'],
  ['Pec Deck', 'Chest', 'Machine', 'fly'],
  ['Smith Machine Bench Press', 'Chest', 'Smith Machine', 'h-push'],
  ['Smith Machine Incline Press', 'Chest', 'Smith Machine', 'incline-push'],
  ['Push-Up', 'Chest', 'Bodyweight', 'h-push'],
  ['Chest Dip', 'Chest', 'Bodyweight', 'dip'],
  ['Band Chest Press', 'Chest', 'Bands', 'h-push'],

  // Back
  ['Deadlift', 'Back', 'Barbell', 'hinge'],
  ['Barbell Row', 'Back', 'Barbell', 'h-pull'],
  ['Pendlay Row', 'Back', 'Barbell', 'h-pull'],
  ['T-Bar Row', 'Back', 'Barbell', 'h-pull'],
  ['Dumbbell Row', 'Back', 'Dumbbell', 'h-pull'],
  ['Chest-Supported Dumbbell Row', 'Back', 'Dumbbell', 'h-pull'],
  ['Seated Cable Row', 'Back', 'Cable', 'h-pull'],
  ['Lat Pulldown', 'Back', 'Cable', 'v-pull'],
  ['Close-Grip Lat Pulldown', 'Back', 'Cable', 'v-pull'],
  ['Single-Arm Cable Pulldown', 'Back', 'Cable', 'v-pull'],
  ['Straight-Arm Pulldown', 'Back', 'Cable', 'pullover'],
  ['Machine Row', 'Back', 'Machine', 'h-pull'],
  ['Assisted Pull-Up', 'Back', 'Machine', 'v-pull'],
  ['Pull-Up', 'Back', 'Bodyweight', 'v-pull'],
  ['Chin-Up', 'Back', 'Bodyweight', 'v-pull'],
  ['Inverted Row', 'Back', 'Bodyweight', 'h-pull'],
  ['Dumbbell Pullover', 'Back', 'Dumbbell', 'pullover'],
  ['Back Extension', 'Back', 'Bodyweight', 'hinge'],
  ['Barbell Shrug', 'Back', 'Barbell', 'shrug'],
  ['Dumbbell Shrug', 'Back', 'Dumbbell', 'shrug'],
  ['Kettlebell Row', 'Back', 'Kettlebell', 'h-pull'],
  ['Band Row', 'Back', 'Bands', 'h-pull'],

  // Shoulders
  ['Overhead Press', 'Shoulders', 'Barbell', 'v-push'],
  ['Seated Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'v-push'],
  ['Arnold Press', 'Shoulders', 'Dumbbell', 'v-push'],
  ['Machine Shoulder Press', 'Shoulders', 'Machine', 'v-push'],
  ['Smith Machine Shoulder Press', 'Shoulders', 'Smith Machine', 'v-push'],
  ['Kettlebell Overhead Press', 'Shoulders', 'Kettlebell', 'v-push'],
  ['Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell', 'lat-raise'],
  ['Cable Lateral Raise', 'Shoulders', 'Cable', 'lat-raise'],
  ['Machine Lateral Raise', 'Shoulders', 'Machine', 'lat-raise'],
  ['Upright Row', 'Shoulders', 'Barbell', 'lat-raise'],
  ['Dumbbell Front Raise', 'Shoulders', 'Dumbbell', 'front-raise'],
  ['Cable Front Raise', 'Shoulders', 'Cable', 'front-raise'],
  ['Rear Delt Fly', 'Shoulders', 'Dumbbell', 'rear-delt'],
  ['Reverse Pec Deck', 'Shoulders', 'Machine', 'rear-delt'],
  ['Face Pull', 'Shoulders', 'Cable', 'rear-delt'],
  ['Band Pull-Apart', 'Shoulders', 'Bands', 'rear-delt'],
  ['Pike Push-Up', 'Shoulders', 'Bodyweight', 'v-push'],

  // Biceps
  ['Barbell Curl', 'Biceps', 'Barbell', 'curl'],
  ['EZ-Bar Curl', 'Biceps', 'EZ Bar', 'curl'],
  ['Dumbbell Curl', 'Biceps', 'Dumbbell', 'curl'],
  ['Hammer Curl', 'Biceps', 'Dumbbell', 'curl'],
  ['Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 'curl'],
  ['Concentration Curl', 'Biceps', 'Dumbbell', 'curl'],
  ['Preacher Curl', 'Biceps', 'EZ Bar', 'curl'],
  ['Machine Preacher Curl', 'Biceps', 'Machine', 'curl'],
  ['Cable Curl', 'Biceps', 'Cable', 'curl'],
  ['Rope Hammer Curl', 'Biceps', 'Cable', 'curl'],
  ['Band Curl', 'Biceps', 'Bands', 'curl'],

  // Triceps
  ['Close-Grip Bench Press', 'Triceps', 'Barbell', 'tri-press'],
  ['Skull Crusher', 'Triceps', 'EZ Bar', 'tri-ext'],
  ['Overhead Dumbbell Triceps Extension', 'Triceps', 'Dumbbell', 'tri-ext'],
  ['Dumbbell Triceps Kickback', 'Triceps', 'Dumbbell', 'tri-ext'],
  ['Cable Triceps Pushdown', 'Triceps', 'Cable', 'tri-ext'],
  ['Rope Pushdown', 'Triceps', 'Cable', 'tri-ext'],
  ['Overhead Cable Triceps Extension', 'Triceps', 'Cable', 'tri-ext'],
  ['Machine Triceps Extension', 'Triceps', 'Machine', 'tri-ext'],
  ['Triceps Dip', 'Triceps', 'Bodyweight', 'dip'],
  ['Bench Dip', 'Triceps', 'Bodyweight', 'dip'],
  ['Diamond Push-Up', 'Triceps', 'Bodyweight', 'tri-press'],
  ['Band Triceps Pushdown', 'Triceps', 'Bands', 'tri-ext'],

  // Quads
  ['Back Squat', 'Quads', 'Barbell', 'squat'],
  ['Front Squat', 'Quads', 'Barbell', 'squat'],
  ['Goblet Squat', 'Quads', 'Dumbbell', 'squat'],
  ['Kettlebell Goblet Squat', 'Quads', 'Kettlebell', 'squat'],
  ['Leg Press', 'Quads', 'Machine', 'squat'],
  ['Hack Squat', 'Quads', 'Machine', 'squat'],
  ['Smith Machine Squat', 'Quads', 'Smith Machine', 'squat'],
  ['Bulgarian Split Squat', 'Quads', 'Dumbbell', 'lunge'],
  ['Dumbbell Lunge', 'Quads', 'Dumbbell', 'lunge'],
  ['Walking Lunge', 'Quads', 'Dumbbell', 'lunge'],
  ['Barbell Lunge', 'Quads', 'Barbell', 'lunge'],
  ['Step-Up', 'Quads', 'Dumbbell', 'lunge'],
  ['Leg Extension', 'Quads', 'Machine', 'leg-ext'],
  ['Bodyweight Squat', 'Quads', 'Bodyweight', 'squat'],

  // Hamstrings
  ['Romanian Deadlift', 'Hamstrings', 'Barbell', 'hinge'],
  ['Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell', 'hinge'],
  ['Stiff-Leg Deadlift', 'Hamstrings', 'Barbell', 'hinge'],
  ['Good Morning', 'Hamstrings', 'Barbell', 'hinge'],
  ['Lying Leg Curl', 'Hamstrings', 'Machine', 'leg-curl'],
  ['Seated Leg Curl', 'Hamstrings', 'Machine', 'leg-curl'],
  ['Nordic Curl', 'Hamstrings', 'Bodyweight', 'leg-curl'],
  ['Kettlebell Swing', 'Hamstrings', 'Kettlebell', 'hinge'],

  // Glutes
  ['Barbell Hip Thrust', 'Glutes', 'Barbell', 'hip-thrust'],
  ['Machine Hip Thrust', 'Glutes', 'Machine', 'hip-thrust'],
  ['Smith Machine Hip Thrust', 'Glutes', 'Smith Machine', 'hip-thrust'],
  ['Glute Bridge', 'Glutes', 'Bodyweight', 'hip-thrust'],
  ['Sumo Deadlift', 'Glutes', 'Barbell', 'hinge'],
  ['Trap Bar Deadlift', 'Glutes', 'Barbell', 'hinge'],
  ['Cable Pull-Through', 'Glutes', 'Cable', 'hinge'],
  ['Cable Glute Kickback', 'Glutes', 'Cable', 'hip-thrust'],
  ['Hip Abduction Machine', 'Glutes', 'Machine', 'abduct'],
  ['Banded Lateral Walk', 'Glutes', 'Bands', 'abduct'],

  // Calves
  ['Standing Calf Raise', 'Calves', 'Machine', 'calf'],
  ['Seated Calf Raise', 'Calves', 'Machine', 'calf'],
  ['Leg Press Calf Raise', 'Calves', 'Machine', 'calf'],
  ['Smith Machine Calf Raise', 'Calves', 'Smith Machine', 'calf'],
  ['Dumbbell Calf Raise', 'Calves', 'Dumbbell', 'calf'],

  // Core
  ['Plank', 'Core', 'Bodyweight', 'core-stab', 'sec'],
  ['Side Plank', 'Core', 'Bodyweight', 'core-stab', 'sec'],
  ['Dead Bug', 'Core', 'Bodyweight', 'core-stab'],
  ['Ab Wheel Rollout', 'Core', 'Bodyweight', 'core-stab'],
  ['Hanging Leg Raise', 'Core', 'Bodyweight', 'core-flex'],
  ['Hanging Knee Raise', 'Core', 'Bodyweight', 'core-flex'],
  ['Crunch', 'Core', 'Bodyweight', 'core-flex'],
  ['Decline Sit-Up', 'Core', 'Bodyweight', 'core-flex'],
  ['Cable Crunch', 'Core', 'Cable', 'core-flex'],
  ['Machine Crunch', 'Core', 'Machine', 'core-flex'],
  ['Russian Twist', 'Core', 'Bodyweight', 'rotation'],
  ['Cable Woodchop', 'Core', 'Cable', 'rotation'],
  ['Pallof Press', 'Core', 'Cable', 'core-stab'],

  // Forearms
  ['Wrist Curl', 'Forearms', 'Dumbbell', 'forearm'],
  ['Reverse Wrist Curl', 'Forearms', 'Dumbbell', 'forearm'],
  ['Reverse Curl', 'Forearms', 'EZ Bar', 'forearm'],
  ["Farmer's Carry", 'Forearms', 'Dumbbell', 'grip', 'sec'],
  ['Dead Hang', 'Forearms', 'Bodyweight', 'grip', 'sec'],
];

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const BUILTIN = RAW.map(([name, muscle, equipment, pattern, unit]) => ({
  id: slug(name),
  name,
  muscle,
  equipment,
  pattern,
  unit: unit || 'reps',
}));
