import { AppHeader } from "@/components/app/app-header";
import { TasksTab } from "@/components/settings/tasks-tab";

export const dynamic = "force-dynamic";
export default function WorkflowsPage() {
  return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950"><AppHeader /><main className="mx-auto max-w-4xl px-4 py-6"><TasksTab /></main></div>;
}
