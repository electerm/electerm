import { render } from 'react-dom'
import 'antd/dist/reset.css'
import 'xterm/css/xterm.css'
import '../common/trzsz'
import Main from '../components/main'
import { notification } from 'antd'
notification.config({
  placement: 'bottomRight'
})

const rootElement = document.getElementById('container')
render(
  <Main />,
  rootElement
)
