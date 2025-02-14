import { osResolve } from './resolve'

export default function () {
  return osResolve(window.store.appPath, 'electerm', 'session_logs')
}
