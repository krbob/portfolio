import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tokenCss = fs.readFileSync(
  path.join(sourceRoot, 'styles/vendor/stock-ecosystem-ui/tokens.css'),
  'utf8',
)

describe('design-token contrast', () => {
  it('keeps every text role used by Portfolio readable on dark application surfaces', () => {
    const darkTheme = resolveDarkTheme(tokenCss)
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
})

function resolveDarkTheme(css: string) {
  const base = declarations(block(css, ':root'))
  const dark = declarations(block(css, ':root[data-theme="dark"]'))
  const values = new Map([...base, ...dark])

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
    [...css.matchAll(/(--ui-[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  )
}

function resolveValue(value: string, values: Map<string, string>, seen: Set<string>): string {
  const reference = /^var\((--ui-[a-z0-9-]+)\)$/.exec(value)?.[1]
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
