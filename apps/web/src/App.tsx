import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { AppShell } from './components/AppShell'
import { BackupsScreen } from './screens/BackupsScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { DataScreen } from './screens/DataScreen'
import { HoldingsScreen } from './screens/HoldingsScreen'
import { PerformanceScreen } from './screens/PerformanceScreen'
import { TransactionsScreen } from './screens/TransactionsScreen'

export function App() {
  return (
    <AuthGate>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/holdings" element={<HoldingsScreen />} />
          <Route path="/performance" element={<PerformanceScreen />} />
          <Route path="/returns" element={<Navigate to="/performance" replace />} />
          <Route path="/charts" element={<Navigate to="/performance" replace />} />
          <Route path="/transactions" element={<TransactionsScreen />} />
          <Route path="/data" element={<DataScreen />} />
          <Route path="/backups" element={<BackupsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthGate>
  )
}
