export function getKeyCharacter (code) {
  if (code.startsWith('Key') && code.length === 4) {
    return code[3].toLowerCase()
  } else if (code.startsWith('Digit') && code.length === 5) {
    return code[5]
  } else {
    return code
  }
}
