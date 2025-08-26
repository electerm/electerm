/**
 * Common utilities for config initValues
 */
import { newBookmarkIdPrefix } from '../../../common/constants.js'
import { getColorFromCategory } from '../../../common/get-category-color.js'
import findBookmarkGroupId from '../../../common/find-bookmark-group-id.js'
import deepCopy from 'json-deep-copy'

/**
 * Creates base init values that are common across all session types
 * @param {Object} props - Props containing formData, bookmarkGroups, currentBookmarkGroupId, store
 * @param {string} sessionType - The session type constant
 * @param {Object} defaults - Session-specific default values
 * @returns {Object} Combined init values
 */
export function createBaseInitValues (props, sessionType, defaults = {}) {
  const { formData = {}, bookmarkGroups = [], currentBookmarkGroupId } = props
  const id = formData.id || ''

  // Determine bookmark group ID
  const initBookmarkGroupId = !id.startsWith(newBookmarkIdPrefix)
    ? findBookmarkGroupId(bookmarkGroups, id)
    : currentBookmarkGroupId

  // Start with defaults and formData
  const base = {
    ...defaults,
    ...deepCopy(formData),
    type: sessionType,
    category: initBookmarkGroupId
  }

  // Only set default color if no color exists (for new bookmarks)
  if (!base.color) {
    base.color = getColorFromCategory(bookmarkGroups, base.category)
  }

  return base
}

/**
 * Common terminal-related defaults
 */
export function getTerminalDefaults (store) {
  return {
    term: store?.config?.terminalType,
    displayRaw: false,
    encode: 'utf-8'
  }
}

/**
 * Common SSH-related defaults
 */
export function getSshDefaults () {
  return {
    enableSsh: true,
    runScripts: [{
      delay: 500,
      script: ''
    }]
  }
}

/**
 * Common terminal background defaults
 */
export function getTerminalBackgroundDefaults (defaultSetting) {
  return {
    terminalBackground: {
      terminalBackgroundImagePath: defaultSetting.terminalBackgroundImagePath,
      terminalBackgroundFilterOpacity: defaultSetting.terminalBackgroundFilterOpacity,
      terminalBackgroundFilterBlur: defaultSetting.terminalBackgroundFilterBlur,
      terminalBackgroundFilterBrightness: defaultSetting.terminalBackgroundFilterBrightness,
      terminalBackgroundFilterGrayscale: defaultSetting.terminalBackgroundFilterGrayscale,
      terminalBackgroundFilterContrast: defaultSetting.terminalBackgroundFilterContrast,
      terminalBackgroundText: defaultSetting.terminalBackgroundText,
      terminalBackgroundTextSize: defaultSetting.terminalBackgroundTextSize,
      terminalBackgroundTextColor: defaultSetting.terminalBackgroundTextColor,
      terminalBackgroundTextFontFamily: defaultSetting.terminalBackgroundTextFontFamily
    }
  }
}
