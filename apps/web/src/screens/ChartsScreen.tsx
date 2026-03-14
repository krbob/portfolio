import { PageIntro } from '../components/PageIntro'
import { PortfolioHistorySection } from '../components/PortfolioHistorySection'

export function ChartsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Performance"
        title="Charts"
        description="Review rebuildable portfolio history in PLN, USD and gold ounces, together with contributions, allocation changes and indexed benchmark overlays."
      />
      <PortfolioHistorySection />
    </div>
  )
}
