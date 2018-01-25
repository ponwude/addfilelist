const events = [
  'unhandledRejection',
  'uncaughtException',
]

let unhandled_error = undefined
function handler(err) {
  unhandled_error = err
  console.log(err)
}
events.forEach( e => process.on(e, handler) )

afterEach(() => {
  if (unhandled_error !== undefined) {
    const err = unhandled_error
    unhandled_error = undefined
    throw err
  }
})

module.exports = undefined
