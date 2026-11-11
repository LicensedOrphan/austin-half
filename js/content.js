// Exercise, stretch and coaching copy. Images live in img/ex/<id>.webp (one per position).

export const WHY = {
  easy: 'Builds the aerobic base and lets your legs adapt. Most of your miles are these.',
  quality: 'The one harder session of the week. Teaches your body to hold a faster effort.',
  long: 'The run that gets you to 13.1. Go slower than you think; time on feet is the point.',
  strength: 'Stronger hips, calves and core keep your form together late in a long run and protect your shins.',
  mobility: 'Optional. Loosens up after Sunday’s long run.',
  rest: 'Rest is where the fitness actually lands. Walk if you like.',
  race: 'Race day. Hold back on the long South Congress climb in the first 2.5 miles, save some legs for the Enfield hills at miles 10 to 12, then finish strong on Congress.',
  timeTrial: 'Your 5K today sets every training pace from here to February.',
};

export const EXERCISES = {
  // ---- Strength --------------------------------------------------------
  goblet_squat: {
    name: 'Goblet squat', reps: 10, images: ['goblet_squat_1', 'goblet_squat_2'],
    cues: ['Hold a dumbbell (or the ruck) at your chest, feet a bit wider than hips.', 'Sit down and back between your heels; chest stays tall.', 'Knees track over your toes. Go as low as you can keep heels down.', 'Drive up through the whole foot.'],
  },
  reverse_lunge: {
    name: 'Reverse lunge', reps: 8, perSide: true, images: ['reverse_lunge_1', 'reverse_lunge_2'],
    cues: ['Stand tall, step one foot back about two feet.', 'Lower until the back knee nearly touches the floor.', 'Front knee stays over the ankle; torso upright.', 'Push through the front heel to stand back up.'],
  },
  sl_rdl: {
    name: 'Single-leg Romanian deadlift', reps: 8, perSide: true, images: ['sl_rdl_1', 'sl_rdl_2'],
    cues: ['Stand on one leg with a soft knee.', 'Hinge at the hip; the free leg swings back in line with your body.', 'Keep hips square to the floor; don’t let the free hip open up.', 'Stop when you feel the hamstring, then squeeze the glute to stand.'],
  },
  step_up: {
    name: 'Step-up (knee height)', reps: 8, perSide: true, images: ['step_up_1', 'step_up_2'],
    cues: ['Put one whole foot on a knee-height box or bench.', 'Lean slightly forward and drive through that heel to stand on top.', 'Don’t push off the bottom foot; make the top leg do the work.', 'Lower slowly under control.'],
  },
  calf_raise: {
    name: 'Calf raise, slow lowering', reps: 15, images: ['calf_raise_1', 'calf_raise_2'],
    cues: ['Balls of your feet on a step edge, hand on a wall.', 'Rise up high onto your toes in one second.', 'Lower for three slow seconds until heels dip below the step.', 'Knees straight but not locked.'],
  },
  glute_bridge: {
    name: 'Glute bridge', reps: 12, images: ['glute_bridge_1', 'glute_bridge_2'],
    cues: ['Lie on your back, knees bent, feet flat and hip-width.', 'Squeeze your glutes and lift your hips until knees, hips and shoulders line up.', 'Pause one second at the top; don’t arch your lower back.', 'Lower slowly.'],
  },
  plank: {
    name: 'Plank', hold: [30, 45], images: ['plank'],
    cues: ['Forearms on the floor, elbows under shoulders.', 'Body in one straight line from head to heels.', 'Squeeze glutes and brace like you’re about to be poked in the stomach.', 'Breathe. Hips don’t sag or pike.'],
  },
  side_plank: {
    name: 'Side plank', hold: [30, 30], perSide: true, sets: 2, images: ['side_plank'],
    cues: ['Lie on your side, elbow under shoulder, feet stacked.', 'Lift your hips so your body is a straight line.', 'Top hand on hip or reaching up.', 'Knees down is fine if you can’t hold the full position.'],
  },

  // ---- Stretches and warm-up ------------------------------------------
  leg_swings: {
    name: 'Leg swings', reps: 10, perSide: true, images: ['leg_swings_1', 'leg_swings_2'],
    cues: ['Hand on a wall or post. Swing one leg forward and back, relaxed.', 'Gradually go higher; no forcing.', 'Then face the wall and swing side to side across your body.', 'Ten each direction, each leg.'],
  },
  calf_stretch: {
    name: 'Calf stretch', hold: [30, 30], perSide: true, images: ['calf_stretch'],
    cues: ['Hands on a wall, one foot back with the heel down.', 'Back leg straight, toes pointing forward.', 'Lean into the wall until you feel the calf.', 'Hold steady; no bouncing.'],
  },
  hip_flexor_stretch: {
    name: 'Kneeling hip-flexor stretch', hold: [30, 30], perSide: true, images: ['hip_flexor_stretch'],
    cues: ['Kneel on one knee, other foot flat in front.', 'Tuck your tailbone under and squeeze the back glute.', 'Shift your hips forward until you feel the front of the back hip.', 'Stay tall; don’t arch your back.'],
  },
  hamstring_stretch: {
    name: 'Standing hamstring stretch', hold: [30, 30], perSide: true, images: ['hamstring_stretch'],
    cues: ['Put one heel on a low step or curb, leg straight, toes up.', 'Keep your back flat and hinge forward from the hips.', 'Stop at a gentle pull behind the thigh.', 'Breathe and relax into it.'],
  },
  pigeon: {
    name: 'Pigeon pose or figure-4', hold: [45, 45], perSide: true, images: ['pigeon'],
    cues: ['Pigeon: front shin across your body, back leg straight behind you.', 'Or figure-4: lie on your back, ankle across the opposite knee, pull that thigh in.', 'Keep hips level and breathe into the outer hip.', 'Ease off if you feel anything in the knee.'],
  },
};

// Sets per strength level: weeks 1–2 intro, 3–13 full, 14–16 light.
const STRENGTH_ORDER = ['goblet_squat', 'reverse_lunge', 'sl_rdl', 'step_up', 'calf_raise', 'glute_bridge', 'plank', 'side_plank'];

export function strengthRoutine(level) {
  const sets = level === 'full' ? 3 : 2;
  const load = level === 'full' ? 'Add dumbbells or the ruck as load.' : 'Bodyweight only.';
  return {
    title: level === 'light' ? 'Strength, light' : 'Strength',
    intro: `${STRENGTH_ORDER.length} exercises, ${sets} sets each. ${load} About 30 minutes.`,
    rest: 45,
    items: STRENGTH_ORDER.map((id) => ({ id, sets: EXERCISES[id].sets ? Math.min(EXERCISES[id].sets, sets) : sets })),
  };
}

export const STRETCH_ROUTINE = {
  title: 'Post-run stretches',
  intro: 'Four stretches, both sides. About 5 minutes.',
  rest: 5,
  items: ['calf_stretch', 'hip_flexor_stretch', 'hamstring_stretch', 'pigeon'].map((id) => ({ id, sets: 1 })),
};

export const WARMUP_ROUTINE = {
  title: 'Pre-run leg swings',
  intro: 'Ten swings each direction, each leg. One minute.',
  rest: 0,
  items: [{ id: 'leg_swings', sets: 1 }],
};

export const MOBILITY_ROUTINE = {
  title: '15 min mobility',
  intro: 'Leg swings, then the four stretches twice through. Gentle; this is recovery.',
  rest: 10,
  items: [{ id: 'leg_swings', sets: 2 }, ...['calf_stretch', 'hip_flexor_stretch', 'hamstring_stretch', 'pigeon'].map((id) => ({ id, sets: 2 })), { id: 'glute_bridge', sets: 1 }],
};

export const LEG_FEEL = [
  { id: 'fresh', label: 'Fresh' },
  { id: 'ok', label: 'Normal' },
  { id: 'heavy', label: 'Heavy' },
  { id: 'sore', label: 'Sore' },
  { id: 'pain', label: 'Sharp pain' },
];
