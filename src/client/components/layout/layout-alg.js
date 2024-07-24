import {
  splitMap
} from '../../common/constants'

const layoutSingle = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    }
  ],
  handleStyles: []
})

const layoutTwoColumns = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      bottom: 0,
      right: (w / 2 - 2) + 'px'
    },
    {
      left: (w / 2 + 2) + 'px',
      top: 0,
      bottom: 0,
      right: 0
    }
  ],
  handleStyles: [
    {
      left: (w / 2 - 2) + 'px',
      top: 0,
      bottom: 0
    }
  ]
})

const layoutThreeColumns = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      bottom: 0,
      right: (2 * w / 3 - 2) + 'px'
    },
    {
      left: (w / 3 + 2) + 'px',
      top: 0,
      bottom: 0,
      right: (w / 3 - 2) + 'px'
    },
    {
      left: (2 * w / 3 + 2) + 'px',
      top: 0,
      bottom: 0,
      right: 0
    }
  ],
  handleStyles: [
    {
      left: (w / 3 - 2) + 'px',
      top: 0,
      bottom: 0
    },
    {
      left: (2 * w / 3 - 2) + 'px',
      top: 0,
      bottom: 0
    }
  ]
})

const layoutTwoRows = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      right: 0,
      bottom: (h / 2 - 2) + 'px'
    },
    {
      left: 0,
      top: (h / 2 + 2) + 'px',
      right: 0,
      bottom: 0
    }
  ],
  handleStyles: [
    {
      top: (h / 2 - 2) + 'px',
      left: 0,
      right: 0
    }
  ]
})

const layoutThreeRows = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      right: 0,
      bottom: (2 * h / 3 - 2) + 'px'
    },
    {
      left: 0,
      top: (h / 3 + 2) + 'px',
      right: 0,
      bottom: (h / 3 - 2) + 'px'
    },
    {
      left: 0,
      top: (2 * h / 3 + 2) + 'px',
      right: 0,
      bottom: 0
    }
  ],
  handleStyles: [
    {
      top: (h / 3 - 2) + 'px',
      left: 0,
      right: 0
    },
    {
      top: (2 * h / 3 - 2) + 'px',
      left: 0,
      right: 0
    }
  ]
})

const layoutGrid2x2 = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      right: (w / 2 - 2) + 'px',
      bottom: (h / 2 - 2) + 'px'
    },
    {
      left: (w / 2 + 2) + 'px',
      top: 0,
      right: 0,
      bottom: (h / 2 - 2) + 'px'
    },
    {
      left: 0,
      top: (h / 2 + 2) + 'px',
      right: (w / 2 - 2) + 'px',
      bottom: 0
    },
    {
      left: (w / 2 + 2) + 'px',
      top: (h / 2 + 2) + 'px',
      right: 0,
      bottom: 0
    }
  ],
  handleStyles: [
    {
      left: (w / 2 - 2) + 'px',
      top: 0,
      bottom: 0
    },
    {
      top: (h / 2 - 2) + 'px',
      left: 0,
      right: 0
    }
  ]
})

const layoutTwoRowsRight = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      bottom: 0,
      right: (w / 2 - 2) + 'px'
    },
    {
      left: (w / 2 + 2) + 'px',
      top: 0,
      right: 0,
      bottom: (h / 2 - 2) + 'px'
    },
    {
      left: (w / 2 + 2) + 'px',
      top: (h / 2 + 2) + 'px',
      right: 0,
      bottom: 0
    }
  ],
  handleStyles: [
    {
      left: (w / 2 - 2) + 'px',
      top: 0,
      bottom: 0
    },
    {
      top: (h / 2 - 2) + 'px',
      left: (w / 2 + 2) + 'px',
      right: 0
    }
  ]
})

const layoutTwoColumnsBottom = (w, h) => ({
  wrapStyles: [
    {
      left: 0,
      top: 0,
      right: 0,
      bottom: (h / 2 - 2) + 'px'
    },
    {
      left: 0,
      top: (h / 2 + 2) + 'px',
      right: (w / 2 - 2) + 'px',
      bottom: 0
    },
    {
      left: (w / 2 + 2) + 'px',
      top: (h / 2 + 2) + 'px',
      right: 0,
      bottom: 0
    }
  ],
  handleStyles: [
    {
      top: (h / 2 - 2) + 'px',
      left: 0,
      right: 0
    },
    {
      left: (w / 2 - 2) + 'px',
      top: (h / 2 + 2) + 'px',
      bottom: 0
    }
  ]
})

const layoutFunctions = {
  [splitMap.c1]: layoutSingle,
  [splitMap.c2]: layoutTwoColumns,
  [splitMap.c3]: layoutThreeColumns,
  [splitMap.r2]: layoutTwoRows,
  [splitMap.r3]: layoutThreeRows,
  [splitMap.c2x2]: layoutGrid2x2,
  [splitMap.c1x2r]: layoutTwoRowsRight,
  [splitMap.c1x2c]: layoutTwoColumnsBottom
}

export default function layoutAlg (layout, w, h) {
  const layoutFunction = layoutFunctions[layout] || layoutSingle
  return layoutFunction(w, h)
}
