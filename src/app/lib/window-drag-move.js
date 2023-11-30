// from https://zhuanlan.zhihu.com/p/112564936

const { screen } = require('electron')
let mouseStartPosition = { x: 0, y: 0 }
let movingInterval = null

function windowMove (canMoving) {
  const { win } = global
  const size = win.getBounds()
  if (canMoving) {
    win.setResizable(false)
    mouseStartPosition = screen.getCursorScreenPoint()

    if (movingInterval) {
      clearInterval(movingInterval)
    }

    movingInterval = setInterval(() => {
      const cursorPosition = screen.getCursorScreenPoint()
      const x = size.x + cursorPosition.x - mouseStartPosition.x
      const y = size.y + cursorPosition.y - mouseStartPosition.y
      win.setBounds({
        width: size.width,
        height: size.height,
        x,
        y
      })
    }, 1)
  } else {
    win.setResizable(true)
    clearInterval(movingInterval)
  }
}

module.exports = windowMove
