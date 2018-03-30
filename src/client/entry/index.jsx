import { render } from 'react-dom'
import '../../../node_modules/xterm/dist/xterm.css'
import Main from '../components/main'

const rootElement = document.getElementById('container')
render(
  <Main />,
  rootElement
)
