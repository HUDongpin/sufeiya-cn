"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="not-found">
          <div className="not-found-inner">
            <p className="code">ERROR / GLOBAL</p>
            <h1>网站暂时无法显示。</h1>
            <p>请稍后重试。现有本机学习记录不会被自动清除。</p>
            <button type="button" onClick={reset}>重新加载</button>
          </div>
        </main>
      </body>
    </html>
  );
}
