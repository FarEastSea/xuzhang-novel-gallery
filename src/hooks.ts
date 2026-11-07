import { useCallback, useEffect, useState } from "react";
import { checkStudio, loadNovel, loadWorks } from "./api";
import { snapshot } from "./data";
import type { NovelDetail, NovelPayload, WorksPayload } from "./types";

export function useWorks() {
  const [state, setState] = useState<WorksPayload & { loading: boolean }>(() => ({
    works: snapshot.works,
    origin: "snapshot",
    syncedAt: snapshot.generatedAt,
    loading: true,
  }));

  const refresh = useCallback(async (force = true) => {
    setState((current) => ({ ...current, loading: true }));
    const payload = await loadWorks(force);
    setState({ ...payload, loading: false });
  }, []);

  useEffect(() => {
    let active = true;
    loadWorks().then((payload) => {
      if (active) setState({ ...payload, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return { ...state, refresh };
}

export function useNovel(id: string | undefined) {
  const fallback = id
    ? snapshot.works.find((work) => work.id === id) || null
    : null;
  const [state, setState] = useState<
    (NovelPayload & { loading: boolean; notFound: boolean }) | null
  >(() =>
    fallback
      ? {
          novel: fallback,
          origin: "snapshot",
          syncedAt: snapshot.generatedAt,
          loading: true,
          notFound: false,
        }
      : null
  );

  useEffect(() => {
    if (!id) return;
    let active = true;
    setState((current) =>
      current && current.novel.id === id
        ? { ...current, loading: true, notFound: false }
        : fallback
          ? {
              novel: fallback,
              origin: "snapshot",
              syncedAt: snapshot.generatedAt,
              loading: true,
              notFound: false,
            }
          : null
    );
    loadNovel(id).then((payload) => {
      if (!active) return;
      setState(
        payload
          ? { ...payload, loading: false, notFound: false }
          : {
              novel: null as unknown as NovelDetail,
              origin: "snapshot",
              syncedAt: snapshot.generatedAt,
              loading: false,
              notFound: true,
            }
      );
    });
    return () => {
      active = false;
    };
  }, [id, fallback]);

  return state;
}

export function useStudioStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    checkStudio().then((value) => {
      if (active) setOnline(value);
    });
    const interval = window.setInterval(() => {
      checkStudio().then((value) => {
        if (active) setOnline(value);
      });
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return online;
}

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · 叙章` : "叙章 · Biz Novel Studio 作品馆";
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useReadingProgress(novelId: string, chapterId: string) {
  useEffect(() => {
    if (!novelId || !chapterId) return;
    try {
      localStorage.setItem(
        `xuzhang:progress:${novelId}`,
        JSON.stringify({ chapterId, updatedAt: new Date().toISOString() })
      );
    } catch {
      // Private browsing may reject localStorage writes.
    }
  }, [novelId, chapterId]);
}

export function getReadingProgress(novelId: string): string | null {
  try {
    const raw = localStorage.getItem(`xuzhang:progress:${novelId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { chapterId?: string };
    return parsed.chapterId || null;
  } catch {
    return null;
  }
}
