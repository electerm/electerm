import React, { useEffect, useRef } from 'react'

export default function SearchResultBar ({
  matches,
  totalLines,
  matchIndex,
  height
}) {
  const canvasRef = useRef(null)
  const drawSearchResults = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.parentElement
    const containerHeight = container.clientHeight
    const dpr = window.devicePixelRatio || 1

    // Set both canvas dimensions and style
    canvas.height = containerHeight * dpr
    canvas.width = 16 * dpr

    const ctx = canvas.getContext('2d')
    // Scale the context to account for the pixel ratio
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    matches.forEach((match, index) => {
      const y = (match / totalLines) * containerHeight
      ctx.fillStyle = index === matchIndex ? 'rgba(243, 67, 9, 0.5)' : 'rgba(243, 196, 9, 0.5)'
      ctx.fillRect(0, y, 16, 2)
    })
  }

  useEffect(() => {
    drawSearchResults()
  }, [matches, totalLines, matchIndex])

  if (!matches.length) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className='term-search-bar'
    />
  )
}
