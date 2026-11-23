export const terminalDropUploads = [
  { command: 'trz', protocol: 'trz', action: 'rename' },
  { command: 'trz -y', protocol: 'trz', action: 'overwrite' },
  { command: 'rz', protocol: 'rz' },
  { command: 'rz -E', protocol: 'rz', action: 'rename' },
  { command: 'rz -y', protocol: 'rz', action: 'overwrite' }
]

export function terminalDropOptions (translate, isSerial = false) {
  const uploads = isSerial
    ? [{ value: 'xmodem', label: 'XMODEM' }]
    : terminalDropUploads.map(({ command, protocol, action }) => ({
      value: command,
      label: action ? `${protocol} ${translate(action)}` : protocol
    }))
  return [...uploads, { value: 'inputOnly', label: translate('inputOnly') }]
}
