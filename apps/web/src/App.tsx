export function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Portfolio</p>
        <h1>Self-hosted portfolio tracking for long-term investing.</h1>
        <p className="hero-copy">
          The first iteration focuses on a clean web foundation, transaction-based accounting, and a
          backend that will own reconstruction of portfolio history.
        </p>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Frontend</h2>
          <p>React, TypeScript, Vite, and a deliberately small initial surface.</p>
        </article>

        <article className="panel">
          <h2>Backend</h2>
          <p>Kotlin and Ktor, aligned with the existing market-data and EDO services.</p>
        </article>

        <article className="panel">
          <h2>Data model</h2>
          <p>Transactions are the source of truth. Daily snapshots will be rebuildable cache.</p>
        </article>
      </section>
    </main>
  )
}
