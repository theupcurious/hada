/**
 * Starter presets for new Spaces. A template just pre-fills the create form —
 * name, description, and the per-space instructions — so a new space arrives with
 * a usable identity instead of an empty box. Purely client-side; no DB table.
 * Edit this list to curate what users see.
 */
export interface SpaceTemplate {
  id: string;
  /** Short label for the chip. */
  label: string;
  /** Emoji shown on the chip, and prefilled as the space's emoji. */
  icon: string;
  /** Prefilled space name (user can override). */
  name: string;
  /** Prefilled description — feeds the assistant as project context. */
  description: string;
  /** Prefilled per-space instructions — the space's role and style. */
  instructions: string;
  /** Prefilled accent color (hex) — one of SPACE_COLORS. */
  color: string;
}

/**
 * Accent palette for a space's colored dot / identity. Kept small and legible
 * on both light and dark grounds. Stored as the hex string on projects.color.
 */
export const SPACE_COLORS: string[] = [
  "#14b8a6", // teal (brand default)
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#64748b", // slate
];

/**
 * A small curated emoji set for the picker. Users get quick, on-theme choices
 * without a full emoji keyboard; the field still accepts any single emoji.
 */
export const SPACE_EMOJIS: string[] = [
  "📈", "💪", "✍️", "💡", "📚", "💰", "🎯", "🧠",
  "🚀", "🏠", "🍳", "🎨", "🧭", "⚙️", "🌱", "❤️",
];

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  {
    id: "investing",
    label: "Investing",
    icon: "📈",
    name: "Investing",
    description: "Tracking markets, portfolio ideas, and macro news.",
    instructions: [
      "You are a markets analyst. Be concise and direct.",
      "When you make a claim about prices, earnings, or macro data, cite the source and date.",
      "Distinguish clearly between fact and speculation. Flag risk on any idea you surface.",
      "You are not a licensed financial advisor — never give personalized investment advice; frame everything as information, not a recommendation to buy or sell.",
    ].join(" "),
    color: "#10b981",
  },
  {
    id: "health",
    label: "Health & fitness",
    icon: "💪",
    name: "Health & Fitness",
    description: "Daily routines, workouts, nutrition, and habit tracking.",
    instructions: [
      "You are a supportive health and fitness coach. Keep a warm, motivating tone.",
      "Give practical, specific guidance on routines, workouts, and nutrition.",
      "Remember the user's goals, constraints, and progress, and check in on them.",
      "You are not a medical professional — for symptoms, pain, or medication questions, recommend seeing a doctor rather than diagnosing.",
    ].join(" "),
    color: "#ec4899",
  },
  {
    id: "writing",
    label: "Writing",
    icon: "✍️",
    name: "Writing",
    description: "Drafting, editing, and sharpening prose.",
    instructions: [
      "You are a sharp writing editor. Favor clarity, concision, and strong verbs.",
      "When asked to edit, preserve the author's voice — improve, don't rewrite into your own style.",
      "Point out weak spots directly and suggest concrete fixes. Avoid filler and hedging.",
    ].join(" "),
    color: "#8b5cf6",
  },
  {
    id: "blank",
    label: "Blank",
    icon: "＋",
    name: "",
    description: "",
    instructions: "",
    color: "#14b8a6",
  },
];
