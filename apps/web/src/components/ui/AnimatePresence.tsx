import { useEffect, useState, type ReactNode } from 'react'

interface AnimatePresenceProps {
  children: ReactNode
  /** Changing the token re-triggers the enter animation */
  token: string | number | null | undefined
  className?: string
}

export function AnimatePresence({ children, token, className = '' }: AnimatePresenceProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    if (token == null) return
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [token])

  if (token == null) return null

  return (
    <div
      className={`transition-[opacity,transform] duration-200 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}
