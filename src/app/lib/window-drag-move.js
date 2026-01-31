// from https://zhuanlan.zhihu.com/p/112564936

const { screen } = require('electron')
const globalState = require('./glob-state')

let mouseStartPosition = { x: 0, y: 0 }
let movingInterval = null
let dragCount = 0

function windowMove (canMoving) {
  const win = globalState.get('win')
  if (!win) {
    return
  }
  const size = win.getBounds()
  if (canMoving) {
    win.setResizable(false)
    mouseStartPosition = screen.getCursorScreenPoint()

    if (movingInterval) {
      clearInterval(movingInterval)
    }

    movingInterval = setInterval(() => {
      dragCount = dragCount + 1
      if (dragCount > 1000) {
        dragCount = 1000
      }
      const cursorPosition = screen.getCursorScreenPoint()
      const x = size.x + cursorPosition.x - mouseStartPosition.x
      const y = size.y + cursorPosition.y - mouseStartPosition.y
      win.setBounds({
        ...size,
        x,
        y
      })
    }, 1)
  } else {
    win.setResizable(true)
    dragCount = 0 // Reset the count when moving is not allowed
    clearInterval(movingInterval)
  }
}

module.exports = windowMove
