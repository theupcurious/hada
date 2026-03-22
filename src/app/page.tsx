"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 lg:px-8 border-b border-border/70 bg-background/85 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">H</span>
          </div>
          <span className="text-xl font-semibold">Hada</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/auth/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/auth/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <p className="label mb-4">AI Assistant</p>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Your AI assistant that{" "}
            <span className="text-muted-foreground">actually does things</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
            Hada manages your calendar, drafts emails, books appointments, does research,
            and handles tasks — like having a brilliant executive assistant available 24/7.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="h-12 px-8 text-base">
                Start for free
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                See what Hada can do
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Chat Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16 w-full max-w-2xl"
        >
          <div className="rounded-2xl border border-border/80 bg-card/70 p-6 shadow-2xl backdrop-blur-sm">
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">H</span>
                </div>
                <div className="flex-1 space-y-3 text-left">
                  <div className="inline-block max-w-[80%] rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-2">
                    <p className="text-sm">I found 3 salons near you with Friday availability:</p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-card/50 p-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">The Cutting Room</p>
                        <p className="text-sm text-muted-foreground">2:00 PM, 4:00 PM available</p>
                      </div>
                      <Button size="sm">Book 2pm</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="label mb-3 text-center">Capabilities</p>
          <h2 className="text-center text-3xl font-bold">What Hada can do for you</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Calendar", desc: "Schedule meetings, check availability, send invites" },
              { title: "Email", desc: "Draft responses, summarize threads, send on your behalf" },
              { title: "Research", desc: "Find information, compare options, create summaries" },
              { title: "Tasks", desc: "Track to-dos, set reminders, follow up automatically" },
              { title: "Bookings", desc: "Book appointments, restaurants, travel arrangements" },
              { title: "And more...", desc: "New skills added regularly — taxes, shopping, and beyond" },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-border/80 bg-card/70 p-6 backdrop-blur-sm transition-colors hover:bg-card/90"
              >
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/70 px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-muted-foreground">Hada — Your AI Assistant</p>
          <p className="text-sm text-muted-foreground">Built with care</p>
        </div>
      </footer>
    </div>
  );
}
