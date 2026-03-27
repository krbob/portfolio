import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scanTargets = [path.join(sourceRoot, 'components'), path.join(sourceRoot, 'screens'), path.join(sourceRoot, 'App.tsx')]
const userFacingAttributeNames = new Set(['placeholder', 'title', 'aria-label', 'alt'])
const allowedRawUiLiterals = new Set([
  'DD.MM.YYYY',
  'DD/MM/YYYY',
  'EXUS.DE',
  'Interactive Brokers',
  'MM/DD/YYYY',
  'MERGE',
  'PLN MWRR',
  'PLN TWR',
  'Portfolio',
  'REPLACE',
  'USD',
  'USD MWRR',
  'VWCE',
  'VWCE.DE',
  'YYYY-MM-DD',
  'fx',
  'ibkr-activity-2026-03.csv',
  'pp',
])

describe('ui localization guard', () => {
  it('keeps raw user-facing literals on an explicit allowlist', () => {
    const unexpected = collectRawUiLiterals().filter((entry) => !allowedRawUiLiterals.has(entry.text))

    expect(unexpected).toEqual([])
  })
})

function collectRawUiLiterals() {
  const entries: Array<{ file: string; line: number; kind: 'jsx' | 'attr'; attribute?: string; text: string }> = []

  for (const target of scanTargets) {
    if (fs.existsSync(target)) {
      scanPath(target, entries)
    }
  }

  return entries
}

function scanPath(targetPath: string, entries: Array<{ file: string; line: number; kind: 'jsx' | 'attr'; attribute?: string; text: string }>) {
  const stats = fs.statSync(targetPath)
  if (stats.isDirectory()) {
    for (const child of fs.readdirSync(targetPath)) {
      scanPath(path.join(targetPath, child), entries)
    }
    return
  }

  if (!targetPath.endsWith('.tsx') || targetPath.endsWith('.test.tsx')) {
    return
  }

  const source = fs.readFileSync(targetPath, 'utf8')
  const sourceFile = ts.createSourceFile(targetPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = normalizeRawText(node.getText(sourceFile))
      if (isUserFacingLiteral(text)) {
        entries.push({
          file: path.relative(sourceRoot, targetPath),
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          kind: 'jsx',
          text,
        })
      }
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && userFacingAttributeNames.has(node.name.text)) {
      const initializer = node.initializer
      if (initializer && ts.isStringLiteral(initializer)) {
        const text = normalizeRawText(initializer.text)
        if (isUserFacingLiteral(text)) {
          entries.push({
            file: path.relative(sourceRoot, targetPath),
            line: sourceFile.getLineAndCharacterOfPosition(initializer.getStart()).line + 1,
            kind: 'attr',
            attribute: node.name.text,
            text,
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function normalizeRawText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function isUserFacingLiteral(text: string) {
  return text.length > 0 && /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(text)
}
