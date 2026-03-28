"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

interface ChartSpec {
  type: "bar" | "pie" | "line" | "radar";
  title?: string;
  data: Array<Record<string, string | number>>;
  xKey?: string;
  yKey?: string;
  keys?: string[];
}

const COLORS = [
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#ec4899", // pink
  "#6366f1", // indigo
];

interface InlineChartProps {
  code: string;
}

export function InlineChart({ code }: InlineChartProps) {
  const spec = useMemo(() => {
    try {
      const parsed = JSON.parse(code) as ChartSpec;
      if (!parsed.type || !Array.isArray(parsed.data) || !parsed.data.length) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [code]);

  if (!spec) {
    return (
      <pre className="mb-2 max-w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs whitespace-pre dark:bg-zinc-800">
        <code>{code}</code>
      </pre>
    );
  }

  const keys = spec.keys ?? Object.keys(spec.data[0]).filter((k) => k !== (spec.xKey ?? "name"));
  const xKey = spec.xKey ?? "name";
  const yKey = spec.yKey ?? keys[0];

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
      {spec.title ? (
        <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{spec.title}</p>
        </div>
      ) : null}
      <div className="p-4" style={{ height: spec.type === "radar" ? 280 : 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "bar" ? (
            <BarChart data={spec.data} margin={{ top: 4, right: 4, bottom: 4, left: -8 }}>
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#e4e4e7",
                }}
              />
              {keys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[i % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : spec.type === "line" ? (
            <LineChart data={spec.data} margin={{ top: 4, right: 4, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#e4e4e7",
                }}
              />
              {keys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                />
              ))}
            </LineChart>
          ) : spec.type === "radar" ? (
            <RadarChart data={spec.data} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#3f3f46" />
              <PolarAngleAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
              />
              {keys.map((key, i) => (
                <Radar
                  key={key}
                  dataKey={key}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#e4e4e7",
                }}
              />
            </RadarChart>
          ) : (
            <PieChart>
              <Pie
                data={spec.data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={3}
                label={(props: { name?: string; percent?: number }) =>
                  `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: "#71717a" }}
              >
                {spec.data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#e4e4e7",
                }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
