import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('accessibility style guard', () => {
  it('does not reintroduce low-contrast zinc text utilities', () => {
    expect(findLowContrastTextClasses(sourceRoot)).toEqual([])
  })
})

function findLowContrastTextClasses(root: string) {
  const violations: Array<{ file: string; line: number; className: string }> = []

  function walk(current: string) {
    for (const entry of fs.readdirSync(current)) {
      const fullPath = path.join(current, entry)
      const stats = fs.statSync(fullPath)
      if (stats.isDirectory()) {
        if (entry !== 'generated') walk(fullPath)
        continue
      }
      if (!(fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) || fullPath.includes('.test.')) continue

      fs.readFileSync(fullPath, 'utf8').split('\n').forEach((line, index) => {
        for (const match of line.matchAll(/(?:placeholder:)?text-zinc-(?:500|600)/g)) {
          violations.push({
            file: path.relative(root, fullPath),
            line: index + 1,
            className: match[0],
          })
        }
      })
    }
  }

  walk(root)
  return violations
}
