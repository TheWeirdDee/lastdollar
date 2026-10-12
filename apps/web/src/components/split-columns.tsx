'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './ui'

/**
 * Two columns where the shorter one stays pinned while the taller one scrolls.
 * A column is only pinned if it fits in the viewport; otherwise its lower part would be unreachable.
 */
export function SplitColumns({
  left,
  right,
  className,
  breakpoint = 'lg',
}: {
  left: ReactNode
  right: ReactNode
  className?: string
  breakpoint?: 'lg' | 'xl'
}) {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    const l = leftRef.current
    const r = rightRef.current
    if (!l || !r || typeof ResizeObserver === 'undefined') return
    const minWidth = breakpoint === 'xl' ? 1280 : 1024
    const update = () => {
      if (window.innerWidth < minWidth) return setPinned(null)
      const lh = l.offsetHeight
      const rh = r.offsetHeight
      const room = window.innerHeight - 120
      const shorter = lh < rh ? 'left' : rh < lh ? 'right' : null
      const h = shorter === 'left' ? lh : rh
      setPinned(shorter && h <= room ? shorter : null)
    }
    const ro = new ResizeObserver(update)
    ro.observe(l)
    ro.observe(r)
    window.addEventListener('resize', update)
    update()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [breakpoint])

  const stick = 'sticky top-24'
  return (
    <div className={cx('grid items-start gap-6', className)}>
      <div ref={leftRef} className={cx('min-w-0 space-y-6', pinned === 'left' && stick)}>
        {left}
      </div>
      <div ref={rightRef} className={cx('min-w-0', pinned === 'right' && stick)}>
        {right}
      </div>
    </div>
  )
}
