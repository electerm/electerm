// from https://zhuanlan.zhihu.com/p/112564936

const { screen } = require('electron')
let winStartPosition = { x: 0, y: 0 }
let mouseStartPosition = { x: 0, y: 0 }
let movingInterval = null

function windowMove (canMoving) {
  const { win } = global
  if (canMoving) {
    const winPosition = win.getPosition()
    winStartPosition = { x: winPosition[0], y: winPosition[1] }
    mouseStartPosition = screen.getCursorScreenPoint()

    if (movingInterval) {
      clearInterval(movingInterval)
    }

    movingInterval = setInterval(() => {
      const cursorPosition = screen.getCursorScreenPoint()
      const x = winStartPosition.x + cursorPosition.x - mouseStartPosition.x
      const y = winStartPosition.y + cursorPosition.y - mouseStartPosition.y
      win.setPosition(x, y, true)
    }, 1)
  } else {
    clearInterval(movingInterval)
  }
}

module.exports = windowMove
