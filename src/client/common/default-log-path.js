import { osResolve } from './resolve'

export default function () {
  return osResolve(window.et.appPath || window.store.appPath, 'electerm', 'session_logs')
}
