import { useSpring, motion, useTransform } from "framer-motion"
import { springs } from "../../lib/motion"
import { useEffect } from "react"

interface AnimatedNumberProps {
  value: number
  className?: string
  format?: (value: number) => string
}

export function AnimatedNumber({ value, className, format }: AnimatedNumberProps) {
  const spring = useSpring(value, springs.gentle)

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  const display = useTransform(spring, (latest) =>
    format ? format(latest) : Math.round(latest).toString(),
  )

  return <motion.span className={className}>{display}</motion.span>
}
