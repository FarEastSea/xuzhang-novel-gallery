import { Link } from "react-router-dom";
import { SITE_NAME, SITE_NAME_EN } from "../config";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`brand${compact ? " brand--compact" : ""}`} aria-label="叙章作品馆首页">
      <span className="brand-mark" aria-hidden="true">
        <span>叙</span>
      </span>
      <span className="brand-word">
        <strong>{SITE_NAME}</strong>
        <small>{SITE_NAME_EN}</small>
      </span>
    </Link>
  );
}
