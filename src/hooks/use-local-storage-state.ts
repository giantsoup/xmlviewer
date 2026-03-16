import { useEffect, useState } from 'preact/hooks'

export function useLocalStorageState<T>(
  storageKey: string,
  initialValue: T | (() => T),
): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const fallback =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue

    if (typeof window === 'undefined') {
      return fallback
    }

    const stored = window.localStorage.getItem(storageKey)
    if (!stored) {
      return fallback
    }

    try {
      return JSON.parse(stored) as T
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(value))
  }, [storageKey, value])

  return [value, setValue]
}
