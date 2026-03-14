import { PageIntro } from '../components/PageIntro'
import { PortfolioReturnsSection } from '../components/PortfolioReturnsSection'

export function ReturnsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Performance"
        title="Returns"
        description="Track MWRR, TWR and benchmark-relative performance across standard horizons, with real PLN and USD views derived from rebuildable daily valuation history."
      />
      <PortfolioReturnsSection />
    </div>
  )
}
