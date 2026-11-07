import { StudioLink } from './StudioLink';
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useSession } from "../session";
import { BNS_STUDIO_URL } from "../config";
import { useStudioStatus } from "../hooks";
import { cn } from "../utils";
import { Brand } from "./Brand";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const online = useStudioStatus();
  const location = useLocation();
  const { user, needsSetup } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  return (
    <header className={cn("site-header", scrolled && "is-scrolled", open && "is-open")}>
      <div className="shell header-shell">
        <Brand />
        <nav className="primary-nav" aria-label="主导航">
          <NavLink to="/" end className={({ isActive }) => cn(isActive && "is-active")}>
            作品馆
          </NavLink>
          <Link to="/#studio">创作现场</Link>
          <NavLink to="/about" className={({ isActive }) => cn(isActive && "is-active")}>
            联动说明
          </NavLink>
        </nav>
        <div className="header-actions">
          <Link className="account-link" title={user?.username} to={user ? "/account" : "/login"}>{user ? user.username : needsSetup ? "初始化" : "登录"}</Link>
          {user?.role === "admin" && <Link className="account-link" to="/admin">管理</Link>}
          <span className={cn("studio-status", online === false && "is-offline")}><span className="status-dot" aria-hidden="true" /><span className="status-long">{online ? "实时同步" : "离线阅读"}</span></span>
          <StudioLink
            className="header-studio-link"
            href={BNS_STUDIO_URL}
            target="_blank"
            rel="noreferrer"
          >
            进入创作台
            <ArrowUpRight size={14} strokeWidth={1.6} />
          </StudioLink>
          <button
            type="button"
            className="menu-toggle"
            aria-label={open ? "关闭菜单" : "打开菜单"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <div className="mobile-menu" aria-hidden={!open} inert={!open}>
        <nav aria-label="移动端导航">
          <Link to="/">作品馆</Link>
          <Link to="/#studio">创作现场</Link>
          <Link to="/about">联动说明</Link>
          <Link to={user ? "/account" : "/login"}>{user ? "账户设置" : "登录"}</Link>
          {user?.role === "admin" && <Link to="/admin">管理中心</Link>}
          <StudioLink href={BNS_STUDIO_URL} target="_blank" rel="noreferrer">
            进入 Biz Novel Studio
            <ArrowUpRight size={16} />
          </StudioLink>
        </nav>
        <p className="mobile-menu-note">AI-NATIVE FICTION ARCHIVE · 2026</p>
      </div>
    </header>
  );
}
