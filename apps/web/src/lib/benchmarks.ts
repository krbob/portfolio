import type { PortfolioBenchmarkSettings } from '../api/write-model'

export const DEFAULT_BENCHMARK_ORDER = ['VWRA', 'V80A', 'V60A', 'V40A', 'V20A', 'CUSTOM', 'INFLATION', 'TARGET_MIX']

export function resolveBenchmarkOrder(settings?: PortfolioBenchmarkSettings): string[] {
  if (!settings) {
    return [...DEFAULT_BENCHMARK_ORDER]
  }

  const optionOrder = settings.options.map((option) => option.key)
  const enabledKeys = settings.enabledKeys.length > 0 ? settings.enabledKeys : optionOrder
  const enabledSet = new Set(enabledKeys)
  const orderedPinned = settings.pinnedKeys.filter((key) => enabledSet.has(key))
  const remainingOptionKeys = optionOrder.filter((key) => enabledSet.has(key) && !orderedPinned.includes(key))
  const remainingKnownDefaults = DEFAULT_BENCHMARK_ORDER.filter(
    (key) => enabledSet.has(key) && !orderedPinned.includes(key) && !remainingOptionKeys.includes(key),
  )
  const remainingEnabledKeys = enabledKeys.filter(
    (key) => !orderedPinned.includes(key) && !remainingOptionKeys.includes(key) && !remainingKnownDefaults.includes(key),
  )

  return [...orderedPinned, ...remainingOptionKeys, ...remainingKnownDefaults, ...remainingEnabledKeys]
}

export function orderAvailableBenchmarkKeys(
  keysWithData: Iterable<string>,
  preferredOrder?: readonly string[],
): string[] {
  const available = new Set(keysWithData)
  const ordered = (preferredOrder?.length ? preferredOrder : DEFAULT_BENCHMARK_ORDER).filter((key) => available.has(key))

  if (preferredOrder?.length) {
    return ordered
  }

  const remaining = [...available]
    .filter((key) => !ordered.includes(key))
    .sort()

  return [...ordered, ...remaining]
}
