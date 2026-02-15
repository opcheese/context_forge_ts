/**
 * Landing page - Public marketing page for ContextForge.
 */

import { useState, useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import { Button } from "@/components/ui/button"
import { Layers, LayoutTemplate, GitBranch, ArrowRight, Anvil, Sparkles, Package, Sun, Moon } from "lucide-react"

// Theme toggle hook (duplicated from app layout since landing is independent)
function useTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  )

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark(!isDark) }
}

function LandingPage() {
  const { isAuthenticated } = useConvexAuth()
  const { isDark, toggle } = useTheme()

  const ctaText = isAuthenticated ? "Go to App" : "Get Started"
  const ctaTo = isAuthenticated ? "/app" : "/login"

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient background texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-foreground/5 border border-border flex items-center justify-center">
              <Anvil className="w-4 h-4 text-foreground/70" />
            </div>
            <span className="text-lg font-bold tracking-tight">ContextForge</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg border border-border bg-background hover:bg-accent flex items-center justify-center transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-muted-foreground" /> : <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {isAuthenticated ? (
              <Link to="/app">
                <Button variant="outline" size="sm">Go to App</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/login">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 pt-24 pb-20 sm:pt-32 sm:pb-28">
        {/* Decorative elements */}
        <div className="absolute top-12 left-1/4 w-64 h-64 bg-orange-500/5 dark:bg-orange-400/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-amber-500/5 dark:bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/50 mb-8 text-sm text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Shape your AI conversations</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Forge better context.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 dark:from-amber-400 dark:via-orange-400 dark:to-red-400">
                Get better answers.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
              ContextForge helps you organize, structure, and manage context for LLM conversations.
              Stop losing track of what matters. Build reusable context that makes every prompt count.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link to={ctaTo}>
                <Button size="lg" className="h-12 px-8 text-base font-semibold gap-2.5 rounded-xl shadow-lg shadow-primary/10">
                  {ctaText}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">Free to use. No credit card.</span>
            </div>
          </div>

          {/* Hero visual — abstract zone diagram */}
          <div className="mt-16 sm:mt-20 grid grid-cols-3 gap-3 max-w-2xl">
            {[
              { label: "Permanent", desc: "Always included", color: "border-blue-500/30 bg-blue-500/5 dark:bg-blue-400/5" },
              { label: "Stable", desc: "Reference material", color: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-400/5" },
              { label: "Working", desc: "Draft content", color: "border-amber-500/30 bg-amber-500/5 dark:bg-amber-400/5" },
            ].map((zone) => (
              <div
                key={zone.label}
                className={`rounded-xl border-2 border-dashed p-4 sm:p-5 ${zone.color} transition-colors`}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {zone.label}
                </div>
                <div className="text-sm text-muted-foreground/80">{zone.desc}</div>
                <div className="mt-3 space-y-1.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-2 rounded-full bg-foreground/[0.06] dark:bg-foreground/[0.08]" style={{ width: `${65 + i * 15}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 sm:py-28 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="text-center mb-14 sm:mb-18">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need to manage context
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              A complete toolkit for organizing the knowledge that powers your AI workflows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Layers,
                title: "Context Zones",
                description: "Organize blocks into Permanent, Stable, and Working zones with token budgets. Drag-and-drop to rearrange. Compress when things get long.",
                accent: "text-blue-500 dark:text-blue-400",
                bg: "bg-blue-500/5 dark:bg-blue-400/5",
              },
              {
                icon: LayoutTemplate,
                title: "Templates",
                description: "Save session configurations as reusable templates. Apply them instantly to new sessions. Build a library of starting points for any task.",
                accent: "text-emerald-500 dark:text-emerald-400",
                bg: "bg-emerald-500/5 dark:bg-emerald-400/5",
              },
              {
                icon: GitBranch,
                title: "Workflows",
                description: "Define multi-step pipelines that carry context forward. Track progress through stages. Go from brainstorm to polished output systematically.",
                accent: "text-amber-500 dark:text-amber-400",
                bg: "bg-amber-500/5 dark:bg-amber-400/5",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-card/50 p-7 sm:p-8 hover:border-border/80 hover:bg-card transition-all duration-300"
              >
                <div className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}>
                  <feature.icon className={`w-5.5 h-5.5 ${feature.accent}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-[15px]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-20 sm:py-28 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="text-center mb-14 sm:mb-18">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Three steps to better AI conversations
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Start small, build up. Your context library grows with every session.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-border" />

            {[
              {
                step: "01",
                title: "Add your context",
                description: "Drop in system prompts, reference docs, examples, and constraints. Assign each block to its zone.",
              },
              {
                step: "02",
                title: "Organize & refine",
                description: "Compress verbose blocks. Arrange by priority. Use templates to save configurations you'll reuse.",
              },
              {
                step: "03",
                title: "Export & use",
                description: "Copy your assembled context. Paste into any LLM. Get dramatically better results from the same models.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center md:text-left">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-foreground text-background font-bold text-sm mb-5 relative z-10">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 py-20 sm:py-28 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="relative rounded-3xl border border-border bg-card/50 overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 dark:from-amber-400/5 dark:to-orange-400/5 pointer-events-none" />

            <div className="relative px-8 py-14 sm:px-14 sm:py-18 text-center">
              <div className="inline-flex items-center gap-2 mb-5">
                <Package className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span className="text-sm font-medium text-muted-foreground">Open source, forever free</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to forge better context?
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
                Stop pasting raw text into chat windows. Start building structured context that compounds.
              </p>
              <Link to={ctaTo}>
                <Button size="lg" className="h-12 px-8 text-base font-semibold gap-2.5 rounded-xl shadow-lg shadow-primary/10">
                  {ctaText}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-8">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Anvil className="w-3.5 h-3.5" />
            <span>ContextForge</span>
          </div>
          <span className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} ContextForge
          </span>
        </div>
      </footer>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: LandingPage,
})
