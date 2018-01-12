/*eslint-disable no-console */

// const fs = require('then-fs')
const http = require('http')

const jsdom = require('jsdom')
const { JSDOM } = jsdom


const hostname = '127.0.0.1'
const port = 3000
const local_url = `http://${hostname}:${port}`

// const file_paths = {
//   '/apply_validation-bundle.js': './apply_validation-bundle.js',
// }

const server = http.createServer(async (req, res) => {
  console.log('server request: ', req.url)
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/javascript')
  res.end('console.log("script loaded")')
})
const server_timeout = 100
server.setTimeout(server_timeout)

;(async function() {
  // start server listening
  try {
    await new Promise((resolve, reject) => {
      server.listen(
        port,
        hostname,
        undefined,
        () => {
          console.log('server listening')
          resolve()
        }
      )

      setTimeout(reject, server_timeout)
    })
  } catch(err) {throw err}

  const dom = new JSDOM(`
      <!DOCTYPE html>
      <p>Hello world</p>
      <script src="/hi"></script>
      <script>console.log('do some shit')</script>
      <script>window.run_when_testing()</script>
    `,
    {
      url: local_url,
      runScripts: 'dangerously',
      resources: 'usable',
      // virtualConsole,
    }
  )

  const { window } = dom

  try {
    await new Promise((resolve, reject) => {
      window.run_when_testing = () => {
        console.log('window loaded')
        resolve()
      }

      setTimeout(reject, server_timeout)
    })
  } catch(err) {throw err}

  console.log('async function complete')
  server.close(() => {console.log('server closed')})
})()


