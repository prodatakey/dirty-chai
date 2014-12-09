'use strict';

(function (dirtyChai) {
    // Inject into various module systems
    if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
      // Node
      module.exports = dirtyChai;
    } else if (typeof define === 'function' && define.amd) {
      // AMD
      define(function () {
          return dirtyChai;
      });
    } else {
      // Other environment (usually <script> tag): plug in to global chai instance directly.
      chai.use(dirtyChai);
    }
}(function dirtyChai(chai, util) {
  var DEFERRED = '__deferred__';

  var flag = util.flag,
      Assertion = chai.Assertion;

  function DeferredAssertion(ctx, assertFunc) {
    var assertion = new Assertion();
    util.transferFlags(ctx, assertion);

    // Clear deferred assertions
    flag(assertion, DEFERRED, null);
    return {
      assert: function() {
        assertFunc.call(assertion);
      },
      assertion: assertion,
    };
  }

  // Flag a deferred assertion
  function deferAssert(ctx, assertFunc) {
    // See if we have any deferred asserts
    var deferred = flag(ctx, DEFERRED) || [];

    deferred.push(new DeferredAssertion(ctx, assertFunc));

    flag(ctx, DEFERRED, deferred);
  }

  // Grab and assert on any deferred assertions
  function checkDeferred(ctx) {
    var deferreds = flag(ctx, DEFERRED) || [],
        deferred;
    
    while((deferred = deferreds.pop())) {
      deferred.assert();
    }

    // Clear the deferred asserts
    flag(ctx, DEFERRED, deferreds);
  }

  function applyMessageToLastDeferred(ctx, msg) {
    var deferreds = flag(ctx, DEFERRED);
    if(deferreds && deferreds.length > 0) {
      flag(deferreds[deferreds.length - 1].assertion, 'message', msg);
    }
  }

  // Prepend our deferred assertion checking to the beginning of Assertion#assert
  var oldAssert = Assertion.prototype.assert;
  Assertion.prototype.assert = function() {
    checkDeferred(this);
    oldAssert.apply(this, arguments);
  };

  // Gets a named property's getter
  function getProperty(name) {
    var prop = Object.getOwnPropertyDescriptor(Assertion.prototype, name);
    return prop.get;
  }

  function convertPropertyToChainMethod(name) {
    var assertFunc = getProperty(name);
    if(assertFunc) {
      Assertion.addChainableMethod(name, 
        function newMethod(msg) {
          /*jshint validthis: true */
          if (msg) { applyMessageToLastDeferred(this, msg); }

          // Execute any deferred asserts when the method is executed
          checkDeferred(this);
        },
        function newProperty() {
          /*jshint validthis: true */
          // Flag deferred assert here
          deferAssert(this, assertFunc);
        });
    }
  }

  // Hook new property creations and make them chainable methods
  var addProperty = util.addProperty;
  util.addProperty = function(ctx, name) {
    addProperty.apply(util, arguments);
    convertPropertyToChainMethod(name);
  };

  // Convert existing chai properties
  convertPropertyToChainMethod('ok');
  convertPropertyToChainMethod('true');
  convertPropertyToChainMethod('false');
  convertPropertyToChainMethod('null');
  convertPropertyToChainMethod('undefined');
  convertPropertyToChainMethod('exist');
  convertPropertyToChainMethod('empty');
  convertPropertyToChainMethod('arguments');
  convertPropertyToChainMethod('Arguments');

  Assertion.addMethod('ensure', function() { checkDeferred(this); });
}));
