import { Suspense, lazy, useCallback } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/layout'
import { ToastProvider } from './components/ui'
import { t } from './lib/messages'

const DashboardScreen = lazy(async () => {
  const module = await import('./screens/DashboardScreen')
  return { default: module.DashboardScreen }
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

  return (
    <ToastProvider>
    <AuthGate>
      <Layout>
        <ErrorBoundary onReset={handleErrorReset}>
          <Suspense fallback={<RouteLoadingState />}>
            <Routes>
              <Route path="/" element={<DashboardScreen />} />
              <Route path="/portfolio" element={<PortfolioScreen />} />
              <Route path="/holdings" element={<Navigate to="/portfolio" replace />} />
              <Route path="/accounts" element={<Navigate to="/portfolio?tab=accounts" replace />} />
              <Route path="/instruments" element={<Navigate to="/strategy" replace />} />
              <Route path="/performance" element={<PerformanceScreen />} />
              <Route path="/returns" element={<Navigate to="/performance" replace />} />
              <Route path="/charts" element={<Navigate to="/performance" replace />} />
              <Route path="/transactions" element={<TransactionsScreen />} />
              <Route path="/strategy" element={<StrategyScreen />} />
              <Route path="/data" element={<DataScreen />} />
              <Route path="/system" element={<SystemScreen />} />
              <Route path="/settings" element={<Navigate to="/strategy" replace />} />
              <Route path="/backups" element={<Navigate to="/data?tab=backups" replace />} />
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
