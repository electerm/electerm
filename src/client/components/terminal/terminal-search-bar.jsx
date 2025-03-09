import React, { useEffect, useRef } from 'react'

export const SearchResultBar = ({ matches, totalLines, matchIndex }) => {
  const canvasRef = useRef(null)

  useEffect(() => {
    drawSearchResults()
  }, [matches, totalLines, matchIndex])

  const drawSearchResults = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const barHeight = canvas.height
    const barWidth = canvas.width

    ctx.clearRect(0, 0, barWidth, barHeight)

    matches.forEach((match, index) => {
      const y = (match.row / totalLines) * barHeight
      ctx.fillStyle = index === matchIndex ? '#ff0000' : '#0000ff'
      ctx.fillRect(0, y, barWidth, 2)
    })
  }

  // const handleClick = (event) => {
  //   const canvas = canvasRef.current;
  //   if (!canvas) return;

  //   const rect = canvas.getBoundingClientRect();
  //   const y = event.clientY - rect.top;
  //   const clickedLine = Math.floor((y / canvas.height) * totalLines);

  //   const clickedMatchIndex = matches.findIndex(match => match.row === clickedLine);
  //   if (clickedMatchIndex !== -1) {
  //     onSelectMatch(clickedMatchIndex);
  //   }
  // };

  if (!matches.length) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      width={20}
      height={300}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        backgroundColor: 'rgba(240, 240, 240, 0.8)',
        borderLeft: '1px solid #ccc'
      }}
    />
  )
}
