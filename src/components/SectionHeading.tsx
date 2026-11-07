import type { ReactNode } from "react";
import { cn } from "../utils";

export function SectionHeading({
  index,
  kicker,
  title,
  copy,
  aside,
  className,
}: {
  index: string;
  kicker: string;
  title: string;
  copy?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("section-heading", className)}>
      <div className="section-heading__index">
        <span>{index}</span>
        <span className="section-heading__line" />
      </div>
      <div className="section-heading__main">
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
        {copy && <p className="section-heading__copy">{copy}</p>}
      </div>
      {aside && <div className="section-heading__aside">{aside}</div>}
    </div>
  );
}
