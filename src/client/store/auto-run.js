import {
  run
} from '@tylerlong/use-proxy'

function autoRun (proxy, func, decorator) {
  let isTrigger = (event) => true
  const listener = (event) => {
    if (isTrigger(event)) {
      proxy.__emitter__.off('event', listener)
      runOnce()
      proxy.__emitter__.on('event', listener)
    }
  }
  let runOnce = () => {
    [, isTrigger] = run(proxy, func)
  }
  if (decorator) {
    runOnce = decorator(runOnce)
  }
  return {
    start: () => {
      runOnce()
      proxy.__emitter__.on('event', listener)
    },
    stop: () => proxy.__emitter__.off('event', listener)
  }
}

export default (...args) => {
  const a = autoRun(...args)
  a.start()
}
