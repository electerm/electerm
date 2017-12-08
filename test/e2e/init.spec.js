// const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
// const {expect} = require('chai')
const cwd = process.cwd()

// const delay = time => new Promise(resolve => setTimeout(resolve, time))

// describe('main window', function () {
//   this.timeout(100000)

//   beforeEach(async function() {
//     this.app = new Application({
//       path: resolve(cwd, 'node_modules/.bin/electron'),
//       args: [resolve(cwd, 'app')]
//     })
//     console.log(this.app)
//     return this.app.start()
//   })

//   afterEach(function() {
//     if (this.app && this.app.isRunning()) {
//       return this.app.stop()
//     }
//   })

//   //const findWrapper = () => this.app.client.element('#outside-context')

//   //const findTabs = () => this.app.client.elements('.tabs')

//   it('should open window', async function() {
//     const { client, browserWindow } = this.app

//     await client.waitUntilWindowLoaded()
//     await delay(500)
//     const title = await browserWindow.getTitle()
//     expect(title).toBe('Hello Electron React!')
//   })

//   it('should haven\'t any logs in console of main window', async function() {
//     const { client } = this.app
//     const logs = await client.getRenderProcessLogs()
//     // Print renderer process logs
//     logs.forEach(log => {
//       console.log(log.message)
//       console.log(log.source)
//       console.log(log.level)
//     })
//     expect(logs).to.have.lengthOf(3)
//   })

//   // it('should to Counter with click "to Counter" link', async () => {
//   //   const { client } = this.app;

//   //   await client.click('[data-tid=container] > a');
//   //   expect(await findCounter().getText()).toBe('0');
//   // });

//   // it('should display updated count after increment button click', async () => {
//   //   const { client } = this.app;

//   //   const buttons = await findButtons();
//   //   await client.elementIdClick(buttons[0]);  // +
//   //   expect(await findCounter().getText()).toBe('1');
//   // });

//   // it('should display updated count after descrement button click', async () => {
//   //   const { client } = this.app;

//   //   const buttons = await findButtons();
//   //   await client.elementIdClick(buttons[1]);  // -
//   //   expect(await findCounter().getText()).toBe('0');
//   // });

//   // it('shouldnt change if even and if odd button clicked', async () => {
//   //   const { client } = this.app;

//   //   const buttons = await findButtons();
//   //   await client.elementIdClick(buttons[2]);  // odd
//   //   expect(await findCounter().getText()).toBe('0');
//   // });

//   // it('should change if odd and if odd button clicked', async () => {
//   //   const { client } = this.app;

//   //   const buttons = await findButtons();
//   //   await client.elementIdClick(buttons[0]);  // +
//   //   await client.elementIdClick(buttons[2]);  // odd
//   //   expect(await findCounter().getText()).toBe('2');
//   // });

//   // it('should change if async button clicked and a second later', async () => {
//   //   const { client } = this.app;

//   //   const buttons = await findButtons();
//   //   await client.elementIdClick(buttons[3]);  // async
//   //   expect(await findCounter().getText()).toBe('2');
//   //   await delay(1500);
//   //   expect(await findCounter().getText()).toBe('3');
//   // });

//   // it('should back to home if back button clicked', async () => {
//   //   const { client } = this.app;
//   //   await client.element(
//   //     '[data-tid="backButton"] > a'
//   //   ).click();

//   //   expect(
//   //     await client.isExisting('[data-tid="container"]')
//   //   ).toBe(true);
//   // });
// })
var Application = require('spectron').Application
var assert = require('assert')
 
describe('application launch', function () {
  this.timeout(10000)
 
  beforeEach(function () {
    this.app = new Application({
      path: electronPath,
      args: [resolve(cwd, 'app')]
    })
    return this.app.start()
  })
 
  afterEach(function () {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })
 
  it('shows an initial window', function () {
    return this.app.client.getWindowCount().then(function (count) {
      assert.equal(count, 1)
    })
  })
})