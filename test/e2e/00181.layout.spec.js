const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { describe } = it
it.setTimeout(100000)

describe('layouts', function () {
  it('should create new tabs properly in different layouts', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)
    const splitMapDesc = {
      c1: 'single',
      c2: 'twoColumns',
      c3: 'threeColumns',
      r2: 'twoRows',
      r3: 'threeRows',
      c2x2: 'grid2x2',
      c1r2: 'twoRowsRight',
      r1c2: 'twoColumnsBottom'
    }

    const splitConfig = {
      c1: {
        children: 1,
        handle: 0
      },
      c2: {
        children: 2,
        handle: 1
      },
      c3: {
        children: 3,
        handle: 2
      },
      r2: {
        children: 2,
        handle: 1
      },
      r3: {
        children: 3,
        handle: 2
      },
      c2x2: {
        children: 4,
        handle: 3
      },
      c1r2: {
        children: 3,
        handle: 2
      },
      r1c2: {
        children: 3,
        handle: 2
      }
    }

    // Test helper function
    async function testLayout (layoutType, expectedTabCount) {
      const desc = splitMapDesc[layoutType]
      log(`Testing ${desc} layout`)
      await client.evaluate((layoutType) => {
        window.store.setLayout(layoutType)
      }, layoutType)
      await delay(1000)
      const layoutAfterCount = await client.evaluate(() => {
        return document.querySelectorAll('.layout-item').length
      })
      expect(layoutAfterCount).equal(expectedTabCount)
    }

    // Test each layout type
    const layouts = Object.keys(splitMapDesc).reverse()
    for (const layout of layouts) {
      await testLayout(layout, splitConfig[layout].children)
    }
    let dd = await client.countElem('.ant-dropdown')
    expect(dd).equal(0)
    await client.hover('.tabs .layout-dd-icon')
    dd = await client.countElem('.ant-dropdown')
    expect(dd).equal(1)

    await electronApp.close().catch(console.log)
  })
})
