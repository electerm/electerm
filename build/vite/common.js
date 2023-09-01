import { config as conf } from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { exec } from 'child_process'

conf()

export const cwd = process.cwd()
export const env = process.env
export const isProd = env.NODE_ENV === 'production'
const packPath = resolve(cwd, '../../package.json')
export const pack = JSON.parse(readFileSync(packPath).toString())
export const version = pack.version
export const viewPath = resolve(cwd, '../../src/client/views')
export const staticPaths = [
  {
    dir: resolve(cwd, '../../node_modules/lodash'),
    path: '/external'
  },
  {
    dir: resolve(cwd, '../../node_modules/react/umd'),
    path: '/external'
  },
  {
    dir: resolve(cwd, '../../node_modules/react-dom/umd'),
    path: '/external'
  },
  {
    dir: resolve(cwd, '../../node_modules/vscode-icons/icons'),
    path: '/icons'
  },
  {
    dir: resolve(cwd, '../../node_modules/@electerm/electerm-resource/tray-icons'),
    path: '/images'
  },
  {
    dir: resolve(cwd, '../../node_modules/@electerm/electerm-resource/res/imgs'),
    path: '/images'
  }
]

export function exe (command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout.trim())
    })
  })
}
