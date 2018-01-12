const add_method = require('../add_method.js')


function ImprovePromiseErrors(init_error, remove_with=[]) {
  Object.getOwnPropertyNames(init_error).forEach(prop => {
    this[prop] = init_error[prop]
  })
  this.remove_with = remove_with
}

ImprovePromiseErrors.prototype = new Error

add_method('replaceStack', ImprovePromiseErrors, function(another_error) {
  const to_return = new ImprovePromiseErrors(another_error)

  to_return.stack = this.remove_with.reduce(
    (stack, to_remove) => stack.removeLinesWith(to_remove),
    this.stack.replace(/Error.*\n/g, 'Error: ' + another_error.message + '\n')
  )

  return to_return
})

add_method('removeLinesWith', String, function(substring) {
  return this
    .split('\n')
    .filter(Array.isArray(substring) ?
      line => !substring.every(ss => line.includes(ss)) :
      line => !line.includes(substring)
    )
    .join('\n')
})


module.exports = {
  ImprovePromiseErrors,

  /* Sets the value of a DOM element with event dispatches. */
  set_val(
    input, // expected to be an input element
    val, // value to set the input attribute value to
    dispatch=['blur', 'change'], // dispatch events after event is set. String, Array of Strings, empty Array
    resolve_events=['valid', 'invalid'], // wait for events to be dispatched before promise is resolved. String, Array of Strings, empty Array
    timeout=100
  ) {
    if (!Array.isArray(dispatch)) dispatch = [dispatch]
    if (!Array.isArray(resolve_events)) resolve_events = [resolve_events]

    const init_error = new ImprovePromiseErrors(new Error())

    return new Promise((resolve, reject) => {
      input.value = val

      if (resolve_events.length > 0) {
        const els = resolve_events.reduce((els, event) => {
          const listener = () => {
            els.forEach(el => input.removeEventListener(...el) )
            resolve(event)
          }
          input.addEventListener(event, listener)
          els.push([event, listener])
          return els
        }, [])

        setTimeout(() => {
          els.forEach(el => input.removeEventListener(...el) )
          reject(init_error.replaceStack(
            new Error(`Did not hear any of the resolve_events: ${resolve_events.join(', ')}.`)
          ))
        }, timeout)

        dispatch.forEach(e => input.dispatchEvent(new Event(e)) )
      } else {
        dispatch.forEach(e => input.dispatchEvent(new Event(e)) )
        resolve()
      }

    })
  },
}

