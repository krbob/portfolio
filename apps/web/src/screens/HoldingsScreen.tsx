import { HoldingsSection } from '../components/HoldingsSection'
import { PageIntro } from '../components/PageIntro'

export function HoldingsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Investing"
        title="Holdings"
        description="Scan positions quickly, filter the view, and inspect one holding at a time."
      />
      <HoldingsSection />
    </div>
  )
}
