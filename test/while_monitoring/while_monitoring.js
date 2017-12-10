/*
Used to monitor if an event is or is not dispatched upon some trigger function


Require module:
const while_monitoring = require('./while_monitoring.js')


APIs:
  await while_monitoring(element).expect(events).upon(cause [, timeout_ms])
    Monitors element for the events to be dispatched when cause is called after
    timeout_ms mili-seconds.
    The promise rejects if events is not seen.

  await while_monitoring(element).do_not_expect(events).upon(cause [, timeout_ms])
    Monitors element for the events not to be dispatched when cause is called
    after timeout_ms mili-seconds.
    The promise rejects if events is seen.

  await while_monitoring(element).expect(events).upon_event(causal_event [, timeout_ms])
    Monitors element for the events to be dispatched when causal_event is
    dispatched on element after for timeout_ms mili-seconds.
    The promise rejects if events is not seen.

  await while_monitoring(element).do_not_expect(events).upon_event(causal_event [, timeout_ms])
    Monitors element for the events not to be dispatched when causal_event is called
    after timeout_ms mili-seconds.
    The promise rejects if events is seen.


Chained Inputs:
  element - HTML element to monitor.
  events - Event type or types to listen for. Example 'click' or ['click', 'change']
  cause - A function that should cause the event to dispatched on element.
  timeout_ms - Wait time before checking if event has happned.
               Defaults to 10 mili-seconds.


Example of awaiting an event to happen upon a cause:
  await while_monitoring(input)
    .expect('change')
    .upon(() => {input.dispatchEvent(new Event('change'))})

Example of an event not happening upon a cause
*/

const add_method = require('../../add_method.js')


function while_monitoring(element) {
  const init_error = new WhileMonitoringError(new Error())

  const default_wait = 10 // mili-seconds

  return {
    expect(events) {
      if (!Array.isArray(events)) events = [events]

      const events_heard = []
      const listener = e => {
        if (!events_heard.includes(e.type))
          events_heard.push(e.type)
      }
      events.forEach(e => {element.addEventListener(e, listener)})

      const upon = (cause=()=>{}, timeout_ms=default_wait) => {
        return new Promise((resolve, reject) => {
          if (events_heard.length > 0)
            reject(new Error(`Event (${events}) was heard before cause called.`))

          ;(cause instanceof Promise ? cause : Promise.resolve().then(cause))
            .then(() => {
              setTimeout(function() {
                events.forEach(e => {element.removeEventListener(e, listener)}) // no test for this

                if (events_heard.length === events.length) resolve(events_heard)
                else {
                  const unheard_events = events.filter(e => !events_heard.includes(e))
                  reject(init_error.replaceStack(
                    new Error(`Event (${unheard_events.join(', ')}) was not heard after cause.`)
                  ))
                }
              }, timeout_ms)
            })
            .catch(reject)
        })
      }

      return {
        upon,
        upon_event(causal_event, timeout_ms=default_wait) {
          if (typeof causal_event !== 'string')
            throw new TypeError('causal_event needs to be a String.')

          return upon(
            () => {element.dispatchEvent(new Event(causal_event))},
            timeout_ms
          )
        },
      }

    },

    do_not_expect(events) {
      if (!Array.isArray(events)) events = [events]

      const events_heard = []
      const listener = e => {events_heard.push(e.type)}
      events.forEach(e => {element.addEventListener(e, listener)})

      const upon = (cause=()=>{}, timeout_ms=default_wait) => {
        return new Promise((resolve, reject) => {
          if (events_heard.length > 0)
            reject(new Error(`Event (${events}) was heard before cause called.`))

          cause = cause instanceof Promise ? cause : cause()
          if (cause instanceof Promise)
            cause.then(resolve).catch(reject)

          ;(cause instanceof Promise ? cause : Promise.resolve().then(cause))
            .then(() => {
              setTimeout(function() {
                events.forEach(e => {element.removeEventListener(e, listener)}) // no test for this

                if (events_heard.length > 0) {
                  reject(init_error.replaceStack(
                    new Error(`${events_heard.join(', ')} was heard after cause.`)
                  ))
                }
                else resolve()
              }, timeout_ms)
            })
            .catch(reject)
        })
      }

      return {
        upon,
        upon_event(causal_event, timeout_ms=default_wait) {
          if (typeof causal_event !== 'string')
            throw new TypeError('causal_event needs to be a String.')

          return upon(
            () => {element.dispatchEvent(new Event(causal_event))},
            timeout_ms
          )
        },
      }

    },
  }
}


function WhileMonitoringError(init_error) {
  Object.getOwnPropertyNames(init_error).forEach(prop => {
    this[prop] = init_error[prop]
  })
}

WhileMonitoringError.prototype = new Error

add_method('replaceStack', WhileMonitoringError, function(another_error) {
  const to_return = new WhileMonitoringError(another_error)

  to_return.stack = this.stack
    .replace(/Error.*\n/g, 'Error: ' + another_error.message + '\n')
    .removeLinesWith('timers.js')
    .removeLinesWith(['at', 'module.exports', 'while_monitoring.js'])
    .removeLinesWith(['at', 'mocha'])

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


module.exports = while_monitoring
