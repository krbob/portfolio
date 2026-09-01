import { describe, expect, it } from 'vitest'
import { buildAuditMetadataEntries, buildAuditMetadataSummary } from './audit-copy'

describe('backup audit trigger copy', () => {
  it('localizes automatic post-change backup triggers', () => {
    expect(buildAuditMetadataSummary({ trigger: 'POST_CHANGE' }, 'pl')).toBe(
      'uruchomienie: po zmianie kanonicznej',
    )
  })

  it('localizes pre-import safety backup triggers', () => {
    expect(buildAuditMetadataSummary({ trigger: 'PRE_IMPORT_REPLACE' }, 'en')).toBe(
      'trigger before REPLACE import',
    )
  })

  it('localizes new backup retention and revision metadata', () => {
    expect(buildAuditMetadataEntries({
      retentionClass: 'POST_CHANGE',
      revision: '42',
      scheduledRetentionCount: '30',
      postChangeRetentionCount: '10',
      safetyRetentionDays: '30',
    }, 'pl')).toEqual([
      ['Klasa retencji', 'po zmianie'],
      ['Rewizja kanoniczna', '42'],
      ['Limit kopii po zmianie', '10'],
      ['Minimalny wiek kopii bezpieczeństwa (dni)', '30'],
      ['Limit kopii okresowych', '30'],
    ])
  })
})
