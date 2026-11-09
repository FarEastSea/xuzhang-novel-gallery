import { StudioLink } from '../components/StudioLink';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe2,
  RefreshCw,
  Server,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE, BNS_STUDIO_URL } from "../config";
import { useDocumentTitle, useStudioStatus, useWorks } from "../hooks";
import { cn, formatRelativeDate } from "../utils";
import { Footer } from "../components/Footer";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/novels?limit=100",
    title: "作品列表",
    copy: "同步标题、简介、题材、创作进度、角色数与更新时间。",
  },
  {
    method: "GET",
    path: "/api/novels/:id",
    title: "作品档案",
    copy: "读取世界观、人物、分卷、创作承诺与完整元数据。",
  },
  {
    method: "GET",
    path: "/api/novels/:id/chapters",
    title: "章节目录与正文",
    copy: "拉取章节状态与已生成正文，未完成的章节保持待读状态。",
  },
  {
    method: "GET",
    path: "/api/health",
    title: "连接状态",
    copy: "用于页头在线指示器，失败时自动回退到本地快照。",
  },
];

export function AboutPage() {
  useDocumentTitle("联动说明");
  const online = useStudioStatus();
  const { works, origin, syncedAt } = useWorks();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.body.dataset.page = "about";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    window.location.reload();
  };

  return (
    <>
      <main className="about-page">
        <section className="about-hero">
          <div className="shell">
            <div className="about-kicker">
              <span>CONNECTION / 联动说明</span>
              <span className="about-kicker__line" />
              <span>REAL-TIME ARCHIVE</span>
            </div>
            <h1>
              一个展厅，
              <br />
              <em>一条实时数据线。</em>
            </h1>
            <div className="about-hero__foot">
              <p>
                叙章不是独立的写作工具，而是 Biz Novel Studio 的公共陈列层。
                创作台负责生产，展厅负责把作品以最合适的方式呈现给读者。
              </p>
              <Link className="button button--ghost" to="/#works">
                先去看看作品
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section className="about-status">
          <div className="shell">
            <div className={cn("connection-card", online === false && "is-offline")}>
              <div className="connection-card__state">
                <span className="connection-orb">
                  {online === false ? <WifiOff size={20} /> : <CheckCircle2 size={20} />}
                </span>
                <div>
                  <span>STUDIO CONNECTION</span>
                  <h2>
                    {online === null
                      ? "正在连接创作台"
                      : online
                        ? "Biz Novel Studio 在线"
                        : "当前使用本地快照"}
                  </h2>
                  <p>
                    {online === false
                      ? "创作台暂时不可达，页面会展示符合当前阅读权限的离线作品数据。"
                      : "作品馆正在从创作台读取最新的作品、章节与创作进度。"}
                  </p>
                </div>
              </div>
              <div className="connection-card__metrics">
                <div>
                  <span>DATA SOURCE</span>
                  <strong>{origin === "live" ? "LIVE API" : "LOCAL SNAPSHOT"}</strong>
                </div>
                <div>
                  <span>WORKS</span>
                  <strong>{String(works.length).padStart(2, "0")}</strong>
                </div>
                <div>
                  <span>LAST SYNC</span>
                  <strong>{formatRelativeDate(syncedAt)}</strong>
                </div>
                <div>
                  <span>ENDPOINT</span>
                  <strong>{API_BASE || "/api"}</strong>
                </div>
              </div>
              <div className="connection-card__actions">
                <button type="button" onClick={refresh} disabled={refreshing}>
                  <RefreshCw size={15} className={refreshing ? "is-spinning" : ""} />
                  {refreshing ? "正在刷新" : "重新同步"}
                </button>
                <StudioLink href={BNS_STUDIO_URL} target="_blank" rel="noreferrer">
                  打开创作台
                  <ArrowUpRight size={14} />
                </StudioLink>
              </div>
            </div>
          </div>
        </section>

        <section className="about-architecture">
          <div className="shell">
            <SectionHeading
              index="01"
              kicker="HOW IT WORKS / 工作方式"
              title="数据是怎么走到这里的"
              copy="浏览器不会直接触碰创作台的服务。叙章通过一个轻量代理读取 Biz Novel Studio 的公开作品接口，再把数据整理成适合阅读的页面。"
            />
            <div className="architecture-flow">
              <Reveal className="architecture-node">
                <span className="architecture-node__icon">
                  <Globe2 size={22} />
                </span>
                <span className="architecture-node__index">01 / READER</span>
                <h3>读者浏览器</h3>
                <p>浏览作品、筛选题材、阅读已生成章节，并保留本地阅读进度。</p>
                <code>xuzhang.site</code>
              </Reveal>
              <div className="architecture-arrow" aria-hidden="true">
                <span />
                <ArrowRight size={17} />
              </div>
              <Reveal className="architecture-node architecture-node--accent" delay={80}>
                <span className="architecture-node__icon">
                  <Server size={22} />
                </span>
                <span className="architecture-node__index">02 / GALLERY</span>
                <h3>叙章陈列层</h3>
                <p>代理接口、清洗字段、生成本地快照，并以作品馆的视觉语言重新编排。</p>
                <code>/api → /api/novels</code>
              </Reveal>
              <div className="architecture-arrow" aria-hidden="true">
                <span />
                <ArrowRight size={17} />
              </div>
              <Reveal className="architecture-node" delay={160}>
                <span className="architecture-node__icon">
                  <Database size={22} />
                </span>
                <span className="architecture-node__index">03 / STUDIO</span>
                <h3>Biz Novel Studio</h3>
                <p>管理作品、世界、人物、分卷与章节生成，是内容唯一的真实来源。</p>
                <code>:28080 /api</code>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="about-endpoints">
          <div className="shell about-endpoints__grid">
            <div className="about-endpoints__intro">
              <span className="eyebrow">API SURFACE</span>
              <h2>
                只读，实时，
                <br />
                <em>克制。</em>
              </h2>
              <p>
                展厅只调用只读接口，不会修改创作台里的任何内容。
                如果某个接口暂时失败，页面会回退到打包时的数据快照，而不是给读者一张空白页。
              </p>
              <div className="fallback-note">
                <Sparkles size={16} />
                <span>
                  当前优先数据源：<strong>{origin === "live" ? "实时接口" : "本地快照"}</strong>
                </span>
              </div>
            </div>
            <div className="endpoint-list">
              {ENDPOINTS.map((endpoint, index) => (
                <Reveal as="div" key={endpoint.path} delay={index * 60} className="endpoint-row">
                  <span className="endpoint-row__method">{endpoint.method}</span>
                  <div>
                    <code>{endpoint.path}</code>
                    <span>{endpoint.title}</span>
                    <p>{endpoint.copy}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="about-publish">
          <div className="shell">
            <SectionHeading
              index="02"
              kicker="ADD A STORY / 新增作品"
              title="在创作台写，在这里被看见"
              copy="新作品默认不上架。管理员选择作品上架并设置可见范围后，获准的读者才能在作品馆中看到它。"
            />
            <ol className="publish-steps">
              {[
                ["01", "在创作台建立作品", "创建小说项目，补全世界观、人物与分卷，让故事拥有完整的骨架。"],
                ["02", "推进章节生成", "在创作台中生成正文。已完成的章节会自动变为可阅读状态。"],
                ["03", "设置上架与范围", "管理员在作品上架中选择作品，设置所有人、登录用户、指定用户或仅管理员可见。"] ,
                ["04", "分享给读者", "把作品链接发给读者。封面、简介、目录和阅读页都已准备好。"],
              ].map(([index, title, copy], i) => (
                <Reveal as="li" key={index} delay={i * 70}>
                  <span>{index}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </Reveal>
              ))}
            </ol>
            <div className="about-config"><div><h3>配置统一在管理中心完成</h3><p>管理员登录后可设置作品来源、创作台入口与离线阅读。保存后立即生效。游客只能浏览面向所有人开放的上架作品。</p></div><div><Link className="button button--ghost" to="/account">账户与权限 <ArrowRight size={15} /></Link></div></div>
          </div>
        </section>

        <section className="about-cta">
          <div className="shell">
            <span className="eyebrow">START HERE</span>
            <h2>
              故事已经在发生。
              <br />
              <em>去把它写完。</em>
            </h2>
            <div className="about-cta__actions">
              <StudioLink className="button button--solid" href={BNS_STUDIO_URL} target="_blank" rel="noreferrer">
                打开 Biz Novel Studio
                <ExternalLink size={16} />
              </StudioLink>
              <Link className="button button--ghost" to="/">
                浏览作品馆
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
