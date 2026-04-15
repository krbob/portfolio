import { Suspense, lazy, useCallback } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/layout'
import { ToastProvider } from './components/ui'
import { useAppResumeRefresh } from './hooks/use-app-resume-refresh'
import { t } from './lib/messages'
import { appRoutes } from './lib/routes'

const DashboardScreen = lazy(async () => {
  const module = await import('./screens/DashboardScreen')
  return { default: module.DashboardScreen }
})

const SetupGuideScreen = lazy(async () => {
  const module = await import('./screens/SetupGuideScreen')
  return { default: module.SetupGuideScreen }
})

const PortfolioScreen = lazy(async () => {
  const module = await import('./screens/PortfolioScreen')
  return { default: module.PortfolioScreen }
})

const PerformanceScreen = lazy(async () => {
  const module = await import('./screens/PerformanceScreen')
  return { default: module.PerformanceScreen }
})

const TransactionsScreen = lazy(async () => {
  const module = await import('./screens/TransactionsScreen')
  return { default: module.TransactionsScreen }
})

const StrategyScreen = lazy(async () => {
  const module = await import('./screens/StrategyScreen')
  return { default: module.StrategyScreen }
})

const DataScreen = lazy(async () => {
  const module = await import('./screens/DataScreen')
  return { default: module.DataScreen }
})

const SystemScreen = lazy(async () => {
  const module = await import('./screens/SystemScreen')
  return { default: module.SystemScreen }
})

export function App() {
  const navigate = useNavigate()
  const handleErrorReset = useCallback(() => { navigate('/') }, [navigate])
  useAppResumeRefresh()

  return (
    <ToastProvider>
    <AuthGate>
      <Layout>
        <ErrorBoundary onReset={handleErrorReset}>
          <Suspense fallback={<RouteLoadingState />}>
            <Routes>
              <Route path={appRoutes.dashboard} element={<DashboardScreen />} />
              <Route path={appRoutes.setup} element={<SetupGuideScreen />} />
              <Route path={appRoutes.portfolio.base} element={<Navigate to={appRoutes.portfolio.holdings} replace />} />
              <Route path={appRoutes.portfolio.holdings} element={<PortfolioScreen />} />
              <Route path={appRoutes.portfolio.accounts} element={<PortfolioScreen />} />
              <Route path={appRoutes.performance} element={<PerformanceScreen />} />
              <Route path={appRoutes.transactions} element={<TransactionsScreen />} />
              <Route path={appRoutes.strategy.base} element={<Navigate to={appRoutes.strategy.instruments} replace />} />
              <Route path={appRoutes.strategy.instruments} element={<StrategyScreen />} />
              <Route path={appRoutes.strategy.targets} element={<StrategyScreen />} />
              <Route path={appRoutes.strategy.benchmarks} element={<StrategyScreen />} />
              <Route path={appRoutes.data.base} element={<Navigate to={appRoutes.data.import} replace />} />
              <Route path={appRoutes.data.import} element={<DataScreen />} />
              <Route path={appRoutes.data.transfer} element={<DataScreen />} />
              <Route path={appRoutes.data.backups} element={<DataScreen />} />
              <Route path={appRoutes.system.base} element={<Navigate to={appRoutes.system.diagnostics} replace />} />
              <Route path={appRoutes.system.diagnostics} element={<SystemScreen />} />
              <Route path={appRoutes.system.marketData} element={<SystemScreen />} />
              <Route path={appRoutes.system.audit} element={<SystemScreen />} />
              <Route path={appRoutes.system.app} element={<SystemScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </AuthGate>
    </ToastProvider>
  )
}

function RouteLoadingState() {
  return (
    <div className="space-y-3 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {t('common.loading')}
      </p>
      <h2 className="text-lg font-semibold text-zinc-300">
        {t('app.loadingTitle')}
      </h2>
      <p className="text-sm text-zinc-500">
        {t('app.loadingDescription')}
      </p>
    </div>
  )
}
