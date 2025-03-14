const fs = require('fs').promises
const path = require('path')
const EventEmitter = require('events')

const widgetInfo = {
  name: 'File Renamer',
  description: 'Batch rename files in a folder using customizable templates',
  version: '1.0.0',
  author: 'ZHAO Xudong',
  configs: [
    {
      name: 'directory',
      type: 'string',
      default: '',
      description: 'The directory containing files to rename'
    },
    {
      name: 'template',
      type: 'string',
      default: '{name}-{n}.{ext}',
      description: `Template for new file names. Available tags:
        {n} - Sequential number (e.g., 1, 2, 3)
        {n:padding} - Padded number (e.g., {n:3} => 001, 002)
        {name} - Original filename without extension
        {ext} - File extension
        {date} - File creation date (YYYY-MM-DD)
        {time} - File creation time (HH-mm-ss)
        {random} - Random string
        {parent} - Parent folder name`
    },
    {
      name: 'startNumber',
      type: 'number',
      default: 1,
      description: 'Starting number for sequential numbering'
    },
    {
      name: 'padWidth',
      type: 'number',
      default: 3,
      description: 'Width to pad numbers with zeros (1 to 10)'
    },
    {
      name: 'includeSubfolders',
      type: 'boolean',
      default: false,
      description: 'Process files in subfolders'
    },
    {
      name: 'fileTypes',
      type: 'string',
      default: '*',
      description: 'Comma-separated list of file extensions (e.g., jpg,png,gif) or * for all'
    },
    {
      name: 'preserveCase',
      type: 'boolean',
      default: true,
      description: 'Preserve original filename case'
    }
  ]
}

class FileRenamer extends EventEmitter {
  constructor (config) {
    super()
    this.config = config
    this.isRunning = false
  }

  async getFiles (dir, fileTypes, includeSubfolders) {
    const files = await fs.readdir(dir, { withFileTypes: true })
    let results = []

    for (const file of files) {
      const fullPath = path.join(dir, file.name)
      if (file.isDirectory() && includeSubfolders) {
        results = results.concat(await this.getFiles(fullPath, fileTypes, includeSubfolders))
      } else if (file.isFile()) {
        const ext = path.extname(file.name).toLowerCase().slice(1)
        if (fileTypes === '*' || fileTypes.split(',').map(t => t.trim().toLowerCase()).includes(ext)) {
          results.push(fullPath)
        }
      }
    }
    return results
  }

  async processTemplate (template, filePath, index) {
    const stats = await fs.stat(filePath)
    const parsedPath = path.parse(filePath)
    const date = new Date(stats.birthtime)

    const replacements = {
      n: (padding) => {
        const num = this.config.startNumber + index
        return padding
          ? String(num).padStart(parseInt(padding), '0')
          : String(num)
      },
      name: () => this.config.preserveCase ? parsedPath.name : parsedPath.name.toLowerCase(),
      ext: () => parsedPath.ext.slice(1),
      date: () => date.toISOString().split('T')[0],
      time: () => date.toTimeString().split(' ')[0].replace(/:/g, '-'),
      random: () => Math.random().toString(36).substring(2, 8),
      parent: () => parsedPath.dir.split(path.sep).pop()
    }

    let result = template
    for (const [tag, func] of Object.entries(replacements)) {
      // Handle tags with parameters like {n:3}
      result = result.replace(new RegExp(`{${tag}(?::([^}]+))?}`, 'g'), (match, param) => func(param))
    }

    return result
  }

  async renameFiles () {
    this.isRunning = true
    const { directory, template, includeSubfolders, fileTypes } = this.config

    try {
      const files = await this.getFiles(directory, fileTypes, includeSubfolders)

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i]
        const dir = path.dirname(filePath)
        const newName = await this.processTemplate(template, filePath, i)
        const newPath = path.join(dir, newName)

        await fs.rename(filePath, newPath)
        this.emit('fileRenamed', {
          oldPath: filePath,
          newPath,
          progress: {
            current: i + 1,
            total: files.length
          }
        })
      }

      this.emit('complete', { totalRenamed: files.length })
    } catch (error) {
      this.emit('error', error)
    } finally {
      this.isRunning = false
    }
  }

  async start () {
    if (this.isRunning) {
      throw new Error('File renaming is already in progress')
    }
    await this.renameFiles()
  }

  getStatus () {
    return {
      status: this.isRunning ? 'running' : 'idle',
      config: this.config
    }
  }
}

function widgetRun (config) {
  return new FileRenamer(config)
}

module.exports = {
  widgetInfo,
  widgetRun
}
