import type { Chapter, NovelSummary } from "./types";

export function splitTitle(title: string): { main: string; sub: string } {
  const parts = title.split(/[：:，,]/);
  const main = (parts.shift() || title).trim();
  const sub = parts.join("，").trim();
  return { main, sub };
}

export function coverKeyFor(
  id: string,
  genreId = "",
  title = ""
): string {
  if (/乡村|悬疑|科幻|都市|异能|现实|科幻/i.test(genreId + title)) {
    if (/边陲|军需|西幻|魔幻|神谕|圣骑|仙侠|玄幻/i.test(title)) {
      // A western-fantasy title can deliberately reuse a strong visual.
    } else {
      return "contract";
    }
  }
  if (/都市|异能|赛博|contract/i.test(genreId)) return "contract";
  if (/边陲|军需|frontier/i.test(title)) return "frontier";
  if (/神谕|圣骑|oracle/i.test(title)) return "oracle";
  const hash = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? "oracle" : "frontier";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1).replace(/\.0$/, "")}万`;
  }
  return formatNumber(value);
}

export function formatWords(value: number): string {
  if (!value) return "待生成";
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1).replace(/\.0$/, "")} 万字`;
  }
  return `${formatNumber(value)} 字`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\//g, ".");
}

export function formatRelativeDate(value: string | null | undefined): string {
  if (!value) return "刚刚";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "刚刚";
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚更新";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(value);
}

export function readingMinutes(words: number): number {
  if (!words) return 0;
  return Math.max(1, Math.round(words / 350));
}

export function isChapterReadable(chapter: Chapter): boolean {
  return (chapter.content || "").trim().length > 200;
}

export function readableChapters(chapters: Chapter[]): Chapter[] {
  return chapters.filter(isChapterReadable);
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "创作中",
    published: "已发布",
    completed: "已完结",
    archived: "已归档",
    not_started: "待开场",
    in_progress: "进行中",
  };
  return labels[status] || status || "创作中";
}

export function projectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: "草稿阶段",
    in_progress: "连载中",
    completed: "已完结",
    paused: "已暂停",
  };
  return labels[status] || status || "草稿阶段";
}

export function percent(current: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

export function workHref(work: Pick<NovelSummary, "id">): string {
  return `/novels/${work.id}`;
}

export function chapterHref(novelId: string, chapterId: string): string {
  return `/read/${novelId}/${chapterId}`;
}

export function studioHref(novelId: string | null | undefined): string {
  return novelId ? '/api/studio?novel=' + encodeURIComponent(novelId) : '/api/studio';
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function sectionParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function textOr(
  value: string | null | undefined,
  fallback: string | null | undefined = "尚未记录"
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback || "尚未记录";
}

export function initials(name: string): string {
  return Array.from(name.trim())[0] || "?";
}
