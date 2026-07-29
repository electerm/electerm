/**
 * code compare utilities
 * - binary file detection (by extension + content)
 * - line splitting and size limits
 * - file extension to Prism language mapping for syntax highlighting
 */

import { getFileExt } from './file-read'
import { maxEditFileSize } from '../../common/constants'

// extensions that are definitely binary and should never be compared as text
const binaryExtMap = {
  png: 1,
  jpg: 1,
  jpeg: 1,
  gif: 1,
  bmp: 1,
  ico: 1,
  webp: 1,
  tiff: 1,
  tif: 1,
  heic: 1,
  heif: 1,
  avif: 1,
  raw: 1,
  cr2: 1,
  nef: 1,
  arw: 1,
  psd: 1,
  ai: 1,
  eps: 1,
  zip: 1,
  tar: 1,
  gz: 1,
  tgz: 1,
  bz2: 1,
  xz: 1,
  lz: 1,
  lzma: 1,
  '7z': 1,
  rar: 1,
  jar: 1,
  war: 1,
  ear: 1,
  apk: 1,
  aab: 1,
  xpi: 1,
  crx: 1,
  exe: 1,
  dll: 1,
  so: 1,
  dylib: 1,
  bin: 1,
  class: 1,
  o: 1,
  obj: 1,
  a: 1,
  lib: 1,
  pyc: 1,
  pyo: 1,
  node: 1,
  wasm: 1,
  swf: 1,
  pdf: 1,
  doc: 1,
  docx: 1,
  xls: 1,
  xlsx: 1,
  ppt: 1,
  pptx: 1,
  odt: 1,
  ods: 1,
  odp: 1,
  mp3: 1,
  mp4: 1,
  avi: 1,
  mov: 1,
  wmv: 1,
  flv: 1,
  ogg: 1,
  wav: 1,
  aac: 1,
  m4a: 1,
  m4v: 1,
  webm: 1,
  mkv: 1,
  mpg: 1,
  mpeg: 1,
  '3gp': 1,
  opus: 1,
  db: 1,
  sqlite: 1,
  sqlite3: 1,
  mdb: 1,
  accdb: 1,
  iso: 1,
  img: 1,
  dmg: 1,
  vmdk: 1,
  qcow2: 1,
  vdi: 1,
  wim: 1,
  ttf: 1,
  otf: 1,
  woff: 1,
  woff2: 1,
  eot: 1,
  pak: 1,
  dat: 1,
  bson: 1,
  msg: 1,
  eml: 1,
  pdb: 1,
  ax: 1,
  nib: 1,
  mo: 1
}

// map file extensions to Prism / refractor language names
// only includes languages that react-diff-viewer-continued can highlight
const extToLangMap = {
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  styl: 'stylus',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  dockerfile: 'docker',
  vue: 'markup',
  svelte: 'markup',
  lua: 'lua',
  r: 'r',
  rkt: 'racket',
  clj: 'clojure',
  cljs: 'clojure',
  edn: 'clojure',
  scala: 'scala',
  pl: 'perl',
  pm: 'perl',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  nim: 'nim',
  zig: 'zig',
  v: 'verilog',
  vim: 'vim',
  ini: 'properties',
  conf: 'properties',
  cfg: 'properties',
  properties: 'properties'
}

// upper bound of lines to diff, keeps memory usage reasonable
// react-diff-viewer-continued uses jsdiff's Myers algorithm, which is far more
// memory-efficient than the previous hand-written LCS DP table, so we can
// safely support larger files.
export const maxDiffLines = 10000

export function getExt (name = '') {
  return (getFileExt(name).ext || '').toLowerCase()
}

export function isBinaryExt (name = '') {
  return binaryExtMap[getExt(name)] === 1
}

/**
 * Whether the two files can be compared as text/code at all.
 * Only non-directory, non-binary-ext, not-too-large files qualify.
 */
export function canCodeCompare (file1 = {}, file2 = {}) {
  if (!file1 || !file2) {
    return false
  }
  if (file1.isDirectory || file2.isDirectory) {
    return false
  }
  if (isBinaryExt(file1.name) || isBinaryExt(file2.name)) {
    return false
  }
  if ((file1.size || 0) > maxEditFileSize || (file2.size || 0) > maxEditFileSize) {
    return false
  }
  return true
}

/**
 * Check whether already-decoded text content looks binary (contains null bytes).
 * utf8-decoded binary data usually contains \u0000.
 */
export function looksBinary (text = '') {
  return text.includes('\u0000')
}

export function splitLines (text = '') {
  if (text === '') {
    return []
  }
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

/**
 * Map a filename to a Prism/refractor language name
 * for syntax highlighting in the diff viewer.
 * Returns undefined if no mapping is found.
 */
export function getHighlightLanguage (name = '') {
  const ext = getExt(name)
  if (!ext) {
    // check for special filenames
    const base = (name || '').toLowerCase()
    if (base === 'dockerfile') {
      return 'docker'
    }
    if (base === 'makefile' || base === 'gnumakefile') {
      return 'makefile'
    }
    return undefined
  }
  return extToLangMap[ext]
}
