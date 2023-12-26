require('dotenv').config()
const FormData = require('form-data')
const fs = require('fs')
const https = require('https')
const { resolve } = require('path')

async function uploadFile (filePath, fileName, conf) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath)
    const formData = new FormData()
    formData.append('file', fileStream, fileName)
    const request = https.request({
      method: 'post',
      port: 443,
      protocol: 'https:',
      headers: formData.getHeaders(),
      ...conf
    })
    formData.pipe(request)
    request.on('response', function (res) {
      console.log('res.statusCode', res.statusCode)
      resolve(res.statusCode)
    })
    request.on('error', function (err) {
      console.error(err)
      reject(err)
    })
  })
}

const p = resolve(__dirname, '../../dist')
const exts = [
  'exe',
  'dmg',
  'gz',
  'snap',
  'deb',
  'rpm',
  'appx'
]
const list = fs.readdirSync(p).filter(f => {
  const extName = f.indexOf('.') !== -1 ? f.split('.').pop() : null
  return exts.includes(extName)
})

async function main () {
  console.log('try upload to custom server')
  const {
    CUSTOM_UPLOAD_URL
  } = process.env
  if (!CUSTOM_UPLOAD_URL) {
    return console.log('CUSTOM_UPLOAD_URL is not set')
  }
  const host = CUSTOM_UPLOAD_URL.split('/')[2]
  const path = '/' + CUSTOM_UPLOAD_URL.split('/').slice(3).join('/')
  console.log('try upload to custom server', list)
  for (const n of list) {
    const filePath = path.join(p, n)
    console.log('try upload to custom server', filePath)
    await uploadFile(filePath, n, {
      host,
      path
    })
  }
}

exports.upload = main
