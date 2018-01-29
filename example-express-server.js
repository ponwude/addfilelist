/*eslint-disable no-console */
/*global process */

const port = '3000'


const http = require('http')
const path = require('path')

const express = require('express')
const logger = require('morgan')

const form_get_routes = require('./form_get_routes.js')
const post_to_database = require('./post_to_database.js')

const debug = require('debug')('example-server:server')

const knex = require('knex')({
  client: 'sqlite3',
  connection: {filename: './example-express-server.db'},
  useNullAsDefault: true,
})

const unhandled_events = [
  'unhandledRejection',
  'uncaughtException',
]
function handler(err) {
  throw err
}
unhandled_events.forEach( e => process.on(e, handler) )


;(async () => {

  const app = express()

  app.use(logger('dev'))

  app.use(await form_get_routes(
    path.resolve('./test/form_test_templates/form_template_good.mustache'),
    path.resolve('./test/form_schemas/form_test_schema.js')
  ))
  console.log('form_get_routes complete')

  app.use(await post_to_database(knex, './test/form_schemas/form_test_schema.js'))
  console.log('post_to_database complete')

  app.set('port', port)


  const server = http.createServer(app)

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
