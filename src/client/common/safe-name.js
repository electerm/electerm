/**
 * convert string to safe name
 * from https://github.com/Jaliborc/safe-filename/blob/master/index.js
 */

export default (name) => {
  return name
    .replace(/\.$/, '')
    .replace('?', '❓')
    .replace('\\', ' ⃥')
    .replace('/', '⟋')
    .replace('|', '│')
    .replace(':', '꞉')
    .replace('<', 'ᐸ')
    .replace('>', 'ᐳ')
    .replace('>', 'ᐳ')
    .replace('"', 'ᐦ')
    .replace('*', '꘎')
}
