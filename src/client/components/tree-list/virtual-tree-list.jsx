import { useEffect, useRef, useState } from 'react'

function getMetrics (container, rowHeight) {
  return {
    scrollTop: container?.scrollTop || 0,
    viewportHeight: container?.clientHeight || rowHeight * 12
  }
}

export default function VirtualTreeList (props) {
  const {
    items,
    rowHeight,
    containerRef,
    overscan = 8,
    renderItem,
    insertionGap
  } = props
  const frameRef = useRef(0)
  const [metrics, setMetrics] = useState(() => {
    return getMetrics(containerRef.current, rowHeight)
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const update = () => {
      setMetrics(prev => {
        const next = getMetrics(container, rowHeight)
        return prev.scrollTop === next.scrollTop &&
          prev.viewportHeight === next.viewportHeight
          ? prev
          : next
      })
    }

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = window.requestAnimationFrame(update)
    }

    update()
    container.addEventListener('scroll', scheduleUpdate, { passive: true })

    let resizeObserver
    if (window.ResizeObserver) {
      resizeObserver = new window.ResizeObserver(scheduleUpdate)
      resizeObserver.observe(container)
    }
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.cancelAnimationFrame(frameRef.current)
      container.removeEventListener('scroll', scheduleUpdate)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [containerRef, rowHeight])

  const gapIndex = insertionGap?.index ?? Number.POSITIVE_INFINITY
  const gapHeight = insertionGap?.height || 0
  const gapTop = Number.isFinite(gapIndex)
    ? gapIndex * rowHeight
    : Number.POSITIVE_INFINITY
  const { scrollTop, viewportHeight } = metrics
  const adjustedScrollTop = scrollTop > gapTop
    ? scrollTop - gapHeight
    : scrollTop
  const adjustedViewportBottom = scrollTop + viewportHeight > gapTop
    ? scrollTop + viewportHeight - gapHeight
    : scrollTop + viewportHeight
  const startIndex = Math.max(0, Math.floor(adjustedScrollTop / rowHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil(adjustedViewportBottom / rowHeight) + overscan
  )
  const visibleItems = items.slice(startIndex, endIndex)
  const totalHeight = items.length * rowHeight + gapHeight

  if (!items.length && !gapHeight) {
    return null
  }

  return (
    <div
      className='tree-list-virtual-spacer'
      style={{ height: totalHeight }}
    >
      {
        visibleItems.map((item, offset) => {
          const index = startIndex + offset
          const top = index * rowHeight + (index >= gapIndex ? gapHeight : 0)
          return (
            <div
              key={item.key}
              className='tree-list-virtual-row'
              style={{
                top,
                height: rowHeight
              }}
            >
              {renderItem(item, index)}
            </div>
          )
        })
      }
    </div>
  )
}
