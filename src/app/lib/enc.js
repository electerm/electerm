/**
 * data encrypt/decrypt
 */

const crypto = require('crypto')
const algorithmDefault = 'aes-192-cbc'
const promisifyAll = require('util-promisifyall')
const cpt = promisifyAll(crypto)

exports.encrypt = function (
  str = '',
  password,
  algorithm = algorithmDefault,
  iv = Buffer.alloc(16, 0)
) {
  const key = crypto.scryptSync(password, 'salt', 24)
  // Use `crypto.randomBytes` to generate a random iv instead of the static iv
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(str, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

exports.decrypt = function (
  encrypted = '',
  password,
  algorithm = algorithmDefault,
  iv = Buffer.alloc(16, 0)
) {
  // Use the async `crypto.scrypt()` instead.
  const key = crypto.scryptSync(password, 'salt', 24)
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  // Encrypted using same algorithm, key and iv.
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

exports.encryptAsync = async function (
  str = '',
  password,
  algorithm = algorithmDefault,
  iv = Buffer.alloc(16, 0)
) {
  const key = await cpt.scryptAsync(password, 'salt', 24)
  // Use `crypto.randomBytes` to generate a random iv instead of the static iv
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(str, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

exports.decryptAsync = async function (
  encrypted = '',
  password,
  algorithm = algorithmDefault,
  iv = Buffer.alloc(16, 0)
) {
  // Use the async `crypto.scrypt()` instead.
  const key = await cpt.scryptAsync(password, 'salt', 24)
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  // Encrypted using same algorithm, key and iv.
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
