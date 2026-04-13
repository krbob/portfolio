export const appRoutes = {
  dashboard: '/',
  setup: '/setup',
  portfolio: {
    base: '/portfolio',
    holdings: '/portfolio/holdings',
    accounts: '/portfolio/accounts',
  },
  performance: '/performance',
  transactions: '/transactions',
  strategy: {
    base: '/strategy',
    instruments: '/strategy/instruments',
    targets: '/strategy/targets',
    benchmarks: '/strategy/benchmarks',
  },
  data: {
    base: '/data',
    import: '/data/import',
    transfer: '/data/transfer',
    backups: '/data/backups',
  },
  system: {
    base: '/system',
    diagnostics: '/system/diagnostics',
    marketData: '/system/market-data',
    audit: '/system/audit',
    app: '/system/app',
  },
} as const

export type PortfolioTabRoute = keyof typeof appRoutes.portfolio
export type StrategyTabRoute = Exclude<keyof typeof appRoutes.strategy, 'base'>
export type DataTabRoute = Exclude<keyof typeof appRoutes.data, 'base'>
export type SystemTabRoute = Exclude<keyof typeof appRoutes.system, 'base'>
