import { useState } from "react";
import { send } from "./api";
import { Modal, Spinner, ErrorBox, useLoad, useNotice, errorText } from "./ui";
import type { Doc, Revision } from "./types";

export function HistoryModal<T>({
  doc,
  close,
  restored,
}: {
  doc: Doc<T>;
  close: () => void;
  restored: (doc: Doc<T>) => void;
}) {
  const result = useLoad<Revision[]>(`/manage/documents/${doc.id}/history`),
    notice = useNotice(),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="版本历史" close={close}>
      <div className="modal-body">
        <p className="muted">恢复后保存为草稿，重新发布才会影响线上。</p>
        {result.loading ? (
          <Spinner />
        ) : result.error ? (
          <ErrorBox message={result.error} />
        ) : (
          result.data?.map((r) => (
            <div className="history-row" key={r.version}>
              <span className="history-dot" />
              <div>
                <strong>
                  版本 {r.version} ·{" "}
                  {
                    (
                      {
                        save: "保存草稿",
                        publish: "发布",
                        unpublish: "下线",
                        create: "创建",
                        restore: "恢复",
                      } as Record<string, string>
                    )[r.action]
                  }
                </strong>
                <small>
                  {r.actor} ·{" "}
                  {new Date(
                    r.createdAt + (r.createdAt.endsWith("Z") ? "" : "Z"),
                  ).toLocaleString("zh-CN")}
                </small>
              </div>
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`将版本 ${r.version} 恢复为当前草稿？`)) return;
                  setBusy(true);
                  try {
                    restored(
                      await send<Doc<T>>(
                        `/manage/documents/${doc.id}/restore`,
                        { version: doc.version, targetVersion: r.version },
                      ),
                    );
                    notice("已恢复为草稿");
                  } catch (e) {
                    notice(errorText(e), true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                恢复
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
