/**
 * Before/After comparison — scroll-triggered slide-in.
 */

import { motion } from "framer-motion"
import { springs } from "../../lib/motion"

const BEFORE_TEXT = `You are an expert TypeScript developer.
I'm building a SaaS product. The tech stack is React,
Convex, TanStack Router, Tailwind. My coding style
prefers small pure functions, no classes, conventional
commits. Current task: add drag-and-drop reordering to
the block list. Reference the existing DnD setup.`

export function BeforeAfter() {
  return (
    <div>
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Full control over every prompt
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Add or remove any piece of content at any point. Your context, your rules.
        </p>
      </motion.div>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {/* Before */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={springs.smooth}
        className="rounded-2xl border border-border bg-card/50 p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-sm font-medium text-muted-foreground">Without ContextForge</span>
        </div>
        <pre className="text-[13px] text-muted-foreground/70 leading-relaxed font-mono whitespace-pre-wrap">
          {BEFORE_TEXT}
        </pre>
      </motion.div>

      {/* After */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={springs.smooth}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-400/[0.03] p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-muted-foreground">With ContextForge</span>
        </div>
        <div className="space-y-3 text-[13px] font-mono">
          <div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-1">
              Permanent
            </span>
            <div className="text-muted-foreground/70 leading-relaxed">
              Role: Senior TypeScript engineer
              <br />
              Style: Pure functions · No classes · Conventional commits
            </div>
          </div>
          <div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
              Stable
            </span>
            <div className="text-muted-foreground/70 leading-relaxed">
              Stack: React · Convex · TanStack Router · Tailwind
              <br />
              Reference: /src/components/dnd/ (existing DnD setup)
            </div>
          </div>
          <div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-1">
              Working
            </span>
            <div className="text-muted-foreground/70 leading-relaxed">
              Task: Add drag-and-drop block reordering
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  )
}
