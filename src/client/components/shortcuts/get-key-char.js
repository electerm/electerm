export function getKeyCharacter (code = '') {
  const mapping = {
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    NumpadDivide: '/',
    NumpadMultiply: '*',
    NumpadSubtract: '-',
    Numpad7: 'N7',
    Numpad8: 'N8',
    Numpad9: 'N9',
    NumpadAdd: '+',
    Numpad4: 'N4',
    Numpad5: 'N5',
    Numpad6: 'N6',
    Numpad1: 'N1',
    Numpad2: 'N2',
    Numpad3: 'N3',
    NumpadEnter: 'Enter',
    Numpad0: 'N0',
    NumpadDecimal: '.',
    IntlBackslash: '\\',
    ArrowLeft: '←',
    ArrowUp: '↑',
    ArrowRight: '→',
    ArrowDown: '↓',
    Semicolon: ';',
    Quote: '\'',
    Comma: ',',
    Period: '.',
    Slash: '/',
    mouseWheelUp: '▲',
    mouseWheelDown: '▼'
  }
  if (code.startsWith('Key') && code.length === 4) {
    return code[3].toLowerCase()
  } else if (code.startsWith('Digit') && code.length === 5) {
    return code[5]
  } else {
    return mapping[code] || code
  }
}
