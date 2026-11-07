import { StudioLink } from './StudioLink';
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BNS_STUDIO_URL } from "../config";
import { useSession } from "../session";
import { Brand } from "./Brand";

export function Footer() {
  const { user, studioEnabled } = useSession();
  return (
    <footer className="site-footer">
      <div className="shell footer-shell">
        <div className="footer-lead">
          <Brand compact />
          <p>
            一个由 Biz Novel Studio 实时供能的 AI 长篇作品陈列室。
            <br />
            故事在这里完成，也在这里被看见。
          </p>
        </div>
        <div className="footer-links">
          <div>
            <span className="footer-label">EXPLORE</span>
            <Link to="/">作品馆</Link>
            <Link to="/#studio">创作现场</Link>
            <Link to="/about">联动说明</Link>
          </div>
          {user && studioEnabled && <div>
            <span className="footer-label">STUDIO</span>
            <StudioLink href={BNS_STUDIO_URL} target="_blank" rel="noreferrer">
              Biz Novel Studio
              <ArrowUpRight size={13} />
            </StudioLink>
            <StudioLink href="/api/studio?path=/novels" target="_blank" rel="noreferrer">
              作品管理
            </StudioLink>
            <StudioLink href="/api/studio?path=/tasks" target="_blank" rel="noreferrer">
              创作任务
            </StudioLink>
          </div>}
        </div>
      </div>
      <div className="shell footer-base">
        <span>© 2026 叙章 XUZHANG · CURATED BY BIZ NOVEL STUDIO</span>
        <span className="footer-mark">MADE FOR STORIES IN PROGRESS</span>
      </div>
    </footer>
  );
}
