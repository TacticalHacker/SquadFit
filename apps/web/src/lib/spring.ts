/**
 * Tiny interruptible spring for gesture-driven UI (bottom sheet). Parameters follow Apple's designer-facing
 * model: `damping` ratio (1 = no overshoot) and `response` in seconds (lower = snappier).
 */

export interface SpringParams {
  damping: number;
  response: number;
}

export interface SpringState {
  value: number;
  velocity: number; // units per second
}

/** Advance one step (semi-implicit Euler, unit mass). */
export function stepSpring(s: SpringState, target: number, p: SpringParams, dt: number): SpringState {
  const stiffness = (2 * Math.PI / p.response) ** 2;
  const friction = (4 * Math.PI * p.damping) / p.response;
  const accel = -stiffness * (s.value - target) - friction * s.velocity;
  const velocity = s.velocity + accel * dt;
  return { value: s.value + velocity * dt, velocity };
}

/** Where a flick would come to rest, like scroll deceleration (Apple's projection). Velocity in px/s. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further you pull, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Animate from the current value (and velocity) to `to` on the display clock. Returns a stop function that
 * reports the live state, so a new gesture can pick the motion up exactly where it is.
 */
export function animateSpring(opts: {
  from: SpringState;
  to: number;
  params?: SpringParams;
  onUpdate: (value: number) => void;
  onRest?: () => void;
}): () => SpringState {
  const params = opts.params ?? { damping: 1, response: 0.35 };
  let state = opts.from;
  let last = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    let dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      state = stepSpring(state, opts.to, params, h);
      dt -= h;
    }
    if (Math.abs(state.velocity) < 5 && Math.abs(state.value - opts.to) < 0.5) {
      state = { value: opts.to, velocity: 0 };
      opts.onUpdate(opts.to);
      opts.onRest?.();
      return;
    }
    opts.onUpdate(state.value);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    return state;
  };
}
