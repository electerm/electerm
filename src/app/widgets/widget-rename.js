const fs = require('fs').promises
const path = require('path')

// Define defaults in one place
const DEFAULTS = {
  directory: '',
  template: '{name}-{n}.{ext}',
  includeSubfolders: false,
  fileTypes: '*',
  startNumber: 1,
  preserveCase: true
}

const widgetInfo = {
  name: 'File Renamer',
  description: 'Batch rename files in a folder using customizable templates',
  version: '1.0.0',
  author: 'ZHAO Xudong',
  type: 'once',
  builtin: true,
  configs: [
    {
      name: 'directory',
      type: 'string',
      default: DEFAULTS.directory,
      description: 'The directory containing files to rename'
    },
    {
      name: 'template',
      type: 'string',
      default: DEFAULTS.template,
      description: 'Template for new file names. Available tags:\n{n} - Sequential number (e.g., 1, 2, 3)\n{n:padding} - Padded number (e.g., {n:3} => 001, 002)\n{name} - Original filename without extension\n{ext} - File extension\n{date} - File creation date (YYYY-MM-DD)\n{time} - File creation time (HH-mm-ss)\n{random} - Random string'
    },
    {
      name: 'includeSubfolders',
      type: 'boolean',
      default: DEFAULTS.includeSubfolders,
      description: 'Process files in subfolders'
    },
    {
      name: 'fileTypes',
      type: 'string',
      default: DEFAULTS.fileTypes,
      description: 'Comma-separated list of file extensions (e.g., jpg,png,gif) or * for all'
    },
    {
      name: 'startNumber',
      type: 'number',
      default: DEFAULTS.startNumber,
      description: 'Starting number for sequential naming'
    },
    {
      name: 'preserveCase',
      type: 'boolean',
      default: DEFAULTS.preserveCase,
      description: 'Preserve case of original filenames'
    }
  ]
}

async function getFiles (dir, fileTypes, includeSubfolders) {
  const files = await fs.readdir(dir, { withFileTypes: true })
  let results = []
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory() && includeSubfolders) {
      results = results.concat(await getFiles(fullPath, fileTypes, includeSubfolders))
    } else if (file.isFile()) {
      const ext = path.extname(file.name).toLowerCase().slice(1)
      if (fileTypes === '*' || fileTypes.split(',').map(t => t.trim().toLowerCase()).includes(ext)) {
        results.push(fullPath)
      }
    }
  }
  return results
}

async function processTemplate (template, filePath, index, startNumber, preserveCase) {
  const stats = await fs.stat(filePath)
  const parsedPath = path.parse(filePath)
  const date = new Date(stats.birthtime)
  const replacements = {
    n: (padding) => {
      const num = startNumber + index
      return padding ? String(num).padStart(parseInt(padding), '0') : String(num)
    },
    name: () => preserveCase ? parsedPath.name : parsedPath.name.toLowerCase(),
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

async function widgetRun (params = {}) {
  const config = {
    ...DEFAULTS,
    ...params
  }

  const {
    directory,
    template,
    includeSubfolders,
    fileTypes,
    startNumber,
    preserveCase
  } = config

  if (!directory) {
    return {
      success: false,
      error: 'Directory must be specified'
    }
  }

  try {
    const files = await getFiles(directory, fileTypes, includeSubfolders)
    const results = []

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      const dir = path.dirname(filePath)
      const newName = await processTemplate(template, filePath, i, startNumber, preserveCase)
      const newPath = path.join(dir, newName)
      await fs.rename(filePath, newPath)

      results.push({
        oldPath: filePath,
        newPath,
        success: true
      })
    }

    return {
      success: true,
      totalRenamed: files.length,
      msg: `Renamed ${files.length} files successfully`,
      details: results
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error
    }
  }
}

module.exports = {
  widgetInfo,
  widgetRun
}
