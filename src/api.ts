import { API_BASE } from "./config";
import { snapshot, loadSnapshot } from "./data";
import type {
  Axiom,
  BookContract,
  Chapter,
  Character,
  Faction,
  Force,
  Genre,
  Location,
  NovelDetail,
  NovelPayload,
  NovelSummary,
  Volume,
  WorksPayload,
} from "./types";
import { coverKeyFor, isChapterReadable } from "./utils";

type JsonRecord = Record<string, any>;

interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
  message?: string;
}

const CACHE_TTL = 30_000;
let worksCache: { value: WorksPayload; at: number } | null = null;
const novelCache = new Map<string, { value: NovelPayload; at: number }>();

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asSummary(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    return asText(record.summary) || asText(record.keyEvents);
  }
  return null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function apiGet<T>(path: string, timeout = 14_000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Biz Novel Studio API ${response.status}`);
    }
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (payload.success === false) {
      throw new Error(payload.message || "Biz Novel Studio API error");
    }
    return payload.data;
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeGenre(raw: JsonRecord | null | undefined): Genre {
  return {
    id: asText(raw?.id) || "unknown",
    name: asText(raw?.name) || "未分类",
    description: asText(raw?.description),
  };
}

function fallbackFor(id: string): NovelDetail | undefined {
  return snapshot.works.find((work) => work.id === id);
}

function normalizeSummary(raw: JsonRecord, fallback?: NovelDetail): NovelSummary {
  const genre = normalizeGenre(raw.genre || fallback?.genre);
  const counts = raw._count || {};
  const progress = raw.bookProgress || {};
  const fallbackStats = fallback?.stats;
  const totalWords = fallbackStats?.totalWords || 0;
  const chapterCount = asNumber(counts.chapters, fallback?.counts.chapters || 0);
  const written = asNumber(
    progress.writtenChapters,
    fallback?.stats.readableChapters || 0
  );
  return {
    id: asText(raw.id) || fallback?.id || "",
    title: asText(raw.title) || fallback?.title || "未命名作品",
    description:
      asText(raw.description) || fallback?.description || "这部作品还没有写下简介。",
    genre,
    status: asText(raw.status) || fallback?.status || "draft",
    projectStatus:
      asText(raw.projectStatus) || fallback?.projectStatus || "not_started",
    createdAt: asText(raw.createdAt) || fallback?.createdAt || null,
    updatedAt: asText(raw.updatedAt) || fallback?.updatedAt || null,
    bookSellingPoint:
      asText(raw.bookSellingPoint) || fallback?.bookSellingPoint || "",
    first30ChapterPromise:
      asText(raw.first30ChapterPromise) || fallback?.first30ChapterPromise || "",
    coverKey:
      fallback?.coverKey ||
      coverKeyFor(
        asText(raw.id) || "",
        genre.id,
        asText(raw.title) || fallback?.title || ""
      ),
    workspaceSourceRoute:
      asText(raw.workspaceSourceRoute) || fallback?.workspaceSourceRoute || null,
    counts: {
      chapters: chapterCount,
      characters: asNumber(counts.characters, fallback?.counts.characters || 0),
      plotBeats: asNumber(counts.plotBeats, fallback?.counts.plotBeats || 0),
    },
    progress: {
      writtenChapters: written,
      targetChapters: asNumber(
        progress.targetChapters,
        fallback?.progress.targetChapters || 80
      ),
    },
    stats: {
      readableChapters: written,
      chapterCount,
      totalWords,
    },
    world: {
      name: asText(raw.world?.name) || fallback?.world.name || null,
      type: asText(raw.world?.worldType) || fallback?.world.type || null,
      description:
        asText(raw.world?.description) ||
        fallback?.world.description ||
        null,
    },
  };
}

function normalizeChapters(raw: unknown, fallback: Chapter[] = []): Chapter[] {
  if (!Array.isArray(raw)) return fallback;
  return raw
    .map((chapter: JsonRecord, index): Chapter => {
      const content = asText(chapter.content) || "";
      const fallbackChapter = fallback.find((item) => item.id === chapter.id);
      return {
        id: asText(chapter.id) || `chapter-${index + 1}`,
        title: asText(chapter.title) || `第 ${index + 1} 章`,
        order: asNumber(chapter.order, index + 1),
        chapterStatus: asText(chapter.chapterStatus) || "unplanned",
        generationState: asText(chapter.generationState) || "planned",
        chapterSummary:
          asSummary(chapter.chapterSummary) ||
          fallbackChapter?.chapterSummary ||
          null,
        targetWordCount:
          typeof chapter.targetWordCount === "number"
            ? chapter.targetWordCount
            : fallbackChapter?.targetWordCount || null,
        wordCount: content
          ? content.replace(/\s/g, "").length
          : fallbackChapter?.wordCount || 0,
        content,
      };
    })
    .sort((a, b) => a.order - b.order);
}

function normalizeCharacters(raw: unknown, fallback: Character[] = []): Character[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.map((character: JsonRecord): Character => ({
    id: asText(character.id),
    name: asText(character.name) || "未命名角色",
    role: asText(character.role),
    castRole: asText(character.castRole),
    identityLabel: asText(character.identityLabel),
    personality: asText(character.personality),
    background: asText(character.background),
    currentGoal: asText(character.currentGoal),
    powerLevel: asText(character.powerLevel),
    firstImpression: asText(character.firstImpression),
    relationToProtagonist: asText(character.relationToProtagonist),
    stanceLabel: asText(character.stanceLabel),
  }));
}

function normalizeVolumes(raw: unknown, fallback: Volume[] = []): Volume[] {
  if (!Array.isArray(raw)) return fallback;
  return raw
    .map((volume: JsonRecord): Volume => ({
      id: asText(volume.id),
      sortOrder: asNumber(volume.sortOrder, 1),
      title: asText(volume.title) || "未命名分卷",
      summary: asText(volume.summary),
      openingHook: asText(volume.openingHook),
      mainPromise: asText(volume.mainPromise),
      climax: asText(volume.climax),
      payoffType: asText(volume.payoffType),
      status: asText(volume.status),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function cleanAxiomSummary(value: string | null): string | null {
  if (!value) return null;
  return (
    value
      .split(/[；;]\s*(?:代价|边界|约束|执行)：/)[0]
      ?.trim() || null
  );
}

function axiomFromText(line: string): Axiom {
  const clean = line.trim();
  const [name, ...rest] = clean.split("：");
  const detail = rest.join("：");
  return {
    name: name?.trim() || "世界规则",
    summary: cleanAxiomSummary(detail) || detail || clean,
    cost: detail.match(/代价：([^，；\n]+)/)?.[1]?.trim() || null,
    boundary: detail.match(/边界：([^，；\n]+)/)?.[1]?.trim() || null,
    enforcement:
      detail.match(/(?:约束|执行)：([^，；\n]+)/)?.[1]?.trim() || null,
  };
}

function normalizeAxioms(raw: unknown): Axiom[] {
  let items: unknown = raw;
  if (typeof raw === "string") {
    items = parseJson<unknown>(raw, null) ?? raw.split(/\n+/);
  }
  if (!Array.isArray(items)) return [];
  return items
    .map((item): Axiom | null => {
      if (typeof item === "string") return axiomFromText(item);
      if (item && typeof item === "object") {
        const record = item as JsonRecord;
        return {
          name: asText(record.name),
          summary: cleanAxiomSummary(asText(record.summary)),
          cost: asText(record.cost),
          boundary: asText(record.boundary),
          enforcement: asText(record.enforcement),
        };
      }
      return null;
    })
    .filter((item): item is Axiom => Boolean(item));
}

function normalizeWorld(raw: JsonRecord | null | undefined, fallback?: NovelDetail) {
  const structure = parseJson<JsonRecord>(raw?.structureJson, {});
  const axiomSource = parseJson<unknown>(raw?.axioms, raw?.axioms);
  const axioms = normalizeAxioms(axiomSource);
  const locations = Array.isArray(structure.locations)
    ? structure.locations.map((location: JsonRecord): Location => ({
        name: asText(location.name),
        terrain: asText(location.terrain),
        summary: asText(location.summary),
        narrativeFunction: asText(location.narrativeFunction),
        risk: asText(location.risk),
      }))
    : fallback?.world.locations || [];
  const factions = Array.isArray(structure.factions)
    ? structure.factions.map((faction: JsonRecord): Faction => ({
        name: asText(faction.name),
        position: asText(faction.position),
        goals: Array.isArray(faction.goals) ? faction.goals.filter(Boolean) : [],
      }))
    : fallback?.world.factions || [];
  const forces = Array.isArray(structure.forces)
    ? structure.forces.map((force: JsonRecord): Force => ({
        name: asText(force.name),
        type: asText(force.type),
        summary: asText(force.summary),
        objective: asText(force.currentObjective),
      }))
    : fallback?.world.forces || [];

  return {
    name: asText(raw?.name) || fallback?.world.name || null,
    type: asText(raw?.worldType) || fallback?.world.type || null,
    description: asText(raw?.description) || fallback?.world.description || null,
    overviewSummary:
      asText(raw?.overviewSummary) || fallback?.world.overviewSummary || null,
    geography: asText(raw?.geography) || fallback?.world.geography || null,
    politics: asText(raw?.politics) || fallback?.world.politics || null,
    conflicts: asText(raw?.conflicts) || fallback?.world.conflicts || null,
    axioms: axioms.length ? axioms : fallback?.world.axioms || [],
    locations,
    factions,
    forces,
  };
}

function normalizeContract(
  raw: JsonRecord | null | undefined,
  fallback?: NovelDetail
): BookContract {
  return {
    readingPromise:
      asText(raw?.readingPromise) || fallback?.bookContract.readingPromise || null,
    protagonistFantasy:
      asText(raw?.protagonistFantasy) ||
      fallback?.bookContract.protagonistFantasy ||
      null,
    coreSellingPoint:
      asText(raw?.coreSellingPoint) ||
      fallback?.bookContract.coreSellingPoint ||
      null,
    chapter3Payoff:
      asText(raw?.chapter3Payoff) || fallback?.bookContract.chapter3Payoff || null,
    chapter10Payoff:
      asText(raw?.chapter10Payoff) ||
      fallback?.bookContract.chapter10Payoff ||
      null,
    chapter30Payoff:
      asText(raw?.chapter30Payoff) ||
      fallback?.bookContract.chapter30Payoff ||
      null,
    escalationLadder:
      asText(raw?.escalationLadder) ||
      fallback?.bookContract.escalationLadder ||
      null,
  };
}

function normalizeDetail(
  raw: JsonRecord,
  chaptersRaw: unknown,
  fallback?: NovelDetail
): NovelDetail {
  const summary = normalizeSummary(raw, fallback);
  const chapters = normalizeChapters(
    chaptersRaw,
    fallback?.chapters || normalizeChapters(raw.chapters, [])
  );
  const readable = chapters.filter(isChapterReadable);
  const totalWords = readable.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  const estimated = asNumber(
    raw.estimatedChapterCount,
    fallback?.estimatedChapterCount || 80
  );

  return {
    ...summary,
    counts: {
      ...summary.counts,
      chapters: chapters.length || summary.counts.chapters,
    },
    progress: {
      writtenChapters: readable.length,
      targetChapters: estimated,
    },
    stats: {
      readableChapters: readable.length,
      chapterCount: chapters.length,
      totalWords: totalWords || fallback?.stats.totalWords || 0,
    },
    targetAudience:
      asText(raw.targetAudience) || fallback?.targetAudience || null,
    writingMode: asText(raw.writingMode) || fallback?.writingMode || null,
    narrativeForm:
      asText(raw.narrativeForm) || fallback?.narrativeForm || null,
    narrativePov: asText(raw.narrativePov) || fallback?.narrativePov || null,
    pacePreference:
      asText(raw.pacePreference) || fallback?.pacePreference || null,
    emotionIntensity:
      asText(raw.emotionIntensity) || fallback?.emotionIntensity || null,
    estimatedChapterCount: estimated,
    defaultChapterLength: asNumber(
      raw.defaultChapterLength,
      fallback?.defaultChapterLength || 0
    ),
    world: normalizeWorld(raw.world, fallback),
    characters: normalizeCharacters(raw.characters, fallback?.characters),
    volumes: normalizeVolumes(raw.volumes, fallback?.volumes),
    bookContract: normalizeContract(raw.bookContract, fallback),
    chapters,
  };
}

function snapshotWorksPayload(): WorksPayload {
  return {
    works: [...snapshot.works].sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    ),
    origin: "snapshot",
    syncedAt: snapshot.generatedAt,
  };
}

export async function loadWorks(force = false): Promise<WorksPayload> {
  await loadSnapshot(force);
  if (!force && worksCache && Date.now() - worksCache.at < CACHE_TTL) {
    return worksCache.value;
  }
  try {
    const data = await apiGet<{ items?: JsonRecord[] }>("/novels?limit=100");
    if (!Array.isArray(data.items)) throw new Error("Unexpected works response");
    const works = data.items
      .map((item) =>
        normalizeSummary(item, fallbackFor(asText(item.id) || "") as NovelDetail)
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime()
      );
    const value: WorksPayload = {
      works,
      origin: "live",
      syncedAt: new Date().toISOString(),
    };
    worksCache = { value, at: Date.now() };
    return value;
  } catch {
    const value = snapshotWorksPayload();
    worksCache = { value, at: Date.now() };
    return value;
  }
}

export async function loadNovel(
  id: string,
  force = false
): Promise<NovelPayload | null> {
  await loadSnapshot(force);
  const cached = novelCache.get(id);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.value;
  }
  const fallback = fallbackFor(id);
  try {
    const detailRaw = await apiGet<JsonRecord>(`/novels/${encodeURIComponent(id)}`);
    let chapterRaw: unknown = detailRaw.chapters;
    try {
      chapterRaw = await apiGet<JsonRecord[]>(
        `/novels/${encodeURIComponent(id)}/chapters`
      );
    } catch {
      // The detail payload usually carries the chapter list as a fallback.
    }
    const novel = normalizeDetail(
      detailRaw,
      chapterRaw,
      fallback as NovelDetail | undefined
    );
    const value: NovelPayload = {
      novel,
      origin: "live",
      syncedAt: new Date().toISOString(),
    };
    novelCache.set(id, { value, at: Date.now() });
    return value;
  } catch {
    if (!fallback) return null;
    return {
      novel: fallback,
      origin: "snapshot",
      syncedAt: snapshot.generatedAt,
    };
  }
}

export async function checkStudio(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as ApiEnvelope<{ status?: string }>;
      return payload.success !== false && payload.data?.status === "ok";
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
