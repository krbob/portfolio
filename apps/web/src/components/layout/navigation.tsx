import type { ReactNode } from 'react'
import { IconDashboard, IconPerformance, IconPortfolio, IconSettings, IconTransactions } from '../ui/icons'

export interface NavItem {
  to: string
  label: {
    en: string
    pl: string
  }
  icon: ReactNode
  end?: boolean
  aliases?: string[]
}

export const investingNav: NavItem[] = [
  {
    to: '/',
    label: { en: 'Dashboard', pl: 'Pulpit' },
    end: true,
    icon: <IconDashboard />,
  },
  {
    to: '/portfolio',
    label: { en: 'Portfolio', pl: 'Portfel' },
    aliases: ['/holdings', '/accounts'],
    icon: <IconPortfolio />,
  },
  {
    to: '/performance',
    label: { en: 'Performance', pl: 'Wyniki' },
    aliases: ['/returns', '/charts'],
    icon: <IconPerformance />,
  },
  {
    to: '/transactions',
    label: { en: 'Transactions', pl: 'Transakcje' },
    icon: <IconTransactions />,
  },
]

export const operationsNav: NavItem[] = [
  {
    to: '/settings',
    label: { en: 'Settings', pl: 'Ustawienia' },
    aliases: ['/data', '/backups', '/instruments'],
    icon: <IconSettings />,
  },
]

export const navSections = [
  {
    label: {
      en: 'Investing',
      pl: 'Inwestowanie',
    },
    items: investingNav,
  },
  {
    label: {
      en: 'Operations',
      pl: 'Operacje',
    },
    items: operationsNav,
  },
]

export function resolveRouteTitle(pathname: string, language: 'en' | 'pl') {
  const item = [...investingNav, ...operationsNav].find((entry) => matchesRoute(pathname, entry))
  return item?.label[language] ?? 'Portfolio'
}

function matchesRoute(pathname: string, item: NavItem) {
  if (item.end && pathname === item.to) {
    return true
  }
  if (!item.end && pathname.startsWith(item.to)) {
    return true
  }
  return item.aliases?.some((alias) => pathname.startsWith(alias)) ?? false
}
