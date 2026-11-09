import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "./session";
import { checkStudio, loadNovel, loadWorks } from "./api";
import type { NovelDetail, NovelPayload, WorksPayload } from "./types";

export function useWorks() {
  const { accessKey } = useSession();
  const [state, setState] = useState<WorksPayload & { loading: boolean }>(() => ({
    works: [],
    origin: "snapshot",
    syncedAt: "",
    loading: true,
  }));

  const requestId = useRef(0);
  const refresh = useCallback(async (force = true) => {
    const current = ++requestId.current;
    setState({ works: [], origin: 'live', syncedAt: '', loading: true });
    const payload = await loadWorks(force);
    if (current === requestId.current) setState({ ...payload, loading: false });
  }, []);
  useEffect(() => {
    void refresh(false);
    return () => { requestId.current++; };
  }, [accessKey, refresh]);

  return { ...state, refresh };
}

export function useNovel(id: string | undefined) {
  const { accessKey } = useSession();
  const [state, setState] = useState<(NovelPayload & { loading: boolean; notFound: boolean }) | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setState(null);
    loadNovel(id).then(payload => {
      if (active) setState(payload ? { ...payload, loading: false, notFound: false } : { novel: null as unknown as NovelDetail, origin: 'live', syncedAt: '', loading: false, notFound: true });
    });
    return () => { active = false; };
  }, [id, accessKey]);
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
