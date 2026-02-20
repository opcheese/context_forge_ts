/**
 * Hero section content — animated with framer-motion.
 * Rendered as a client:visible island.
 */

import { motion } from "framer-motion"
import { heroStagger, heroStaggerItem, springs } from "../../lib/motion"

export function HeroAnimated() {
  return (
    <motion.div className="max-w-3xl" variants={heroStagger} initial="hidden" animate="visible">
      {/* Eyebrow */}
      <motion.div
        variants={heroStaggerItem}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/50 mb-8 text-sm text-muted-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-500 dark:text-amber-400"
        >
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
        <span>Shape your AI conversations</span>
      </motion.div>

      <motion.h1
        variants={heroStaggerItem}
        className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
      >
        Forge better context.{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 dark:from-amber-400 dark:via-orange-400 dark:to-red-400">
          Get better answers.
        </span>
      </motion.h1>

      <motion.p
        variants={heroStaggerItem}
        className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl"
      >
        ContextForge helps you organize, structure, and manage context for LLM conversations. Stop
        losing track of what matters. Build reusable context that makes every prompt count.
      </motion.p>

      <motion.div variants={heroStaggerItem} className="flex flex-wrap items-center gap-4">
        <motion.a
          href="/app/login"
          className="inline-flex items-center justify-center rounded-xl text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 shadow-lg shadow-primary/10 gap-2.5 transition-colors"
          initial="rest"
          whileHover="hover"
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
        >
          Get Started
          <motion.span
            variants={{ rest: { x: 0 }, hover: { x: 3 } }}
            transition={springs.snappy}
            className="inline-flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </motion.span>
        </motion.a>
        <span className="text-sm text-muted-foreground">Free to use. No credit card.</span>
      </motion.div>
    </motion.div>
  )
}
