import { render } from 'react-dom'
import '../../../node_modules/xterm/dist/xterm.css'
import Main from '../components/main'
import '../css/basic.styl'
import '../css/index.styl'
import '../css/theme.styl'



const rootElement = document.getElementById('container')
render(
  <Main />,
  rootElement
)
