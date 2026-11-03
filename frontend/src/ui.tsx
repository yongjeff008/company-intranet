import {
  createContext,
  useContext,
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import {
  Inbox,
  LoaderCircle,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api } from "./api";
import type { Account } from "./types";

export const Session = createContext<{
  user: Account;
  refresh: () => Promise<void>;
}>(null!);
export const useSession = () => useContext(Session);
const Notices = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export const useNotice = () => useContext(Notices);
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5500);
    return () => clearTimeout(t);
  }, [notice]);
  return (
    <Notices.Provider
      value={(message, error = false) => setNotice({ message, error })}
    >
      {children}
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={`toast ${notice.error ? "error" : ""}`}
        >
          {notice.error ? (
            <AlertCircle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{notice.message}</span>
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </Notices.Provider>
  );
}
export function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, bump] = useState(0);
  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    let current = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<T>(url, { signal: controller.signal })
      .then((value) => {
        if (current) setData(value);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [url, revision]);
  return { data, error, loading, reload: () => bump((v) => v + 1), setData };
}
export const Spinner = () => (
  <div className="loading">
    <LoaderCircle className="spin" size={24} />
    正在加载…
  </div>
);
export function Empty({
  title = "这里还没有内容",
  text = "内容发布后，会自动出现在这里。",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={28} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {text && <p className="muted">{text}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id })
        : children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="关闭" onClick={close}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
      {retry && <button onClick={retry}>重试</button>}
    </div>
  );
}
export const date = (value: string) =>
  new Date(
    value.endsWith("Z") || value.includes("+") ? value : value + "Z",
  ).toLocaleDateString("zh-CN");
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败";
