/**
 * code compare component
 * reads both file contents and renders a side-by-side diff
 * using react-diff-viewer-continued (word-level diff + syntax highlight)
 */

import { useState, useEffect, useMemo } from 'react'
import { Spin } from 'antd'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import resolve from '../../common/resolve'
import { refs } from '../common/ref'
import { typeMap } from '../../common/constants'
import isColorDark from '../../common/is-color-dark'
import {
  looksBinary,
  isBinaryExt,
  splitLines,
  maxDiffLines,
  getHighlightLanguage
} from './code-compare-utils'
import './code-compare.styl'

const e = window.translate

export default function CodeCompare (props) {
  const { file1, file2, tab = {} } = props
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text1, setText1] = useState('')
  const [text2, setText2] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load () {
      setLoading(true)
      setError('')
      setText1('')
      setText2('')
      // check binary by extension before reading
      if (isBinaryExt(file1 && file1.name) || isBinaryExt(file2 && file2.name)) {
        setError('binary file - not supported for code compare')
        setLoading(false)
        return
      }
      try {
        const [t1, t2] = await Promise.all([
          readFileContent(file1, tab),
          readFileContent(file2, tab)
        ])
        if (cancelled) {
          return
        }
        if (looksBinary(t1) || looksBinary(t2)) {
          setError(e('binary file') + ' - ' + e('not supported for code compare'))
          setLoading(false)
          return
        }
        const a = splitLines(t1)
        const b = splitLines(t2)
        if (a.length > maxDiffLines || b.length > maxDiffLines) {
          setError(e('file too large for code compare') + ' (max ' + maxDiffLines + ' ' + e('lines') + ')')
          setLoading(false)
          return
        }
        setText1(t1)
        setText2(t2)
      } catch (err) {
        if (!cancelled) {
          setError(err && err.message ? err.message : String(err))
        }
      }
      if (!cancelled) {
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [file1, file2, tab])

  const { useDarkTheme, styles } = useMemo(() => {
    const themeConf = window.store?.getUiThemeConfig?.() || {}
    const dark = isColorDark(themeConf.main || '#121214')
    const vars = {
      diffViewerBackground: themeConf['main-light'] || (dark ? '#1e1e1e' : '#fff'),
      diffViewerColor: themeConf.text || (dark ? '#ddd' : '#333'),
      gutterBackground: themeConf['main-dark'] || (dark ? '#2a2a2a' : '#f5f5f5'),
      gutterColor: themeConf['text-dark'] || (dark ? '#888' : '#999'),
      addedBackground: themeConf.success || '#06D6A0',
      addedColor: dark ? '#06D6A0' : '#058f6b',
      removedBackground: themeConf.error || '#EF476F',
      removedColor: dark ? '#EF476F' : '#c93659',
      wordAddedBackground: 'rgba(6, 214, 160, 0.25)',
      wordRemovedBackground: 'rgba(239, 71, 111, 0.25)',
      addedGutterBackground: 'rgba(6, 214, 160, 0.15)',
      removedGutterBackground: 'rgba(239, 71, 111, 0.15)',
      codeFoldBackground: themeConf['main-dark'] || (dark ? '#252525' : '#f0f0f0'),
      codeFoldContentColor: themeConf['text-dark'] || (dark ? '#666' : '#bbb'),
      emptyLineBackground: themeConf['main-dark'] || (dark ? '#1a1a1a' : '#fafafa'),
      diffViewerTitleBackground: themeConf['main-dark'] || (dark ? '#2a2a2a' : '#f0f0f0'),
      diffViewerTitleColor: themeConf.text || (dark ? '#ddd' : '#333'),
      diffViewerTitleBorderColor: themeConf.primary || '#08c'
    }
    return {
      useDarkTheme: dark,
      styles: {
        variables: {
          light: vars,
          dark: vars
        },
        diffContainer: {
          fontFamily: "'Maple Mono', 'Menlo', 'Consolas', monospace",
          fontSize: '13px',
          lineHeight: '1.5'
        }
      }
    }
  }, [])

  const highlightLanguage = useMemo(() => {
    const lang1 = getHighlightLanguage(file1?.name)
    const lang2 = getHighlightLanguage(file2?.name)
    return lang1 === lang2 ? lang1 : undefined
  }, [file1, file2])

  const name1 = file1 ? file1.name : ''
  const name2 = file2 ? file2.name : ''
  const identical = text1 === text2 && !loading && !error

  let body = null
  if (error) {
    body = <div className='code-compare-message'>{error}</div>
  } else if (identical) {
    body = <div className='code-compare-message'>{e('files are identical')}</div>
  } else {
    body = (
      <div className='code-compare-body'>
        <ReactDiffViewer
          oldValue={text1}
          newValue={text2}
          splitView
          compareMethod={DiffMethod.WORDS}
          useDarkTheme={useDarkTheme}
          styles={styles}
          leftTitle={name1}
          rightTitle={name2}
          hideLineNumbers={false}
          showDiffOnly
          extraLinesSurroundingDiff={3}
          hideSummary
          codeFoldMessageRenderer={() => <span />}
          disableWorker
          highlightLanguage={highlightLanguage}
        />
      </div>
    )
  }

  return (
    <div className='code-compare-wrap'>
      <Spin spinning={loading}>
        {body}
      </Spin>
    </div>
  )
}

async function readFileContent (file, tab) {
  if (!file) {
    return ''
  }
  const p = resolve(file.path, file.name)
  if (file.type === typeMap.remote) {
    const sftpEntry = refs.get('sftp-' + tab.id)
    const sftp = sftpEntry && sftpEntry.sftp
    if (!sftp) {
      throw new Error(e('sftp not ready'))
    }
    return sftp.readFile(p)
  }
  return window.fs.readFile(p)
}
