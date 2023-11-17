export function getRandomHexColor () {
  let color = '#'
  const hexValues = '0123456789ABCDEF'

  for (let i = 0; i < 6; i++) {
    const index = Math.floor(Math.random() * 16)
    color += hexValues[index]
  }

  return color
}

export const defaultColors = [
  '#0366d6',
  '#28a745',
  '#d73a49',
  '#ffab4a',
  '#ffd33d',
  '#6f42c1',
  '#e99695',
  '#24292e',
  '#6a737d'
]

export const getRandomDefaultColor = () => {
  const index = Math.floor(Math.random() * defaultColors.length)
  return defaultColors[index]
}
