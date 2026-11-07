import { StudioLink } from '../components/StudioLink';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  List,
  Minus,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDocumentTitle, useNovel, useReadingProgress } from "../hooks";
import type { Chapter, NovelDetail } from "../types";
import {
  chapterHref,
  cn,
  formatNumber,
  isChapterReadable,
  readingMinutes,
  sectionParagraphs,
  studioHref,
  textOr,
  workHref,
} from "../utils";

type ReaderTheme = "paper" | "sepia" | "night";

const THEME_ORDER: ReaderTheme[] = ["paper", "sepia", "night"];
const THEME_LABELS: Record<ReaderTheme, string> = {
  paper: "纸白",
  sepia: "米黄",
  night: "夜读",
};

const THEME_ICONS = {
  paper: Sun,
  sepia: Coffee,
  night: Moon,
};

function getSavedTheme(): ReaderTheme {
  try {
    const value = localStorage.getItem("xuzhang:reader:theme");
    if (value === "paper" || value === "sepia" || value === "night") return value;
  } catch {
    // Ignore blocked storage.
  }
  return "paper";
}

function getSavedFontSize(): number {
  try {
    const value = Number(localStorage.getItem("xuzhang:reader:font"));
    if (Number.isFinite(value) && value >= 16 && value <= 24) return value;
  } catch {
    // Ignore blocked storage.
  }
  return 19;
}

function ReaderDirectory({
  open,
  onClose,
  novel,
  currentId,
  readable,
}: {
  open: boolean;
  onClose: () => void;
  novel: NovelDetail;
  currentId: string;
  readable: Chapter[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.classList.add("reader-dir-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("reader-dir-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        className={cn("reader-overlay", open && "is-visible")}
        onClick={onClose}
        aria-label="关闭目录"
        tabIndex={open ? 0 : -1}
      />
      <aside className={cn("reader-drawer", open && "is-open")} aria-hidden={!open}>
        <div className="reader-drawer__head">
          <div>
            <span>CONTENTS</span>
            <h2>章节目录</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭目录">
            <X size={18} />
          </button>
        </div>
        <p className="reader-drawer__book">{novel.title}</p>
        <ol className="reader-drawer__list">
          {readable.map((chapter, index) => (
            <li key={chapter.id} className={cn(chapter.id === currentId && "is-current")}>
              <Link to={chapterHref(novel.id, chapter.id)} onClick={onClose}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{chapter.title}</strong>
                  <small>{formatNumber(chapter.wordCount)} 字</small>
                </span>
                {chapter.id === currentId ? <Check size={14} /> : <ChevronRight size={14} />}
              </Link>
            </li>
          ))}
          {novel.chapters
            .filter((chapter) => !isChapterReadable(chapter))
            .slice(0, 6)
            .map((chapter) => (
              <li key={chapter.id} className="is-pending">
                <div>
                  <span>{String(chapter.order).padStart(2, "0")}</span>
                  <span>
                    <strong>{chapter.title}</strong>
                    <small>创作中</small>
                  </span>
                  <Sparkles size={13} />
                </div>
              </li>
            ))}
        </ol>
        <div className="reader-drawer__foot">
          <span>{readable.length} / {novel.stats.chapterCount} 章可读</span>
          <Link to={workHref(novel)} onClick={onClose}>
            返回作品档案 <ArrowUpRight size={13} />
          </Link>
        </div>
      </aside>
    </>
  );
}

export function ReaderPage() {
  const { novelId, chapterId } = useParams<{ novelId: string; chapterId: string }>();
  const navigate = useNavigate();
  const state = useNovel(novelId);
  const novel = state?.novel;
  const [theme, setTheme] = useState<ReaderTheme>(getSavedTheme);
  const [fontSize, setFontSize] = useState(getSavedFontSize);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const readable = useMemo(
    () => (novel ? novel.chapters.filter(isChapterReadable) : []),
    [novel]
  );
  const chapterIndex = readable.findIndex((chapter) => chapter.id === chapterId);
  const chapter = chapterIndex >= 0 ? readable[chapterIndex] : null;

  useDocumentTitle(
    novel && chapter ? `${chapter.title} · ${novel.title}` : novel?.title
  );

  useReadingProgress(novelId || "", chapterId || "");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapterId]);

  useEffect(() => {
    document.documentElement.dataset.readerTheme = theme;
    try {
      localStorage.setItem("xuzhang:reader:theme", theme);
    } catch {
      // Ignore blocked storage.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--reader-font-size", `${fontSize}px`);
    try {
      localStorage.setItem("xuzhang:reader:font", String(fontSize));
    } catch {
      // Ignore blocked storage.
    }
  }, [fontSize]);

  useEffect(() => {
    document.body.dataset.page = "reader";
    return () => {
      delete document.body.dataset.page;
      delete document.documentElement.dataset.readerTheme;
      document.documentElement.style.removeProperty("--reader-font-size");
      document.body.classList.remove("reader-dir-open");
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = document.documentElement.scrollHeight - window.innerHeight;
        setScrollProgress(height > 0 ? Math.min(100, (window.scrollY / height) * 100) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [chapter]);

  useEffect(() => {
    if (!chapter) return;
    const onKey = (event: KeyboardEvent) => {
      if (directoryOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowRight" && chapterIndex < readable.length - 1) {
        navigate(chapterHref(novelId || "", readable[chapterIndex + 1].id));
      }
      if (event.key === "ArrowLeft" && chapterIndex > 0) {
        navigate(chapterHref(novelId || "", readable[chapterIndex - 1].id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapter, chapterIndex, directoryOpen, navigate, novelId, readable]);

  if (!state || (!novel && state.loading)) {
    return (
      <main className="loading-page loading-page--reader">
        <div className="loading-page__mark">叙</div>
        <p>正在铺开这一页…</p>
      </main>
    );
  }

  if (!novel || !chapter) {
    const fallbackChapter = novel ? readable[0] : null;
    return (
      <main className="reader reader--paper">
        <div className="reader-missing">
          <span className="eyebrow">CHAPTER NOT FOUND</span>
          <h1>{novel ? "这一章还在路上。" : "没有找到这部作品。"}</h1>
          <p>
            {novel
              ? "后续章节仍在创作台中生成。你可以先阅读已经完成的章节。"
              : "作品可能仍在创作台中，或者链接已经失效。"}
          </p>
          <div>
            {novel && fallbackChapter ? (
              <Link className="button button--solid" to={chapterHref(novel.id, fallbackChapter.id)}>
                阅读第一章
                <ArrowRight size={16} />
              </Link>
            ) : (
              <Link className="button button--solid" to="/">
                <ArrowLeft size={16} />
                返回作品馆
              </Link>
            )}
            {novel && (
              <Link className="button button--ghost" to={workHref(novel)}>
                查看作品档案
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  const paragraphs = sectionParagraphs(chapter.content);
  const ThemeIcon = THEME_ICONS[theme];
  const nextChapter = chapterIndex < readable.length - 1 ? readable[chapterIndex + 1] : null;
  const previousChapter = chapterIndex > 0 ? readable[chapterIndex - 1] : null;
  const nextPlanned = novel.chapters.find(
    (item) => item.order > chapter.order && !isChapterReadable(item)
  );

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
  };

  return (
    <div className={cn("reader", `reader--${theme}`)}>
      <div className="reader-progress-bar" aria-hidden="true">
        <span style={{ width: `${scrollProgress}%` }} />
      </div>
      <header className="reader-header">
        <div className="reader-header__inner">
          <Link className="reader-brand" to="/" aria-label="返回叙章作品馆">
            叙
          </Link>
          <div className="reader-header__book">
            <span>NOW READING</span>
            <Link to={workHref(novel)}>{novel.title}</Link>
          </div>
          <div className="reader-tools">
            <button
              type="button"
              className="reader-tool reader-tool--directory"
              onClick={() => setDirectoryOpen(true)}
            >
              <List size={16} />
              <span>目录</span>
            </button>
            <div className="reader-font-tools" aria-label="字号调整">
              <Type size={15} />
              <button
                type="button"
                onClick={() => setFontSize((size) => Math.max(16, size - 1))}
                disabled={fontSize <= 16}
                aria-label="减小字号"
              >
                <Minus size={13} />
              </button>
              <button
                type="button"
                onClick={() => setFontSize((size) => Math.min(24, size + 1))}
                disabled={fontSize >= 24}
                aria-label="增大字号"
              >
                <Plus size={13} />
              </button>
            </div>
            <button
              type="button"
              className="reader-tool reader-tool--theme"
              onClick={cycleTheme}
              aria-label={`切换阅读主题，当前为${THEME_LABELS[theme]}`}
              title={`阅读主题：${THEME_LABELS[theme]}`}
            >
              <ThemeIcon size={16} />
              <span>{THEME_LABELS[theme]}</span>
            </button>
            <button
              type="button"
              className="reader-tool reader-tool--back"
              onClick={() => window.history.back()}
              aria-label="返回上一页"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>
      </header>

      <ReaderDirectory
        open={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        novel={novel}
        currentId={chapter.id}
        readable={readable}
      />

      <main className="reader-main">
        <article className="reader-article">
          <header className="reader-chapter-head">
            <div className="reader-chapter-kicker">
              <span>CHAPTER {String(chapterIndex + 1).padStart(2, "0")}</span>
              <span className="reader-chapter-kicker__line" />
              <span>{novel.genre.name}</span>
            </div>
            <h1>{chapter.title}</h1>
            <div className="reader-chapter-meta">
              <span>{formatNumber(chapter.wordCount)} 字</span>
              <span>约 {readingMinutes(chapter.wordCount)} 分钟</span>
              <span>{textOr(novel.world.name, "未命名世界")}</span>
            </div>
          </header>

          <div className="reader-ornament" aria-hidden="true">
            <span />
            <i>✦</i>
            <span />
          </div>

          <div className="reader-content">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <div className="reader-end">
            <span className="reader-end__rule" />
            <span>本章完</span>
            <span className="reader-end__rule" />
          </div>

          <nav className="reader-chapter-nav" aria-label="章节切换">
            {previousChapter ? (
              <Link className="reader-chapter-nav__link" to={chapterHref(novel.id, previousChapter.id)}>
                <ChevronLeft size={18} />
                <span>
                  <small>上一章</small>
                  <strong>{previousChapter.title}</strong>
                </span>
              </Link>
            ) : (
              <span className="reader-chapter-nav__link is-disabled">
                <ChevronLeft size={18} />
                <span>
                  <small>上一章</small>
                  <strong>已经是第一章</strong>
                </span>
              </span>
            )}
            {nextChapter ? (
              <Link
                className="reader-chapter-nav__link reader-chapter-nav__link--next"
                to={chapterHref(novel.id, nextChapter.id)}
              >
                <span>
                  <small>下一章</small>
                  <strong>{nextChapter.title}</strong>
                </span>
                <ChevronRight size={18} />
              </Link>
            ) : (
              <span className="reader-chapter-nav__link reader-chapter-nav__link--next is-disabled">
                <span>
                  <small>下一章</small>
                  <strong>{nextPlanned ? `《${nextPlanned.title}》创作中` : "待创作"}</strong>
                </span>
                <ChevronRight size={18} />
              </span>
            )}
          </nav>

          <div className="reader-note">
            <div className="reader-note__icon">
              <Sparkles size={18} />
            </div>
            <div>
              <h3>这个故事仍在生长</h3>
              <p>
                本章由 Biz Novel Studio 创作流程生成。后续章节正在创作台中继续推进，
                完成之后会自动同步到作品馆。
              </p>
              <div className="reader-note__actions">
                <StudioLink href={studioHref(novel.id)} target="_blank" rel="noreferrer">
                  打开创作台 <ArrowUpRight size={13} />
                </StudioLink>
                <Link to={workHref(novel)}>
                  <BookOpen size={14} />
                  作品档案
                </Link>
              </div>
            </div>
          </div>

          <div className="reader-back">
            <Link to={workHref(novel)}>
              <ArrowLeft size={14} />
              返回《{novel.title}》作品档案
            </Link>
          </div>
        </article>
      </main>

      <footer className="reader-footer">
        <span>叙章 XUZHANG</span>
        <span>POWERED BY BIZ NOVEL STUDIO</span>
      </footer>
    </div>
  );
}
