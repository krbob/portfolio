import { HoldingsSection } from '../components/HoldingsSection'
import { PageIntro } from '../components/PageIntro'

export function HoldingsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Investing"
        title="Holdings"
        description="Scan positions quickly, filter by account or asset class, and inspect one holding in detail without losing portfolio context."
      />
      <HoldingsSection />
    </div>
  )
}
