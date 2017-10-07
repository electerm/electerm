import { render } from 'react-dom'
import Main from '../components/main'
import '../css/index.styl'

const rootElement = document.getElementById('container')
render(
  <Main />,
  rootElement
)
