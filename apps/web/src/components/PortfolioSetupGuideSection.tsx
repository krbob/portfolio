import { Link } from 'react-router-dom'
import { useAppReadiness } from '../hooks/use-app-readiness'
import { usePortfolioDataQuality } from '../hooks/use-portfolio-data-quality'
import {
  useAccounts,
  useInstruments,
  usePortfolioBenchmarkSettings,
  usePortfolioTargets,
  useTransactions,
} from '../hooks/use-write-model'
import { useI18n } from '../lib/i18n'
import { badge, badgeVariants } from '../lib/styles'
import { Card, SectionHeader } from './ui'

type GuideStatus = 'done' | 'action' | 'warning' | 'info'

interface GuideAction {
  kind: 'route' | 'hash'
  to: string
  label: string
}

interface GuideItem {
  key: string
  title: string
  description: string
  status: GuideStatus
  action?: GuideAction
}

export function PortfolioSetupGuideSection() {
  const { isPolish } = useI18n()
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const targetsQuery = usePortfolioTargets()
  const benchmarkSettingsQuery = usePortfolioBenchmarkSettings()
  const readinessQuery = useAppReadiness()
  const dataQuality = usePortfolioDataQuality()

  const items: GuideItem[] = [
    buildSetupItem({
      key: 'accounts',
      title: isPolish ? 'Konta' : 'Accounts',
      count: accountsQuery.data?.length ?? 0,
      loading: accountsQuery.isLoading,
      loadingDescription: isPolish ? 'Sprawdzanie konfiguracji kont...' : 'Checking account setup...',
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'konto jest gotowe do księgowania' : 'konta są gotowe do księgowania'}.`
          : `${count} ${count === 1 ? 'account is' : 'accounts are'} ready for posting.`,
      emptyDescription: isPolish
        ? 'Dodaj pierwszy rachunek, zanim zaczniesz księgować transakcje.'
        : 'Add the first account before you start recording transactions.',
      action: {
        kind: 'route',
        to: '/accounts',
        label: isPolish ? 'Otwórz konta' : 'Open accounts',
      },
    }),
    buildSetupItem({
      key: 'instruments',
      title: isPolish ? 'Instrumenty' : 'Instruments',
      count: instrumentsQuery.data?.length ?? 0,
      loading: instrumentsQuery.isLoading,
      loadingDescription: isPolish ? 'Sprawdzanie katalogu instrumentów...' : 'Checking instrument catalog...',
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'instrument jest dostępny w katalogu' : 'instrumentów jest dostępnych w katalogu'}.`
          : `${count} ${count === 1 ? 'instrument is' : 'instruments are'} available in the catalog.`,
      emptyDescription: isPolish
        ? 'Dodaj instrumenty, aby transakcje i wyceny miały do czego się odwołać.'
        : 'Add instruments so transactions and valuations have a catalog to reference.',
      action: {
        kind: 'route',
        to: '/instruments',
        label: isPolish ? 'Otwórz instrumenty' : 'Open instruments',
      },
    }),
    buildSetupItem({
      key: 'transactions',
      title: isPolish ? 'Transakcje' : 'Transactions',
      count: transactionsQuery.data?.length ?? 0,
      loading: transactionsQuery.isLoading,
      loadingDescription: isPolish ? 'Sprawdzanie dziennika transakcji...' : 'Checking transaction journal...',
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'transakcja zasila read modele' : 'transakcji zasila read modele'}.`
          : `${count} ${count === 1 ? 'transaction feeds' : 'transactions feed'} the read models.`,
      emptyDescription: isPolish
        ? 'Zapisz pierwszą transakcję, aby portfolio zaczęło budować pozycje i historię.'
        : 'Record the first transaction to start building holdings and history.',
      action: {
        kind: 'route',
        to: '/transactions',
        label: isPolish ? 'Otwórz transakcje' : 'Open transactions',
      },
    }),
    buildSetupItem({
      key: 'targets',
      title: isPolish ? 'Alokacja docelowa' : 'Target allocation',
      count: targetsQuery.data?.length ?? 0,
      loading: targetsQuery.isLoading,
      loadingDescription: isPolish ? 'Sprawdzanie konfiguracji celów...' : 'Checking target setup...',
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'cel wspiera sygnały odchylenia' : 'cele wspierają sygnały odchylenia'}.`
          : `${count} ${count === 1 ? 'target supports' : 'targets support'} drift diagnostics.`,
      emptyDescription: isPolish
        ? 'Skonfiguruj cele, aby odblokować drift i sugestie rebalansowania.'
        : 'Configure targets to unlock drift and rebalance suggestions.',
      action: {
        kind: 'hash',
        to: '#targets',
        label: isPolish ? 'Otwórz cele' : 'Open targets',
      },
    }),
    {
      key: 'benchmarks',
      title: isPolish ? 'Benchmarki' : 'Benchmarks',
      description: benchmarkSettingsQuery.isLoading
        ? (isPolish ? 'Sprawdzanie aktywnych benchmarków...' : 'Checking active benchmarks...')
        : (benchmarkSettingsQuery.data?.enabledKeys.length ?? 0) > 0
          ? isPolish
            ? `${benchmarkSettingsQuery.data!.enabledKeys.length} benchmarków jest aktywnych w wynikach.`
            : `${benchmarkSettingsQuery.data!.enabledKeys.length} benchmarks are active in Performance.`
          : isPolish
            ? 'Włącz benchmarki, aby porównywać portfel z rynkiem, inflacją i target mix.'
            : 'Enable benchmarks to compare the portfolio against markets, inflation and target mix.',
      status: benchmarkSettingsQuery.isLoading
        ? 'info'
        : (benchmarkSettingsQuery.data?.enabledKeys.length ?? 0) > 0
          ? 'done'
          : 'action',
      action: {
        kind: 'hash',
        to: '#benchmarks',
        label: isPolish ? 'Otwórz benchmarki' : 'Open benchmarks',
      },
    },
    buildReadinessItem(readinessQuery.data?.status, readinessQuery.isLoading, readinessQuery.isError, isPolish),
    buildDataQualityItem(dataQuality.summary?.warningCount, dataQuality.isLoading, Boolean(dataQuality.error), isPolish),
  ]

  const doneCount = items.filter((item) => item.status === 'done').length
  const attentionCount = items.filter((item) => item.status === 'action' || item.status === 'warning').length

  return (
    <Card as="section">
      <SectionHeader
        eyebrow={isPolish ? 'Start i diagnostyka' : 'Setup and diagnostics'}
        title={isPolish ? 'Następne kroki' : 'Next steps'}
        description={isPolish
          ? 'Krótka checklista konfiguracji i zaufania do danych. Każdy punkt prowadzi do miejsca, w którym można go domknąć.'
          : 'A short checklist for setup and data trust. Each item links to the place where you can resolve it.'}
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <span className={`${badge} ${badgeVariants.success}`}>
          {isPolish ? 'Gotowe' : 'Done'} {doneCount}
        </span>
        <span className={`${badge} ${attentionCount > 0 ? badgeVariants.warning : badgeVariants.default}`}>
          {isPolish ? 'Do uwagi' : 'Needs attention'} {attentionCount}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.key} className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
              </div>
              <span className={`${badge} ${guideBadgeVariant(item.status)}`}>
                {guideStatusLabel(item.status, isPolish)}
              </span>
            </div>

            {item.action ? (
              <div className="mt-4">
                <GuideActionLink action={item.action} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Card>
  )
}

function buildSetupItem({
  key,
  title,
  count,
  loading,
  loadingDescription,
  successDescription,
  emptyDescription,
  action,
}: {
  key: string
  title: string
  count: number
  loading: boolean
  loadingDescription: string
  successDescription: (count: number) => string
  emptyDescription: string
  action: GuideAction
}): GuideItem {
  if (loading) {
    return {
      key,
      title,
      description: loadingDescription,
      status: 'info',
      action,
    }
  }

  return {
    key,
    title,
    description: count > 0 ? successDescription(count) : emptyDescription,
    status: count > 0 ? 'done' : 'action',
    action,
  }
}

function buildReadinessItem(status: string | undefined, isLoading: boolean, isError: boolean, isPolish: boolean): GuideItem {
  if (isLoading) {
    return {
      key: 'readiness',
      title: isPolish ? 'Gotowość środowiska' : 'Runtime readiness',
      description: isPolish ? 'Sprawdzanie zależności runtime...' : 'Checking runtime dependencies...',
      status: 'info',
      action: {
        kind: 'hash',
        to: '#health',
        label: isPolish ? 'Otwórz health' : 'Open health',
      },
    }
  }

  if (isError || !status || status !== 'READY') {
    return {
      key: 'readiness',
      title: isPolish ? 'Gotowość środowiska' : 'Runtime readiness',
      description: isPolish
        ? 'Najpierw usuń blokery lub ostrzeżenia runtime, inaczej kolejne sygnały mogą być mylące.'
        : 'Resolve runtime blockers or warnings first, otherwise the downstream signals may be misleading.',
      status: 'warning',
      action: {
        kind: 'hash',
        to: '#health',
        label: isPolish ? 'Otwórz health' : 'Open health',
      },
    }
  }

  return {
    key: 'readiness',
    title: isPolish ? 'Gotowość środowiska' : 'Runtime readiness',
    description: isPolish ? 'Runtime jest gotowy do pracy z wyceną i read modelami.' : 'Runtime is ready for valuation and read-model workflows.',
    status: 'done',
    action: {
      kind: 'hash',
      to: '#health',
      label: isPolish ? 'Otwórz health' : 'Open health',
    },
  }
}

function buildDataQualityItem(warningCount: number | undefined, isLoading: boolean, hasError: boolean, isPolish: boolean): GuideItem {
  if (isLoading) {
    return {
      key: 'data-quality',
      title: isPolish ? 'Jakość danych' : 'Data quality',
      description: isPolish ? 'Składanie sygnałów jakości danych...' : 'Assembling data-quality signals...',
      status: 'info',
      action: {
        kind: 'hash',
        to: '#data-quality',
        label: isPolish ? 'Otwórz jakość danych' : 'Open data quality',
      },
    }
  }

  if (hasError || (warningCount ?? 0) > 0) {
    return {
      key: 'data-quality',
      title: isPolish ? 'Jakość danych' : 'Data quality',
      description: isPolish
        ? `Są sygnały wymagające uwagi${warningCount ? ` (${warningCount})` : ''}. Przejrzyj pokrycie wycen, benchmarków i odświeżeń.`
        : `There are data signals that need attention${warningCount ? ` (${warningCount})` : ''}. Review valuations, benchmarks and refresh coverage.`,
      status: 'warning',
      action: {
        kind: 'hash',
        to: '#data-quality',
        label: isPolish ? 'Otwórz jakość danych' : 'Open data quality',
      },
    }
  }

  return {
    key: 'data-quality',
    title: isPolish ? 'Jakość danych' : 'Data quality',
    description: isPolish ? 'Pokrycie danych wygląda spójnie dla bieżącego widoku.' : 'Data coverage looks consistent for the current view.',
    status: 'done',
    action: {
      kind: 'hash',
      to: '#data-quality',
      label: isPolish ? 'Otwórz jakość danych' : 'Open data quality',
    },
  }
}

function GuideActionLink({ action }: { action: GuideAction }) {
  const className = 'inline-flex text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100'

  if (action.kind === 'route') {
    return (
      <Link className={className} to={action.to}>
        {action.label}
      </Link>
    )
  }

  return (
    <a className={className} href={action.to}>
      {action.label}
    </a>
  )
}

function guideBadgeVariant(status: GuideStatus) {
  switch (status) {
    case 'done':
      return badgeVariants.success
    case 'action':
      return badgeVariants.info
    case 'warning':
      return badgeVariants.warning
    case 'info':
      return badgeVariants.default
  }
}

function guideStatusLabel(status: GuideStatus, isPolish: boolean) {
  switch (status) {
    case 'done':
      return isPolish ? 'Gotowe' : 'Done'
    case 'action':
      return isPolish ? 'Do zrobienia' : 'To do'
    case 'warning':
      return isPolish ? 'Uwagi' : 'Attention'
    case 'info':
      return isPolish ? 'Sprawdzanie' : 'Checking'
  }
}
