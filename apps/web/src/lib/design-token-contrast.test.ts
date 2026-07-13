import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contractTokenCss = fs.readFileSync(
  path.join(sourceRoot, 'styles/vendor/stock-ecosystem-ui/tokens.css'),
  'utf8',
)
const portfolioTokenCss = fs.readFileSync(
  path.join(sourceRoot, 'styles/portfolio-tokens.css'),
  'utf8',
)

describe('design-token contrast', () => {
  it('keeps every text role used by Portfolio readable on dark application surfaces', () => {
    const darkTheme = resolveDarkTheme(contractTokenCss, portfolioTokenCss)
    const backgrounds = [
      '--ui-color-canvas',
      '--ui-color-surface',
      '--ui-color-surface-raised',
    ]
    const foregrounds = [
      '--ui-color-text',
      '--ui-color-text-secondary',
      '--ui-color-text-muted',
      '--ui-color-action',
      '--ui-color-positive',
      '--ui-color-negative',
      '--ui-color-danger',
      '--ui-color-highlight',
    ]

    for (const foreground of foregrounds) {
      for (const background of backgrounds) {
        expect(
          contrastRatio(darkTheme.get(foreground)!, darkTheme.get(background)!),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps Portfolio dark surfaces on the neutral product palette', () => {
    const darkTheme = resolveDarkTheme(contractTokenCss, portfolioTokenCss)
    const expected = new Map([
      ['--ui-color-canvas', '#09090b'],
      ['--ui-color-surface', '#151517'],
      ['--ui-color-surface-raised', '#18181b'],
      ['--ui-color-border', '#27272a'],
      ['--ui-color-border-strong', '#3f3f46'],
      ['--ui-color-text', '#f4f4f5'],
      ['--ui-color-text-secondary', '#a1a1aa'],
      ['--ui-color-text-muted', '#8b8b8b'],
      ['--ui-chart-grid', '#27272a'],
      ['--ui-chart-text', '#e4e4e7'],
    ])

    for (const [token, value] of expected) {
      expect(darkTheme.get(token), token).toBe(value)
    }

    for (const token of [
      '--ui-color-canvas',
      '--ui-color-surface',
      '--ui-color-surface-raised',
    ]) {
      expect(channelSpread(darkTheme.get(token)!), `${token} should remain neutral`).toBeLessThanOrEqual(3)
    }
  })

  it('keeps forced-dark and system-dark Portfolio overrides aligned', () => {
    const forcedDark = declarations(block(portfolioTokenCss, ':root[data-theme="dark"]'))
    const systemDark = declarations(block(portfolioTokenCss, ':root:not([data-theme="light"])'))

    expect([...systemDark]).toEqual([...forcedDark])
  })
})

function resolveDarkTheme(contractCss: string, productCss: string) {
  const contractBase = declarations(block(contractCss, ':root'))
  const contractDark = declarations(block(contractCss, ':root[data-theme="dark"]'))
  const productBase = declarations(block(productCss, ':root'))
  const productDark = declarations(block(productCss, ':root[data-theme="dark"]'))
  const values = new Map([...contractBase, ...contractDark, ...productBase, ...productDark])

  for (const name of values.keys()) {
    values.set(name, resolveValue(requireValue(values, name), values, new Set([name])))
  }
  return values
}

function block(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(css)
  if (!match) throw new Error(`Missing ${selector} token block.`)
  return match[1]
}

function declarations(css: string) {
  return new Map(
    [...css.matchAll(/(--(?:ui|portfolio)-[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  )
}

function resolveValue(value: string, values: Map<string, string>, seen: Set<string>): string {
  const reference = /^var\((--(?:ui|portfolio)-[a-z0-9-]+)\)$/.exec(value)?.[1]
  if (!reference) return value
  if (seen.has(reference)) throw new Error(`Circular token reference: ${[...seen, reference].join(' -> ')}`)
  return resolveValue(requireValue(values, reference), values, new Set([...seen, reference]))
}

function requireValue(values: Map<string, string>, name: string) {
  const value = values.get(name)
  if (!value) throw new Error(`Missing token value for ${name}.`)
  return value
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

function luminance(hex: string) {
  if (!/^#[a-f\d]{6}$/i.test(hex)) throw new Error(`Expected resolved hex color, received ${hex}.`)
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function channelSpread(hex: string) {
  if (!/^#[a-f\d]{6}$/i.test(hex)) throw new Error(`Expected resolved hex color, received ${hex}.`)
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  return Math.max(...channels) - Math.min(...channels)
}
