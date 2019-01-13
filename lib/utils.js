const _ = {
  isString: function (str) {
    return typeof str === 'string'
  },
  isObject: function (obj) {
    return typeof str === 'object'
  },
  isFunction: function (func) {
    return typeof func === 'function'
  },
  has: function (obj, key) {
    return typeof obj[key] !== 'undefined'
  },
  get: function (obj, key) {
    //  _.get(req, 'query.access_token')
    const parts = key.split('.')
    let check = obj
    for (let i = 0; i < parts.length; i++) {
      if (check[parts[i]]) {
        check = check[parts[i]]
      } else {
        console.log('_.get %s NULL', key)
        return undefined
      }
    }
    console.log('_.get %s -> ', key, check)
    return check
  }
}

module.exports = _
