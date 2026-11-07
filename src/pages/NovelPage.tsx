import { StudioLink } from '../components/StudioLink';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  Copy,
  Feather,
  Layers3,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { COVER_IMAGES } from "../config";
import {
  getReadingProgress,
  useDocumentTitle,
  useNovel,
} from "../hooks";
import type { Chapter, NovelDetail } from "../types";
import {
  chapterHref,
  cn,
  formatDate,
  formatNumber,
  formatRelativeDate,
  formatWords,
  isChapterReadable,
  percent,
  projectStatusLabel,
  readingMinutes,
  statusLabel,
  studioHref,
  textOr,
  workHref,
} from "../utils";
import { Cover } from "../components/Cover";
import { Footer } from "../components/Footer";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

const POV_LABELS: Record<string, string> = {
  third_person: "第三人称",
  first_person: "第一人称",
  multi_pov: "多视角",
};

const PACE_LABELS: Record<string, string> = {
  fast: "快节奏",
  balanced: "张弛有度",
  slow: "慢热铺陈",
};

const WRITING_MODE_LABELS: Record<string, string> = {
  original: "原创",
  continuation: "续写",
  adaptation: "改编",
};

const CAST_LABELS: Record<string, string> = {
  protagonist: "主角",
  antagonist: "对手",
  supporting: "配角",
  mentor: "引路人",
};

function ChapterRow({
  chapter,
  novelId,
  index,
}: {
  chapter: Chapter;
  novelId: string;
  index: number;
}) {
  const readable = isChapterReadable(chapter);
  const content = (
    <>
      <span className="chapter-row__number">{String(index + 1).padStart(2, "0")}</span>
      <span className="chapter-row__body">
        <span className="chapter-row__title">{chapter.title}</span>
        <span className="chapter-row__summary">
          {chapter.chapterSummary ||
            (readable
              ? "本章已生成，点击进入阅读。"
              : "章节大纲已就位，等待创作台继续生成正文。")}
        </span>
      </span>
      <span className="chapter-row__meta">
        {readable ? (
          <>
            <span>{formatNumber(chapter.wordCount)} 字</span>
            <span>{readingMinutes(chapter.wordCount)} 分钟</span>
          </>
        ) : (
          <span className="chapter-row__pending">
            <Sparkles size={12} />
            创作中
          </span>
        )}
      </span>
      <span className="chapter-row__arrow" aria-hidden="true">
        {readable ? <ArrowUpRight size={16} /> : <span />}
      </span>
    </>
  );

  return (
    <li className={cn("chapter-row", !readable && "is-pending")}>
      {readable ? (
        <Link to={chapterHref(novelId, chapter.id)} aria-label={`阅读第 ${index + 1} 章 ${chapter.title}`}>
          {content}
        </Link>
      ) : (
        <div aria-disabled="true">{content}</div>
      )}
    </li>
  );
}

function NovelAside({
  novel,
  origin,
  syncedAt,
  readableCount,
}: {
  novel: NovelDetail;
  origin: string;
  syncedAt: string;
  readableCount: number;
}) {
  const items = [
    ["作品状态", statusLabel(novel.status)],
    ["题材", novel.genre.name],
    ["叙事视角", POV_LABELS[novel.narrativePov || ""] || "第三人称"],
    ["叙事节奏", PACE_LABELS[novel.pacePreference || ""] || "张弛有度"],
    ["章节进度", `${readableCount} / ${novel.stats.chapterCount || novel.progress.targetChapters}`],
    ["角色", `${novel.characters.length} 位`],
    ["最近更新", formatDate(novel.updatedAt)],
  ];
  return (
    <aside className="novel-aside">
      <div className="aside-panel">
        <span className="aside-panel__label">AT A GLANCE</span>
        <h3>本书速览</h3>
        <dl>
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <nav className="aside-panel aside-nav" aria-label="本页导航">
        <span className="aside-panel__label">ON THIS PAGE</span>
        <a href="#story">故事内核</a>
        <a href="#world">世界切片</a>
        <a href="#characters">人物谱</a>
        <a href="#volumes">分卷结构</a>
        <a href="#chapters">章节目录</a>
      </nav>
      <div className="aside-panel aside-source">
        <span className="aside-panel__label">DATA SOURCE</span>
        <h3>{origin === "live" ? "实时同步中" : "本地快照"}</h3>
        <p>
          作品数据读取自 Biz Novel Studio。
          <br />
          上次同步：{formatRelativeDate(syncedAt)}
        </p>
        <code>GET /api/novels/{novel.id}</code>
        <StudioLink href={studioHref(novel.id)} target="_blank" rel="noreferrer">
          在创作台打开
          <ArrowUpRight size={13} />
        </StudioLink>
      </div>
    </aside>
  );
}

export function NovelPage() {
  const { id } = useParams<{ id: string }>();
  const state = useNovel(id);
  const novel = state?.novel;
  const [copied, setCopied] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);

  useDocumentTitle(novel?.title);

  useEffect(() => {
    if (!id) return;
    setResumeId(getReadingProgress(id));
  }, [id]);

  const readable = useMemo(
    () => (novel ? novel.chapters.filter(isChapterReadable) : []),
    [novel]
  );

  useEffect(() => {
    if (!novel) return;
    const previous = document.body.dataset.page;
    document.body.dataset.page = "novel";
    return () => {
      if (previous) document.body.dataset.page = previous;
      else delete document.body.dataset.page;
    };
  }, [novel]);

  if (!state || (!novel && state.loading)) {
    return (
      <main className="loading-page">
        <div className="loading-page__mark">叙</div>
        <p>正在从创作台取回作品…</p>
      </main>
    );
  }

  if (!novel || state.notFound) {
    return (
      <>
        <main className="not-found-page">
          <span className="eyebrow">404 / STORY NOT FOUND</span>
          <h1>这一页，还没有被写下。</h1>
          <p>作品可能仍在创作台中，或者链接已经失效。</p>
          <div className="not-found-page__actions">
            <Link className="button button--solid" to="/">
              <ArrowLeft size={16} />
              返回作品馆
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const resumeChapter = resumeId
    ? readable.find((chapter) => chapter.id === resumeId)
    : null;
  const firstChapter = resumeChapter || readable[0];
  const cover = COVER_IMAGES[novel.coverKey] || COVER_IMAGES.frontier;
  const progress = percent(readable.length, novel.stats.chapterCount);
  const studioUrl = studioHref(novel.id);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <main className="novel-page">
        <section className="novel-hero">
          <div
            className="novel-hero__ambient"
            style={{ backgroundImage: `url(${cover})` }}
            aria-hidden="true"
          />
          <div className="novel-hero__veil" aria-hidden="true" />
          <div className="shell">
            <nav className="breadcrumb" aria-label="面包屑">
              <Link to="/">
                <ArrowLeft size={13} />
                作品馆
              </Link>
              <span>/</span>
              <span>{novel.genre.name}</span>
              <span>/</span>
              <span className="breadcrumb__current">{novel.title}</span>
            </nav>
            <div className="novel-intro">
              <div className="novel-cover-block">
                <Cover work={novel} size="detail" index={0} eager />
                <span className="novel-cover-block__caption">CONCEPT COVER · 概念封面</span>
              </div>
              <div className="novel-intro__copy">
                <div className="novel-kicker">
                  <span>WORK / {novel.genre.name}</span>
                  <span className="novel-kicker__line" />
                  <span className="novel-kicker__status">
                    <span className="sync-dot" />
                    {statusLabel(novel.status)}
                  </span>
                </div>
                <h1>{novel.title}</h1>
                <p className="novel-lede">{novel.description}</p>
                <div className="novel-actions">
                  {firstChapter ? (
                    <Link
                      className="button button--solid"
                      to={chapterHref(novel.id, firstChapter.id)}
                    >
                      <BookOpen size={16} strokeWidth={1.7} />
                      {resumeChapter ? "继续阅读" : "开始阅读"}
                      <span className="button__sub">第 {readable.indexOf(firstChapter) + 1} 章</span>
                    </Link>
                  ) : (
                    <StudioLink className="button button--solid" href={studioUrl} target="_blank" rel="noreferrer">
                      <Sparkles size={16} />
                      在创作台查看
                    </StudioLink>
                  )}
                  <StudioLink className="button button--ghost" href={studioUrl} target="_blank" rel="noreferrer">
                    创作台工作区
                    <ArrowUpRight size={15} />
                  </StudioLink>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={copyLink}
                    aria-label="复制作品链接"
                    title={copied ? "已复制" : "复制作品链接"}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="novel-progress">
                  <div className="novel-progress__top">
                    <span>创作进度</span>
                    <span>
                      {readable.length} / {novel.stats.chapterCount || novel.progress.targetChapters} 章
                    </span>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label="章节创作进度"
                  >
                    <span style={{ width: `${Math.max(progress, 2)}%` }} />
                  </div>
                  <div className="novel-progress__foot">
                    <span>{projectStatusLabel(novel.projectStatus)}</span>
                    <span>目标 {novel.progress.targetChapters} 章</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="novel-meta-strip">
              <div>
                <span>GENRE</span>
                <strong>{novel.genre.name}</strong>
              </div>
              <div>
                <span>WORLD</span>
                <strong>{textOr(novel.world.name, "未命名世界")}</strong>
              </div>
              <div>
                <span>POV</span>
                <strong>{POV_LABELS[novel.narrativePov || ""] || "第三人称"}</strong>
              </div>
              <div>
                <span>MODE</span>
                <strong>{WRITING_MODE_LABELS[novel.writingMode || ""] || "原创"}</strong>
              </div>
              <div>
                <span>WORDS</span>
                <strong>{formatWords(novel.stats.totalWords)}</strong>
              </div>
              <div>
                <span>UPDATED</span>
                <strong>{formatDate(novel.updatedAt)}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="shell novel-layout">
          <div className="novel-main">
            <Reveal>
              <section className="novel-block" id="story">
                <SectionHeading
                  index="01"
                  kicker="THE CORE / 故事内核"
                  title="它想给读者什么"
                />
                <div className="story-pullquote">
                  <span className="story-pullquote__mark">“</span>
                  <p>
                    {textOr(
                      novel.bookContract.readingPromise || novel.bookSellingPoint,
                      "这部作品还没有写下自己的创作承诺。"
                    )}
                  </p>
                  <span className="story-pullquote__label">READER'S PROMISE</span>
                </div>
                <div className="story-grid">
                  <article className="story-card story-card--wide">
                    <span className="story-card__label">STORY / 故事梗概</span>
                    <h3>{novel.genre.name} · {textOr(novel.world.name, "未知世界")}</h3>
                    <p>{novel.description}</p>
                  </article>
                  <article className="story-card">
                    <span className="story-card__label">FIRST 30 / 前三十章</span>
                    <p>
                      {textOr(
                        novel.first30ChapterPromise ||
                          novel.bookContract.chapter30Payoff,
                        "前三十章的创作承诺仍在创作台中酝酿。"
                      )}
                    </p>
                  </article>
                  <article className="story-card story-card--accent">
                    <span className="story-card__label">WHY READ / 追读理由</span>
                    <p>
                      {textOr(
                        novel.bookContract.coreSellingPoint ||
                          novel.bookSellingPoint,
                        "一个还在生长中的故事，等待它的第一批读者。"
                      )}
                    </p>
                    <div className="story-tags">
                      <span>{novel.genre.name}</span>
                      <span>{novel.progress.targetChapters} 章目标</span>
                      <span>{PACE_LABELS[novel.pacePreference || ""] || "张弛有度"}</span>
                    </div>
                  </article>
                </div>
              </section>
            </Reveal>

            <Reveal>
              <section className="novel-block" id="world">
                <SectionHeading
                  index="02"
                  kicker="THE WORLD / 世界切片"
                  title={textOr(novel.world.name, "一个尚未命名的世界")}
                  copy={
                    novel.world.overviewSummary ||
                    novel.world.description ||
                    undefined
                  }
                  aside={
                    novel.world.type ? (
                      <span className="world-type-badge">{novel.world.type}</span>
                    ) : undefined
                  }
                />
                {novel.world.axioms.length > 0 && (
                  <div className="axiom-grid">
                    {novel.world.axioms.slice(0, 4).map((axiom, index) => (
                      <article className="axiom-card" key={`${axiom.name}-${index}`}>
                        <span className="axiom-card__number">
                          RULE {String(index + 1).padStart(2, "0")}
                        </span>
                        <h4>{textOr(axiom.name, "世界规则")}</h4>
                        <p>{textOr(axiom.summary, "这条规则仍在补完。")}</p>
                        {(axiom.cost || axiom.boundary || axiom.enforcement) && (
                          <dl>
                            {axiom.cost && (
                              <div>
                                <dt>代价</dt>
                                <dd>{axiom.cost}</dd>
                              </div>
                            )}
                            {axiom.boundary && (
                              <div>
                                <dt>边界</dt>
                                <dd>{axiom.boundary}</dd>
                              </div>
                            )}
                            {axiom.enforcement && (
                              <div>
                                <dt>约束</dt>
                                <dd>{axiom.enforcement}</dd>
                              </div>
                            )}
                          </dl>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                {novel.world.locations.length > 0 && (
                  <div className="locations">
                    <div className="mini-heading">
                      <span>KEY LOCATIONS</span>
                      <span>{String(novel.world.locations.length).padStart(2, "0")}</span>
                    </div>
                    <div className="location-grid">
                      {novel.world.locations.map((location, index) => (
                        <article className="location-card" key={`${location.name}-${index}`}>
                          <span className="location-card__index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <span className="location-card__terrain">
                              {textOr(location.terrain, "未知地貌")}
                            </span>
                            <h4>{textOr(location.name, "未命名地点")}</h4>
                            <p>{textOr(location.summary, location.narrativeFunction)}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                {novel.world.factions.length > 0 && (
                  <div className="faction-row">
                    <span className="mini-heading__label">FACTIONS / 势力</span>
                    {novel.world.factions.map((faction, index) => (
                      <span className="faction-chip" key={`${faction.name}-${index}`}>
                        {textOr(faction.name, "未命名势力")}
                        {faction.position && <em>{faction.position}</em>}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </Reveal>

            <Reveal>
              <section className="novel-block" id="characters">
                <SectionHeading
                  index="03"
                  kicker="THE CAST / 人物谱"
                  title="走进故事的人"
                  copy="他们带着各自的欲望、恐惧与秘密，在同一个世界里相遇。"
                  aside={<span className="count-badge">{novel.characters.length} 位角色</span>}
                />
                {novel.characters.length > 0 ? (
                  <div className="character-grid">
                    {novel.characters.slice(0, 9).map((character, index) => (
                      <article className="character-card" key={`${character.name}-${index}`}>
                        <div className="character-card__top">
                          <span className={`character-sigil character-sigil--${(index % 4) + 1}`}>
                            {character.name.slice(0, 1)}
                          </span>
                          <div>
                            <span className="character-card__role">
                              {CAST_LABELS[character.castRole || ""] ||
                                textOr(character.identityLabel, "登场角色")}
                            </span>
                            <h4>{character.name}</h4>
                          </div>
                        </div>
                        <p className="character-card__title">
                          {textOr(character.role || character.identityLabel, "身份待揭晓")}
                        </p>
                        <p className="character-card__personality">
                          {textOr(
                            character.personality || character.firstImpression,
                            "这个角色的性格还未被记录。"
                          )}
                        </p>
                        <div className="character-card__foot">
                          <span>{textOr(character.powerLevel, "境界未知")}</span>
                          <span>{textOr(character.relationToProtagonist, "关系未明")}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-note">
                    <UserRound size={20} />
                    <p>人物仍在创作台里入场。等他们准备好，就会出现在这里。</p>
                  </div>
                )}
              </section>
            </Reveal>

            <Reveal>
              <section className="novel-block" id="volumes">
                <SectionHeading
                  index="04"
                  kicker="THE STRUCTURE / 分卷结构"
                  title="长篇的骨架"
                  copy="每一卷都有自己的开场钩子、核心承诺与高潮兑现。"
                  aside={<span className="count-badge">{novel.volumes.length} 卷</span>}
                />
                {novel.volumes.length > 0 ? (
                  <div className="volume-list">
                    {novel.volumes.map((volume, index) => (
                      <article className="volume-card" key={volume.id || index}>
                        <div className="volume-card__rail">
                          <span>{String(volume.sortOrder || index + 1).padStart(2, "0")}</span>
                          <i />
                        </div>
                        <div className="volume-card__body">
                          <span className="volume-card__label">VOLUME {String(volume.sortOrder || index + 1).padStart(2, "0")}</span>
                          <h4>{volume.title}</h4>
                          <p>{textOr(volume.summary, "这一卷的梗概还在打磨。")}</p>
                          <div className="volume-card__detail">
                            <div>
                              <span>开场钩子</span>
                              <p>{textOr(volume.openingHook, "尚未记录")}</p>
                            </div>
                            <div>
                              <span>高潮兑现</span>
                              <p>{textOr(volume.climax, "尚未记录")}</p>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-note">
                    <Layers3 size={20} />
                    <p>分卷结构仍在创作台中搭建。</p>
                  </div>
                )}
              </section>
            </Reveal>

            <Reveal>
              <section className="novel-block" id="chapters">
                <SectionHeading
                  index="05"
                  kicker="THE CHAPTERS / 章节目录"
                  title="已写下的，与正在写的"
                  copy={`共 ${novel.stats.chapterCount} 章规划，${readable.length} 章已生成正文。未完成章节会随着创作台进度逐章点亮。`}
                  aside={
                    <span className="count-badge">
                      {readable.length} / {novel.stats.chapterCount}
                    </span>
                  }
                />
                <div className="chapter-list-head">
                  <span>CHAPTER</span>
                  <span>STATUS</span>
                </div>
                {novel.chapters.length > 0 ? (
                  <ol className="chapter-list">
                    {novel.chapters.map((chapter, index) => (
                      <ChapterRow
                        key={chapter.id}
                        chapter={chapter}
                        novelId={novel.id}
                        index={index}
                      />
                    ))}
                  </ol>
                ) : (
                  <div className="empty-note">
                    <Feather size={20} />
                    <p>还没有章节。去创作台写下第一章吧。</p>
                  </div>
                )}
                <div className="chapters-footer">
                  <span>
                    <Clock3 size={14} />
                    后续章节由创作台持续生成
                  </span>
                  <StudioLink href={studioUrl} target="_blank" rel="noreferrer">
                    查看创作现场 <ArrowUpRight size={13} />
                  </StudioLink>
                </div>
              </section>
            </Reveal>
          </div>

          <NovelAside
            novel={novel}
            origin={state.origin}
            syncedAt={state.syncedAt}
            readableCount={readable.length}
          />
        </div>

        <section className="novel-cta">
          <div className="shell novel-cta__inner">
            <div>
              <p className="eyebrow">KEEP WRITING</p>
              <h2>这个故事，还在继续。</h2>
              <p>打开 Biz Novel Studio，接着写下一章，或者开启一个全新的世界。</p>
            </div>
            <div className="novel-cta__actions">
              <StudioLink className="button button--solid" href={studioUrl} target="_blank" rel="noreferrer">
                继续创作
                <ArrowUpRight size={16} />
              </StudioLink>
              <Link className="button button--ghost" to="/">
                返回作品馆
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
