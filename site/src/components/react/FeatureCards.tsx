/**
 * Feature cards with scroll-triggered stagger animation.
 */

import { motion } from "framer-motion"
import { sectionStagger, sectionStaggerItem } from "../../lib/motion"

const features = [
  {
    title: "Context Zones",
    description:
      "Organize blocks into Permanent, Stable, and Working zones with token budgets. Drag-and-drop to rearrange. Compress when things get long.",
    accent: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/5 dark:bg-blue-400/5",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
        <path d="m6.08 9.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59" />
        <path d="m6.08 14.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59" />
      </svg>
    ),
  },
  {
    title: "Templates",
    description:
      "Save session configurations as reusable templates. Apply them instantly to new sessions. Build a library of starting points for any task.",
    accent: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/5 dark:bg-emerald-400/5",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="7" x="3" y="3" rx="1" />
        <rect width="9" height="7" x="3" y="14" rx="1" />
        <rect width="5" height="7" x="16" y="14" rx="1" />
      </svg>
    ),
  },
  {
    title: "Workflows",
    description:
      "Define multi-step pipelines that carry context forward. Track progress through stages. Go from brainstorm to polished output systematically.",
    accent: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/5 dark:bg-amber-400/5",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" x2="6" y1="3" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
  },
]

export function FeatureCards() {
  return (
    <motion.div
      className="grid md:grid-cols-3 gap-6"
      variants={sectionStagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {features.map((feature) => (
        <motion.div
          key={feature.title}
          variants={sectionStaggerItem}
          className="group rounded-2xl border border-border bg-card/50 p-7 sm:p-8 hover:border-border/80 hover:bg-card transition-all duration-300"
        >
          <div className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}>
            <span className={feature.accent}>{feature.icon}</span>
          </div>
          <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
          <p className="text-muted-foreground leading-relaxed text-[15px]">{feature.description}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}
