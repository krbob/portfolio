import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

type Validator<T> = (value: unknown) => value is T

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  options?: {
    validate?: Validator<T>
  },
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, initialValue, options?.validate))

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }, [key, value])

  return [value, setValue]
}

function readStoredValue<T>(key: string, initialValue: T, validate?: Validator<T>) {
  if (typeof window === 'undefined') {
    return initialValue
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) {
      return initialValue
    }

    const parsed = JSON.parse(raw) as unknown
    if (validate && !validate(parsed)) {
      return initialValue
    }

    return (parsed as T) ?? initialValue
  } catch {
    return initialValue
  }
}
