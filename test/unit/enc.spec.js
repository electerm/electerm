const { enc, dec } = require('../../src/app/common/pass-enc')
const { expect } = require('../common/expect')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)

describe('enc/dec funcs', function () {
  it('dec/dec', async function () {
    const rr = 'AZaz/.,;sd7s87dfds#2342834_+=-!@$%^&*()'
    const r = enc(rr)
    console.log(r)
    const r2 = dec(r)
    console.log(r2)
    expect(r2).equal(rr)
  })
})
