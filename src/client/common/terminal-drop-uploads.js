export const terminalDropUploads = [
  { command: 'trz', protocol: 'trz', action: 'rename' },
  { command: 'trz -y', protocol: 'trz', action: 'overwrite' },
  { command: 'rz', protocol: 'rz' },
  { command: 'rz -E', protocol: 'rz', action: 'rename' },
  { command: 'rz -y', protocol: 'rz', action: 'overwrite' }
]

export function dropUploadLabel ({ protocol, action }, translate) {
  return action ? `${protocol} ${translate(action)}` : protocol
}
