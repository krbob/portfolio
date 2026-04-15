import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DEFAULT_QUERY_STALE_TIME_MS } from '../lib/query-client'

const RESUME_REFRESH_COOLDOWN_MS = 5_000

export function useAppResumeRefresh() {
  const queryClient = useQueryClient()
  const hiddenAtRef = useRef<number | null>(typeof document !== 'undefined' && document.hidden ? Date.now() : null)
  const lastRefreshAtRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined
    }

    async function refreshActiveWorkspaceData() {
      const hiddenAt = hiddenAtRef.current
      if (hiddenAt == null || document.hidden) {
        return
      }

      const now = Date.now()
      if (now - hiddenAt < DEFAULT_QUERY_STALE_TIME_MS) {
        hiddenAtRef.current = null
        return
      }

      if (navigator.onLine === false) {
        return
      }

      if (now - lastRefreshAtRef.current < RESUME_REFRESH_COOLDOWN_MS) {
        return
      }

      lastRefreshAtRef.current = now
      hiddenAtRef.current = null
      await queryClient.invalidateQueries()
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
        return
      }

      void refreshActiveWorkspaceData()
    }

    function handleFocus() {
      void refreshActiveWorkspaceData()
    }

    function handlePageShow() {
      void refreshActiveWorkspaceData()
    }

    function handleOnline() {
      void refreshActiveWorkspaceData()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('online', handleOnline)
    }
  }, [queryClient])
}
