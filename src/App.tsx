import { useEffect } from "react";
import { Link, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LoginPage, AccountPage, AdminPage } from "./pages/ManagementPages";
import { Header } from "./components/Header";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { NovelPage } from "./pages/NovelPage";
import { ReaderPage } from "./pages/ReaderPage";

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const timer = window.setTimeout(() => {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
      }, 80);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return null;
}

function SiteLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <span className="eyebrow">404 / PAGE NOT FOUND</span>
      <h1>这一页，还没有被写下。</h1>
      <p>你访问的页面不存在，或者故事已经被移动到别处。</p>
      <div className="not-found-page__actions">
        <Link className="button button--solid" to="/">
          <ArrowLeft size={16} />
          返回作品馆
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/novels/:id" element={<NovelPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/read/:novelId/:chapterId" element={<ReaderPage />} />
      </Routes>
    </>
  );
}
