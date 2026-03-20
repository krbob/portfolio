import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/layout'
import { useI18n } from './lib/i18n'

const DashboardScreen = lazy(async () => {
  const module = await import('./screens/DashboardScreen')
  return { default: module.DashboardScreen }
})

const HoldingsScreen = lazy(async () => {
  const module = await import('./screens/HoldingsScreen')
  return { default: module.HoldingsScreen }
})

const PerformanceScreen = lazy(async () => {
  const module = await import('./screens/PerformanceScreen')
  return { default: module.PerformanceScreen }
})

const TransactionsScreen = lazy(async () => {
  const module = await import('./screens/TransactionsScreen')
  return { default: module.TransactionsScreen }
})

const SettingsScreen = lazy(async () => {
  const module = await import('./screens/SettingsScreen')
  return { default: module.SettingsScreen }
})

export function App() {
  const { isPolish } = useI18n()

  return (
    <AuthGate>
      <Layout>
        <Suspense fallback={<RouteLoadingState isPolish={isPolish} />}>
          <Routes>
            <Route path="/" element={<DashboardScreen />} />
            <Route path="/holdings" element={<HoldingsScreen />} />
            <Route path="/performance" element={<PerformanceScreen />} />
            <Route path="/returns" element={<Navigate to="/performance" replace />} />
            <Route path="/charts" element={<Navigate to="/performance" replace />} />
            <Route path="/transactions" element={<TransactionsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/data" element={<Navigate to="/settings" replace />} />
            <Route path="/backups" element={<Navigate to="/settings#backups" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthGate>
  )
}

function RouteLoadingState({ isPolish }: { isPolish: boolean }) {
  return (
    <div className="space-y-3 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {isPolish ? 'Ładowanie' : 'Loading'}
      </p>
      <h2 className="text-lg font-semibold text-zinc-300">
        {isPolish ? 'Przygotowywanie widoku' : 'Preparing workspace'}
      </h2>
      <p className="text-sm text-zinc-500">
        {isPolish ? 'Podłączanie kolejnego ekranu i jego danych portfela.' : 'Attaching the next screen and its portfolio data.'}
      </p>
    </div>
  )
}
