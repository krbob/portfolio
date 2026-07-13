import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FadeIn } from './FadeIn'

describe('FadeIn', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('animates position without lowering descendant contrast', () => {
    vi.useFakeTimers()
    const { container } = render(<FadeIn>Readable content</FadeIn>)
    const wrapper = container.firstElementChild

    expect(wrapper).toHaveClass('translate-y-2', 'transition-transform')
    expect(wrapper?.className).not.toContain('opacity')

    act(() => vi.runAllTimers())

    expect(wrapper).toHaveClass('translate-y-0')
    expect(wrapper?.className).not.toContain('opacity')
  })
})
