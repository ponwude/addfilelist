const while_monitoring = require('./while_monitoring/while_monitoring.js')


module.exports = {
  /* Sets the value of a DOM element with event dispatches. */
  set_val(
    input, // expected to be an input element
    val, // value to set the input attribute value to
    dispatch=['blur', 'change'], // dispatch events after event is set. String, Array of Strings, empty Array
    resolve_events=['valid', 'invalid'] // wait for events to be dispatched before promise is resolved. String, Array of Strings, empty Array
  ) {
    if (!Array.isArray(dispatch)) dispatch = [dispatch]
    if (!Array.isArray(resolve_events)) resolve_events = [resolve_events]

    return new Promise(resolve => {
      input.value = val
      dispatch.forEach(e => {input.dispatchEvent(new Event(e))})

      if (resolve_events.length > 0) {
        resolve_events.forEach(e => {
          const listener = () => {
            input.removeEventListener(e, listener)
            resolve(e)
          }
          input.addEventListener(e, listener)
        })
      } else resolve()
    })
  },
}

