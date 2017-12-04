/*
Used to monitor if an event is or is not dispatched upon some trigger function


Require module:
const while_monitoring = require('./while_monitoring.js')


APIs:
  await while_monitoring(element).expect(event).upon(cause [, timeout_ms])
    Monitors element for the event to be dispatched when cause is called after
    timeout_ms mili-seconds.
    The promise rejects if event is not seen.

  await while_monitoring(element).do_not_expect(event).upon(cause [, timeout_ms])
    Monitors element for the event not to be dispatched when cause is called
    after timeout_ms mili-seconds.
    The promise rejects if event is seen.

  await while_monitoring(element).expect(event).upon_event(causal_event [, timeout_ms])
    Monitors element for the event to be dispatched when causal_event is
    dispatched on element after for timeout_ms mili-seconds.
    The promise rejects if event is not seen.

  await while_monitoring(element).do_not_expect(event).upon_event(causal_event [, timeout_ms])
    Monitors element for the event not to be dispatched when causal_event is called
    after timeout_ms mili-seconds.
    The promise rejects if event is seen.


Chained Inputs:
  element - HTML element to monitor.
  event - Event type to listen for. Example: 'click'.
  cause - A function that should cause the event to dispatched on element.
  timeout_ms - Wait time before checking if event has happned.
               Defaults to 10 mili-seconds.


Example of awaiting an event to happen upon a cause:
  await while_monitoring(input)
    .expect('change')
    .upon(() => {input.dispatchEvent(new Event('change'))})

Example of an event not happening upon a cause
*/


module.exports = function (element) {

  const default_wait = 10 // mili-seconds

  return {
    expect(event) {
      let event_emitted = false
      let event_heard = undefined
      const listener = e => {
        event_emitted = true
        event_heard = e
      }
      element.addEventListener(event, listener)

      const upon = (cause, timeout_ms=default_wait) => {
        return new Promise((resolve, reject) => {
          if (event_emitted) reject(new Error(`Event (${event}) was heard before cause called`))

          cause()

          setTimeout(function() {
            element.removeEventListener(event, listener) // no test for this

            if (event_emitted) resolve(event_heard)
            else reject(new Error(`Event (${event}) was not heard after cause.`))

          }, timeout_ms)
        })
      }

      return {upon,
        upon_event(causal_event, timeout_ms=default_wait) {
          return upon(
            () => {element.dispatchEvent(new Event(causal_event))},
            timeout_ms
          )
        }
      }

    },

    do_not_expect(events) {
      if (!Array.isArray(events)) events = [events]

      let event_emitted = false
      let events_heard = []
      const listener = e => {
        event_emitted = true
        events_heard.push(e.type)
      }
      events.forEach(e => {element.addEventListener(e, listener)})

      const upon = (cause, timeout_ms=default_wait) => {
        return new Promise((resolve, reject) => {
          if (event_emitted) reject(new Error(`Event (${events}) was heard before cause called.`))

          cause()

          setTimeout(function() {
            events.forEach(e => {element.removeEventListener(e, listener)}) // no test for this

            // console.log('event_emitted', event_emitted)
            // console.log('events_heard', events_heard)
            if (event_emitted) reject(new Error(`${events_heard.join(', ')} was heard after cause.`))
            else resolve()

          }, timeout_ms)
        })
      }

      return {upon,
        upon_event(causal_event, timeout_ms=default_wait) {
          return upon(
            () => {element.dispatchEvent(new Event(causal_event))},
            timeout_ms
          )
        }
      }

    },
  }
}