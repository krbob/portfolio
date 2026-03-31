import { useEffect, useRef, useState, type ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  className?: string
  /** Delay before starting the animation in ms */
  delay?: number
}

export function FadeIn({ children, className = '', delay = 0 }: FadeInProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timeout)
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-300 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}
