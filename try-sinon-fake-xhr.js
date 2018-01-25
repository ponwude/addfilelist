const { default: mock } = require('xhr-mock')
// XMLHttpRequest

const jsdom = require('jsdom')
const { JSDOM } = jsdom

const dom = new JSDOM('<!DOCTYPE html><body></body>', {
  runScripts: 'dangerously',
})
const { window } = dom
const { document } = window

mock.setup()
window.XMLHttpRequest = XMLHttpRequest
window.eval('XMLHttpRequest = window.XMLHttpRequest')

mock.post(/.*/g, (req, res) => {
  console.log('post request caught')
  return res.send('hi back')
})

window.eval(`
const xhr = new XMLHttpRequest()
xhr.open('post', '/hi')
xhr.send('hi there')
`)

console.log('end file')
