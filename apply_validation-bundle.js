(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
window.apply_validation = require('./apply_validation.js')

},{"./apply_validation.js":2}],2:[function(require,module,exports){
const Sequence = require('event_sequencing')


module.exports = function(form, schema) {
  /*
  Applies the validaton to the from from schema.

  form needs to contain the inputs with the name attributes that match schema names
  */
  schema
    .filter(spec => spec.validate !== undefined)
    .forEach(spec => {
      const input = form.querySelector(`input[name="${spec.name}"]`),
            input_container = input.parentNode,
            error_text = input_container.querySelector('.input-error-msg')

      const validate_promise = eval(spec.validate)

      const validate_listener = async () => {
        /*
        called when input should be checked
        displays errors after the input
        throws error if input error
        */
        try {
          await validate_promise.validate(input.value)
          input.classList.remove('input-error')
          input.dispatchEvent(new Event('valid'))
        } catch (err) {
          error_text.innerHTML = err.name === 'ValidationError' ?
            err.details[0].message.replace('"value" ', '') :
            'Unknown Error'  // https://github.com/hapijs/joi/blob/v13.0.1/API.md#errors

          input.classList.add('input-error')
          input.dispatchEvent(new Event('invalid'))
        }
      }

      Sequence(input)
        .once('blur', validate_listener)
        .repeat('change', validate_listener)
        .until.event('submit', form)
    })

  return form
}

},{"event_sequencing":3}],3:[function(require,module,exports){
'use strict'

module.exports = (function() {
  function constructor(default_target) {
    /*
    Constructs a new instance of sequence

    default_target (optional) - will be used if a target isn't passed to the chain methods
      if not defined the first target will be set as the default target

    A seperate function because typescript doesn't allow auto-instantiation.
    reference: http://raganwald.com/2014/07/09/javascript-constructor-problem.html
    */
    return new sequence(default_target)
  }
  function sequence(default_target) {
    this.default_target = default_target  // may be undefined
    this.listener_queue = []  // listener queue
    this.queue_index = -1  // queue index

    this._cycle = false  // if true the sequence will repeat
  }


  sequence.prototype.cycle = function() {
    /*
    If called the defined listeners will be repeated again
    when all have been used.
    */
    if (this.listener_queue.length < 1) {
      throw new Error('Cannot cycle because there are no listeners to cycle.')
    }

    this._cycle = true

    return this
  }

  // primary methods that will allow wrappers to be put on them
  const _setup_listener = {
    once(listener) {
      /* Call listener once for the event type for target element. */

      return function(event) {
        /* wraps listener to remove it after it is called once */
        listener(event)
        this._remove_listener()
        this._next()  // tells sequence instance that the next listener should be initialized
      }
    },

    repeat(listener) {
      /*
      Allows the listener to be repeated multiple times.

      Use the .until.(once|repeat) after this to stop listener from repeating
      */
      return listener
    },
  }

  // add _setup_listener methods to sequence
  for (const sl in _setup_listener) { if (_setup_listener.hasOwnProperty(sl)) {
    const method = function(type, listener, target) {
      /* */
      target = this._find_default_target(target)
      listener = _setup_listener[sl](listener).bind(this)

      this._add({type, target, listener})

      return this
    }

    sequence.prototype[sl] = method
  }}

  sequence.prototype.wait_until = function(type, target) {
    // wait until event

    this._add({
      type,
      target: this._find_default_target(target),
      listener: () => this._next(),
    })

    return this
  }


  // Adds until methods
  // adds a wrapper that will remove the last defined event listener
  Object.defineProperty(sequence.prototype, 'until', {
    get() {
      // IMPROVEMENT: it would be great if this didn't have to recreate the methods every time

      const last_listener_index = this.listener_queue.length - 1

      const out_methods = {
        event: function(type, target) {
          // wait until event
          this._add(
            {
              type,
              target: this._find_default_target(target),
              listener: function() {
                this._remove_listener(last_listener_index)
                this._next()
              }.bind(this),
            },
            true
          )

          return this
        }.bind(this),
      }

      for (const sl in _setup_listener) {
        if (_setup_listener.hasOwnProperty(sl)) {
          out_methods[sl] = function(type, listener, target) {
            const bound_listener = _setup_listener[sl](listener).bind(this)

            this._add(
              {
                type,
                target: this._find_default_target(target),
                listener: function(event) {
                  this._remove_listener(last_listener_index)
                  bound_listener(event)
                }.bind(this),
              },
              true
            )

            return this
          }.bind(this)
        }
      }

      return out_methods
    },
  })

  sequence.prototype._add = function(another, launch_with_last=false) {
    /*
    Adds another listener to the listener_queue.
    If the listener_queue is empty when called the listener is set to
    listen on the target.

    another - object with the keys
      type - string that specifies the event type
             Reference: Parameters type @
              https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
      listener - function that will be called on hearing the event
                 Reference: Parameters listener @
                  https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
      target - element that the listener will be applied to
               Reference: https: //developer.mozilla.org/en-US/docs/Web/API/EventTarget
    launch_with_last (optional) - If truthy another will be set to listen with
                                  the last listener.
    */
    const num_listeners = this.listener_queue.length

    if (launch_with_last && num_listeners > 0) {
      const last_index = num_listeners - 1
      this.listener_queue[last_index].push(another)

      // launch this if adding to the current listening listeners
      if (last_index === this.queue_index) this._next(another)

    } else if (launch_with_last) {
      throw new Error('No previous listeners to launch with.')

    } else {
      this.listener_queue.push([another])

      // if initial insert start the first listener
      if (this.listener_queue.length === 1) this._next()
    }
  }

  sequence.prototype._next = function(launch) {
    /*
    Adds the next set of listeners to their targets.

    launch (optional) - Add the listener in launch instead of going
                        to the next set of listeners.
    */
    if (launch) set_listener(launch)

    else {
      this.queue_index += 1
      const queue_index = this.queue_index
      const queue_length = this.listener_queue.length

      if (queue_index < queue_length) {
        this.listener_queue[queue_index].forEach(set_listener)

      } else if (this._cycle) {
        this.queue_index = -1
        this._next()
      }
    }

    function set_listener(settings) {
      const {type, listener, target} = settings
      target.addEventListener(type, listener)
    }
  }

  sequence.prototype._remove_listener = function(queue_index) {
    /*
    Removes listeners

    queue_index (optional) - If defined removes listeners in this.listener_queue at queue_index.
                             Else removes the listeners at this.queue_index (current active listeners)
    Removes the listener that is specified in this.listener_queue at queue_index.
    If queue_index is undefined it is set to this.queue_index.
    */

    // defaults to the current this.queue_index
    if (queue_index === undefined) queue_index = this.queue_index

    // check if valid index
    const queue_length = this.listener_queue.length
    if (queue_length === 0) {
      throw new Error('listener_queue is empty.')
    }
    if (queue_index < 0 || queue_index >= queue_length) {
      throw new Error(`queue_index out of range. queue_index=${queue_index}, listener_queue.length=${queue_length}.`)
    }

    this.listener_queue[queue_index].forEach(settings => {
      const {type, listener, target} = settings
      target.removeEventListener(type, listener)
    })
  }

  sequence.prototype._find_default_target = function(target) {
    /*
    Determines what target element to use.

    Throws error if both target and this.default_target are undefined.
    */
    if (target !== undefined) return target
    if (this.default_target !== undefined) return this.default_target
    throw new Error('No target or default target defined.')
  }

  return constructor
})()

},{}]},{},[1]);
