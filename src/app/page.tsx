"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const featureCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08 },
  }),
};

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black overflow-hidden">
      {/* Background glow accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-500/10 via-cyan-500/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-gradient-to-tl from-cyan-500/8 via-teal-400/5 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-4 lg:px-8 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden shadow-lg shadow-teal-500/20">
            <Image src="/hada-logo.png" alt="Hada" width={24} height={24} className="h-6 w-6 object-cover" />
          </div>
          <span className="text-xl font-semibold">Hada</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/auth/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="gradient-brand text-white border-0 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-3xl pt-12"
        >
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Your AI assistant that{" "}
            <span className="gradient-text">actually does things</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
            Hada manages your calendar, drafts emails, books appointments, does research,
            and handles tasks — like having a brilliant executive assistant available 24/7.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="h-12 px-8 text-base gradient-brand text-white border-0 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.02] transition-all duration-300"
              >
                Start for free
              </Button>
            </Link>
            <Link href="#features">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base backdrop-blur-sm hover:scale-[1.02] transition-all duration-200"
              >
                See what Hada can do
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Chat Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="relative mt-16 w-full max-w-2xl"
        >
          {/* Glow behind preview */}
          <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-teal-500/15 via-cyan-500/10 to-teal-400/15 blur-2xl" style={{ animation: "glow-pulse 4s ease-in-out infinite" }} />
          <div className="glass relative rounded-2xl p-6" style={{ animation: "float 6s ease-in-out infinite" }}>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <span className="text-xs text-muted-foreground">You</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-2">
                  <p className="text-sm">Book me a haircut for Friday afternoon</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-brand text-white shadow-md shadow-teal-500/20">
                  <span className="text-sm font-bold">H</span>
                </div>
                <div className="flex-1 space-y-3 text-left">
                  <div className="inline-block max-w-[80%] rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-2">
                    <p className="text-sm">I found 3 salons near you with Friday availability:</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/50 p-3 backdrop-blur-sm transition-all hover:border-border/80 hover:bg-card/70">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">The Cutting Room</p>
                        <p className="text-sm text-muted-foreground">2:00 PM, 4:00 PM available</p>
                      </div>
                      <Button size="sm" className="gradient-brand text-white border-0 shadow-sm shadow-teal-500/20 text-xs">Book 2pm</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features */}
      <section id="features" className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
          >
            <p className="label mb-3 text-center">Capabilities</p>
            <h2 className="text-center text-3xl font-bold">
              What Hada can do <span className="gradient-text">for you</span>
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Calendar", desc: "Schedule meetings, check availability, send invites", icon: "📅" },
              { title: "Email", desc: "Draft responses, summarize threads, send on your behalf", icon: "✉️" },
              { title: "Research", desc: "Find information, compare options, create summaries", icon: "🔍" },
              { title: "Tasks", desc: "Set reminders, schedule recurring jobs, follow up automatically", icon: "✅" },
              { title: "Telegram", desc: "Message Hada from anywhere — works over Telegram too", icon: "💬" },
              { title: "Memory", desc: "Remembers your preferences and context across every conversation", icon: "🧠" },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={featureCardVariants}
                className="group glass rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-teal-500/5 cursor-default"
              >
                <span className="text-2xl mb-3 block">{feature.icon}</span>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border/50 px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-muted-foreground">Hada — Your AI Assistant</p>
          <p className="text-sm text-muted-foreground">© 2026 Hada</p>
        </div>
      </footer>
    </div>
  );
}
