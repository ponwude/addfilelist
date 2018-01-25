/*eslint-disable no-console, no-unused-vars */

const MockXMLHttpRequest = require('mock-xmlhttprequest')
// XMLHttpRequest

const jsdom = require('jsdom')
const { JSDOM } = jsdom
const dom = new JSDOM('<!DOCTYPE html><body></body>', {
  runScripts: 'dangerously',
})
const { window } = dom
const { document, Event } = window

window.XMLHttpRequest = MockXMLHttpRequest
window.eval('XMLHttpRequest = window.XMLHttpRequest')

window.eval(`
  document.addEventListener('submit', function() {
    const xhr = new XMLHttpRequest()
    xhr.open('post', '/hi')
    xhr.send(new FormData())
    console.log('xhr sent')
  })
`)

;(async function() {

  const xhr = await new Promise((resolve, reject) => {
    MockXMLHttpRequest.onSend = resolve
    console.log('onSend set')

    document.dispatchEvent(new Event('submit'))
    console.log('dispatchEvent')

    setTimeout(() => reject(new Error('timed out')), 30)
  })

  console.log('xhr resolved')
})()
