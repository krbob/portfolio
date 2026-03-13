import { PageIntro } from '../components/PageIntro'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'

export function BackupsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Operations"
        title="Backups"
        description="Run server-side snapshots, inspect retention state and recover the canonical write model when you need a known-good restore point."
      />
      <PortfolioBackupsSection />
    </div>
  )
}
