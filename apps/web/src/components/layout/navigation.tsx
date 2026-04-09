import type { ReactNode } from 'react'
import { IconDashboard, IconData, IconPerformance, IconPortfolio, IconSettings, IconStrategy, IconTransactions } from '../ui/icons'

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

export const managementNav: NavItem[] = [
  {
    to: '/strategy',
    label: { en: 'Strategy', pl: 'Strategia' },
    aliases: ['/instruments'],
    icon: <IconStrategy />,
  },
  {
    to: '/data',
    label: { en: 'Data', pl: 'Dane' },
    aliases: ['/backups'],
    icon: <IconData />,
  },
  {
    to: '/system',
    label: { en: 'System', pl: 'System' },
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
      en: 'Management',
      pl: 'Zarządzanie',
    },
    items: managementNav,
  },
]

export function resolveRouteTitle(pathname: string, language: 'en' | 'pl') {
  const item = [...investingNav, ...managementNav].find((entry) => matchesRoute(pathname, entry))
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
