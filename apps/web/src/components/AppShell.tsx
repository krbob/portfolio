import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <p className="sidebar-label">Portfolio</p>
          <h1 className="sidebar-title">Long-term investing, tracked with intent.</h1>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <span className="nav-item nav-item-active">Dashboard</span>
          <span className="nav-item">Holdings</span>
          <span className="nav-item">Transactions</span>
          <span className="nav-item">Performance</span>
        </nav>
      </aside>

      <main className="content">{children}</main>
    </div>
  )
}
