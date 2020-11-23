/**
 * handle terminal interactive operation
 */

import { useEffect } from 'react'

export default function TermInteractive () {
  // function onMsg (e) {
  //   const arg = JSON.parse(e.data)
  //   if (arg.action === 'session-inetractive') {
  //     console.log(arg)
  //   }
  // }
  function init () {
    // setTimeout(() => {
    //   window.et.commonWs.addEventListener('message', onMsg)
    // }, 500)
  }
  useEffect(() => {
    init()
  }, [])
  return null
}
