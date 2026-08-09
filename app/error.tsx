"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="not-found">
      <div className="not-found-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/sufeiya-logo.png" width="2792" height="560" alt="苏肥鸭多邻国" />
        <p className="code">ERROR / RETRY</p>
        <h1>页面暂时没有准备好。</h1>
        <p>请重新加载当前页面；你的本机学习数据不会因为这次错误被清除。</p>
        <button className="button button-ink" type="button" onClick={reset}>重新加载</button>
      </div>
    </main>
  );
}
