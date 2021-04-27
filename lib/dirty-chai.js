'use strict'

function dirtyChai (chai, util) {
  const DEFERRED = '__deferred__'

  const flag = util.flag
  const Assertion = chai.Assertion

  // Defer some chain operation
  function defer (ctx, deferFunc) {
    // See if we have any deferred asserts
    const deferred = flag(ctx, DEFERRED) || []

    deferred.push(deferFunc)

    flag(ctx, DEFERRED, deferred)
  }

  // Grab and assert on any deferred operations
  function execDeferred (ctx) {
    const deferreds = flag(ctx, DEFERRED) || []
    let root = ctx
    let deferred

    // Clear the deferred asserts
    flag(ctx, DEFERRED, undefined)

    while ((deferred = deferreds.shift())) {
      const result = deferred.call(root)
      if (result !== undefined) {
        root = result
      }
    }

    return root
  }

  function applyMessageToLastDeferred (ctx, msg) {
    const deferreds = flag(ctx, DEFERRED)
    if (deferreds && deferreds.length > 0) {
      deferreds.splice(-1, 0, function () {
        flag(this, 'message', msg)
      })
    }
  }

  function convertAssertionPropertyToChainMethod (name, getter) {
    if (getter) {
      Assertion.addChainableMethod(name,
        function newMethod (msg) {
          if (msg) { applyMessageToLastDeferred(this, msg) }

          // Execute any deferred asserts when the method is executed
          return execDeferred(this)
        },
        function newProperty () {
          // Flag deferred assert here
          defer(this, getter)
          return this
        })
    }
  }

  /**
   * Checks to see if a getter calls the `this.assert` function
   *
   * This is not super-reliable since we don't know the required
   * preconditions for the getter. A best option would be for chai
   * to differentiate between asserting properties and ones that only chain.
   */
  function callsAssert (getter) {
    const stub = {
      assertCalled: false,
      assert: function () {
        this.assertCalled = true
      }
    }

    try {
      getter.call(stub)
    } catch (e) {
      // This most likely happened because we don't meet the getter's preconditions
      // Error on the side of conversion
      stub.assertCalled = true
    }

    return stub.assertCalled
  }

  // Get a list of all the assertion object's properties
  const properties = Object.getOwnPropertyNames(Assertion.prototype)
    .map(function (name) { const descriptor = Object.getOwnPropertyDescriptor(Assertion.prototype, name); descriptor.name = name; return descriptor })

  // For all pure function assertions, exec deferreds before the original function body.
  properties
    .filter(function (property) { return property.name !== 'assert' && property.name !== 'constructor' && typeof property.value === 'function' })
    .forEach(function (property) {
      Assertion.overwriteMethod(property.name, function (_super) {
        return function () {
          const result = execDeferred(this)
          return _super.apply(result, arguments)
        }
      })
    })

  // For chainable methods, defer the getter, exec deferreds before the assertion function
  properties
    .filter(function (property) { return Object.prototype.hasOwnProperty.call(Assertion.prototype.__methods, property.name) })
    .forEach(function (property) {
      Assertion.overwriteChainableMethod(property.name, function (_super) {
        return function () {
          // Method call of the chainable method
          const result = execDeferred(this)
          return _super.apply(result, arguments)
        }
      }, function (_super) {
        return function () {
          // Getter of chainable method
          defer(this, _super)
          return this
        }
      })
    })

  const getters = properties.filter(function (property) {
    return property.name !== '_obj' &&
    typeof property.get === 'function' &&
    !Object.prototype.hasOwnProperty.call(Assertion.prototype.__methods, property.name)
  })

  // For all pure properties, defer the getter
  getters
    .filter(function (property) { return !callsAssert(property.get) })
    .forEach(function (property) {
      Assertion.overwriteProperty(property.name, function (_super) {
        return function () {
          defer(this, _super)
          return this
        }
      })
    })

  // For all assertion properties, convert it to a chainable
  getters
    .filter(function (property) { return callsAssert(property.get) })
    .forEach(function (property) {
      convertAssertionPropertyToChainMethod(property.name, property.get)
    })

  Assertion.addMethod('ensure', function () { return execDeferred(this) })

  // Hook new property creations
  const addProperty = util.addProperty
  util.addProperty = function (ctx, name, getter) {
    addProperty.apply(util, arguments)

    // Convert to chained property
    convertAssertionPropertyToChainMethod(name, getter)
  }

  // Hook new method assertions
  const addMethod = util.addMethod
  util.addMethod = function (ctx, name) {
    addMethod.apply(util, arguments)
    Assertion.overwriteMethod(name, function (_super) {
      return function () {
        const result = execDeferred(this)
        return _super.apply(result, arguments)
      }
    })
  }

  // Hook new chainable methods
  const addChainableMethod = util.addChainableMethod
  util.addChainableMethod = function (ctx, name) {
    // When overwriting an existing property, don't patch it
    let patch = true
    if (Object.prototype.hasOwnProperty.call(Assertion.prototype, name)) {
      patch = false
    }

    addChainableMethod.apply(util, arguments)
    if (patch) {
      Assertion.overwriteChainableMethod(name, function (_super) {
        return function () {
          // Method call of the chainable method
          const result = execDeferred(this)
          return _super.apply(result, arguments)
        }
      }, function (_super) {
        return function () {
          // Getter of chainable method
          defer(this, _super)
          return this
        }
      })
    }
  }
}

module.exports = dirtyChai
