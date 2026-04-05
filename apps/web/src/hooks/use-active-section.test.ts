import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useActiveSectionId } from './use-active-section'

describe('useActiveSectionId', () => {
  it('returns null when IntersectionObserver is not available', () => {
    // jsdom does not have IntersectionObserver — the hook guards against this
    const { result } = renderHook(() => useActiveSectionId(['a', 'b']))
    expect(result.current).toBeNull()
  })

  it('returns null when no section elements exist in the DOM', () => {
    // Even if we had IntersectionObserver, no matching elements → null
    const { result } = renderHook(() => useActiveSectionId(['nonexistent-1', 'nonexistent-2']))
    expect(result.current).toBeNull()
  })

  it('returns null for empty section ids list', () => {
    const { result } = renderHook(() => useActiveSectionId([]))
    expect(result.current).toBeNull()
  })
})
