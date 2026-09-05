"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DocumentDraft {
  title: string;
  content: string;
  folder: string;
}

/** Serializes saves and keeps edits made during an in-flight request dirty. */
export function useDocumentDraft(
  storageKey: string,
  initial: DocumentDraft,
  onSave: (draft: DocumentDraft) => Promise<boolean>,
) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const [recovered, setRecovered] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const current = useRef(initial);
  const saved = useRef(JSON.stringify(initial));
  const saveRef = useRef(onSave);
  const inFlight = useRef<Promise<boolean> | null>(null);
  saveRef.current = onSave;

  const retain = useCallback((value: DocumentDraft) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw || raw === saved.current) return;
      const value = JSON.parse(raw) as Partial<DocumentDraft>;
      if (typeof value.title !== "string" || typeof value.content !== "string" || typeof value.folder !== "string") return;
      const restored = value as DocumentDraft;
      current.current = restored;
      setDraft(restored);
      setRecovered(true);
      setStatus("pending");
    } catch {
      setStorageError(true);
    }
  }, [storageKey]);

  const update = useCallback((patch: Partial<DocumentDraft>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    retain(next);
    setRecovered(false);
    setDraft(next);
    setStatus("pending");
  }, [retain]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      if (!await inFlight.current) return false;
      return flush();
    }
    if (JSON.stringify(current.current) === saved.current) {
      try { localStorage.removeItem(storageKey); } catch { /* Server copy matches. */ }
      setStatus("saved");
      return true;
    }
    const snapshot = { ...current.current };
    setStatus("saving");
    const request = (async () => {
      try {
        if (!await saveRef.current(snapshot)) throw new Error("Save failed");
        saved.current = JSON.stringify(snapshot);
        if (JSON.stringify(current.current) === saved.current) {
          try { localStorage.removeItem(storageKey); } catch { /* The server copy is saved. */ }
          setStatus("saved");
          setRecovered(false);
        } else {
          setStatus("pending");
        }
        return true;
      } catch {
        retain(current.current);
        setStatus("error");
        return false;
      }
    })();
    inFlight.current = request;
    const ok = await request;
    inFlight.current = null;
    return ok && JSON.stringify(current.current) !== saved.current ? flush() : ok;
  }, [retain, storageKey]);

  useEffect(() => {
    // A recovered draft is reviewable before it overwrites a newer server copy.
    if (status !== "pending" || recovered) return;
    const timer = window.setTimeout(() => { void flush(); }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, flush, recovered, status]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(current.current) === saved.current) return;
      retain(current.current);
      event.preventDefault();
      event.returnValue = "";
    };
    const onLink = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.download || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (JSON.stringify(current.current) === saved.current || anchor.getAttribute("href")?.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      void flush().then((ok) => {
        if (ok) window.location.assign(anchor.href);
        // On failure stay in the editor, with the retry state and recovery draft intact.
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onLink, true);
    };
  }, [flush, retain]);

  return { draft, update, flush, status, recovered, storageError };
}
