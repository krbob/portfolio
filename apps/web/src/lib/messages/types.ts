export interface MessageEntry {
  pl: string
  en: string
}

export type MessageCatalog = Record<string, MessageEntry>
