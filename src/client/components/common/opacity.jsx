import { useEffect } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta-hooks'
import eq from 'fast-deep-equal'

const opacityDomId = 'opacity-style'

/**
 * Opacity component
 * Handles conditional CSS rendering based on opacity setting
 * @param {Object} props
 * @param {number} props.opacity - Opacity value from store.config
 * @returns {null}
 */
export default function Opacity ({ opacity }) {
  // Default to 1 if opacity is not provided
  const currentOpacity = opacity !== undefined ? opacity : 1
  const delta = useDelta(currentOpacity)

  function applyOpacity () {
    let styleElement = document.getElementById(opacityDomId)

    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = opacityDomId
      document.head.appendChild(styleElement)
    }

    // Update style content based on opacity value
    if (currentOpacity === 1) {
      styleElement.innerHTML = ''
    } else {
      styleElement.innerHTML = `
        html {
          background: transparent !important;
        }
        body {
          background: transparent !important;
        }
        #outside-context {
          opacity: ${currentOpacity} !important;
        }
      `
    }
  }

  useEffect(() => {
    applyOpacity()

    // Cleanup function
    return () => {
      const styleElement = document.getElementById(opacityDomId)
      if (styleElement) {
        document.head.removeChild(styleElement)
      }
    }
  }, [])

  useConditionalEffect(() => {
    applyOpacity()
  }, delta && !eq(delta.prev, delta.curr))

  return null
}
