/**
 * Steps section with connector line draw animation.
 */

import { motion } from "framer-motion"
import { lineDrawVariants } from "../../lib/motion"

const steps = [
  {
    step: "01",
    title: "Build your context",
    description:
      "Drop in system prompts, reference docs, examples, and constraints. Organize blocks across zones.",
  },
  {
    step: "02",
    title: "Brainstorm with AI",
    description:
      "Use your assembled context for an informed conversation. Explore ideas with the full picture already loaded.",
  },
  {
    step: "03",
    title: "Keep what matters",
    description:
      "Save useful outputs back to your context library. Discard the rest. Your knowledge compounds over time.",
  },
]

export function StepsSection() {
  return (
    <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
      {/* Connector line */}
      <motion.div
        className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-border"
        style={{ transformOrigin: "left" }}
        variants={lineDrawVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      />

      {steps.map((item) => (
        <div key={item.step} className="relative text-center md:text-left">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-foreground text-background font-bold text-sm mb-5 relative z-10">
            {item.step}
          </div>
          <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
          <p className="text-muted-foreground text-[15px] leading-relaxed">{item.description}</p>
        </div>
      ))}
    </div>
  )
}
