"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export class EditorErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="m-6 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="font-semibold">This document couldn’t be opened</h2>
        <p className="my-3 text-sm text-zinc-500">Your saved document is unchanged. Try opening it again, or choose another document.</p>
        <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
      </div>
    );
  }
}
