"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import { toLocaleLanguageTag, type AppLocale } from "@/lib/i18n";
import type { UserMemory } from "@/lib/types/database";

type MemoryResponse = {
  memories?: UserMemory[];
  error?: string;
};

type MemoryMutationResponse = {
  memory?: UserMemory;
  success?: boolean;
  error?: string;
};

type MemoryDraft = {
  id: string;
  topic: string;
  content: string;
};

export function MemoryTab() {
  const locale = useResolvedLocale();
  const copy = MEMORY_COPY[locale];
  const localeTag = toLocaleLanguageTag(locale);
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newMemoryOpen, setNewMemoryOpen] = useState(false);
  const [newMemoryDraft, setNewMemoryDraft] = useState({ topic: "", content: "" });
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadMemories();
  }, []);

  const filteredMemories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return memories;
    }

    return memories.filter((memory) => {
      const topic = memory.topic.toLowerCase();
      const content = memory.content.toLowerCase();
      return topic.includes(normalizedQuery) || content.includes(normalizedQuery);
    });
  }, [memories, query]);

  async function loadMemories() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/memories", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as MemoryResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to load memories.");
      }

      setMemories(Array.isArray(data.memories) ? data.memories : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load memories.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMemory() {
    if (isSaving) return;

    const topic = newMemoryDraft.topic.trim();
    const content = newMemoryDraft.content.trim();
    if (!topic || !content) {
      setMessage(copy.topicAndContentRequired);
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/dashboard/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, content }),
      });
      const data = (await response.json().catch(() => ({}))) as MemoryMutationResponse;

      if (!response.ok || !data.memory) {
        throw new Error(data.error || "Failed to create memory.");
      }

      setMemories((prev) => [data.memory!, ...prev]);
      setNewMemoryDraft({ topic: "", content: "" });
      setNewMemoryOpen(false);
      setMessage(copy.memorySaved);
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : copy.failedToCreateMemory);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveMemory(memoryId: string) {
    if (isSaving || !memoryDraft) return;

    const topic = memoryDraft.topic.trim();
    const content = memoryDraft.content.trim();
    if (!topic || !content) {
      setMessage(copy.topicAndContentRequired);
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/dashboard/memories/${memoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, content }),
      });
      const data = (await response.json().catch(() => ({}))) as MemoryMutationResponse;

      if (!response.ok || !data.memory) {
        throw new Error(data.error || "Failed to update memory.");
      }

      setMemories((prev) => prev.map((memory) => (memory.id === memoryId ? data.memory! : memory)));
      setEditingMemoryId(null);
      setMemoryDraft(null);
      setMessage(copy.memoryUpdated);
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : copy.failedToUpdateMemory);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    if (isSaving) return;
    if (!window.confirm(copy.confirmDeleteMemory)) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/dashboard/memories/${memoryId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as MemoryMutationResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete memory.");
      }

      setMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
      if (editingMemoryId === memoryId) {
        setEditingMemoryId(null);
        setMemoryDraft(null);
      }
      setMessage(copy.memoryDeleted);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : copy.failedToDeleteMemory);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{copy.title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {copy.subtitle}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.howMemoryWorks}</CardTitle>
          <CardDescription>{copy.memorySeparateFromChat}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>{copy.memoryExplanationOne}</p>
          <p>{copy.memoryExplanationTwo}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{copy.savedMemories}</CardTitle>
              <CardDescription>{copy.savedMemoriesDescription}</CardDescription>
            </div>
            <Button size="sm" className="w-full sm:w-auto" onClick={() => setNewMemoryOpen((value) => !value)}>
              {newMemoryOpen ? copy.cancel : copy.addMemory}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchMemories}
          />

          {newMemoryOpen ? (
            <div className="space-y-3 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/40">
              <Input
                value={newMemoryDraft.topic}
                onChange={(event) =>
                  setNewMemoryDraft((prev) => ({ ...prev, topic: event.target.value }))
                }
                placeholder={copy.topic}
              />
              <textarea
                value={newMemoryDraft.content}
                onChange={(event) =>
                  setNewMemoryDraft((prev) => ({ ...prev, content: event.target.value }))
                }
                placeholder={copy.memoryContent}
                rows={4}
                className="min-h-28 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
              />
              <div className="flex justify-stretch sm:justify-end">
                <Button size="sm" onClick={() => void handleCreateMemory()} disabled={isSaving}>
                  {isSaving ? copy.saving : copy.saveMemory}
                </Button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          ) : null}

          {message ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{copy.loadingMemories}</p>
          ) : filteredMemories.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {memories.length === 0 ? copy.noMemoriesYet : copy.noMemoriesMatchSearch}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredMemories.map((memory) => {
                const isEditing = editingMemoryId === memory.id;

                return (
                  <div
                    key={memory.id}
                    className="rounded-xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/40"
                  >
                    {isEditing && memoryDraft ? (
                      <div className="space-y-3">
                        <Input
                          value={memoryDraft.topic}
                          onChange={(event) =>
                            setMemoryDraft((prev) => (prev ? { ...prev, topic: event.target.value } : prev))
                          }
                        />
                        <textarea
                          value={memoryDraft.content}
                          onChange={(event) =>
                            setMemoryDraft((prev) => (prev ? { ...prev, content: event.target.value } : prev))
                          }
                          rows={4}
                          className="min-h-28 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setMemoryDraft(null);
                            }}
                          >
                            {copy.cancel}
                          </Button>
                          <Button size="sm" onClick={() => void handleSaveMemory(memory.id)} disabled={isSaving}>
                            {isSaving ? copy.saving : copy.save}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {memory.topic}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {memory.content}
                          </p>
                          <p className="mt-2 text-xs text-zinc-400">
                            {copy.updated} {formatTimestamp(memory.updated_at, localeTag)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingMemoryId(memory.id);
                              setMemoryDraft({
                                id: memory.id,
                                topic: memory.topic,
                                content: memory.content,
                              });
                            }}
                          >
                            {copy.edit}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                            onClick={() => void handleDeleteMemory(memory.id)}
                            disabled={isSaving}
                          >
                            {copy.delete}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimestamp(value: string, localeTag: string): string {
  return new Date(value).toLocaleString(localeTag, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const MEMORY_COPY: Record<
  AppLocale,
  {
    title: string;
    subtitle: string;
    howMemoryWorks: string;
    memorySeparateFromChat: string;
    memoryExplanationOne: string;
    memoryExplanationTwo: string;
    savedMemories: string;
    savedMemoriesDescription: string;
    addMemory: string;
    cancel: string;
    searchMemories: string;
    topic: string;
    memoryContent: string;
    saving: string;
    saveMemory: string;
    save: string;
    loadingMemories: string;
    noMemoriesYet: string;
    noMemoriesMatchSearch: string;
    updated: string;
    edit: string;
    delete: string;
    topicAndContentRequired: string;
    memorySaved: string;
    memoryUpdated: string;
    memoryDeleted: string;
    failedToCreateMemory: string;
    failedToUpdateMemory: string;
    failedToDeleteMemory: string;
    confirmDeleteMemory: string;
  }
> = {
  en: {
    title: "Memory",
    subtitle: "Review and manage the facts and preferences Hada keeps across chats.",
    howMemoryWorks: "How memory works",
    memorySeparateFromChat: "Memory is separate from chat history.",
    memoryExplanationOne: "Memories are durable facts or preferences Hada can reuse across future conversations.",
    memoryExplanationTwo: "Clearing chat history does not remove saved memories.",
    savedMemories: "Saved memories",
    savedMemoriesDescription: "Search, edit, add, or delete saved memory items.",
    addMemory: "Add memory",
    cancel: "Cancel",
    searchMemories: "Search memories",
    topic: "Topic",
    memoryContent: "Memory content",
    saving: "Saving...",
    saveMemory: "Save memory",
    save: "Save",
    loadingMemories: "Loading memories...",
    noMemoriesYet: "No memories saved yet.",
    noMemoriesMatchSearch: "No memories match your search.",
    updated: "Updated",
    edit: "Edit",
    delete: "Delete",
    topicAndContentRequired: "Topic and content are required.",
    memorySaved: "Memory saved.",
    memoryUpdated: "Memory updated.",
    memoryDeleted: "Memory deleted.",
    failedToCreateMemory: "Failed to create memory.",
    failedToUpdateMemory: "Failed to update memory.",
    failedToDeleteMemory: "Failed to delete memory.",
    confirmDeleteMemory: "Delete this memory?",
  },
  ko: {
    title: "메모리",
    subtitle: "Hada가 대화 전반에서 유지하는 사실과 선호도를 관리하세요.",
    howMemoryWorks: "메모리 동작 방식",
    memorySeparateFromChat: "메모리는 채팅 기록과 분리되어 저장됩니다.",
    memoryExplanationOne: "메모리는 이후 대화에서도 재사용할 수 있는 지속적인 사실/선호도입니다.",
    memoryExplanationTwo: "채팅 기록을 지워도 저장된 메모리는 삭제되지 않습니다.",
    savedMemories: "저장된 메모리",
    savedMemoriesDescription: "검색, 수정, 추가, 삭제를 할 수 있습니다.",
    addMemory: "메모리 추가",
    cancel: "취소",
    searchMemories: "메모리 검색",
    topic: "주제",
    memoryContent: "메모리 내용",
    saving: "저장 중...",
    saveMemory: "메모리 저장",
    save: "저장",
    loadingMemories: "메모리를 불러오는 중...",
    noMemoriesYet: "아직 저장된 메모리가 없습니다.",
    noMemoriesMatchSearch: "검색 결과와 일치하는 메모리가 없습니다.",
    updated: "업데이트",
    edit: "수정",
    delete: "삭제",
    topicAndContentRequired: "주제와 내용은 필수입니다.",
    memorySaved: "메모리가 저장되었습니다.",
    memoryUpdated: "메모리가 업데이트되었습니다.",
    memoryDeleted: "메모리가 삭제되었습니다.",
    failedToCreateMemory: "메모리 생성에 실패했습니다.",
    failedToUpdateMemory: "메모리 업데이트에 실패했습니다.",
    failedToDeleteMemory: "메모리 삭제에 실패했습니다.",
    confirmDeleteMemory: "이 메모리를 삭제할까요?",
  },
  ja: {
    title: "メモリ",
    subtitle: "Hada が会話をまたいで保持する事実や設定を管理します。",
    howMemoryWorks: "メモリの仕組み",
    memorySeparateFromChat: "メモリはチャット履歴とは別に保存されます。",
    memoryExplanationOne: "メモリは、今後の会話でも再利用される永続的な事実・設定です。",
    memoryExplanationTwo: "チャット履歴を削除しても、保存済みメモリは削除されません。",
    savedMemories: "保存済みメモリ",
    savedMemoriesDescription: "検索・編集・追加・削除ができます。",
    addMemory: "メモリ追加",
    cancel: "キャンセル",
    searchMemories: "メモリを検索",
    topic: "トピック",
    memoryContent: "メモリ内容",
    saving: "保存中...",
    saveMemory: "メモリを保存",
    save: "保存",
    loadingMemories: "メモリを読み込み中...",
    noMemoriesYet: "保存済みメモリはまだありません。",
    noMemoriesMatchSearch: "検索条件に一致するメモリがありません。",
    updated: "更新",
    edit: "編集",
    delete: "削除",
    topicAndContentRequired: "トピックと内容は必須です。",
    memorySaved: "メモリを保存しました。",
    memoryUpdated: "メモリを更新しました。",
    memoryDeleted: "メモリを削除しました。",
    failedToCreateMemory: "メモリ作成に失敗しました。",
    failedToUpdateMemory: "メモリ更新に失敗しました。",
    failedToDeleteMemory: "メモリ削除に失敗しました。",
    confirmDeleteMemory: "このメモリを削除しますか？",
  },
};
