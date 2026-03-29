import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_42%),radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(113,113,122,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(113,113,122,0.05)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30 dark:opacity-20" />
      <div className="relative">{children}</div>
    </div>
  );
}
