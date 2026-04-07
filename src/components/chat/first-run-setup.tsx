"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type WritingStyle = "concise" | "balanced" | "detailed";
export type RecommendationStyle = "decision_first" | "context_first";
export type PlanningStyle = "daily" | "weekly" | "both";
export type WorkRhythm = "morning_deep_work" | "afternoon_deep_work" | "flexible";
export type AssistantVoice = "pragmatic" | "friendly" | "professional" | "academic";

export interface FirstRunSetupRememberFlags {
  workingStyle: boolean;
  recommendationStyle: boolean;
  planningStyle: boolean;
  workRhythm: boolean;
  primaryGoals: boolean;
  calendarHabits: boolean;
  currentProjects: boolean;
  assistantVoice: boolean;
}

export interface FirstRunSetupValues {
  writingStyle: WritingStyle;
  recommendationStyle: RecommendationStyle;
  planningStyle: PlanningStyle;
  workRhythm: WorkRhythm;
  primaryGoals: string[];
  calendarHabits: string[];
  currentProjects: string[];
  assistantVoice: AssistantVoice;
  remember: FirstRunSetupRememberFlags;
}

export interface FirstRunSetupProps {
  initialValues?: Partial<FirstRunSetupValues>;
  onComplete: (values: FirstRunSetupValues) => void;
  onSkip: () => void;
  className?: string;
}

const DEFAULT_VALUES: FirstRunSetupValues = {
  writingStyle: "concise",
  recommendationStyle: "decision_first",
  planningStyle: "daily",
  workRhythm: "morning_deep_work",
  primaryGoals: [],
  calendarHabits: [],
  currentProjects: [],
  assistantVoice: "pragmatic",
  remember: {
    workingStyle: true,
    recommendationStyle: true,
    planningStyle: true,
    workRhythm: true,
    primaryGoals: true,
    calendarHabits: true,
    currentProjects: true,
    assistantVoice: true,
  },
};

const WRITING_STYLES: Array<{ value: WritingStyle; label: string; helper: string }> = [
  { value: "concise", label: "Concise", helper: "Short, direct, minimal fluff" },
  { value: "balanced", label: "Balanced", helper: "Clear with enough context" },
  { value: "detailed", label: "Detailed", helper: "Thorough and explicit" },
];

const RECOMMENDATION_STYLES: Array<{ value: RecommendationStyle; label: string; helper: string }> = [
  { value: "decision_first", label: "Decision first", helper: "Lead with the answer" },
  { value: "context_first", label: "Context first", helper: "Explain the why first" },
];

const PLANNING_STYLES: Array<{ value: PlanningStyle; label: string; helper: string }> = [
  { value: "daily", label: "Daily priorities", helper: "Plan around today" },
  { value: "weekly", label: "Weekly plans", helper: "Work from a weekly rhythm" },
  { value: "both", label: "Both", helper: "Use whichever fits the task" },
];

const WORK_RHYTHMS: Array<{ value: WorkRhythm; label: string; helper: string }> = [
  { value: "morning_deep_work", label: "Morning deep work", helper: "Protect focus before noon" },
  { value: "afternoon_deep_work", label: "Afternoon deep work", helper: "Use the afternoon for focus" },
  { value: "flexible", label: "Flexible", helper: "Adapt to the day" },
];

const ASSISTANT_VOICES: Array<{ value: AssistantVoice; label: string; preview: string }> = [
  {
    value: "pragmatic",
    label: "Pragmatic",
    preview: "I’ll keep this short, practical, and decision-first.",
  },
  {
    value: "friendly",
    label: "Friendly",
    preview: "I’ll keep this clear, supportive, and easy to act on.",
  },
  {
    value: "professional",
    label: "Professional",
    preview: "I’ll keep this structured, precise, and ready to share.",
  },
  {
    value: "academic",
    label: "Academic",
    preview: "I’ll be thorough, explicit about assumptions, and careful with evidence.",
  },
];

const PRIMARY_GOALS = [
  "Protect focus time",
  "Turn ideas into docs",
  "Research faster",
  "Stay on top of projects",
  "Make better decisions",
  "Reduce admin overhead",
] as const;

const CALENDAR_HABITS = [
  "Avoid mornings",
  "Protect 2h focus blocks",
  "Batch meetings",
  "Leave buffers between calls",
  "Prefer no-meeting days",
] as const;

const REMEMBER_ITEMS: Array<{
  key: keyof FirstRunSetupRememberFlags;
  label: string;
  description: string;
}> = [
  {
    key: "workingStyle",
    label: "Working style",
    description: "Use your writing, recommendation, and planning preferences.",
  },
  {
    key: "primaryGoals",
    label: "Goals",
    description: "Keep the current priorities in mind for future responses.",
  },
  {
    key: "planningStyle",
    label: "Planning style",
    description: "Use your daily, weekly, or mixed planning cadence.",
  },
  {
    key: "calendarHabits",
    label: "Calendar habits",
    description: "Respect how you like to protect or batch time.",
  },
  {
    key: "currentProjects",
    label: "Current projects",
    description: "Remember the projects you add during setup.",
  },
  {
    key: "assistantVoice",
    label: "Assistant voice",
    description: "Keep the tone aligned with your chosen style.",
  },
];

export function FirstRunSetup({ initialValues, onComplete, onSkip, className }: FirstRunSetupProps) {
  const [step, setStep] = useState(0);
  const [projectInput, setProjectInput] = useState("");
  const [values, setValues] = useState<FirstRunSetupValues>(() => mergeInitialValues(initialValues));

  const previewSentence = useMemo(() => buildPreviewSentence(values), [values]);

  useEffect(() => {
    setValues(mergeInitialValues(initialValues));
  }, [initialValues]);

  const goNext = () => setStep((current) => Math.min(current + 1, 2));
  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const toggleSingle = <K extends "writingStyle" | "recommendationStyle" | "planningStyle" | "workRhythm" | "assistantVoice">(
    key: K,
    value: FirstRunSetupValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const toggleMany = (key: "primaryGoals" | "calendarHabits", value: string) => {
    setValues((current) => {
      const next = current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value];

      return { ...current, [key]: next };
    });
  };

  const addCurrentProject = () => {
    const next = projectInput.trim();
    if (!next) return;

    setValues((current) => {
      if (current.currentProjects.includes(next)) {
        return current;
      }

      return {
        ...current,
        currentProjects: [...current.currentProjects, next],
      };
    });
    setProjectInput("");
  };

  const removeCurrentProject = (project: string) => {
    setValues((current) => ({
      ...current,
      currentProjects: current.currentProjects.filter((item) => item !== project),
    }));
  };

  const toggleRemember = (key: keyof FirstRunSetupRememberFlags) => {
    setValues((current) => ({
      ...current,
      remember: {
        ...current.remember,
        [key]: !current.remember[key],
      },
    }));
  };

  const currentStepLabel = ["How you work", "What matters now", "Assistant style"][step];

  return (
    <Card
      className={cn(
        "overflow-hidden border-zinc-200/70 bg-white/85 shadow-2xl shadow-teal-500/5 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/80",
        className,
      )}
    >
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Let&apos;s set up how Hada works with you.
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Three quick steps. You can change everything later in Settings.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="shrink-0 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Skip
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["1", "2", "3"].map((value, index) => {
            const active = index === step;
            const complete = index < step;

            return (
              <div
                key={value}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-teal-500/50 bg-teal-500/10 text-teal-700 dark:border-teal-400/40 dark:bg-teal-400/10 dark:text-teal-300"
                    : complete
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-zinc-200/70 bg-zinc-50 text-zinc-500 dark:border-zinc-800/70 dark:bg-zinc-900/50 dark:text-zinc-400",
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-current/10 text-[10px] font-semibold">
                  {value}
                </span>
                <span>{index === 0 ? "Setup" : index === 1 ? "Goals" : "Style"}</span>
              </div>
            );
          })}
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">{currentStepLabel}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {step === 0 ? (
              <>
                <OptionGroup
                  title="Writing style"
                  helper="How Hada should draft and refine text."
                  options={WRITING_STYLES}
                  value={values.writingStyle}
                  onSelect={(next) => toggleSingle("writingStyle", next)}
                />

                <OptionGroup
                  title="Recommendation style"
                  helper="How Hada should frame answers and tradeoffs."
                  options={RECOMMENDATION_STYLES}
                  value={values.recommendationStyle}
                  onSelect={(next) => toggleSingle("recommendationStyle", next)}
                />

                <OptionGroup
                  title="Planning style"
                  helper="What kind of planning cadence fits you best."
                  options={PLANNING_STYLES}
                  value={values.planningStyle}
                  onSelect={(next) => toggleSingle("planningStyle", next)}
                />

                <OptionGroup
                  title="Work rhythm"
                  helper="When Hada should protect your focus time."
                  options={WORK_RHYTHMS}
                  value={values.workRhythm}
                  onSelect={(next) => toggleSingle("workRhythm", next)}
                />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <MultiSelectGroup
                  title="Primary goals"
                  helper="Pick the outcomes Hada should optimize for."
                  options={PRIMARY_GOALS}
                  values={values.primaryGoals}
                  onToggle={(value) => toggleMany("primaryGoals", value)}
                />

                <MultiSelectGroup
                  title="Calendar habits"
                  helper="Choose the scheduling patterns Hada should respect."
                  options={CALENDAR_HABITS}
                  values={values.calendarHabits}
                  onToggle={(value) => toggleMany("calendarHabits", value)}
                />

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">Current projects</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Optional. Add the projects Hada should keep in view.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={projectInput}
                      onChange={(event) => setProjectInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCurrentProject();
                        }
                      }}
                      placeholder="Add a project, then press Enter"
                      className="h-11 rounded-xl border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCurrentProject}
                      disabled={!projectInput.trim()}
                      className="h-11 rounded-xl"
                    >
                      Add
                    </Button>
                  </div>

                  {values.currentProjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {values.currentProjects.map((project) => (
                        <button
                          key={project}
                          type="button"
                          onClick={() => removeCurrentProject(project)}
                          aria-label={`Remove project ${project}`}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                          title="Remove project"
                        >
                          <span>{project}</span>
                          <span className="text-xs text-zinc-400">×</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 dark:text-zinc-500">No projects added yet.</p>
                  )}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">Assistant voice</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Choose the tone Hada should default to.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {ASSISTANT_VOICES.map((voice) => {
                      const selected = values.assistantVoice === voice.value;
                      return (
                        <button
                          key={voice.value}
                          type="button"
                          onClick={() => toggleSingle("assistantVoice", voice.value)}
                          aria-pressed={selected}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                            selected
                              ? "border-teal-500/50 bg-teal-500/10 shadow-sm shadow-teal-500/5"
                              : "border-zinc-200 bg-white/90 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{voice.label}</span>
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full",
                                selected ? "bg-teal-500" : "bg-zinc-300 dark:bg-zinc-600",
                              )}
                            />
                          </div>
                          <p className="mt-1.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{voice.preview}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-zinc-50 to-white p-4 shadow-sm dark:border-zinc-800/70 dark:from-zinc-950 dark:to-zinc-900/60">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Live preview</p>
                  <p className="mt-3 text-base leading-7 text-zinc-800 dark:text-zinc-200">{previewSentence}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    Hada will remember the preferences you keep checked below.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">Remember these preferences</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      You can change everything later in Settings.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {REMEMBER_ITEMS.map((item) => {
                      const checked = values.remember[item.key];
                      return (
                        <label
                          key={item.key}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                            checked
                              ? "border-teal-500/40 bg-teal-500/10"
                              : "border-zinc-200 bg-white/90 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:border-zinc-700",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRemember(item.key)}
                            aria-label={item.label}
                            className="mt-1 h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">{item.label}</span>
                            <span className="mt-1 block text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                              {item.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 border-t border-zinc-200/70 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800/70 dark:bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {step === 2 ? "You are one click away from a personalized workspace." : "These preferences can be edited later."}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={goBack} className="rounded-xl">
              Back
            </Button>
          ) : null}

          {step < 2 ? (
            <Button type="button" onClick={goNext} className="rounded-xl">
              Continue
            </Button>
          ) : (
            <Button type="button" variant="brand" onClick={() => onComplete(values)} className="rounded-xl">
              Finish setup
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function OptionGroup<T extends string>({
  title,
  helper,
  options,
  value,
  onSelect,
}: {
  title: string;
  helper: string;
  options: Array<{ value: T; label: string; helper: string }>;
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{helper}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              aria-pressed={selected}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                selected
                  ? "border-teal-500/50 bg-teal-500/10 shadow-sm shadow-teal-500/5"
                  : "border-zinc-200 bg-white/90 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{option.label}</span>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    selected ? "bg-teal-500" : "bg-zinc-300 dark:bg-zinc-600",
                  )}
                />
              </div>
              <p className="mt-1.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{option.helper}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiSelectGroup({
  title,
  helper,
  options,
  values,
  onToggle,
}: {
  title: string;
  helper: string;
  options: readonly string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{helper}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={selected}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-all",
                selected
                  ? "border-teal-500/50 bg-teal-500/10 text-teal-700 dark:border-teal-400/40 dark:bg-teal-400/10 dark:text-teal-300"
                  : "border-zinc-200 bg-white/90 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function mergeInitialValues(initialValues?: Partial<FirstRunSetupValues>): FirstRunSetupValues {
  const remember = initialValues?.remember
    ? {
        ...DEFAULT_VALUES.remember,
        ...initialValues.remember,
      }
    : { ...DEFAULT_VALUES.remember };

  return {
    writingStyle: initialValues?.writingStyle ?? DEFAULT_VALUES.writingStyle,
    recommendationStyle: initialValues?.recommendationStyle ?? DEFAULT_VALUES.recommendationStyle,
    planningStyle: initialValues?.planningStyle ?? DEFAULT_VALUES.planningStyle,
    workRhythm: initialValues?.workRhythm ?? DEFAULT_VALUES.workRhythm,
    primaryGoals: normalizeList(initialValues?.primaryGoals),
    calendarHabits: normalizeList(initialValues?.calendarHabits),
    currentProjects: normalizeList(initialValues?.currentProjects),
    assistantVoice: initialValues?.assistantVoice ?? DEFAULT_VALUES.assistantVoice,
    remember,
  };
}

function normalizeList(values?: string[]) {
  return Array.isArray(values) ? values.map((value) => value.trim()).filter(Boolean) : [];
}

function buildPreviewSentence(values: FirstRunSetupValues) {
  const voice = ASSISTANT_VOICES.find((item) => item.value === values.assistantVoice)?.preview ?? DEFAULT_VOICE_PREVIEW;
  const styleBits = [
    values.writingStyle === "concise"
      ? "I’ll keep writing concise."
      : values.writingStyle === "balanced"
      ? "I’ll balance brevity and context."
      : "I’ll give you the full picture.",
    values.recommendationStyle === "decision_first"
      ? "I’ll lead with the recommendation."
      : "I’ll start with the context and tradeoffs.",
    values.workRhythm === "morning_deep_work"
      ? "I’ll protect your mornings for deep work."
      : values.workRhythm === "afternoon_deep_work"
      ? "I’ll reserve your afternoons for focus."
      : "I’ll adapt to your day as it changes.",
  ];

  return `${voice} ${styleBits.join(" ")}`;
}

const DEFAULT_VOICE_PREVIEW = "I’ll keep this clear, practical, and easy to act on.";
