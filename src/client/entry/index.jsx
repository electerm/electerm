import { createRoot } from 'react-dom/client'
import '../../../node_modules/xterm/css/xterm.css'
import Main from '../components/main'
import { notification } from 'antd'

notification.config({
  placement: 'bottomRight'
})

const container = document.getElementById('container')
const root = createRoot(container)
root.render(<Main />)
