"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MermaidDiagramProps {
  chart: string;
}

let mermaidInitialized = false;

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
              darkMode: true,
              background: "transparent",
              primaryColor: "#6d28d9",
              primaryTextColor: "#e4e4e7",
              primaryBorderColor: "#7c3aed",
              secondaryColor: "#1e3a5f",
              secondaryTextColor: "#e4e4e7",
              tertiaryColor: "#1c1917",
              lineColor: "#71717a",
              textColor: "#d4d4d8",
              mainBkg: "#27272a",
              nodeBorder: "#52525b",
              clusterBkg: "#1c1917",
              clusterBorder: "#3f3f46",
              titleColor: "#e4e4e7",
              edgeLabelBackground: "#27272a",
              nodeTextColor: "#e4e4e7",
            },
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 13,
            flowchart: { curve: "monotoneX", padding: 12 },
            sequence: { actorMargin: 40 },
          });
          mermaidInitialized = true;
        }

        const { svg: rendered } = await mermaid.render(idRef.current, chart.trim());
        if (!cancelled) {
          setSvg(rendered);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <pre className="mb-2 max-w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs whitespace-pre dark:bg-zinc-800">
        <code>{chart}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-2 flex h-24 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
        <span className="text-xs text-zinc-400">Rendering diagram...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "my-2 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60",
        "[&_svg]:mx-auto [&_svg]:max-w-full",
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
