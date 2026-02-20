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

// --- Transition presets ---

export const transitions = {
  /** Fade in + scale up from 0.97 */
  enter: {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
    transition: springs.smooth,
  },
  /** Fade out + scale down to 0.95 */
  exit: {
    exit: { opacity: 0, scale: 0.95 },
    transition: springs.smooth,
  },
  /** Combined enter + exit for AnimatePresence */
  fadeScale: {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: springs.smooth,
  },
  /** Simple fade */
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },
} as const

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

// --- Landing page variants ---

/** Hero stagger — sequential fade-up on page load */
export const heroStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
}

export const heroStaggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: springs.smooth },
}

/** Section-level scroll-triggered stagger */
export const sectionStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

export const sectionStaggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: springs.smooth },
}

/** Step connector line — scaleX draw from left */
export const lineDrawVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.6, ease: "easeOut" } },
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
