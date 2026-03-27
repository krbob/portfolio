import { getActiveUiLanguage, type UiLanguage } from './i18n'
import { appMessages } from './messages/app'
import { portfolioMessages } from './messages/portfolio'
import { settingsMessages } from './messages/settings'
import { supportMessages } from './messages/support'
import { transactionMessages } from './messages/transactions'
import type { MessageCatalog, MessageEntry } from './messages/types'

const messages = {
  ...appMessages,
  ...portfolioMessages,
  ...settingsMessages,
  ...transactionMessages,
  ...supportMessages,
} satisfies MessageCatalog

export type MessageKey = keyof typeof messages

export function t(key: MessageKey): string {
  return resolveMessage(messages[key], getActiveUiLanguage())
}

export function tFor(key: MessageKey, language: UiLanguage): string {
  return resolveMessage(messages[key], language)
}

export function formatMessage(template: string, values: Record<string, string | number | null | undefined>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value == null ? '' : String(value))
  }, template)
}

function resolveMessage(entry: MessageEntry, language: UiLanguage): string {
  return language === 'pl' ? entry.pl : entry.en
}
