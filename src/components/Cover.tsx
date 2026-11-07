import { BookOpen, Sparkles } from "lucide-react";
import { COVER_IMAGES } from "../config";
import type { NovelSummary } from "../types";
import { cn, splitTitle } from "../utils";

interface CoverProps {
  work: Pick<NovelSummary, "title" | "genre" | "coverKey">;
  size?: "hero" | "card" | "detail" | "mini";
  index?: number;
  className?: string;
  eager?: boolean;
}

export function Cover({
  work,
  size = "card",
  index,
  className,
  eager = false,
}: CoverProps) {
  const image = COVER_IMAGES[work.coverKey] || COVER_IMAGES.frontier;
  const { main, sub } = splitTitle(work.title);
  return (
    <figure
      className={cn("book-cover", `book-cover--${size}`, className)}
      aria-label={`${work.title} 概念封面`}
    >
      <img
        className="book-cover__image"
        src={image}
        alt=""
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        draggable={false}
      />
      <span className="book-cover__wash" aria-hidden="true" />
      <span className="book-cover__grain" aria-hidden="true" />
      <span className="book-cover__top">
        <span>BIZ NOVEL STUDIO</span>
        {typeof index === "number" && (
          <span className="book-cover__index">N° {String(index + 1).padStart(2, "0")}</span>
        )}
      </span>
      <span className="book-cover__side" aria-hidden="true">
        叙章 · AI FICTION
      </span>
      <figcaption className="book-cover__title">
        <span className="book-cover__genre">{work.genre.name}</span>
        <strong>{main}</strong>
        {sub && <span className="book-cover__sub">{sub}</span>}
      </figcaption>
      <span className="book-cover__seal" aria-hidden="true">
        叙
      </span>
    </figure>
  );
}

export function CoverBadge({ readable }: { readable: boolean }) {
  return (
    <span className={cn("cover-badge", !readable && "cover-badge--muted")}>
      {readable ? <BookOpen size={12} /> : <Sparkles size={12} />}
      {readable ? "可阅读" : "构思中"}
    </span>
  );
}
