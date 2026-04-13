import {
  useAccounts,
  useInstruments,
  usePortfolioBenchmarkSettings,
  usePortfolioTargets,
  useTransactions,
} from './use-write-model'
import { useAppReadiness } from './use-app-readiness'
import { usePortfolioDataQuality } from './use-portfolio-data-quality'
import { useI18n } from '../lib/i18n'
import { t } from '../lib/messages'
import { appRoutes } from '../lib/routes'

export type GuideStatus = 'done' | 'action' | 'warning' | 'info'

export interface GuideAction {
  kind: 'route' | 'hash'
  to: string
  label: string
}

export interface GuideItem {
  key: string
  title: string
  description: string
  status: GuideStatus
  action?: GuideAction
}

export function usePortfolioSetupGuide() {
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
      title: t('setup.accounts'),
      count: accountsQuery.data?.length ?? 0,
      loading: accountsQuery.isLoading,
      loadingDescription: t('setup.checkingAccounts'),
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'konto jest gotowe do księgowania' : 'konta są gotowe do księgowania'}.`
          : `${count} ${count === 1 ? 'account is' : 'accounts are'} ready for posting.`,
      emptyDescription: t('setup.accountsEmpty'),
      action: {
        kind: 'route',
        to: appRoutes.portfolio.accounts,
        label: t('setup.openAccounts'),
      },
    }),
    buildSetupItem({
      key: 'instruments',
      title: t('setup.instruments'),
      count: instrumentsQuery.data?.length ?? 0,
      loading: instrumentsQuery.isLoading,
      loadingDescription: t('setup.checkingInstruments'),
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'instrument jest dostępny w katalogu' : 'instrumentów jest dostępnych w katalogu'}.`
          : `${count} ${count === 1 ? 'instrument is' : 'instruments are'} available in the catalog.`,
      emptyDescription: t('setup.instrumentsEmpty'),
      action: {
        kind: 'route',
        to: appRoutes.strategy.instruments,
        label: t('setup.openInstruments'),
      },
    }),
    buildSetupItem({
      key: 'transactions',
      title: t('setup.transactions'),
      count: transactionsQuery.data?.length ?? 0,
      loading: transactionsQuery.isLoading,
      loadingDescription: t('setup.checkingTransactions'),
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'transakcja zasila modele odczytowe' : 'transakcji zasila modele odczytowe'}.`
          : `${count} ${count === 1 ? 'transaction feeds' : 'transactions feed'} the read models.`,
      emptyDescription: t('setup.transactionsEmpty'),
      action: {
        kind: 'route',
        to: appRoutes.transactions,
        label: t('setup.openTransactions'),
      },
    }),
    buildSetupItem({
      key: 'targets',
      title: t('setup.targetAllocation'),
      count: targetsQuery.data?.length ?? 0,
      loading: targetsQuery.isLoading,
      loadingDescription: t('setup.checkingTargets'),
      successDescription: (count) =>
        isPolish
          ? `${count} ${count === 1 ? 'cel wspiera sygnały odchylenia' : 'cele wspierają sygnały odchylenia'}.`
          : `${count} ${count === 1 ? 'target supports' : 'targets support'} drift diagnostics.`,
      emptyDescription: t('setup.targetsEmpty'),
      action: {
        kind: 'route',
        to: appRoutes.strategy.targets,
        label: t('setup.openTargets'),
      },
    }),
    {
      key: 'benchmarks',
      title: t('setup.benchmarks'),
      description: benchmarkSettingsQuery.isLoading
        ? t('setup.checkingBenchmarks')
        : (benchmarkSettingsQuery.data?.enabledKeys?.length ?? 0) > 0
          ? isPolish
            ? `${benchmarkSettingsQuery.data!.enabledKeys.length} benchmarków jest aktywnych w zakładce Wyniki.`
            : `${benchmarkSettingsQuery.data!.enabledKeys.length} benchmarks are active in Performance.`
          : t('setup.benchmarksEmpty'),
      status: benchmarkSettingsQuery.isLoading
        ? 'info'
        : (benchmarkSettingsQuery.data?.enabledKeys?.length ?? 0) > 0
          ? 'done'
          : 'action',
      action: {
        kind: 'route',
        to: appRoutes.strategy.benchmarks,
        label: t('setup.openBenchmarks'),
      },
    },
    buildReadinessItem(readinessQuery.data, readinessQuery.isLoading, readinessQuery.isError),
    buildDataQualityItem(dataQuality.summary?.warningCount, dataQuality.isLoading, Boolean(dataQuality.error), isPolish),
  ]

  const doneCount = items.filter((item) => item.status === 'done').length
  const attentionCount = items.filter((item) => item.status === 'action' || item.status === 'warning').length

  return {
    items,
    doneCount,
    attentionCount,
  }
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

function buildReadinessItem(
  readiness: { status: string; checks?: Array<{ status: string }> } | undefined,
  isLoading: boolean,
  isError: boolean,
): GuideItem {
  if (isLoading) {
    return {
      key: 'readiness',
      title: t('setup.readiness'),
      description: t('setup.checkingReadiness'),
      status: 'info',
      action: {
        kind: 'route',
        to: appRoutes.system.diagnostics,
        label: t('setup.openHealth'),
      },
    }
  }

  if (isError || !readiness?.status) {
    return {
      key: 'readiness',
      title: t('setup.readiness'),
      description: t('setup.readinessWarning'),
      status: 'warning',
      action: {
        kind: 'route',
        to: appRoutes.system.diagnostics,
        label: t('setup.openHealth'),
      },
    }
  }

  const hasBlockingIssue = readiness.status === 'NOT_READY' || readiness.checks?.some((check) => check.status === 'FAIL')
  if (hasBlockingIssue) {
    return {
      key: 'readiness',
      title: t('setup.readiness'),
      description: t('setup.readinessWarning'),
      status: 'warning',
      action: {
        kind: 'route',
        to: appRoutes.system.diagnostics,
        label: t('setup.openHealth'),
      },
    }
  }

  const hasAdvisoryNotice = readiness.status === 'DEGRADED' || readiness.checks?.some((check) => check.status === 'WARN')
  if (hasAdvisoryNotice) {
    return {
      key: 'readiness',
      title: t('setup.readiness'),
      description: t('setup.readinessAdvisory'),
      status: 'info',
      action: {
        kind: 'route',
        to: appRoutes.system.diagnostics,
        label: t('setup.openHealth'),
      },
    }
  }

  return {
    key: 'readiness',
    title: t('setup.readiness'),
    description: t('setup.readinessOk'),
    status: 'done',
    action: {
      kind: 'route',
      to: appRoutes.system.diagnostics,
      label: t('setup.openHealth'),
    },
  }
}

function buildDataQualityItem(warningCount: number | undefined, isLoading: boolean, hasError: boolean, isPolish: boolean): GuideItem {
  if (isLoading) {
    return {
      key: 'data-quality',
      title: t('setup.dataQuality'),
      description: t('setup.checkingDataQuality'),
      status: 'info',
      action: {
        kind: 'route',
        to: appRoutes.system.diagnostics,
        label: t('setup.openDataQuality'),
      },
    }
  }

  if (hasError || (warningCount ?? 0) > 0) {
    return {
      key: 'data-quality',
      title: t('setup.dataQuality'),
      description: isPolish
        ? `Są sygnały wymagające uwagi${warningCount ? ` (${warningCount})` : ''}. Przejrzyj pokrycie wycen, benchmarków i odświeżeń.`
        : `There are data signals that need attention${warningCount ? ` (${warningCount})` : ''}. Review valuations, benchmarks and refresh coverage.`,
      status: 'warning',
      action: {
        kind: 'route',
        to: appRoutes.system.diagnostics,
        label: t('setup.openDataQuality'),
      },
    }
  }

  return {
    key: 'data-quality',
    title: t('setup.dataQuality'),
    description: t('setup.dataQualityOk'),
    status: 'done',
    action: {
      kind: 'route',
      to: appRoutes.system.diagnostics,
      label: t('setup.openDataQuality'),
    },
  }
}
