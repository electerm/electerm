import { osResolve } from './resolve'

export default function () {
  return window.et.sessionLogPath || osResolve(window.store.appPath, 'electerm', 'session_logs')
}
