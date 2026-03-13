import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { PageIntro } from '../components/PageIntro'
import { PortfolioStateSection } from '../components/PortfolioStateSection'

export function DataScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Write model"
        title="Data setup"
        description="Manage accounts and instruments, then move the canonical portfolio state in and out of the system when you need backups, migration or recovery."
      />

      <section className="workspace-grid">
        <AccountsSection />
        <InstrumentsSection />
      </section>

      <PortfolioStateSection />
    </div>
  )
}
