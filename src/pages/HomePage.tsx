import { StudioLink } from '../components/StudioLink';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BNS_STUDIO_URL, COVER_IMAGES } from "../config";
import { useDocumentTitle, useStudioStatus, useWorks } from "../hooks";
import type { NovelSummary } from "../types";
import {
  cn,
  formatNumber,
  formatRelativeDate,
  workHref,
} from "../utils";
import { Cover } from "../components/Cover";
import { Footer } from "../components/Footer";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { WorkCard } from "../components/WorkCard";

const PROCESS_STEPS = [
  {
    index: "01",
    en: "WORLD",
    title: "先造一个世界",
    copy: "规则、势力、地理与代价。故事的可信度，从第一块基石开始。",
  },
  {
    index: "02",
    en: "CAST",
    title: "再让角色入场",
    copy: "欲望、恐惧、秘密与关系。每个人物都带着自己的引力。",
  },
  {
    index: "03",
    en: "STRUCTURE",
    title: "把冲突搭成骨架",
    copy: "分卷、章节、钩子与回报。长篇的节奏，被精确地编排。",
  },
  {
    index: "04",
    en: "DRAFT",
    title: "最后，让文字发生",
    copy: "从章节任务书到正文，AI 持续写作，创作者持续掌舵。",
  },
];

function HeroStage({ work }: { work: NovelSummary }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty("--tilt-y", `${x * 7}deg`);
        node.style.setProperty("--tilt-x", `${y * -6}deg`);
        node.style.setProperty("--shift-x", `${x * 14}px`);
        node.style.setProperty("--shift-y", `${y * 10}px`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--tilt-y", "0deg");
      node.style.setProperty("--tilt-x", "0deg");
      node.style.setProperty("--shift-x", "0px");
      node.style.setProperty("--shift-y", "0px");
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="hero-stage" ref={ref}>
      <div
        className="hero-stage__glow"
        style={{
          backgroundImage: `url(${COVER_IMAGES[work.coverKey] || COVER_IMAGES.frontier})`,
        }}
        aria-hidden="true"
      />
      <span className="hero-orbit hero-orbit--one" aria-hidden="true" />
      <span className="hero-orbit hero-orbit--two" aria-hidden="true" />
      <Link to={workHref(work)} className="hero-stage__cover" aria-label={`查看《${work.title}》`}>
        <Cover work={work} size="hero" index={0} eager />
      </Link>
      <div className="hero-stage__caption">
        <span className="hero-stage__caption-label">本期焦点 · FEATURED</span>
        <Link to={workHref(work)}>
          <h2>{work.title}</h2>
        </Link>
        <p>
          {work.genre.name} · {work.stats.chapterCount} 章规划 ·{" "}
          {work.stats.readableChapters} 章可读
        </p>
      </div>
      <div className="hero-seal" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <defs>
            <path
              id="seal-circle"
              d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"
            />
          </defs>
          <text>
            <textPath href="#seal-circle">
              BIZ NOVEL STUDIO · GENERATED WORKS ·&nbsp;
            </textPath>
          </text>
        </svg>
        <span>叙</span>
      </div>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle("作品馆");
  const { works, origin, syncedAt } = useWorks();
  const online = useStudioStatus();
  const [genre, setGenre] = useState("全部");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const featured = works[0];

  const genres = useMemo(
    () => ["全部", ...Array.from(new Set(works.map((work) => work.genre.name)))],
    [works]
  );

  useEffect(() => {
    if (!genres.includes(genre)) setGenre("全部");
  }, [genre, genres]);

  const filtered = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    return works.filter((work) => {
      const inGenre = genre === "全部" || work.genre.name === genre;
      const inSearch =
        !keyword ||
        [work.title, work.description, work.genre.name, work.bookSellingPoint]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return inGenre && inSearch;
    });
  }, [deferredQuery, genre, works]);

  const readableCount = works.reduce(
    (sum, work) => sum + work.stats.readableChapters,
    0
  );
  const characterCount = works.reduce(
    (sum, work) => sum + work.counts.characters,
    0
  );
  const plannedChapters = works.reduce(
    (sum, work) => sum + Math.max(work.counts.chapters, work.progress.targetChapters || 0),
    0
  );

  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-noise" aria-hidden="true" />
          <div className="shell hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span className="hero-kicker__line" />
                <span>AI-NATIVE FICTION ARCHIVE</span>
                <span className="hero-kicker__year">2026</span>
              </div>
              <h1 className="hero-title">
                <span>故事，</span>
                <em>正在生成。</em>
              </h1>
              <p className="hero-lede">
                这里是 <strong>Biz Novel Studio</strong> 的作品陈列室。
                从一句灵感，到一整个世界，再到正在生长的章节——
                每一部作品，都是人机共写的另一种可能。
              </p>
              <div className="hero-actions">
                {featured && (
                  <Link className="button button--solid" to={workHref(featured)}>
                    走进本期作品
                    <ArrowUpRight size={17} strokeWidth={1.7} />
                  </Link>
                )}
                <a className="button button--ghost" href="#works">
                  浏览全部作品
                  <span className="button__count">{String(works.length).padStart(2, "0")}</span>
                </a>
              </div>
              <dl className="hero-stats">
                <div>
                  <dt>作品</dt>
                  <dd>{String(works.length).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>可读章节</dt>
                  <dd>{String(readableCount).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>登场角色</dt>
                  <dd>{String(characterCount).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>故事世界</dt>
                  <dd>{String(works.filter((work) => work.world.name).length).padStart(2, "0")}</dd>
                </div>
              </dl>
            </div>
            {featured && <HeroStage work={featured} />}
          </div>
          <div className="hero-scroll">
            <a href="#works" aria-label="向下浏览作品">
              <span>SCROLL TO EXPLORE</span>
              <ArrowDown size={15} />
            </a>
          </div>
          <div className="hero-marquee" aria-hidden="true">
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i}>
                  AI-NATIVE FICTION <i>✦</i> WORLD BUILDING <i>✦</i> CHARACTER SYSTEM{" "}
                  <i>✦</i> LONG-FORM NARRATIVE <i>✦</i>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="works-section" id="works">
          <div className="shell">
            <SectionHeading
              index="01"
              kicker="THE COLLECTION / 作品陈列"
              title="正在生长的故事"
              copy="每一部作品都实时同步自 Biz Novel Studio。阅读已完成的章节，或见证一个世界从草稿开始成形。"
              aside={
                <div className="sync-note">
                  <span className={cn("sync-dot", online === false && "is-offline")} />
                  <div>
                    <strong>
                      {origin === "live" ? "实时数据" : "本地快照"}
                      <span> / </span>
                      {online === false ? "创作台离线" : "创作台在线"}
                    </strong>
                    <span>上次同步 {formatRelativeDate(syncedAt)}</span>
                  </div>
                </div>
              }
            />

            <div className="works-toolbar">
              <div className="filter-pills" role="group" aria-label="按题材筛选">
                {genres.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={cn("filter-pill", genre === item && "is-active")}
                    onClick={() => setGenre(item)}
                  >
                    {item}
                    <span>
                      {item === "全部"
                        ? works.length
                        : works.filter((work) => work.genre.name === item).length}
                    </span>
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Search size={16} strokeWidth={1.6} />
                <span className="sr-only">搜索作品</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索标题、题材或故事…"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">
                    <X size={14} />
                  </button>
                )}
              </label>
            </div>

            {filtered.length > 0 ? (
              <div className="works-grid">
                {filtered.map((work, index) => (
                  <Reveal key={work.id} delay={index * 90} as="div">
                    <WorkCard work={work} index={index} offset={index === 1} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="works-empty">
                <Sparkles size={24} strokeWidth={1.2} />
                <h3>还没有匹配的故事</h3>
                <p>当前没有可阅读的上架作品，或没有符合筛选条件的作品。</p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setQuery("");
                    setGenre("全部");
                  }}
                >
                  清除筛选 <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div className="works-footnote">
              <p>
                <span>NOTE</span>
                作品按最近更新时间排序，仅展示管理员已上架且对当前账户可见的作品。
              </p>
              <span>{String(works.length).padStart(2, "0")} WORKS IN PROGRESS</span>
            </div>
          </div>
        </section>

        <section className="manifesto">
          <div className="shell">
            <Reveal>
              <p className="eyebrow">A NOTE ON MAKING</p>
              <blockquote>
                “人类决定故事要去哪里，
                <br />
                <em>AI 负责把沿途的风景全部写出来。</em>”
              </blockquote>
              <p className="manifesto__foot">
                叙章不生产故事。我们只是把创作台里正在发生的事，认真地陈列出来。
              </p>
            </Reveal>
          </div>
          <span className="manifesto__glyph" aria-hidden="true">
            叙
          </span>
        </section>

        <section className="studio-section" id="studio">
          <div className="shell">
            <SectionHeading
              index="02"
              kicker="INSIDE THE STUDIO / 创作现场"
              title="一部作品，这样被生成"
              copy="Biz Novel Studio 把长篇创作拆成可协作、可追踪的工序。以下每一个环节，最终都会沉淀为你在作品馆里读到的文字。"
              aside={
                <StudioLink className="text-link" href={BNS_STUDIO_URL} target="_blank" rel="noreferrer">
                  打开创作台 <ArrowUpRight size={14} />
                </StudioLink>
              }
            />
            <div className="studio-grid">
              <Reveal className="studio-lead">
                <span className="studio-lead__index">PIPELINE / 04 STEPS</span>
                <h3>
                  从世界观到正文，
                  <br />
                  <em>每一步都可被看见。</em>
                </h3>
                <p>
                  不是一次性的“生成一篇文章”，而是一套持续运转的长篇生产系统。
                  创作者设定方向，Agent 推进工序，作品在迭代中逐渐成形。
                </p>
                <div className="studio-live-card">
                  <div className="studio-live-card__top">
                    <span className={cn("sync-dot", online === false && "is-offline")} />
                    <strong>{online === false ? "快照预览中" : "创作台实时联动"}</strong>
                    <span>LIVE</span>
                  </div>
                  <dl>
                    <div>
                      <dt>作品</dt>
                      <dd>{formatNumber(works.length)}</dd>
                    </div>
                    <div>
                      <dt>角色</dt>
                      <dd>{formatNumber(characterCount)}</dd>
                    </div>
                    <div>
                      <dt>章节规划</dt>
                      <dd>{formatNumber(plannedChapters)}</dd>
                    </div>
                    <div>
                      <dt>已生成</dt>
                      <dd>{formatNumber(readableCount)}</dd>
                    </div>
                  </dl>
                  <code>GET /api/novels</code>
                </div>
              </Reveal>
              <ol className="process-list">
                {PROCESS_STEPS.map((step, index) => (
                  <Reveal as="li" key={step.index} delay={index * 80} className="process-item">
                    <span className="process-item__index">{step.index}</span>
                    <div>
                      <span className="process-item__en">{step.en}</span>
                      <h4>{step.title}</h4>
                      <p>{step.copy}</p>
                    </div>
                    <ArrowRight size={17} strokeWidth={1.3} />
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="shell closing__inner">
            <p className="eyebrow">THE NEXT CHAPTER</p>
            <h2>
              下一部故事，
              <br />
              <em>等你开场。</em>
            </h2>
            <p className="closing__copy">
              在 Biz Novel Studio 写下一个世界，由管理员决定何时上架、向谁开放。
            </p>
            <div className="closing__actions">
              <StudioLink className="button button--solid" href={BNS_STUDIO_URL} target="_blank" rel="noreferrer">
                打开 Biz Novel Studio
                <ArrowUpRight size={17} />
              </StudioLink>
              <Link className="button button--ghost" to="/about">
                了解联动方式
              </Link>
            </div>
            <div className="closing__meta">
              <span>REAL-TIME SYNC</span>
              <span>·</span>
              <span>{works.length} STORIES AND COUNTING</span>
            </div>
          </div>
          <span className="closing__word" aria-hidden="true">
            STORIES
          </span>
        </section>
      </main>
      <Footer />
    </>
  );
}
