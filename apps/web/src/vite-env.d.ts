/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_CHART_ATTRIBUTION?: string
}

interface PortfolioRuntimeConfig {
  showChartAttribution?: boolean | string
}

interface Window {
  __PORTFOLIO_CONFIG__?: PortfolioRuntimeConfig
}
