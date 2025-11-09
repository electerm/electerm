#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

/**
 * Clean empty folders recursively in a given directory
 * @param {string} dirPath - The directory path to clean
 * @returns {number} - Number of empty folders removed
 */
function cleanEmptyFolders (dirPath) {
  let removedCount = 0

  if (!fs.existsSync(dirPath)) {
    console.log('Directory does not exist:', dirPath)
    return removedCount
  }

  try {
    const items = fs.readdirSync(dirPath)

    // First, recursively clean subdirectories
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stats = fs.statSync(itemPath)

      if (stats.isDirectory()) {
        removedCount += cleanEmptyFolders(itemPath)
      }
    }

    // After cleaning subdirectories, check if current directory is now empty
    const remainingItems = fs.readdirSync(dirPath)
    if (remainingItems.length === 0) {
      // Don't remove the root node_modules directory itself
      const nodeModulesPath = path.resolve(process.cwd(), 'work/app/node_modules')
      if (path.resolve(dirPath) !== nodeModulesPath) {
        console.log('Removing empty directory:', dirPath)
        fs.rmdirSync(dirPath)
        removedCount++
      }
    }
  } catch (error) {
    console.error('Error processing directory ' + dirPath + ':', error.message)
  }

  return removedCount
}

/**
 * Main function to clean empty folders in work/app/node_modules
 */
function main () {
  const targetDir = path.resolve(process.cwd(), 'work/app/node_modules')

  console.log('Starting cleanup of empty folders in:', targetDir)
  console.log('='.repeat(60))

  if (!fs.existsSync(targetDir)) {
    console.log('Target directory does not exist:', targetDir)
    return
  }

  const startTime = Date.now()
  const removedCount = cleanEmptyFolders(targetDir)
  const endTime = Date.now()

  console.log('='.repeat(60))
  console.log('Cleanup completed!')
  console.log('Empty folders removed:', removedCount)
  console.log('Time taken:', endTime - startTime + 'ms')

  if (removedCount === 0) {
    console.log('No empty folders found.')
  }
}

// Run the script if called directly
if (require.main === module) {
  main()
}

module.exports = { cleanEmptyFolders, main }
