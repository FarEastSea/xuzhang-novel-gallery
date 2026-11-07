export interface Genre {
  id: string;
  name: string;
  description?: string | null;
}

export interface WorldSummary {
  name: string | null;
  type: string | null;
  description: string | null;
}

export interface WorkStats {
  readableChapters: number;
  chapterCount: number;
  totalWords: number;
}

export interface WorkProgress {
  writtenChapters: number;
  targetChapters: number;
}

export interface Counts {
  chapters: number;
  characters: number;
  plotBeats: number;
}

export interface NovelSummary {
  id: string;
  title: string;
  description: string;
  genre: Genre;
  status: string;
  projectStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
  bookSellingPoint: string;
  first30ChapterPromise: string;
  coverKey: string;
  workspaceSourceRoute: string | null;
  counts: Counts;
  progress: WorkProgress;
  stats: WorkStats;
  world: WorldSummary;
}

export interface Character {
  id: string | null;
  name: string;
  role: string | null;
  castRole: string | null;
  identityLabel: string | null;
  personality: string | null;
  background: string | null;
  currentGoal: string | null;
  powerLevel: string | null;
  firstImpression: string | null;
  relationToProtagonist: string | null;
  stanceLabel: string | null;
}

export interface Volume {
  id: string | null;
  sortOrder: number;
  title: string;
  summary: string | null;
  openingHook: string | null;
  mainPromise: string | null;
  climax: string | null;
  payoffType: string | null;
  status: string | null;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  chapterStatus: string;
  generationState: string;
  chapterSummary: string | null;
  targetWordCount: number | null;
  wordCount: number;
  content: string;
}

export interface Axiom {
  name: string | null;
  summary: string | null;
  cost?: string | null;
  boundary?: string | null;
  enforcement?: string | null;
}

export interface Location {
  name: string | null;
  terrain: string | null;
  summary: string | null;
  narrativeFunction: string | null;
  risk: string | null;
}

export interface Faction {
  name: string | null;
  position: string | null;
  goals: string[];
}

export interface Force {
  name: string | null;
  type: string | null;
  summary: string | null;
  objective: string | null;
}

export interface WorldDetail extends WorldSummary {
  overviewSummary: string | null;
  geography: string | null;
  politics: string | null;
  conflicts: string | null;
  axioms: Axiom[];
  locations: Location[];
  factions: Faction[];
  forces: Force[];
}

export interface BookContract {
  readingPromise?: string | null;
  protagonistFantasy?: string | null;
  coreSellingPoint?: string | null;
  chapter3Payoff?: string | null;
  chapter10Payoff?: string | null;
  chapter30Payoff?: string | null;
  escalationLadder?: string | null;
}

export interface NovelDetail extends NovelSummary {
  targetAudience: string | null;
  writingMode: string | null;
  narrativeForm: string | null;
  narrativePov: string | null;
  pacePreference: string | null;
  emotionIntensity: string | null;
  estimatedChapterCount: number | null;
  defaultChapterLength: number | null;
  world: WorldDetail;
  characters: Character[];
  volumes: Volume[];
  bookContract: BookContract;
  chapters: Chapter[];
}

export interface Snapshot {
  generatedAt: string;
  source: string;
  works: NovelDetail[];
}

export type DataOrigin = "live" | "snapshot";

export interface WorksPayload {
  works: NovelSummary[];
  origin: DataOrigin;
  syncedAt: string;
}

export interface NovelPayload {
  novel: NovelDetail;
  origin: DataOrigin;
  syncedAt: string;
}
