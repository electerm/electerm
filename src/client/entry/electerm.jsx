import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import '@fontsource/maple-mono/index.css'
import Main from '../components/main/index.jsx'

const rootElement = createRoot(document.getElementById('container'))
rootElement.render(
  <Main />
)
