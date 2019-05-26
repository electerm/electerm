/**
 * check if string is ip
 * from https://github.com/DavidTPate/isip/blob/master/index.js @David Pate
 */

const digit = '0-9'
const digitOnly = '[' + digit + ']'
const alpha = 'a-zA-Z'
const hexDigit = digit + 'a-fA-F'
const hexDigitOnly = '[' + hexDigit + ']'
const unreserved = alpha + digit + '-\\._~'
const subDelims = '!$&\'()*+,;='
const or = '|'
const zeroPad = '0?'
const decOctect = '(' + zeroPad + zeroPad + digitOnly + or + zeroPad + '[1-9]' + digitOnly + or + '1' + digitOnly + digitOnly + or + '2' + '[0-4]' + digitOnly + or + '25' + '[0-5])'
const cidr = digitOnly + or + '[1-2]' + digitOnly + or + '3' + '[0-2]'
const IPv4address = '(' + decOctect + '\\.){3}' + decOctect + '(\\/(' + cidr + '))?'

const h16 = '(' + hexDigitOnly + '){1,4}'

const ls32 = '(' + h16 + ':' + h16 + '|' + IPv4address + ')'

const IPv6SixHex = '(' + h16 + ':){6}' + ls32

const IPv6FiveHex = '::(' + h16 + ':){5}' + ls32

const IPv6FourHex = h16 + '::(' + h16 + ':){4}' + ls32

const IPv6ThreeeHex = '(' + h16 + ':){0,1}' + h16 + '::(' + h16 + ':){3}' + ls32

const IPv6TwoHex = '(' + h16 + ':){0,2}' + h16 + '::(' + h16 + ':){2}' + ls32

const IPv6OneHex = '(' + h16 + ':){0,3}' + h16 + '::' + h16 + ':' + ls32

const IPv6NoneHex = '(' + h16 + ':){0,4}' + h16 + '::' + ls32

const IPv6NoneHex2 = '(' + h16 + ':){0,5}' + h16 + '::' + h16

const IPv6NoneHex3 = '(' + h16 + ':){0,6}' + h16 + '::'

const IPv6address = '((' + IPv6SixHex + or + IPv6FiveHex + or + IPv6FourHex + or + IPv6ThreeeHex + or + IPv6TwoHex + or + IPv6OneHex + or + IPv6NoneHex + or + IPv6NoneHex2 + or + IPv6NoneHex3 + ')(\\/(' + cidr + '))?)'

const IPvFuture = '((v|V)' + hexDigitOnly + '+\\.[' + unreserved + subDelims + ':]+(' + cidr + ')?)'

const allTypesRegExp = new RegExp('^(' + IPv4address + or + IPv6address + or + IPvFuture + ')$')

export default (str) => {
  return allTypesRegExp.test(str)
}
