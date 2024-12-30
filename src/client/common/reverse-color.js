export function getReverseColor (hex) {
  // Check if the input is a valid hex color code
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return '#0088cc'
  }
  // Convert the hex color code to an integer
  const num = parseInt(hex.slice(1), 16)
  // Bitwise XOR the integer with 0xFFFFFF to get the reverse color
  const reverse = num ^ 0xFFFFFF
  // Convert the reverse color to a hex string and pad with zeros if needed
  return '#' + reverse.toString(16).padStart(6, '0')
}
