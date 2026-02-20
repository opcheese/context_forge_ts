/**
 * Steps section with connector line draw animation.
 */

import { motion } from "framer-motion"
import { lineDrawVariants } from "../../lib/motion"

const steps = [
  {
    step: "01",
    title: "Add your context",
    description:
      "Drop in system prompts, reference docs, examples, and constraints. Assign each block to its zone.",
  },
  {
    step: "02",
    title: "Organize & refine",
    description:
      "Compress verbose blocks. Arrange by priority. Use templates to save configurations you'll reuse.",
  },
  {
    step: "03",
    title: "Export & use",
    description:
      "Copy your assembled context. Paste into any LLM. Get dramatically better results from the same models.",
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
