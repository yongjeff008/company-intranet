import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  FileText,
  Megaphone,
  Pause,
  Play,
  Search,
  Settings2,
  Video,
  ClipboardList,
} from "lucide-react";
import DOMPurify from "dompurify";
import { api, send } from "./api";
import {
  Empty,
  ErrorBox,
  Field,
  Heading,
  Spinner,
  date,
  errorText,
  useLoad,
  useNotice,
  useSession,
} from "./ui";
import {
  kinds,
  type Content,
  type Item,
  type Portal,
  type PortalModule,
  type Asset,
  type Department,
  type Template,
  type Site,
} from "./types";
import { moduleStyle, useSiteTheme } from "./themes";

export function PortalPage() {
  const { id = "home" } = useParams(),
    [params] = useSearchParams(),
    { user } = useSession();
  const result = useLoad<Portal>(
    `/portal/pages/${id}${params.has("preview") ? "?preview=true" : ""}`,
  );
  if (result.loading) return <Spinner />;
  if (result.error)
    return (
      <>
        <Heading eyebrow="DEPARTMENT SPACE" title="部门空间" />
        <Empty title="这个空间还在准备中" text={result.error} />
        {["admin", "it"].includes(user.role) && (
          <Link className="btn primary" to={`/it/pages/${id}`}>
            配置此页面
          </Link>
        )}
      </>
    );
  const portal = result.data!;
  return (
    <>
      {portal.preview && (
        <div className="preview-banner">
          配置草稿预览 · 普通用户看不到此版本
          <Link to={`/it/pages/${id}`}>返回编辑</Link>
        </div>
      )}
      <div className="portal-welcome">
        <p className="eyebrow">{portal.site.subtitle}</p>
        <div>
          <h1>{id === "home" ? portal.site.name : portal.page.name}</h1>
          <span className="today">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
        </div>
        <p>{portal.page.description}</p>
      </div>
      <div className={`portal-grid ${portal.page.layout}`}>
        {portal.modules.map((m) => (
          <ModuleView key={m.config.id} module={m} site={portal.site} />
        ))}
      </div>
      {portal.modules.length === 0 && (
        <section className="panel welcome-empty">
          <div className="empty-landscape" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <Empty
            title="一个新的工作空间，从这里开始"
            text="页面已准备就绪。配置模块、发布内容后，信息将在这里有序呈现。"
          >
            {["admin", "it"].includes(user.role) ? (
              <Link className="btn primary" to={`/it/pages/${id}`}>
                <Settings2 size={16} />
                配置页面模块
              </Link>
            ) : (
              <Link className="btn secondary" to="/library">
                浏览内容中心
                <ArrowRight size={16} />
              </Link>
            )}
          </Empty>
        </section>
      )}
    </>
  );
}
const icons: Record<string, typeof FileText> = {
  news: FileText,
  notice: Megaphone,
  video: Video,
  document: FileText,
  ticker: Megaphone,
  survey: ClipboardList,
};
export function ModuleView({
  module,
  site,
}: {
  module: PortalModule;
  site?: Site;
}) {
  const currentSite = useSiteTheme();
  const { config: m, items, template } = module,
    [paused, setPaused] = useState(false),
    Icon = icons[m.type] ?? FileText;
  return (
    <section
      className={`portal-module panel variant-${m.variant} module-${m.type}`}
      style={
        {
          gridColumn: `span ${m.width}`,
          ...moduleStyle(m, site ?? currentSite),
        } as React.CSSProperties
      }
    >
      <header className="module-header">
        <h2>
          <Icon size={18} />
          {m.title}
        </h2>
        <Link
          to={`/library?type=${m.type === "ticker" ? "" : m.type}&departmentId=${m.departmentId}`}
        >
          更多
          <ChevronRight size={14} />
        </Link>
      </header>
      {items.length === 0 ? (
        <Empty title="暂无已发布内容" text="等待部门管理员发布第一条内容" />
      ) : template ? (
        <TemplatePreview template={template} title={m.title} items={items} />
      ) : m.type === "ticker" ? (
        <div className="ticker-wrap">
          <div
            className={`ticker ${paused ? "paused" : ""} ${m.tickerMode === "static" ? "static" : ""}`}
            tabIndex={0}
          >
            <div className="ticker-track">
              {[0, 1].map((copy) => (
                <div
                  className="ticker-set"
                  key={copy}
                  aria-hidden={copy === 1 ? true : undefined}
                >
                  {items.map((item) => (
                    <Link
                      to={`/content/${item.id}`}
                      key={item.id}
                      tabIndex={copy ? -1 : undefined}
                    >
                      <span className="badge">{kinds[item.data.type]}</span>
                      {item.data.title}
                      <ArrowRight size={15} />
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <button
            className="ticker-control"
            aria-label={paused ? "继续滚动" : "暂停滚动"}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        </div>
      ) : (
        <div className="module-items">
          {items.map((item, index) => (
            <Link
              to={`/content/${item.id}`}
              key={item.id}
              className={`content-link ${index === 0 ? "first" : ""}`}
            >
              {item.data.coverId && (
                <img
                  className="content-cover"
                  src={`/api/assets/${item.data.coverId}`}
                  alt=""
                />
              )}
              <div className="content-link-main">
                <div className="content-meta">
                  <span>{item.data.category || item.departmentName}</span>
                  <time>{date(item.updatedAt)}</time>
                </div>
                <h3>
                  {item.data.pinned && <span className="pin-label">置顶</span>}
                  {item.data.title}
                </h3>
                {m.variant !== "list" && (
                  <p>{item.data.summary || "点击查看详细内容"}</p>
                )}
                {item.data.type === "document" && (
                  <small>{item.data.documentNumber || "正式文件"}</small>
                )}
              </div>
              <ArrowRight className="item-arrow" size={16} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function TemplatePreview({
  template,
  title,
  items,
}: {
  template: Template;
  title: string;
  items: Item[];
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    host.current!.style.setProperty("contain", "layout paint", "important");
    host.current!.style.setProperty("position", "relative", "important");
    const root =
      host.current!.shadowRoot ?? host.current!.attachShadow({ mode: "open" });
    const rendered = items
      .map((item) =>
        template.itemHtml.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
          escape(
            (
              {
                title: item.data.title,
                summary: item.data.summary,
                department: item.departmentName,
                date: date(item.updatedAt),
                url: `/content/${item.id}`,
                type: kinds[item.data.type],
              } as Record<string, string>
            )[key] ?? "",
          ),
        ),
      )
      .join("");
    const html = template.html
      .replace(/\{\{\s*items\s*\}\}/g, rendered)
      .replace(/\{\{\s*title\s*\}\}/g, escape(title));
    const container = document.createElement("div");
    container.innerHTML = DOMPurify.sanitize(html, {
      FORBID_TAGS: ["style", "script", "iframe", "form"],
      FORBID_ATTR: ["style"],
    });
    const style = document.createElement("style");
    style.textContent =
      ":host{display:block;font:inherit;color:inherit}a{color:inherit}*{box-sizing:border-box}" +
      template.css;
    root.replaceChildren(style, container);
  }, [template, title, items]);
  return <div ref={host} className="custom-template" />;
}
export function Library() {
  const [params, setParams] = useSearchParams(),
    [query, setQuery] = useState(params.get("q") ?? "");
  const type = params.get("type") ?? "",
    departmentId = params.get("departmentId") ?? "";
  const departments = useLoad<Department[]>("/departments");
  const result = useLoad<Item[]>(`/portal/content?${params.toString()}`);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  }
  return (
    <>
      <Heading
        eyebrow="CONTENT LIBRARY"
        title="内容中心"
        text="发现企业动态，查找工作所需。"
      />
      <div className="panel">
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            filter("q", query);
          }}
        >
          <Search size={19} />
          <input
            aria-label="搜索内容"
            value={query}
            placeholder="搜索标题、摘要、文件文号…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn primary">搜索</button>
        </form>
        <div className="filter-bar">
          <div className="tabs">
            <button
              className={!type ? "active" : ""}
              onClick={() => filter("type", "")}
            >
              全部内容
            </button>
            {Object.entries(kinds)
              .filter(([key]) => key !== "ticker")
              .map(([key, label]) => (
                <button
                  key={key}
                  className={type === key ? "active" : ""}
                  onClick={() => filter("type", key)}
                >
                  {label}
                </button>
              ))}
          </div>
          <select
            aria-label="按部门筛选"
            value={departmentId}
            onChange={(e) => filter("departmentId", e.target.value)}
          >
            <option value="">全部部门</option>
            {departments.data
              ?.filter((d) => d.active)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
        {result.loading ? (
          <Spinner />
        ) : result.error ? (
          <ErrorBox message={result.error} retry={result.reload} />
        ) : result.data?.length === 0 ? (
          <Empty
            title="没有找到匹配的内容"
            text="试试其他关键词，或等待部门发布内容。"
          />
        ) : (
          <div className="library-list">
            {result.data?.map((item) => (
              <Link to={`/content/${item.id}`} key={item.id}>
                <span className={`type-symbol ${item.data.type}`}>
                  {item.data.type === "video" ? (
                    <Video size={21} />
                  ) : item.data.type === "survey" ? (
                    <ClipboardList size={21} />
                  ) : (
                    <FileText size={21} />
                  )}
                </span>
                <div>
                  <div className="content-meta">
                    <span>
                      {kinds[item.data.type]} · {item.departmentName}
                    </span>
                    <time>{date(item.updatedAt)}</time>
                  </div>
                  <h3>{item.data.title}</h3>
                  <p>{item.data.summary}</p>
                </div>
                <ChevronRight size={19} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
export function ContentDetail() {
  const { id } = useParams(),
    result = useLoad<{ item: Item; submitted: boolean }>(
      `/portal/content/${id}`,
    );
  if (result.loading) return <Spinner />;
  if (result.error) return <ErrorBox message={result.error} />;
  const { item, submitted } = result.data!,
    data = item.data;
  return (
    <>
      <Link className="back-link" to="/library">
        ← 返回内容中心
      </Link>
      <article
        className={`panel article ${data.type === "document" ? "official-document" : ""}`}
      >
        <header>
          <span className="pill">{kinds[data.type]}</span>
          <h1>{data.title}</h1>
          <div className="article-meta">
            <span>{item.departmentName}</span>
            <span>{data.author || data.issuer}</span>
            <time>{date(item.updatedAt)}</time>
          </div>
          {data.type === "document" && (
            <div className="document-info">
              <strong>{data.issuer}</strong>
              <span>{data.documentNumber}</span>
              <span>
                {
                  (
                    {
                      pending: "未生效",
                      effective: "有效",
                      expired: "已失效",
                      revoked: "已废止",
                    } as Record<string, string>
                  )[data.effectiveState]
                }
              </span>
            </div>
          )}
        </header>
        {data.summary && <p className="article-summary">{data.summary}</p>}
        {data.coverId && (
          <img
            className="article-cover"
            src={`/api/assets/${data.coverId}`}
            alt=""
          />
        )}
        {data.type === "video" && (
          <video
            controls
            preload="metadata"
            src={data.videoId ? `/api/assets/${data.videoId}` : data.videoUrl}
          />
        )}
        {data.body && (
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.body) }}
          />
        )}
        {data.type === "ticker" && data.link && (
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn secondary"
          >
            打开关联链接
            <ArrowRight size={16} />
          </a>
        )}
        {data.type === "survey" && (
          <SurveyForm
            id={item.id}
            content={data}
            submitted={submitted}
            onSubmitted={result.reload}
          />
        )}
        {data.assetIds.length > 0 && (
          <div className="attachments">
            <h3>相关附件</h3>
            {data.assetIds.map((assetId) => (
              <AssetLink key={assetId} id={assetId} />
            ))}
          </div>
        )}
        {data.changeNote && (
          <p className="version-note">版本说明：{data.changeNote}</p>
        )}
      </article>
    </>
  );
}
function AssetLink({ id }: { id: string }) {
  // File response supplies the original filename, not a public storage URL.
  return (
    <a href={`/api/assets/${id}`} target="_blank" rel="noopener noreferrer">
      <FileText size={18} />
      <span>查看附件</span>
      <ArrowDownToLine size={17} />
    </a>
  );
}
function SurveyForm({
  id,
  content,
  submitted,
  onSubmitted,
}: {
  id: string;
  content: Content;
  submitted: boolean;
  onSubmitted: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    notice = useNotice();
  const now = Date.now(),
    closed =
      content.closed ||
      (content.startsAt && Date.parse(content.startsAt) > now) ||
      !content.endsAt ||
      Date.parse(content.endsAt) <= now;
  if (submitted)
    return (
      <div className="success-panel">
        <ClipboardList size={28} />
        <h3>感谢你的参与</h3>
        <p>你已提交此问卷，请勿重复提交。</p>
      </div>
    );
  if (closed)
    return <Empty title="问卷尚未开始或已经结束" text="当前不接受新的答卷。" />;
  const update = (key: string, value: unknown) =>
    setAnswers((old) => ({ ...old, [key]: value }));
  return (
    <form
      className="survey-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!confirm("确认提交？提交后不可修改。")) return;
        setBusy(true);
        setError("");
        try {
          await send(`/surveys/${id}/answers`, { answers });
          notice("问卷已提交，感谢你的参与");
          onSubmitted();
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="survey-info">
        <span className="pill">
          {content.anonymous ? "登录匿名问卷" : "实名问卷"}
        </span>
        <p>
          {content.anonymous
            ? "登录仅用于资格校验和防止重复提交，业务结果不包含身份对应关系。请勿在自由文本中填写不必要的个人信息。"
            : "此次填写会关联你的账号，请确认后提交。"}
        </p>
        <small>
          截止时间：{new Date(content.endsAt!).toLocaleString("zh-CN")}
        </small>
      </div>
      {content.questions.map((q, index) => (
        <fieldset key={q.id}>
          <legend>
            {index + 1}. {q.title}
            {q.required && <em> *</em>}
          </legend>
          {q.type === "single" || q.type === "multiple" ? (
            q.options.map((option) => (
              <label className="choice" key={option}>
                <input
                  type={q.type === "single" ? "radio" : "checkbox"}
                  name={q.id}
                  value={option}
                  checked={
                    q.type === "single"
                      ? answers[q.id] === option
                      : ((answers[q.id] as string[]) ?? []).includes(option)
                  }
                  onChange={(e) =>
                    update(
                      q.id,
                      q.type === "single"
                        ? option
                        : e.target.checked
                          ? [...((answers[q.id] as string[]) ?? []), option]
                          : ((answers[q.id] as string[]) ?? []).filter(
                              (v) => v !== option,
                            ),
                    )
                  }
                />
                {option}
              </label>
            ))
          ) : q.type === "textarea" ? (
            <textarea
              required={q.required}
              maxLength={3000}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => update(q.id, e.target.value)}
            />
          ) : (
            <input
              aria-label={q.title}
              required={q.required}
              type={
                q.type === "number" || q.type === "rating" ? "number" : "text"
              }
              min={q.type === "rating" ? 1 : (q.min ?? undefined)}
              max={q.type === "rating" ? 5 : (q.max ?? undefined)}
              step={q.type === "rating" ? 1 : "any"}
              maxLength={300}
              value={(answers[q.id] as string | number) ?? ""}
              onChange={(e) =>
                update(
                  q.id,
                  e.target.type === "number"
                    ? e.target.value === ""
                      ? null
                      : Number(e.target.value)
                    : e.target.value,
                )
              }
            />
          )}
        </fieldset>
      ))}
      {error && <ErrorBox message={error} />}
      <button className="btn primary" disabled={busy}>
        {busy ? "正在提交…" : "确认并提交问卷"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
