/*eslint-disable no-console */
/*global process */

const http = require('http')
const path = require('path')
const express = require('express')

const create_form_routes = require('./create_form_routes.js')

const debug = require('debug')('example-server:server')


const template =
`<body>{{form_html}}</body>
<script>var form_type = {{form_type}}</script>
`

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason)
  // application specific logging, throwing an error, or other logic here
})

;(async () => {
  const onError = function(error) {
    if (error.syscall !== 'listen') {
      throw error
    }

    const bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges')
        process.exit(1)
        break
      case 'EADDRINUSE':
        console.error(bind + ' is already in use')
        process.exit(1)
        break
      default:
        throw error
    }
  }

  const port = '3000'
  const app = express()
  app.use((req, res, next) => {
    console.log('hi', Date.now())
    next()
  })
  app.use(await create_form_routes(template, path.resolve('./test/form_schema_example.js')))
  app.set('port', port)

  const server = http.createServer(app)
  server.on('error', onError)
  server.on('listening', function() {
    const addr = server.address()
    const bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port
    debug('Listening on ' + bind)
  })

  server.listen(port)
  console.log(`server listening on port: ${port}`)

})()
