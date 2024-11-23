const layoutConfigs = {
  c1: { cols: 1, rows: 1 },
  c2: { cols: 2, rows: 1 },
  c3: { cols: 3, rows: 1 },
  r2: { cols: 1, rows: 2 },
  r3: { cols: 1, rows: 3 },
  c2x2: { cols: 2, rows: 2 },
  c1r2: { cols: 2, rows: 2, special: 'right', length: 3 },
  r1c2: { cols: 2, rows: 2, special: 'bottom', length: 3 }
}

export default function calcSessionSize (layout, w, h) {
  const { cols, rows, special, length = cols * rows } = layoutConfigs[layout] || layoutConfigs.c1
  const spacing = 0

  const sessionWidth = (w - (cols - 1) * spacing) / cols
  const sessionHeight = (h - (rows - 1) * spacing) / rows

  const sessions = new Array(length).fill(0).map((_, i) => ({
    width: sessionWidth,
    height: sessionHeight
  }))

  if (special === 'right') {
    sessions[0].height = h
  } else if (special === 'bottom') {
    sessions[0].width = w
  }

  return sessions
}
