"use client";

import { MotionConfig } from "framer-motion";

/**
 * App-wide reduced-motion handling for Framer Motion. The global CSS only
 * neutralizes CSS animations/transitions; Framer drives its animations in JS,
 * so it needs its own signal. `reducedMotion="user"` disables transform and
 * layout animations when the OS requests reduced motion while keeping opacity
 * crossfades, so nothing appears without an entrance.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
