import { HoldingsSection } from '../components/HoldingsSection'
import { PageIntro } from '../components/PageIntro'

export function HoldingsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Read model"
        title="Holdings"
        description="Inspect active positions grouped by account and instrument, with cost basis, current valuation and valuation coverage status."
      />
      <HoldingsSection />
    </div>
  )
}
