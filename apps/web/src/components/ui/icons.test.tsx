import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  IconClose,
  IconDashboard,
  IconEmptyList,
  IconMenu,
  IconPerformance,
  IconPlus,
  IconPortfolio,
  IconSettings,
  IconTransactions,
  IconWarning,
} from './icons'

const allIcons = [
  { name: 'IconDashboard', Component: IconDashboard, defaultClass: 'h-4 w-4 shrink-0' },
  { name: 'IconPortfolio', Component: IconPortfolio, defaultClass: 'h-4 w-4 shrink-0' },
  { name: 'IconPerformance', Component: IconPerformance, defaultClass: 'h-4 w-4 shrink-0' },
  { name: 'IconTransactions', Component: IconTransactions, defaultClass: 'h-4 w-4 shrink-0' },
  { name: 'IconSettings', Component: IconSettings, defaultClass: 'h-4 w-4 shrink-0' },
  { name: 'IconMenu', Component: IconMenu, defaultClass: 'h-5 w-5' },
  { name: 'IconClose', Component: IconClose, defaultClass: 'h-5 w-5' },
  { name: 'IconWarning', Component: IconWarning, defaultClass: 'h-5 w-5' },
  { name: 'IconEmptyList', Component: IconEmptyList, defaultClass: 'h-5 w-5' },
  { name: 'IconPlus', Component: IconPlus, defaultClass: 'h-5 w-5' },
]

describe('icons', () => {
  for (const { name, Component, defaultClass } of allIcons) {
    it(`${name} renders an svg with default className`, () => {
      const { container } = render(<Component />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('class')).toBe(defaultClass)
    })

    it(`${name} accepts custom className`, () => {
      const { container } = render(<Component className="h-8 w-8" />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('class')).toBe('h-8 w-8')
    })
  }
})
