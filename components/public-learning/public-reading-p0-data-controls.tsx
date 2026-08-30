"use client";

import { useCallback, useEffect, useState } from "react";

import {
  PUBLIC_READING_P0_DELETE_PHRASE,
  createReadingP0OpaqueExport,
  deleteReadingP0Data,
  inspectReadingP0Data,
  readingP0WriteLocksSupported,
  withReadingP0WriteLock,
  type ReadingP0Raw,
  type ReadingP0Snapshot,
} from "@/lib/public-learning/reading-p0-data-boundary";

const missingRaw: ReadingP0Raw = { status: "missing", raw: null, bytes: 0 };
const emptySnapshot: ReadingP0Snapshot = { state: missingRaw, events: missingRaw };

function label(value: ReadingP0Raw) {
  return value.status === "unknown" ? "unknown（浏览器拒绝读取）" : `${value.status} · ${value.bytes} bytes`;
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PublicReadingP0DataControls() {
  const [snapshot, setSnapshot] = useState<ReadingP0Snapshot>(emptySnapshot);
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(() => {
    setSnapshot(inspectReadingP0Data(window.localStorage));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  function exportData() {
    const exportedAt = new Date().toISOString();
    downloadJson(
      `sufeiya-reading-p0-${exportedAt.slice(0, 10)}.json`,
      createReadingP0OpaqueExport(inspectReadingP0Data(window.localStorage), exportedAt),
    );
    setMessage("Reading P0 的两个本机 namespace 已单独导出；未上传网络，也未读取账户或其他学习区数据。");
  }

  async function deleteData() {
    if (!readingP0WriteLocksSupported()) {
      setMessage("当前浏览器不支持跨标签页写锁；为避免非原子删除，本页拒绝执行。");
      return;
    }
    try {
      const result = await withReadingP0WriteLock(async () => deleteReadingP0Data(
        window.localStorage,
        {
          acknowledgedPermanentLocalDeletion: acknowledged,
          typedPhrase: phrase,
        },
      ));
      setMessage(
        result.status === "complete"
          ? "Reading P0 的 state 与 events 已逐项核验删除；其他本机 namespace 未进入本次操作。"
          : `删除结果为 ${result.status}；仍存在 ${result.remaining.join(", ") || "无"}；读取未知 ${result.unknown.join(", ") || "无"}。`,
      );
      if (result.success) {
        setAcknowledged(false);
        setPhrase("");
      }
      refresh();
    } catch {
      setMessage("删除未能在独立写锁中运行；没有把操作报告为成功。");
    }
  }

  return (
    <section className="data-control-section" data-public-reading-p0-controls>
      <div className="data-control-heading">
        <span>PUBLIC READING P0 · SEPARATE LOCAL CONTROL</span>
        <h3>已发布 Reading P0</h3>
        <p>state：{label(snapshot.state)}；events：{label(snapshot.events)}。unknown 不会被冒充为“没有数据”。</p>
      </div>
      <details>
        <summary>查看 Reading P0 本机 raw 状态</summary>
        <pre>{snapshot.state.status === "ready" ? snapshot.state.raw : snapshot.state.status}</pre>
        <pre>{snapshot.events.status === "ready" ? snapshot.events.raw : snapshot.events.status}</pre>
      </details>
      <div className="data-actions">
        <button className="button button-ghost" onClick={exportData} type="button">单独导出 Reading P0 JSON</button>
      </div>
      <div className="data-danger-zone">
        <label>
          <input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
          <span>我了解这会永久删除 Reading P0 的 state 与 events，不删除工作区、Sofia、教研草稿或账户数据。</span>
        </label>
        <input aria-label="输入 Reading P0 删除确认短语" onChange={(event) => setPhrase(event.target.value)} placeholder={PUBLIC_READING_P0_DELETE_PHRASE} type="text" value={phrase} />
        <button
          className="button button-ghost"
          disabled={!acknowledged || phrase !== PUBLIC_READING_P0_DELETE_PHRASE}
          onClick={() => void deleteData()}
          type="button"
        >
          删除并逐项核验 Reading P0 数据
        </button>
      </div>
      {message ? <p className="data-global-message" role="status">{message}</p> : null}
    </section>
  );
}
