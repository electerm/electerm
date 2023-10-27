export const buildRunScripts = function (inst) {
  return [{
    delay: inst.loginScriptDelay || 0,
    script: inst.loginScript
  }]
}
