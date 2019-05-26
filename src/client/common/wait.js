/**
 * wait async
 */
export default function wait (time) {
  return new Promise(resolve => {
    setTimeout(resolve, time)
  })
}
