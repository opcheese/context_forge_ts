/**
 * Motion presets — shared with the SPA via copy.
 * Keep in sync with ../../src/lib/motion.ts
 */

import type { Transition, Variants } from "framer-motion"

export const springs = {
  snappy: { type: "spring" as const, stiffness: 500, damping: 30 },
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  gentle: { type: "spring" as const, stiffness: 200, damping: 25 },
} satisfies Record<string, Transition>

export const heroStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
}

export const heroStaggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: springs.smooth },
}

export const sectionStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

export const sectionStaggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: springs.smooth },
}

export const lineDrawVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.6, ease: "easeOut" } },
}
