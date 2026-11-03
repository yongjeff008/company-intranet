import { HistoryModal } from "./history";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Link2,
  Plus,
  Upload,
  FileText,
  ArrowRight,
  Eye,
  Save,
  Send,
  Trash2,
  BarChart3,
  History,
  ChevronDown,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import { api, send } from "./api";
import {
  Empty,
  ErrorBox,
  Field,
  Heading,
  Modal,
  Spinner,
  date,
  errorText,
  useLoad,
  useNotice,
  useSession,
} from "./ui";
import {
  defaultContent,
  kinds,
  type Content,
  type Doc,
  type Department,
  type Asset,
  type Revision,
  type Question,
} from "./types";

export function ContentList() {
  const { user } = useSession(),
    result = useLoad<Doc<Content>[]>("/manage/documents?kind=content"),
    departments = useLoad<Department[]>("/departments");
  const [filter, setFilter] = useState(""),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState("");
  const items = result.data
    ?.map((doc) => ({ doc, data: JSON.parse(doc.draft) as Content }))
    .filter(
      ({ doc, data }) =>
        (!filter || data.type === filter) &&
        (!status ||
          (status === "published" ? !!doc.published : !doc.published)) &&
        (!query || data.title.includes(query)),
    );
  const hasDepartment =
    user.role === "admin"
      ? departments.data?.some((d) => d.active)
      : user.grants.length > 0;
  return (
    <>
      <Heading
        eyebrow="CONTENT STUDIO"
        title="内容工作台"
        text="把重要的信息，带给需要它的同事。"
      >
        <Link className="btn primary" to="/work/new">
          <Plus size={17} />
          新建内容
        </Link>
      </Heading>
      <div className="summary-strip">
        <span>
          <strong>{result.data?.length ?? 0}</strong>条内容
        </span>
        <span>
          <strong>{result.data?.filter((d) => d.published).length ?? 0}</strong>
          已发布
        </span>
        <span>
          <strong>
            {result.data?.filter((d) => !d.published).length ?? 0}
          </strong>
          未发布
        </span>
        <small>内容修改先保存为草稿，发布后前台生效</small>
      </div>
      {!hasDepartment && !departments.loading && (
        <div className="info-banner">
          还没有可维护的部门。请先由 IT 创建部门并分配管理员。
        </div>
      )}
      <section className="panel">
        <div className="filter-bar">
          <input
            aria-label="搜索标题"
            placeholder="搜索内容标题…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="内容类型"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">全部类型</option>
            {Object.entries(kinds).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="发布状态"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">未发布</option>
          </select>
        </div>
        {result.loading ? (
          <Spinner />
        ) : result.error ? (
          <ErrorBox message={result.error} retry={result.reload} />
        ) : !items?.length ? (
          <Empty
            title="从第一条内容开始"
            text="新闻、公告、视频和问卷，都可以从这里创建。"
          >
            <Link to="/work/new" className="btn secondary">
              <Plus size={16} />
              创建内容
            </Link>
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>内容标题</th>
                  <th>类型 / 部门</th>
                  <th>状态</th>
                  <th>最后修改</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map(({ doc, data }) => (
                  <tr key={doc.id}>
                    <td>
                      <Link className="table-title" to={`/work/${doc.id}`}>
                        {data.title}
                      </Link>
                      {data.summary && (
                        <small className="table-summary">{data.summary}</small>
                      )}
                    </td>
                    <td>
                      <span>{kinds[data.type]}</span>
                      <small>
                        {
                          departments.data?.find(
                            (d) => d.id === doc.departmentId,
                          )?.name
                        }
                      </small>
                    </td>
                    <td>
                      <span
                        className={`status ${doc.published ? "published" : ""}`}
                      >
                        {doc.published
                          ? doc.published !== doc.draft
                            ? "已发布 · 有草稿"
                            : "已发布"
                          : "未发布"}
                      </span>
                    </td>
                    <td>
                      {date(doc.updatedAt)}
                      <small>版本 {doc.version}</small>
                    </td>
                    <td>
                      <Link to={`/work/${doc.id}`} className="text-link">
                        编辑
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function ContentEditor() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { user } = useSession(),
    notice = useNotice(),
    [params] = useSearchParams();
  const result = useLoad<Doc<Content>>(id ? `/manage/documents/${id}` : null),
    departments = useLoad<Department[]>("/departments");
  const [doc, setDoc] = useState<Doc<Content> | null>(null),
    [data, setData] = useState<Content>(
      defaultContent(params.get("type") ?? "news"),
    ),
    [departmentId, setDepartmentId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [modal, setModal] = useState(""),
    [dirty, setDirty] = useState(false);
  const available =
    departments.data?.filter(
      (d) =>
        d.active &&
        (user.role === "admin" ||
          user.grants.some((g) => g.departmentId === d.id)),
    ) ?? [];
  useEffect(() => {
    if (result.data) {
      setDoc(result.data);
      setData(JSON.parse(result.data.draft));
      setDepartmentId(result.data.departmentId!);
      setDirty(false);
    }
  }, [result.data]);
  useEffect(() => {
    if (!departmentId && available.length) setDepartmentId(available[0].id);
  }, [available.length, departmentId]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const update = (patch: Partial<Content>) => {
    setData((old) => ({ ...old, ...patch }));
    setDirty(true);
  };
  async function save(publish = false) {
    setBusy(true);
    setError("");
    try {
      if (!departmentId) throw new Error("请先选择有权限的部门");
      let current = doc;
      if (!current)
        current = await send<Doc<Content>>(`/manage/content/${departmentId}`, {
          version: 0,
          data: { ...data, assetIds: [], coverId: null, videoId: null },
        });
      current = await send<Doc<Content>>(
        `/manage/documents/${current.id}`,
        { version: current.version, data },
        "PUT",
      );
      setDoc(current);
      setData(JSON.parse(current.draft));
      setDirty(false);
      if (publish) {
        current = await send<Doc<Content>>(
          `/manage/documents/${current.id}/publish`,
          { version: current.version },
        );
        setDoc(current);
      }
      notice(publish ? "内容已发布，前台已更新" : "草稿已保存");
      if (!id) navigate(`/work/${current.id}`, { replace: true });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (id && result.loading) return <Spinner />;
  if (id && result.error) return <ErrorBox message={result.error} />;
  const localDate = (value: string | null) =>
    value
      ? new Date(
          Date.parse(value) - new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <>
      <Link
        className="back-link"
        to="/work"
        onClick={(e) => {
          if (dirty && !confirm("有尚未保存的修改，确定离开？"))
            e.preventDefault();
        }}
      >
        ← 返回内容工作台
      </Link>
      <Heading
        eyebrow="CONTENT EDITOR"
        title={doc ? "编辑内容" : "新建内容"}
        text="先保存草稿，准备好后再发布。"
      >
        <button className="btn secondary" onClick={() => setModal("preview")}>
          <Eye size={16} />
          预览
        </button>
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() => save()}
        >
          <Save size={16} />
          保存草稿
        </button>
        <button
          className="btn primary"
          disabled={busy}
          onClick={() => save(true)}
        >
          <Send size={16} />
          {busy ? "处理中…" : "发布内容"}
        </button>
      </Heading>
      {error && <ErrorBox message={error} />}
      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel form-panel">
            <div className="form-row">
              <Field label="内容类型">
                <select
                  value={data.type}
                  disabled={!!doc?.published}
                  onChange={(e) => update({ type: e.target.value })}
                >
                  {Object.entries(kinds).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="所属部门">
                <select
                  value={departmentId}
                  disabled={!!doc}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">选择部门</option>
                  {available.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="标题 *">
              <input
                className="title-input"
                maxLength={200}
                placeholder="一个清晰的标题，让内容更容易被发现"
                value={data.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>
            <Field label="摘要">
              <textarea
                rows={3}
                maxLength={1000}
                value={data.summary}
                placeholder="简要介绍这条内容，将展示在列表和卡片中"
                onChange={(e) => update({ summary: e.target.value })}
              />
            </Field>
            <Field label="正文">
              <RichEditor
                value={data.body}
                onChange={(body) => update({ body })}
              />
            </Field>
          </section>
          {data.type === "document" && (
            <section className="panel form-panel">
              <h2>正式文件信息</h2>
              <div className="form-row">
                <Field label="文号">
                  <input
                    value={data.documentNumber}
                    onChange={(e) => update({ documentNumber: e.target.value })}
                    placeholder="例如：公司〔2026〕1 号"
                  />
                </Field>
                <Field label="发文单位 *">
                  <input
                    value={data.issuer}
                    onChange={(e) => update({ issuer: e.target.value })}
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="发文日期">
                  <input
                    type="date"
                    value={data.issuedOn}
                    onChange={(e) => update({ issuedOn: e.target.value })}
                  />
                </Field>
                <Field label="有效状态">
                  <select
                    value={data.effectiveState}
                    onChange={(e) => update({ effectiveState: e.target.value })}
                  >
                    <option value="pending">未生效</option>
                    <option value="effective">有效</option>
                    <option value="expired">已失效</option>
                    <option value="revoked">已废止</option>
                  </select>
                </Field>
              </div>
              <Field label="更正 / 版本说明">
                <textarea
                  value={data.changeNote}
                  onChange={(e) => update({ changeNote: e.target.value })}
                  placeholder="替换原件时请说明更正原因，历史版本将保留"
                />
              </Field>
              <Field label="替代文件 ID（可选）">
                <input
                  value={data.replacesId}
                  onChange={(e) => update({ replacesId: e.target.value })}
                />
              </Field>
            </section>
          )}
          {data.type === "video" && (
            <section className="panel form-panel">
              <h2>视频来源</h2>
              <Field
                label="视频地址"
                hint="支持已有 HTTP/HTTPS 视频地址，也可从素材库选择上传的 MP4/WebM。"
              >
                <input
                  placeholder="https://…"
                  value={data.videoUrl}
                  onChange={(e) => update({ videoUrl: e.target.value })}
                />
              </Field>
              <div className="asset-picker-row">
                <button
                  className="btn secondary"
                  onClick={() => setModal("video")}
                >
                  <VideoIcon />
                  {data.videoId ? "更换已上传视频" : "选择 / 上传视频"}
                </button>
                {data.videoId && (
                  <button
                    className="text-link"
                    onClick={() => update({ videoId: null })}
                  >
                    移除视频
                  </button>
                )}
              </div>
            </section>
          )}
          {data.type === "ticker" && (
            <section className="panel form-panel">
              <Field label="关联链接（可选）">
                <input
                  placeholder="https://…"
                  value={data.link}
                  onChange={(e) => update({ link: e.target.value })}
                />
              </Field>
              <p className="muted">
                首页跑马灯也可直接引用已发布新闻，不必重复创建短消息。
              </p>
            </section>
          )}
          {data.type === "survey" && (
            <section className="panel form-panel">
              <div className="section-heading">
                <h2>问卷题目</h2>
                <button
                  className="btn secondary small"
                  onClick={() =>
                    update({
                      questions: [
                        ...data.questions,
                        {
                          id: crypto.randomUUID(),
                          title: "",
                          type: "single",
                          required: true,
                          options: ["选项一", "选项二"],
                          min: null,
                          max: null,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  添加题目
                </button>
              </div>
              {data.questions.length === 0 && (
                <Empty
                  title="添加第一道题目"
                  text="支持单选、多选、文本、数字及评分题"
                />
              )}
              {data.questions.map((q, index) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  index={index}
                  update={(value) =>
                    update({
                      questions: data.questions.map((old) =>
                        old.id === q.id ? value : old,
                      ),
                    })
                  }
                  remove={() =>
                    update({
                      questions: data.questions.filter(
                        (old) => old.id !== q.id,
                      ),
                    })
                  }
                />
              ))}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={data.anonymous}
                  onChange={(e) => update({ anonymous: e.target.checked })}
                />
                登录匿名：仅记录参与资格，答卷不关联账号
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={data.closed}
                  onChange={(e) => update({ closed: e.target.checked })}
                />
                提前关闭问卷
              </label>
              <p className="muted">
                问卷开始收集答卷后，不能改变题目结构及匿名方式。
              </p>
            </section>
          )}
        </div>
        <aside className="editor-side">
          <section className="panel form-panel">
            <h2>发布设置</h2>
            <div className="save-status">
              <span className={`status ${doc?.published ? "published" : ""}`}>
                {doc?.published ? "线上已有发布版本" : "尚未发布"}
              </span>
              {dirty && <span className="dirty-dot">有未保存修改</span>}
            </div>
            <Field label="分类">
              <input
                value={data.category}
                onChange={(e) => update({ category: e.target.value })}
                placeholder="例如：企业动态"
              />
            </Field>
            <Field label="作者 / 来源">
              <input
                value={data.author}
                onChange={(e) => update({ author: e.target.value })}
              />
            </Field>
            <Field
              label={
                data.type === "survey" ? "问卷开始时间" : "开始展示时间（可选）"
              }
            >
              <input
                type="datetime-local"
                value={localDate(data.startsAt)}
                onChange={(e) =>
                  update({
                    startsAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
              />
            </Field>
            <Field
              label={
                data.type === "survey"
                  ? "问卷截止时间 *"
                  : "结束展示时间（可选）"
              }
            >
              <input
                type="datetime-local"
                value={localDate(data.endsAt)}
                onChange={(e) =>
                  update({
                    endsAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
              />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={data.pinned}
                onChange={(e) => update({ pinned: e.target.checked })}
              />
              置顶推荐
            </label>
            {doc?.published && (
              <button
                className="btn danger full"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm("下线后，普通用户将无法访问这条内容。确定继续？")
                  )
                    return;
                  setBusy(true);
                  try {
                    const next = await send<Doc<Content>>(
                      `/manage/documents/${doc.id}/unpublish`,
                      { version: doc.version },
                    );
                    setDoc(next);
                    notice("内容已下线，历史数据保留");
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                下线内容
              </button>
            )}
          </section>
          <section className="panel form-panel">
            <h2>封面与附件</h2>
            {data.coverId && (
              <img
                className="editor-cover"
                src={`/api/assets/${data.coverId}`}
                alt="封面"
              />
            )}
            <button
              className="btn secondary full"
              disabled={!departmentId}
              onClick={() => setModal("cover")}
            >
              选择 / 上传封面
            </button>
            {data.coverId && (
              <button
                className="text-link"
                onClick={() => update({ coverId: null })}
              >
                移除封面
              </button>
            )}
            <div className="attachment-count">
              <FileText size={17} />
              已关联 {data.assetIds.length} 个附件
            </div>
            <button
              className="btn secondary full"
              disabled={!departmentId}
              onClick={() => setModal("attachment")}
            >
              管理附件{data.type === "document" ? " / 原件" : ""}
            </button>
            {data.assetIds.map((assetId, i) => (
              <div className="mini-file" key={assetId}>
                <a
                  href={`/api/assets/${assetId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  附件 {i + 1}
                </a>
                <button
                  aria-label="移除附件"
                  onClick={() =>
                    update({
                      assetIds: data.assetIds.filter((a) => a !== assetId),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </section>
          {doc && (
            <section className="panel form-panel">
              <button
                className="btn secondary full"
                onClick={() => setModal("history")}
              >
                <History size={16} />
                版本与恢复
              </button>
              {data.type === "survey" &&
                (user.role === "admin" ||
                  user.grants.some(
                    (g) => g.departmentId === departmentId && g.canViewResults,
                  )) && (
                  <button
                    className="btn secondary full"
                    onClick={() => setModal("results")}
                  >
                    <BarChart3 size={16} />
                    查看问卷结果
                  </button>
                )}
            </section>
          )}
        </aside>
      </div>
      {["cover", "video", "attachment"].includes(modal) && (
        <AssetPicker
          departmentId={departmentId}
          mode={modal}
          close={() => setModal("")}
          onSelect={(asset) => {
            update(
              modal === "cover"
                ? { coverId: asset.id }
                : modal === "video"
                  ? { videoId: asset.id }
                  : { assetIds: [...new Set([...data.assetIds, asset.id])] },
            );
            setModal("");
          }}
        />
      )}
      {modal === "preview" && (
        <Modal title="内容预览 · 未发布" close={() => setModal("")} wide>
          <article className="article">
            <span className="pill">{kinds[data.type]}</span>
            <h1>{data.title || "未填写标题"}</h1>
            <p className="article-summary">{data.summary}</p>
            <div
              className="prose"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(data.body),
              }}
            />
            {data.type === "survey" && (
              <div className="info-banner">
                预览不会收集答卷，共 {data.questions.length} 道题。
              </div>
            )}
          </article>
        </Modal>
      )}
      {modal === "history" && doc && (
        <HistoryModal
          doc={doc}
          close={() => setModal("")}
          restored={(next) => {
            setDoc(next);
            setData(JSON.parse(next.draft));
            setDirty(false);
            setModal("");
          }}
        />
      )}
      {modal === "results" && doc && (
        <ResultsModal id={doc.id} close={() => setModal("")} />
      )}
    </>
  );
}
function VideoIcon() {
  return <FileText size={16} />;
}
function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { role: "textbox", "aria-label": "内容正文", class: "prose" },
    },
  });
  useEffect(() => {
    if (
      editor &&
      !editor.isDestroyed &&
      editor.schema &&
      editor.getHTML() !== value
    )
      editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);
  if (!editor) return null;
  const actions = [
    {
      icon: Bold,
      label: "加粗",
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: "斜体",
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Heading2,
      label: "标题",
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: List,
      label: "项目列表",
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: "编号列表",
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      label: "引用",
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: Link2,
      label: "插入链接",
      run: () => {
        const href = prompt("输入完整的 HTTP/HTTPS 地址");
        if (href && /^https?:\/\//i.test(href))
          editor.chain().focus().setLink({ href }).run();
      },
    },
  ];
  return (
    <div className="rich-editor">
      <div className="editor-toolbar">
        {actions.map((action) => (
          <button
            type="button"
            title={action.label}
            aria-label={action.label}
            key={action.label}
            onClick={action.run}
          >
            <action.icon size={16} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
function QuestionEditor({
  question: q,
  index,
  update,
  remove,
}: {
  question: Question;
  index: number;
  update: (q: Question) => void;
  remove: () => void;
}) {
  return (
    <div className="question-editor">
      <div className="section-heading">
        <span className="question-number">题目 {index + 1}</span>
        <button className="icon-btn" title="删除题目" onClick={remove}>
          <Trash2 size={16} />
        </button>
      </div>
      <Field label="题目">
        <input
          value={q.title}
          onChange={(e) => update({ ...q, title: e.target.value })}
        />
      </Field>
      <div className="form-row">
        <Field label="题型">
          <select
            value={q.type}
            onChange={(e) => update({ ...q, type: e.target.value })}
          >
            <option value="single">单选题</option>
            <option value="multiple">多选题</option>
            <option value="text">单行文本</option>
            <option value="textarea">多行文本</option>
            <option value="number">数字</option>
            <option value="rating">评分（1～5）</option>
          </select>
        </Field>
        <label className="check-row">
          <input
            type="checkbox"
            checked={q.required}
            onChange={(e) => update({ ...q, required: e.target.checked })}
          />
          必填
        </label>
      </div>
      {["single", "multiple"].includes(q.type) && (
        <Field label="选项（每行一个，不可重复）">
          <textarea
            rows={3}
            value={q.options.join("\n")}
            onChange={(e) =>
              update({ ...q, options: e.target.value.split("\n") })
            }
          />
        </Field>
      )}
      {q.type === "number" && (
        <div className="form-row">
          <Field label="最小值">
            <input
              type="number"
              value={q.min ?? ""}
              onChange={(e) =>
                update({
                  ...q,
                  min: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Field>
          <Field label="最大值">
            <input
              type="number"
              value={q.max ?? ""}
              onChange={(e) =>
                update({
                  ...q,
                  max: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Field>
        </div>
      )}
    </div>
  );
}
function AssetPicker({
  departmentId,
  mode,
  close,
  onSelect,
}: {
  departmentId: string;
  mode: string;
  close: () => void;
  onSelect: (asset: Asset) => void;
}) {
  const result = useLoad<Asset[]>(`/manage/assets/${departmentId}`),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const assets = result.data?.filter((a) =>
    mode === "cover"
      ? a.mime.startsWith("image/")
      : mode === "video"
        ? a.mime.startsWith("video/")
        : true,
  );
  return (
    <Modal title="部门素材库" close={close} wide>
      <div className="modal-body">
        <p className="muted">
          选择已有素材或上传新文件。支持常用图片、PDF、Office、MP4/WebM，单文件不超过
          200MB。
        </p>
        <label className="btn secondary upload-button">
          <Upload size={16} />
          {busy ? "正在上传…" : "上传文件"}
          <input
            type="file"
            disabled={busy}
            accept={
              mode === "cover"
                ? ".png,.jpg,.jpeg,.webp"
                : mode === "video"
                  ? ".mp4,.webm"
                  : ".png,.jpg,.jpeg,.webp,.pdf,.docx,.xlsx,.pptx,.txt,.mp4,.webm"
            }
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 200 * 1024 * 1024) {
                setError("文件超过 200MB");
                return;
              }
              setBusy(true);
              setError("");
              try {
                const form = new FormData();
                form.append("file", file);
                await api(`/manage/assets/${departmentId}`, {
                  method: "POST",
                  body: form,
                });
                result.reload();
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {error && <ErrorBox message={error} />}
        {result.loading ? (
          <Spinner />
        ) : result.error ? (
          <ErrorBox message={result.error} />
        ) : !assets?.length ? (
          <Empty
            title="暂无可选素材"
            text="上传后，文件会保存在本部门素材库中。"
          />
        ) : (
          <div className="asset-grid">
            {assets.map((a) => (
              <button
                key={a.id}
                className="asset-card"
                onClick={() => onSelect(a)}
              >
                {a.mime.startsWith("image/") ? (
                  <img src={`/api/assets/${a.id}`} alt="" />
                ) : (
                  <FileText size={28} />
                )}
                <strong>{a.filename}</strong>
                <small>{(a.size / 1024 / 1024).toFixed(2)} MB</small>
                <span>
                  选择此文件
                  <ArrowRight size={13} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
interface SurveyResults {
  total: number;
  anonymous: boolean;
  questions: {
    id: string;
    title: string;
    type: string;
    options: { option: string; count: number }[];
    average: number | null;
    count: number;
    texts: string[];
  }[];
}
function ResultsModal({ id, close }: { id: string; close: () => void }) {
  const result = useLoad<SurveyResults>(`/manage/surveys/${id}/results`);
  return (
    <Modal title="问卷结果" close={close} wide>
      <div className="modal-body">
        {result.loading ? (
          <Spinner />
        ) : result.error ? (
          <ErrorBox message={result.error} />
        ) : (
          <>
            <div className="section-heading">
              <div>
                <h2>{result.data!.total} 份答卷</h2>
                <p className="muted">
                  {result.data!.anonymous ? "匿名答卷不含身份映射" : "实名问卷"}{" "}
                  · 选择比例以总答卷数为分母
                </p>
              </div>
              <a
                className="btn secondary"
                href={`/api/manage/surveys/${id}/export`}
              >
                导出 CSV
              </a>
            </div>
            {result.data!.questions.map((q) => (
              <div className="result-question" key={q.id}>
                <h3>{q.title}</h3>
                {q.type === "multiple" && (
                  <small>多选题，各选项占比之和可能超过 100%</small>
                )}
                {q.options.map((o) => (
                  <div className="result-option" key={o.option}>
                    <span>{o.option}</span>
                    <div>
                      <i
                        style={{
                          width: `${result.data!.total ? (o.count / result.data!.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <small>{o.count} 人</small>
                  </div>
                ))}
                {q.average !== null && (
                  <p>
                    平均值：<strong>{q.average.toFixed(2)}</strong> · {q.count}{" "}
                    份有效数值
                  </p>
                )}
                {q.texts.map((t, i) => (
                  <blockquote key={i}>{t}</blockquote>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
