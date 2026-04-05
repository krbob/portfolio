import { useEffect, useRef, useState } from 'react'

/**
 * Returns the id of the section that is currently most visible in the viewport.
 * Uses IntersectionObserver with a top-biased rootMargin so that sections near
 * the top of the viewport are preferred over those further down.
 */
export function useActiveSectionId(sectionIds: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)
  const ratioMap = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratioMap.current.set(entry.target.id, entry.intersectionRatio)
        }

        let bestId: string | null = null
        let bestRatio = 0

        for (const [id, ratio] of ratioMap.current) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }

        if (bestId != null) {
          setActiveId(bestId)
        }
      },
      {
        // Bias toward sections near the top of the viewport
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      },
    )

    for (const el of elements) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
    }
  }, [sectionIds])

  return activeId
}
