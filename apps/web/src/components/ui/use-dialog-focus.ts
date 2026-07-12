import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      let current: HTMLElement | null = element
      while (current && container.contains(current)) {
        if (current.hidden || current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('inert')) {
          return false
        }
        const style = window.getComputedStyle(current)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        current = current.parentElement
      }
      return true
    },
  )
}

/** Keeps keyboard focus inside a mounted dialog and returns it to its opener. */
export function useDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
) {
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!active || !containerRef.current) return undefined

    const container = containerRef.current
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const initialTarget = container.querySelector<HTMLElement>('[data-dialog-autofocus]')
      ?? focusableElements(container)[0]
      ?? container

    initialTarget.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscapeRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = focusableElements(container)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement

      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [active, containerRef])
}
