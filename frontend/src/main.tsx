import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  CircleHelp,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { api, send, setCsrf } from "./api";
import {
  Session,
  NoticeProvider,
  Spinner,
  Field,
  ErrorBox,
  useLoad,
  useSession,
} from "./ui";
import { roles, type Account, type Department, type Site } from "./types";
const PortalPage = lazy(() =>
  import("./portal").then((m) => ({ default: m.PortalPage })),
);
const Library = lazy(() =>
  import("./portal").then((m) => ({ default: m.Library })),
);
const ContentDetail = lazy(() =>
  import("./portal").then((m) => ({ default: m.ContentDetail })),
);
const ContentList = lazy(() =>
  import("./content").then((m) => ({ default: m.ContentList })),
);
const ContentEditor = lazy(() =>
  import("./content").then((m) => ({ default: m.ContentEditor })),
);
const Dashboard = lazy(() =>
  import("./it").then((m) => ({ default: m.Dashboard })),
);
const Departments = lazy(() =>
  import("./it").then((m) => ({ default: m.Departments })),
);
const UsersPage = lazy(() =>
  import("./it").then((m) => ({ default: m.UsersPage })),
);
const PageEditor = lazy(() =>
  import("./it").then((m) => ({ default: m.PageEditor })),
);
const Templates = lazy(() =>
  import("./it").then((m) => ({ default: m.Templates })),
);
const TemplateEditor = lazy(() =>
  import("./it").then((m) => ({ default: m.TemplateEditor })),
);
const SiteSettings = lazy(() =>
  import("./it").then((m) => ({ default: m.SiteSettings })),
);
const AuditPage = lazy(() =>
  import("./it").then((m) => ({ default: m.AuditPage })),
);
import "./styles.css";
import "./themes.css";
import { SiteTheme, themeId, themeStyle } from "./themes";

function App() {
  const [user, setUser] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    const result = await api<{ user: Account | null; csrfToken: string }>(
      "/auth/session",
    );
    setCsrf(result.csrfToken);
    setUser(result.user);
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="connection-error">
        <ErrorBox message={error} retry={() => location.reload()} />
      </div>
    );
  if (!user) return <Login refresh={refresh} />;
  return (
    <Session.Provider value={{ user, refresh }}>
      <Shell />
    </Session.Provider>
  );
}

function Login({ refresh }: { refresh: () => Promise<void> }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <img src="/mark.svg" alt="" />
          <span>
            企业内网<small>CONNECTED WORKPLACE</small>
          </span>
        </div>
        <div>
          <span className="pill light">一个入口，连接日常工作</span>
          <h1>
            信息有序流动，
            <br />
            协作自然发生。
          </h1>
          <p>
            从企业资讯到部门知识，
            <br />
            让每一份内容，都找到需要它的人。
          </p>
        </div>
        <div className="login-grid" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <small>INFORMATION · PEOPLE · POSSIBILITIES</small>
      </section>
      <section className="login-form">
        <div>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>登录工作门户</h2>
          <p className="muted">使用你的内网账号，开启今天的工作。</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await send("/auth/login", { username, password });
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="用户名">
              <input
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
              />
            </Field>
            <Field label="密码">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
              />
            </Field>
            {error && <ErrorBox message={error} />}
            <button className="btn primary full" disabled={busy}>
              {busy ? "正在登录…" : "登录门户"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <p className="login-help">
            <CircleHelp size={15} />
            账号或权限问题，请联系 IT 管理员
          </p>
        </div>
      </section>
    </main>
  );
}

function Shell() {
  const { user, refresh } = useSession(),
    location = useLocation();
  const [mobile, setMobile] = useState(false);
  const departments = useLoad<Department[]>("/departments");
  const site = useLoad<Site>("/portal/site");
  useEffect(() => {
    const reload = () => site.reload();
    window.addEventListener("site-published", reload);
    return () => window.removeEventListener("site-published", reload);
  }, [site.reload]);
  useEffect(() => {
    document.documentElement.dataset.theme = themeId(site.data);
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [site.data]);
  useEffect(() => {
    if (site.data) document.title = `${site.data.name} · 内容与协作`;
  }, [site.data]);
  const isIT = ["admin", "it"].includes(user.role),
    isEditor = ["admin", "editor"].includes(user.role);
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  const inAdmin = location.pathname.startsWith("/it"),
    inWork = location.pathname.startsWith("/work");
  return (
    <SiteTheme.Provider value={site.data}>
      <div
        className="app-shell"
        data-theme={themeId(site.data)}
        style={themeStyle(site.data)}
      >
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <Link to="/" className="brand">
            <img src="/mark.svg" alt="" />
            <span>
              {site.data?.name ?? "企业内网"}
              <small>CONNECTED WORKPLACE</small>
            </span>
          </Link>
          <button
            className="mobile-close"
            aria-label="关闭菜单"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
          <div className="nav-label">工作空间</div>
          <nav>
            <NavLink to="/" end>
              <PanelsTopLeft size={18} />
              门户首页
            </NavLink>
            <NavLink to="/library">
              <FilePenLine size={18} />
              内容中心
            </NavLink>
            {isEditor && (
              <NavLink to="/work">
                <LayoutDashboard size={18} />
                内容工作台
              </NavLink>
            )}
          </nav>
          <div className="nav-label">
            部门空间{" "}
            <span>{departments.data?.filter((d) => d.active).length ?? 0}</span>
          </div>
          <nav className="department-nav">
            {departments.data
              ?.filter((d) => d.active)
              .map((d) => (
                <NavLink key={d.id} to={`/departments/${d.id}`}>
                  <span className="department-dot" />
                  {d.name}
                  <ChevronRight size={13} />
                </NavLink>
              ))}
            {departments.data?.length === 0 && (
              <p className="nav-empty">部门空间尚未配置</p>
            )}
          </nav>
          {isIT && (
            <>
              <div className="nav-label">IT 配置中心</div>
              <nav>
                <NavLink to="/it" end>
                  <SlidersHorizontal size={18} />
                  配置概览
                </NavLink>
                <NavLink to="/it/pages/home">
                  <PanelsTopLeft size={18} />
                  页面与模块
                </NavLink>
                <NavLink to="/it/departments">
                  <Building2 size={18} />
                  部门管理
                </NavLink>
                <NavLink to="/it/templates">
                  <FilePenLine size={18} />
                  模板库
                </NavLink>
                <NavLink to="/it/users">
                  <Users size={18} />
                  用户与授权
                </NavLink>
                <NavLink to="/it/settings">
                  <Settings2 size={18} />
                  站点设置
                </NavLink>
                <NavLink to="/it/audit">
                  <ShieldCheck size={18} />
                  操作日志
                </NavLink>
              </nav>
            </>
          )}
          <div className="sidebar-foot">
            <span className="status-dot" />
            企业内部工作空间<small>让内容，产生连接。</small>
          </div>
        </aside>
        {mobile && (
          <div className="sidebar-overlay" onClick={() => setMobile(false)} />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu"
                aria-label="打开菜单"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              <span>{site.data?.name ?? "企业内网"}</span>
              <ChevronRight size={13} />
              <strong>
                {inAdmin ? "IT 配置中心" : inWork ? "内容工作台" : "工作门户"}
              </strong>
            </div>
            <div className="user-bar">
              <span className="role-label">{roles[user.role]}</span>
              <span className="avatar">{user.name.slice(-2)}</span>
              <span>{user.name}</span>
              <button
                title="退出登录"
                aria-label="退出登录"
                onClick={async () => {
                  await send("/auth/logout");
                  await refresh();
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </header>
          <main className="main-content">
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<PortalPage />} />
                <Route path="/departments/:id" element={<PortalPage />} />
                <Route path="/library" element={<Library />} />
                <Route path="/content/:id" element={<ContentDetail />} />
                <Route
                  path="/work"
                  element={
                    <Guard allowed={isEditor}>
                      <ContentList />
                    </Guard>
                  }
                />
                <Route
                  path="/work/new"
                  element={
                    <Guard allowed={isEditor}>
                      <ContentEditor />
                    </Guard>
                  }
                />
                <Route
                  path="/work/:id"
                  element={
                    <Guard allowed={isEditor}>
                      <ContentEditor />
                    </Guard>
                  }
                />
                <Route
                  path="/it"
                  element={
                    <Guard allowed={isIT}>
                      <Dashboard />
                    </Guard>
                  }
                />
                <Route
                  path="/it/departments"
                  element={
                    <Guard allowed={isIT}>
                      <Departments />
                    </Guard>
                  }
                />
                <Route
                  path="/it/users"
                  element={
                    <Guard allowed={isIT}>
                      <UsersPage />
                    </Guard>
                  }
                />
                <Route
                  path="/it/pages/:id"
                  element={
                    <Guard allowed={isIT}>
                      <PageEditor />
                    </Guard>
                  }
                />
                <Route
                  path="/it/templates"
                  element={
                    <Guard allowed={isIT}>
                      <Templates />
                    </Guard>
                  }
                />
                <Route
                  path="/it/templates/:id"
                  element={
                    <Guard allowed={isIT}>
                      <TemplateEditor />
                    </Guard>
                  }
                />
                <Route
                  path="/it/settings"
                  element={
                    <Guard allowed={isIT}>
                      <SiteSettings />
                    </Guard>
                  }
                />
                <Route
                  path="/it/audit"
                  element={
                    <Guard allowed={isIT}>
                      <AuditPage />
                    </Guard>
                  }
                />
                <Route
                  path="*"
                  element={
                    <ErrorBox message="页面不存在，请从左侧导航重新进入。" />
                  }
                />
              </Routes>
            </Suspense>
          </main>
          <footer className="app-footer">
            {site.data?.footer ?? "企业内网 · 让信息连接工作"}
            <span>CONTENT BRINGS US TOGETHER</span>
          </footer>
        </div>
      </div>
    </SiteTheme.Provider>
  );
}
function Guard({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) {
  return allowed ? children : <ErrorBox message="没有此工作空间的访问权限" />;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <NoticeProvider>
        <App />
      </NoticeProvider>
    </BrowserRouter>
  </StrictMode>,
);
