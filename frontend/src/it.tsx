import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  FileText,
  Globe2,
  LayoutGrid,
  Monitor,
  Plus,
  Save,
  Send,
  Settings2,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
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
  defaultModule,
  kinds,
  roles,
  type Account,
  type Department,
  type Doc,
  type Page,
  type Module,
  type Item,
  type Revision,
  type Site,
  type Template,
} from "./types";
import { ModuleView, TemplatePreview } from "./portal";
import { HistoryModal } from "./history";
import {
  themes,
  themeId,
  themeStyle,
  moduleStyle,
  useSiteTheme,
} from "./themes";

export function Dashboard() {
  const departments = useLoad<Department[]>("/departments"),
    pages = useLoad<Doc[]>("/manage/documents?kind=page"),
    users = useLoad<Account[]>("/it/users"),
    content = useLoad<Item[]>("/portal/content");
  const ready = (departments.data?.length ?? 0) > 0,
    configured = pages.data?.some(
      (p) => JSON.parse(p.draft).modules.length > 0,
    ),
    assigned = users.data?.some(
      (u) => u.role === "editor" && u.grants.length > 0,
    );
  return (
    <>
      <Heading
        eyebrow="CONFIGURATION CENTER"
        title="构建你的企业工作空间"
        text="先搭建结构，再让每个部门的内容在这里汇聚。"
      >
        <Link className="btn secondary" to="/">
          <Eye size={16} />
          查看门户
        </Link>
      </Heading>
      <section className="admin-hero">
        <div>
          <span className="pill light">IT 工作空间</span>
          <h2>
            把复杂的管理，
            <br />
            变成清晰的配置。
          </h2>
          <p>
            页面、部门、模板各司其职，
            <br />
            业务内容交给最了解它的人。
          </p>
          <Link className="btn cream" to="/it/pages/home">
            开始配置首页
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hero-layout" aria-hidden="true">
          <div />
          <section>
            <i />
            <i />
            <i />
          </section>
          <section>
            <i />
            <i />
          </section>
        </div>
      </section>
      <div className="metrics">
        {[
          {
            label: "部门空间",
            value: departments.data?.filter((d) => d.active).length ?? 0,
            icon: Building2,
          },
          {
            label: "页面配置",
            value: pages.data?.length ?? 0,
            icon: LayoutGrid,
          },
          { label: "用户账号", value: users.data?.length ?? 0, icon: Users },
          {
            label: "已发布内容",
            value: content.data?.length ?? 0,
            icon: FileText,
          },
        ].map((m) => (
          <div className="panel metric" key={m.label}>
            <span>
              {m.label}
              <m.icon size={18} />
            </span>
            <strong>{m.value.toString().padStart(2, "0")}</strong>
            <small>来自当前系统的真实数据</small>
          </div>
        ))}
      </div>
      <section className="panel checklist">
        <div className="section-heading">
          <h2>建立站点，只需循序而行</h2>
          <span className="muted">配置完成后，业务内容仍保持为空</span>
        </div>
        {[
          {
            title: "创建部门空间",
            text: "建立组织范围，为每个部门准备独立页面。",
            done: ready,
            url: "/it/departments",
          },
          {
            title: "组合页面模块",
            text: "选模板、加模块，通过预览确认每一种尺寸。",
            done: configured,
            url: "/it/pages/home",
          },
          {
            title: "分配部门管理员",
            text: "把内容维护权限交给业务，结果权限单独授予。",
            done: assigned,
            url: "/it/users",
          },
        ].map((step, i) => (
          <Link to={step.url} key={step.title}>
            <span className={`step-number ${step.done ? "done" : ""}`}>
              {step.done ? <Check size={18} /> : `0${i + 1}`}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            <ArrowRight size={18} />
          </Link>
        ))}
      </section>
    </>
  );
}

export function Departments() {
  const result = useLoad<Department[]>("/departments"),
    notice = useNotice();
  const [editing, setEditing] = useState<Partial<Department> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Heading
        eyebrow="DEPARTMENTS"
        title="部门管理"
        text="独立的内容空间，统一的管理边界。"
      >
        <button
          className="btn primary"
          onClick={() => {
            setError("");
            setEditing({
              name: "",
              description: "",
              active: true,
              sortOrder: result.data?.length ?? 0,
            });
          }}
        >
          <Plus size={17} />
          新建部门
        </button>
      </Heading>
      {result.loading ? (
        <Spinner />
      ) : result.error ? (
        <ErrorBox message={result.error} retry={result.reload} />
      ) : !result.data?.length ? (
        <section className="panel">
          <Empty
            title="创建第一个部门空间"
            text="部门创建后会拥有独立页面，等待配置和业务内容填充。"
          />
        </section>
      ) : (
        <div className="department-cards">
          {result.data.map((d) => (
            <section
              className={`panel department-card ${!d.active ? "inactive" : ""}`}
              key={d.id}
            >
              <div className="section-heading">
                <span className="type-symbol">
                  <Building2 size={23} />
                </span>
                <span className={`status ${d.active ? "published" : ""}`}>
                  {d.active ? "启用中" : "已停用"}
                </span>
              </div>
              <h2>{d.name}</h2>
              <p>{d.description || "尚未填写部门介绍"}</p>
              <div className="department-actions">
                <Link className="text-link" to={`/it/pages/${d.id}`}>
                  配置部门页面
                  <ArrowRight size={14} />
                </Link>
                <button
                  className="text-link"
                  onClick={() => {
                    setEditing(d);
                    setError("");
                  }}
                >
                  编辑
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={editing.id ? "编辑部门" : "新建部门"}
          close={() => setEditing(null)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await send(
                  editing.id
                    ? `/it/departments/${editing.id}`
                    : "/it/departments",
                  editing,
                  editing.id ? "PUT" : "POST",
                );
                setEditing(null);
                result.reload();
                notice("部门设置已保存");
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="部门名称 *">
              <input
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </Field>
            <Field label="部门介绍">
              <textarea
                rows={4}
                maxLength={1000}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>
            <Field label="排序">
              <input
                type="number"
                value={editing.sortOrder}
                onChange={(e) =>
                  setEditing({ ...editing, sortOrder: Number(e.target.value) })
                }
              />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              启用部门
            </label>
            {editing.id && (
              <p className="muted">
                停用会撤下部门导航和内容，已保存的数据与历史版本保留。
              </p>
            )}
            {error && <ErrorBox message={error} />}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button className="btn primary" disabled={busy}>
                保存部门
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

interface UserDraft {
  id?: string;
  username: string;
  name: string;
  password: string;
  role: string;
  active: boolean;
  grants: { departmentId: string; canViewResults: boolean }[];
}
export function UsersPage() {
  const result = useLoad<Account[]>("/it/users"),
    departments = useLoad<Department[]>("/departments"),
    { user, refresh } = useSession(),
    notice = useNotice();
  const [editing, setEditing] = useState<UserDraft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const roleOptions = Object.entries(roles).filter(
    ([key]) => user.role === "admin" || ["editor", "reader"].includes(key),
  );
  return (
    <>
      <Heading
        eyebrow="ACCESS & PEOPLE"
        title="用户与授权"
        text="内容维护和问卷结果，分别授予恰当的权限。"
      >
        <button
          className="btn primary"
          onClick={() => {
            setError("");
            setEditing({
              username: "",
              name: "",
              password: "",
              role: "editor",
              active: true,
              grants: [],
            });
          }}
        >
          <Plus size={17} />
          创建用户
        </button>
      </Heading>
      <section className="panel">
        {result.loading ? (
          <Spinner />
        ) : result.error ? (
          <ErrorBox message={result.error} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>授权部门</th>
                  <th>状态</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <small>{u.username}</small>
                    </td>
                    <td>{roles[u.role]}</td>
                    <td>
                      {u.grants
                        .map(
                          (g) =>
                            departments.data?.find(
                              (d) => d.id === g.departmentId,
                            )?.name,
                        )
                        .join("、") || "—"}
                    </td>
                    <td>
                      <span className={`status ${u.active ? "published" : ""}`}>
                        {u.active ? "启用" : "停用"}
                      </span>
                    </td>
                    <td>
                      {(user.role === "admin" ||
                        ["editor", "reader"].includes(u.role)) && (
                        <button
                          className="text-link"
                          onClick={() => {
                            setError("");
                            setEditing({ ...u, password: "" });
                          }}
                        >
                          编辑授权
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <Modal
          title={editing.id ? "编辑用户与授权" : "创建用户"}
          close={() => setEditing(null)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await send(
                  editing.id ? `/it/users/${editing.id}` : "/it/users",
                  editing,
                  editing.id ? "PUT" : "POST",
                );
                const self = editing.id === user.id;
                setEditing(null);
                result.reload();
                notice("账号与授权已保存");
                if (self) await refresh();
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-row">
              <Field label="用户名 *">
                <input
                  required
                  maxLength={80}
                  value={editing.username}
                  onChange={(e) =>
                    setEditing({ ...editing, username: e.target.value })
                  }
                />
              </Field>
              <Field label="姓名 *">
                <input
                  required
                  maxLength={100}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field
              label={editing.id ? "重置密码（留空保持不变）" : "初始密码 *"}
              hint="12～128 位。账号变更会使其现有登录会话失效。"
            >
              <input
                type="password"
                required={!editing.id}
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={editing.password}
                onChange={(e) =>
                  setEditing({ ...editing, password: e.target.value })
                }
              />
            </Field>
            <Field label="角色">
              <select
                value={editing.role}
                disabled={editing.id === user.id}
                onChange={(e) =>
                  setEditing({ ...editing, role: e.target.value })
                }
              >
                {roleOptions.map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                disabled={editing.id === user.id}
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              启用账号
            </label>
            {editing.role === "editor" && (
              <div className="grant-list">
                <h3>部门内容权限</h3>
                {departments.data
                  ?.filter((d) => d.active)
                  .map((d) => {
                    const grant = editing.grants.find(
                      (g) => g.departmentId === d.id,
                    );
                    return (
                      <div className="grant-row" key={d.id}>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={!!grant}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                grants: e.target.checked
                                  ? [
                                      ...editing.grants,
                                      {
                                        departmentId: d.id,
                                        canViewResults: false,
                                      },
                                    ]
                                  : editing.grants.filter(
                                      (g) => g.departmentId !== d.id,
                                    ),
                              })
                            }
                          />
                          {d.name}
                        </label>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            disabled={!grant}
                            checked={grant?.canViewResults ?? false}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                grants: editing.grants.map((g) =>
                                  g.departmentId === d.id
                                    ? { ...g, canViewResults: e.target.checked }
                                    : g,
                                ),
                              })
                            }
                          />
                          可查看问卷结果
                        </label>
                      </div>
                    );
                  })}
                {!departments.data?.length && (
                  <p className="muted">请先创建部门，再进行授权。</p>
                )}
              </div>
            )}
            {error && <ErrorBox message={error} />}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button disabled={busy} className="btn primary">
                保存用户
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function PageEditor() {
  const siteTheme = useSiteTheme();
  const { id = "home" } = useParams(),
    navigate = useNavigate(),
    notice = useNotice();
  const result = useLoad<Doc<Page>>(`/manage/documents/${id}`),
    departments = useLoad<Department[]>("/departments"),
    content = useLoad<Item[]>("/portal/content"),
    templates = useLoad<Doc<Template>[]>("/manage/documents?kind=template");
  const [doc, setDoc] = useState<Doc<Page> | null>(null),
    [page, setPage] = useState<Page | null>(null),
    [selected, setSelected] = useState(""),
    [phone, setPhone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [library, setLibrary] = useState(false),
    [history, setHistory] = useState(false);
  useEffect(() => {
    if (result.data) {
      setDoc(result.data);
      setPage(JSON.parse(result.data.draft));
      setDirty(false);
      setSelected("");
    }
  }, [result.data]);
  const change = (next: Page) => {
    setPage(next);
    setDirty(true);
  };
  const patchModule = (patch: Partial<Module>) => {
    if (page)
      change({
        ...page,
        modules: page.modules.map((m) =>
          m.id === selected ? { ...m, ...patch } : m,
        ),
      });
  };
  async function save(publish = false) {
    if (!page || !doc) return;
    setBusy(true);
    setError("");
    try {
      let next = await send<Doc<Page>>(
        `/manage/documents/${id}`,
        { version: doc.version, data: page },
        "PUT",
      );
      setDoc(next);
      setPage(JSON.parse(next.draft));
      setDirty(false);
      if (publish) {
        next = await send<Doc<Page>>(`/manage/documents/${id}/publish`, {
          version: next.version,
        });
        setDoc(next);
      }
      notice(publish ? "页面配置已发布" : "页面草稿已保存");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (result.error) return <ErrorBox message={result.error} />;
  if (result.loading || !page) return <Spinner />;
  const active = page.modules.find((m) => m.id === selected);
  return (
    <>
      <Heading
        eyebrow="PAGE BUILDER"
        title="页面与模块"
        text="选择模板，组合内容。每一次修改，都可以先预览。"
      >
        <button className="btn secondary" onClick={() => setHistory(true)}>
          版本历史
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
          发布配置
        </button>
      </Heading>
      {error && <ErrorBox message={error} />}
      <div className="builder-topbar">
        <select
          aria-label="选择配置页面"
          value={id}
          onChange={(e) => {
            if (!dirty || confirm("有未保存的修改，确定切换页面？"))
              navigate(`/it/pages/${e.target.value}`);
          }}
        >
          <option value="home">站点首页</option>
          {departments.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {!d.active ? "（已停用）" : ""}
            </option>
          ))}
        </select>
        <span className={`status ${doc?.published ? "published" : ""}`}>
          {dirty ? "有未保存修改" : doc?.published ? "有线上版本" : "尚未发布"}
        </span>
        <Link
          className="text-link"
          target="_blank"
          to={`${id === "home" ? "/" : `/departments/${id}`}?preview`}
        >
          打开已保存草稿预览
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="builder-layout">
        <div className="builder-controls">
          <section className="panel form-panel">
            <h2>页面设置</h2>
            <Field label="页面名称">
              <input
                value={page.name}
                onChange={(e) => change({ ...page, name: e.target.value })}
              />
            </Field>
            <Field label="页面介绍">
              <textarea
                rows={2}
                value={page.description}
                onChange={(e) =>
                  change({ ...page, description: e.target.value })
                }
              />
            </Field>
            <div className="form-row">
              <Field label="布局模板">
                <select
                  value={page.layout}
                  onChange={(e) => change({ ...page, layout: e.target.value })}
                >
                  <option value="editorial">舒展门户 · 宽松留白</option>
                  <option value="compact">高效信息 · 紧凑布局</option>
                </select>
              </Field>
              <Field label="页面主题色">
                <input
                  type="color"
                  value={page.accent}
                  onChange={(e) => change({ ...page, accent: e.target.value })}
                />
              </Field>
            </div>
          </section>
          <section className="panel form-panel">
            <div className="section-heading">
              <h2>
                页面模块{" "}
                <span className="count-badge">{page.modules.length}</span>
              </h2>
              <button
                className="btn secondary small"
                onClick={() => setLibrary(true)}
              >
                <Plus size={15} />
                添加模块
              </button>
            </div>
            {page.modules.length === 0 && (
              <Empty
                title="选择页面的第一块内容"
                text="从新闻、公告、视频等六种模块开始。"
              />
            )}
            {page.modules.map((m, index) => (
              <div
                className={`module-control ${selected === m.id ? "selected" : ""}`}
                key={m.id}
              >
                <button
                  className="module-select"
                  onClick={() => setSelected(selected === m.id ? "" : m.id)}
                >
                  <span className="module-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{m.title}</strong>
                    <small>
                      {kinds[m.type]} · {m.width}/12 列
                      {m.hidden ? " · 隐藏" : ""}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                <div className="module-control-actions">
                  <button
                    title="上移"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...page.modules];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      change({ ...page, modules: next });
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    title="下移"
                    disabled={index === page.modules.length - 1}
                    onClick={() => {
                      const next = [...page.modules];
                      [next[index + 1], next[index]] = [
                        next[index],
                        next[index + 1],
                      ];
                      change({ ...page, modules: next });
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    title="复制模块"
                    onClick={() =>
                      change({
                        ...page,
                        modules: [
                          ...page.modules.slice(0, index + 1),
                          {
                            ...m,
                            id: crypto.randomUUID(),
                            title: m.title + " 副本",
                          },
                          ...page.modules.slice(index + 1),
                        ],
                      })
                    }
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    title="移除模块"
                    onClick={() => {
                      if (confirm("仅移除模块展示，保留业务内容。确定？"))
                        change({
                          ...page,
                          modules: page.modules.filter((v) => v.id !== m.id),
                        });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </section>
          {active && (
            <section className="panel form-panel module-settings">
              <h2>模块设置 · {active.title}</h2>
              <Field label="模块标题">
                <input
                  value={active.title}
                  onChange={(e) => patchModule({ title: e.target.value })}
                />
              </Field>
              <div className="form-row">
                <Field label="展示样式">
                  <select
                    value={active.variant}
                    onChange={(e) => patchModule({ variant: e.target.value })}
                  >
                    <option value="list">清晰列表</option>
                    <option value="cards">图文卡片</option>
                    <option value="featured">首条突出</option>
                  </select>
                </Field>
                <Field label="桌面占宽">
                  <select
                    value={active.width}
                    onChange={(e) =>
                      patchModule({ width: Number(e.target.value) })
                    }
                  >
                    <option value={4}>三分之一</option>
                    <option value={6}>二分之一</option>
                    <option value={8}>三分之二</option>
                    <option value={12}>整行</option>
                  </select>
                </Field>
              </div>
              <Field label="内容来源部门">
                <select
                  value={active.departmentId}
                  onChange={(e) =>
                    patchModule({ departmentId: e.target.value })
                  }
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
              </Field>
              <div className="form-row">
                <Field label="分类筛选">
                  <input
                    placeholder="留空为全部分类"
                    value={active.category}
                    onChange={(e) => patchModule({ category: e.target.value })}
                  />
                </Field>
                <Field label="展示数量">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={active.count}
                    onChange={(e) =>
                      patchModule({ count: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              {themeId(siteTheme) !== "custom" && (
                <p className="theme-note">
                  当前预设主题统一模块配色。下方颜色仍会保存，切回自选主题色后生效。
                </p>
              )}
              <div className="form-row">
                <Field label="模块强调色">
                  <input
                    type="color"
                    value={active.accent}
                    onChange={(e) => patchModule({ accent: e.target.value })}
                  />
                </Field>
                <Field label="模块背景">
                  <input
                    type="color"
                    value={active.background}
                    onChange={(e) =>
                      patchModule({ background: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="没有内容时">
                <select
                  value={active.emptyMode}
                  onChange={(e) => patchModule({ emptyMode: e.target.value })}
                >
                  <option value="show">展示空状态</option>
                  <option value="hide">隐藏模块</option>
                </select>
              </Field>
              {active.type === "ticker" && (
                <Field label="跑马灯模式">
                  <select
                    value={active.tickerMode}
                    onChange={(e) =>
                      patchModule({ tickerMode: e.target.value })
                    }
                  >
                    <option value="scroll">横向滚动（可暂停）</option>
                    <option value="static">静态展示</option>
                  </select>
                </Field>
              )}
              <Field
                label="自定义模板"
                hint="只使用已经发布的模板版本，后续修改模板不会自动影响此页面。"
              >
                <select
                  value={active.templateId}
                  onChange={async (e) => {
                    const templateId = e.target.value;
                    if (!templateId) {
                      patchModule({ templateId: "", templateVersion: 0 });
                      return;
                    }
                    try {
                      const revisions = await api<Revision[]>(
                        `/manage/documents/${templateId}/history`,
                      );
                      const published = revisions.find(
                        (r) => r.action === "publish",
                      );
                      if (!published) throw new Error("此模板尚未发布");
                      patchModule({
                        templateId,
                        templateVersion: published.version,
                      });
                    } catch (e) {
                      notice(errorText(e), true);
                    }
                  }}
                >
                  <option value="">使用内置样式</option>
                  {templates.data
                    ?.filter((t) => t.published)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {JSON.parse(t.draft).name}
                      </option>
                    ))}
                </select>
              </Field>
              {active.templateId && (
                <p className="muted">
                  绑定模板版本 {active.templateVersion}
                  ；重新选择可升级至最新发布版。
                </p>
              )}
              <Field label="人工推荐（优先展示后自动补足）">
                <select
                  multiple
                  size={4}
                  value={active.selectedIds}
                  onChange={(e) =>
                    patchModule({
                      selectedIds: Array.from(
                        e.target.selectedOptions,
                        (o) => o.value,
                      ),
                    })
                  }
                >
                  {content.data
                    ?.filter(
                      (i) =>
                        (active.type === "ticker"
                          ? ["news", "notice", "ticker"].includes(i.data.type)
                          : i.data.type === active.type) &&
                        (!active.departmentId ||
                          i.departmentId === active.departmentId),
                    )
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.data.title}
                      </option>
                    ))}
                </select>
              </Field>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={active.hidden}
                  onChange={(e) => patchModule({ hidden: e.target.checked })}
                />
                隐藏模块
              </label>
            </section>
          )}
        </div>
        <section className="builder-preview">
          <div className="preview-toolbar">
            <span>
              <Eye size={16} />
              实时布局预览
            </span>
            <div>
              <button
                className={!phone ? "active" : ""}
                aria-label="桌面预览"
                onClick={() => setPhone(false)}
              >
                <Monitor size={17} />
              </button>
              <button
                className={phone ? "active" : ""}
                aria-label="手机预览"
                onClick={() => setPhone(true)}
              >
                <Smartphone size={17} />
              </button>
            </div>
          </div>
          <div className={`preview-canvas ${phone ? "phone" : ""}`}>
            <div
              className="preview-page-heading"
              style={{ borderColor: page.accent }}
            >
              <small>WORKPLACE</small>
              <h2>{page.name}</h2>
              <p>{page.description}</p>
            </div>
            <div className={`portal-grid ${page.layout}`}>
              {page.modules
                .filter((m) => !m.hidden)
                .map((m) => {
                  const items = (content.data ?? [])
                    .filter(
                      (i) =>
                        (m.type === "ticker"
                          ? ["news", "notice", "ticker"].includes(i.data.type)
                          : i.data.type === m.type) &&
                        (!m.departmentId ||
                          i.departmentId === m.departmentId) &&
                        (!m.category || i.data.category === m.category),
                    )
                    .sort((a, b) => {
                      const ai = m.selectedIds.indexOf(a.id),
                        bi = m.selectedIds.indexOf(b.id);
                      return (
                        (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi) ||
                        Number(b.data.pinned) - Number(a.data.pinned)
                      );
                    })
                    .slice(0, m.count);
                  return items.length || m.emptyMode === "show" ? (
                    <ModuleView
                      key={m.id}
                      module={{ config: m, items, template: null }}
                    />
                  ) : null;
                })}
            </div>
            {page.modules.length === 0 && (
              <Empty
                title="页面还没有模块"
                text="在左侧添加模块，预览会随配置更新。"
              />
            )}
          </div>
          <p className="preview-hint">
            内容为真实已发布数据。自定义模板效果请保存草稿后打开完整预览。
          </p>
        </section>
      </div>
      {history && doc && (
        <HistoryModal
          doc={doc}
          close={() => setHistory(false)}
          restored={(next) => {
            setDoc(next);
            setPage(JSON.parse(next.draft));
            setDirty(false);
            setHistory(false);
          }}
        />
      )}
      {library && (
        <Modal title="添加开箱即用模块" close={() => setLibrary(false)} wide>
          <div className="module-library">
            {Object.entries(kinds).map(([type, title]) => (
              <button
                key={type}
                onClick={() => {
                  const module = defaultModule(type, id === "home" ? "" : id);
                  change({ ...page, modules: [...page.modules, module] });
                  setSelected(module.id);
                  setLibrary(false);
                }}
              >
                <span className={`type-symbol ${type}`}>
                  <LayoutGrid size={21} />
                </span>
                <h3>{title}</h3>
                <p>
                  {
                    (
                      {
                        news: "企业动态、图文新闻与部门报道",
                        notice: "重要提醒、通知与时效管理",
                        video: "培训视频与配套学习资料",
                        document: "正式发文、文号与原件",
                        ticker: "复用新闻或维护独立短消息",
                        survey: "题目、参与校验及结果统计",
                      } as Record<string, string>
                    )[type]
                  }
                </p>
                <span className="text-link">
                  添加模块
                  <Plus size={15} />
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

const initialTemplate: Template = {
  name: "我的内容卡片",
  html: '<section class="collection">{{items}}</section>',
  itemHtml:
    '<article class="entry"><small>{{department}} · {{date}}</small><a href="{{url}}"><h3>{{title}}</h3></a><p>{{summary}}</p></article>',
  css: ".collection{display:grid;gap:16px;padding:20px}.entry{border-left:3px solid #226957;padding:6px 16px}.entry small{color:#718078}.entry h3{margin:8px 0;font-size:17px}.entry a{text-decoration:none}.entry p{color:#69766f;line-height:1.7}",
};
export function Templates() {
  const result = useLoad<Doc<Template>[]>("/manage/documents?kind=template"),
    navigate = useNavigate(),
    notice = useNotice(),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Heading
        eyebrow="TEMPLATE LIBRARY"
        title="模板库"
        text="先选择合适的样式，再用 HTML / CSS 表达你的想法。"
      >
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const doc = await send<Doc<Template>>(
                "/it/templates",
                initialTemplate,
              );
              navigate(`/it/templates/${doc.id}`);
            } catch (e) {
              notice(errorText(e), true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Plus size={17} />
          创建自定义模板
        </button>
      </Heading>
      <div className="info-banner">
        内置样式在页面配置中直接选择；自定义模板发布后，由页面绑定指定版本。
      </div>
      <div className="template-cards">
        {["清晰列表", "图文卡片", "首条突出"].map((name, index) => (
          <section className="panel template-card" key={name}>
            <div className={`template-thumbnail layout-${index}`}>
              <i />
              <i />
              <i />
            </div>
            <span className="pill">内置模板</span>
            <h2>{name}</h2>
            <p>响应式布局，手机端自动适配。</p>
            <Link to="/it/pages/home" className="text-link">
              前往页面配置
              <ArrowRight size={15} />
            </Link>
          </section>
        ))}
        {result.data?.map((doc) => (
          <section className="panel template-card" key={doc.id}>
            <div className="template-thumbnail custom">
              <Code2 size={38} />
            </div>
            <span className={`status ${doc.published ? "published" : ""}`}>
              {doc.published ? "已发布" : "草稿"}
            </span>
            <h2>{JSON.parse(doc.draft).name}</h2>
            <p>自定义 HTML/CSS · 当前版本 {doc.version}</p>
            <Link to={`/it/templates/${doc.id}`} className="text-link">
              编辑模板
              <ArrowRight size={15} />
            </Link>
          </section>
        ))}
      </div>
      {result.error && <ErrorBox message={result.error} />}
    </>
  );
}
export function TemplateEditor() {
  const { id } = useParams(),
    result = useLoad<Doc<Template>>(`/manage/documents/${id}`),
    notice = useNotice();
  const [doc, setDoc] = useState<Doc<Template> | null>(null),
    [value, setValue] = useState<Template | null>(null),
    [tab, setTab] = useState<"html" | "itemHtml" | "css">("itemHtml"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (result.data) {
      setDoc(result.data);
      setValue(JSON.parse(result.data.draft));
    }
  }, [result.data]);
  async function save(publish = false) {
    if (!doc || !value) return;
    setBusy(true);
    setError("");
    try {
      let next = await send<Doc<Template>>(
        `/manage/documents/${doc.id}`,
        { version: doc.version, data: value },
        "PUT",
      );
      setDoc(next);
      setValue(JSON.parse(next.draft));
      if (publish) {
        next = await send<Doc<Template>>(
          `/manage/documents/${doc.id}/publish`,
          { version: next.version },
        );
        setDoc(next);
      }
      notice(publish ? "模板已发布；页面需显式选择此版本" : "模板草稿已保存");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (result.error) return <ErrorBox message={result.error} />;
  if (result.loading || !value) return <Spinner />;
  const sample: Item[] = [
    {
      id: "preview-only",
      departmentId: "preview",
      departmentName: "部门名称（预览示例）",
      updatedAt: new Date().toISOString(),
      data: {
        type: "news",
        title: "新闻标题将在这里呈现（预览示例）",
        summary: "这是模板预览示例，不是已发布业务内容。",
      } as ContentForTemplate,
    },
  ];
  return (
    <>
      <Link to="/it/templates" className="back-link">
        ← 返回模板库
      </Link>
      <Heading
        eyebrow="TEMPLATE EDITOR"
        title="编辑自定义模板"
        text="受控 HTML/CSS · 样式隔离 · 不执行自定义脚本"
      >
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
          发布模板
        </button>
      </Heading>
      {error && <ErrorBox message={error} />}
      <Field label="模板名称">
        <input
          value={value.name}
          maxLength={100}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
      </Field>
      <div className="template-editor-layout">
        <section className="panel code-panel">
          <div className="tabs">
            {(
              [
                ["html", "外层 HTML"],
                ["itemHtml", "单项 HTML"],
                ["css", "CSS"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            spellCheck={false}
            aria-label={tab}
            value={value[tab]}
            onChange={(e) => setValue({ ...value, [tab]: e.target.value })}
          />
          <div className="binding-help">
            <strong>可用字段</strong>
            <code>
              {
                "{{items}} {{title}} {{summary}} {{department}} {{date}} {{url}} {{type}}"
              }
            </code>
            <p>
              外层需包含 {"{{items}}"}；单项需包含 {"{{title}}"}。CSS
              只作用于当前模块，不支持外部资源和 @ 导入。
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="preview-toolbar">
            <span>
              <Eye size={16} />
              模板预览
            </span>
            <span className="pill">示例数据</span>
          </div>
          <TemplatePreview template={value} title={value.name} items={sample} />
        </section>
      </div>
    </>
  );
}
type ContentForTemplate = Item["data"];

export function SiteSettings() {
  const result = useLoad<Doc<Site>>("/manage/documents/site"),
    [doc, setDoc] = useState<Doc<Site> | null>(null),
    [value, setValue] = useState<Site | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    notice = useNotice();
  useEffect(() => {
    if (result.data) {
      setDoc(result.data);
      setValue(JSON.parse(result.data.draft));
    }
  }, [result.data]);
  if (result.error) return <ErrorBox message={result.error} />;
  if (result.loading || !value) return <Spinner />;
  return (
    <>
      <Heading
        eyebrow="SITE SETTINGS"
        title="站点设置"
        text="给工作门户一个清晰、一致的身份。"
      />
      <form
        className="site-settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!doc) return;
          setBusy(true);
          setError("");
          try {
            const saved = await send<Doc<Site>>(
              "/manage/documents/site",
              { version: doc.version, data: value },
              "PUT",
            );
            setDoc(saved);
            setDoc(
              await send<Doc<Site>>("/manage/documents/site/publish", {
                version: saved.version,
              }),
            );
            window.dispatchEvent(new Event("site-published"));
            notice("站点设置已发布，全站主题已更新");
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <section
          className="panel form-panel site-identity-fields"
          aria-label="站点信息"
        >
          <Field label="站点名称">
            <input
              required
              maxLength={100}
              value={value.name}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
            />
          </Field>
          <Field label="副标题">
            <input
              maxLength={200}
              value={value.subtitle}
              onChange={(e) => setValue({ ...value, subtitle: e.target.value })}
            />
          </Field>
          <Field label="页脚文案">
            <input
              maxLength={500}
              value={value.footer}
              onChange={(e) => setValue({ ...value, footer: e.target.value })}
            />
          </Field>
        </section>
        <div className="theme-settings-layout">
          <section className="panel form-panel theme-picker">
            <div className="section-heading">
              <h2>选择网站主题</h2>
              <span className="pill">10 套配色</span>
            </div>
            <p className="muted">
              从导航到模块，使用一套协调的主色、辅助色与背景。选择后先在右侧预览，发布后全站生效。
            </p>
            {["四季", "节日", "通用"].map((group) => (
              <fieldset className="theme-group" key={group}>
                <legend>
                  {group === "四季"
                    ? "四季流转"
                    : group === "节日"
                      ? "节日氛围"
                      : "品牌与特殊场景"}
                </legend>
                <div className="theme-options">
                  {themes
                    .filter((t) => t.group === group)
                    .map((theme) => (
                      <label
                        className={`theme-option ${themeId(value) === theme.id ? "selected" : ""}`}
                        key={theme.id}
                      >
                        <input
                          type="radio"
                          name="site-theme"
                          aria-label={theme.name}
                          value={theme.id}
                          checked={themeId(value) === theme.id}
                          onChange={() =>
                            setValue({ ...value, theme: theme.id })
                          }
                        />
                        <span
                          className="theme-swatches"
                          aria-hidden="true"
                          style={{ background: theme.background }}
                        >
                          {(theme.id === "custom"
                            ? [value.accent, ...theme.colors.slice(1)]
                            : theme.colors
                          ).map((color, i) => (
                            <i key={i} style={{ background: color }} />
                          ))}
                        </span>
                        <strong>{theme.name}</strong>
                        <small>{theme.description}</small>
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
            {themeId(value) === "custom" && (
              <Field
                label="主题色"
                hint="过浅的颜色会自动加深，保证按钮文字清晰；各模块保留独立配色。"
              >
                <input
                  type="color"
                  value={value.accent}
                  onChange={(e) =>
                    setValue({ ...value, accent: e.target.value })
                  }
                />
              </Field>
            )}
            {themeId(value) === "monochrome" && (
              <p className="theme-note">
                发布后，整个工作空间及图片、视频、自定义模板都以灰阶呈现。切换回其他主题即可恢复，不会修改原始素材。
              </p>
            )}
          </section>
          <aside className="theme-preview-panel" aria-label="主题实时预览">
            <div className="theme-preview-label">
              <Eye size={16} />
              <strong>主题实时预览</strong>
              <span>选择预览</span>
            </div>
            <ThemePreview site={value} />
            <p className="muted">
              {themes.find((t) => t.id === themeId(value))?.name} ·
              演示内容仅用于预览
            </p>
            <p className="theme-note">
              节日主题由管理员手动切换；预设主题统一模块配色。原有模块颜色会保留，切回自选主题色即可恢复。
            </p>
          </aside>
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn primary" disabled={busy}>
          <Send size={16} />
          保存并发布
        </button>
      </form>
    </>
  );
}
function ThemePreview({ site }: { site: Site }) {
  const current = themeId(site);
  return (
    <div
      className={`theme-preview ${current === "monochrome" ? "grayscale" : ""}`}
      data-theme={current}
      style={themeStyle(site)}
    >
      <div className="theme-preview-nav">
        <span className="theme-preview-mark">企</span>
        <strong>{site.name || "企业信息门户"}</strong>
        <small>工作门户</small>
      </div>
      <div className="theme-preview-hero">
        <small>{site.subtitle || "CONNECTED WORKPLACE"}</small>
        <h3>
          让每一份信息，
          <br />
          连接工作的可能。
        </h3>
        <span>了解企业动态 ↗</span>
      </div>
      <div className="theme-preview-modules">
        {[
          ["news", "企业新闻", "信息共享，让协作自然发生"],
          ["notice", "通知公告", "及时了解日常工作安排"],
          ["video", "培训课堂", "一起学习，持续成长"],
          ["survey", "员工调查", "倾听每一位同事的声音"],
        ].map(([type, title, text]) => (
          <div
            key={type}
            style={moduleStyle(
              {
                type,
                accent: type === "notice" ? "#93601c" : "#226957",
                background: "#ffffff",
              } as Module,
              site,
            )}
          >
            <strong>
              <i />
              {title}
            </strong>
            <p>{text}</p>
            <div className="theme-preview-lines">
              <i />
              <i />
            </div>
          </div>
        ))}
      </div>
      <div className="theme-preview-bottom">
        <span>内容中心</span>
        <span className="theme-preview-button">查看全部 →</span>
      </div>
      <footer>{site.footer || "企业信息门户 · 内部工作空间"}</footer>
    </div>
  );
}
export function AuditPage() {
  const result = useLoad<Record<string, string | number>[]>("/it/audit");
  return (
    <>
      <Heading
        eyebrow="AUDIT TRAIL"
        title="操作日志"
        text="最近 200 次关键操作，记录每一次配置与内容变更。"
      />
      <section className="panel">
        {result.loading ? (
          <Spinner />
        ) : result.error ? (
          <ErrorBox message={result.error} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>操作人</th>
                  <th>操作</th>
                  <th>对象</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {result.data?.map((row) => (
                  <tr key={String(row.Id ?? row.id)}>
                    <td>{row.Actor ?? row.actor}</td>
                    <td>
                      <code>{row.Action ?? row.action}</code>
                    </td>
                    <td>
                      <small>{row.Target ?? row.target}</small>
                    </td>
                    <td>
                      {new Date(
                        String(row.CreatedAt ?? row.createdAt) + "Z",
                      ).toLocaleString("zh-CN")}
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
