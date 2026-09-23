/**
 * open the text editor, load/mount it on demand
 */

import { refsStatic } from '../common/ref'

let pending = null

/**
 * request to open the text editor with file data,
 * if the editor is not mounted yet, mount it first
 * and keep the data as pending, editor will consume
 * it on mount
 * @param {object} data { id, file }
 */
export function openTextEditor (data) {
  const editor = refsStatic.get('text-editor')
  if (editor) {
    editor.openEditor(data)
    return
  }
  pending = data
  window.store.textEditorRequested = true
}

export function takePendingTextEditorData () {
  const data = pending
  pending = null
  return data
}
