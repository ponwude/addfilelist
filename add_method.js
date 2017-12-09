module.exports = function(name, obj, method) {

  if(obj.prototype[name] === undefined) {
    obj.prototype[name] = method

    Object.defineProperty(obj.prototype, name, {enumerable: false})

  } else throw new Error(`Cannot override existing ${typeof obj}.prototype.${name} method.`)
}
