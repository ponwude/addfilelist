/*
Used to monitor if an event is or is not dispatched upon some trigger function


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
  causal_event - String that specifies the event that will be dispatched on element
  timeout_ms - Wait time before checking if event has happned.
               Defaults to 10 mili-seconds.


Example of awaiting an event to happen upon a cause:
  await while_monitoring(input)
    .expect('change')
    .upon(() => {input.dispatchEvent(new Event('change'))})

Example of an event not happening upon a cause
*/

const { ImprovePromiseErrors } = require('./support_test_functions.js')


function while_monitoring(element) {
  const init_error = new ImprovePromiseErrors(new Error(), [
    'timers.js',
    ['at', 'module.exports', 'while_monitoring.js'],
    ['at', 'mocha'],
  ])

  const default_wait = 100 // mili-seconds

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
            reject(new Error(`Before upon trigger the following events were heard: ${events_heard.join(', ')}`))

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
            reject(new Error(`Before upon trigger the following events were heard: ${events_heard.join(', ')}`))

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


module.exports = while_monitoring
