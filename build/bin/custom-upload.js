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
    const confs = {
      method: 'post',
      port: 443,
      protocol: 'https:',
      headers: formData.getHeaders(),
      ...conf
    }
    const request = https.request(confs)
    formData.pipe(request)
    request.on('response', function (res) {
      console.log('res.statusCode', res.statusCode)
      if (res.statusCode !== 200) {
        return reject(res.statusCode)
      }
      resolve(res.statusCode)
    })
    request.on('error', function (err) {
      console.error(err)
      reject(err)
    })
  })
}

async function main () {
  const p = resolve(__dirname, '../../dist')
  const exts = [
    'exe',
    'dmg',
    'gz',
    'snap',
    'deb',
    'rpm',
    'appx',
    'AppImage'
  ]
  const list0 = fs.readdirSync(p)
  console.log('list0', list0)
  const list = list0.filter(f => {
    const extName = f.indexOf('.') !== -1 ? f.split('.').pop() : null
    return exts.includes(extName)
  })

  console.log('try upload to custom server')
  const {
    CUSTOM_UPLOAD_URL
  } = process.env
  if (!CUSTOM_UPLOAD_URL) {
    return console.log('CUSTOM_UPLOAD_URL is not set')
  }
  const host = CUSTOM_UPLOAD_URL.split('/')[2]
  const path = '/' + CUSTOM_UPLOAD_URL.split('/').slice(3).join('/')
  for (const n of list) {
    const filePath = resolve(p, n)
    console.log('try upload to custom server', filePath)
    await uploadFile(filePath, n, {
      host,
      path
    }).catch(console.log)
  }
}

exports.upload = main
