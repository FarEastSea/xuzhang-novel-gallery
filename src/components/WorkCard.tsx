import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { NovelSummary } from "../types";
import { cn, formatRelativeDate, workHref } from "../utils";
import { Cover, CoverBadge } from "./Cover";

export function WorkCard({
  work,
  index,
  offset = false,
}: {
  work: NovelSummary;
  index: number;
  offset?: boolean;
}) {
  const readable = work.stats.readableChapters > 0;
  return (
    <article className={cn("work-card", offset && "work-card--offset")}>
      <Link to={workHref(work)} className="work-card__link" aria-label={`查看《${work.title}》`}>
        <div className="work-card__visual">
          <Cover work={work} size="card" index={index} />
          <CoverBadge readable={readable} />
          <span className="work-card__open" aria-hidden="true">
            <ArrowUpRight size={20} strokeWidth={1.4} />
          </span>
        </div>
        <div className="work-card__meta">
          <div className="work-card__eyebrow">
            <span>{work.genre.name}</span>
            <span>{formatRelativeDate(work.updatedAt)}</span>
          </div>
          <h3 className="work-card__title">{work.title}</h3>
          <p className="work-card__desc">{work.description}</p>
          <div className="work-card__footer">
            <span>
              {work.stats.chapterCount || 0} 章规划 · {work.counts.characters} 位角色
            </span>
            <span className="work-card__time">
              {readable ? `${work.stats.readableChapters} 章可读` : "IN PROGRESS"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
