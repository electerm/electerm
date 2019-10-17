import { render } from 'react-dom'
import '../../../node_modules/xterm/dist/xterm.css'
import Main from '../components/main'
import { notification } from 'antd'

notification.config({
  placement: 'bottomRight'
})

const log = require('electron-log')
log.transports.console.format = '{h}:{i}:{s} › {text}'
log.transports.file.level = 'verbose'
window.log = log
const rootElement = document.getElementById('container')
render(
  <Main />,
  rootElement
)
