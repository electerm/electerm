/**
 * Promise support timeout
 */

export class NewPromise extends Promise {
  constructor (executor, timeout = 120000) {
    let timeoutId

    super((resolve, reject) => {
      const wrappedResolve = (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      }

      const wrappedReject = (reason) => {
        clearTimeout(timeoutId)
        reject(reason)
      }

      timeoutId = setTimeout(() => {
        wrappedReject(new Error('Promise timed out'))
      }, timeout)

      executor(wrappedResolve, wrappedReject)
    })
  }
}
