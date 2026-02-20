/**
 * Motion Design System — spring presets and transition configs.
 *
 * Use these throughout the app for consistent, polished animations.
 */

import type { Transition, Variants } from "framer-motion"

// --- Spring presets ---

export const springs = {
  /** Instant-feel: buttons, toggles, hover */
  snappy: { type: "spring" as const, stiffness: 500, damping: 30 },
  /** Default: modals, panels, block enter/exit */
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  /** Ambient: progress bars, token meters */
  gentle: { type: "spring" as const, stiffness: 200, damping: 25 },
} satisfies Record<string, Transition>

// --- Variant presets for lists ---

export const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.03,
    },
  },
}

export const listItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springs.smooth,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
}

// --- Scale feedback presets ---

export const scaleFeedback = {
  /** Subtle press for buttons */
  button: {
    whileTap: { scale: 0.98 },
    whileHover: { scale: 1.02 },
    transition: springs.snappy,
  },
  /** Slightly more pronounced for icon buttons */
  icon: {
    whileTap: { scale: 0.92 },
    whileHover: { scale: 1.08 },
    transition: springs.snappy,
  },
} as const

// --- Dialog/modal presets ---

export const dialogOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
} as const

export const dialogContent = {
  initial: { opacity: 0, scale: 0.97, y: -8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -8 },
  transition: springs.smooth,
} as const
