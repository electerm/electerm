/**
 * animate text when text change
 */

import React, { useRef, useEffect } from 'react'

export default function AnimateText ({ children, className }) {
  const textRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const dom = textRef.current
    if (!dom) return

    dom.className = className || 'animate-text-wrap'
    timerRef.current = setTimeout(() => {
      if (dom) {
        dom.className = className || 'animate-text-wrap'
      }
    }, 450)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [className])

  return (
    <div className={className} ref={textRef}>
      {children}
    </div>
  )
}
