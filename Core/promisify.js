"use strict";

/**
 * thatLooksLikeAPromiseToMe()
 *
 * Duck-types a promise.
 *
 * @param {object} o
 * @return {bool} True if this resembles a promise
 */
function thatLooksLikeAPromiseToMe(o) {
  return o && typeof o.then === "function" && typeof o.catch === "function";
}


/**
 * promisify()
 *
 * Transforms callback-based function -- func(arg1, arg2 .. argN, callback) -- into
 * an ES6-compatible Promise. Promisify provides a default callback of the form (error, result)
 * and rejects when `error` is truthy. You can also supply settings object as the second argument.
 *
 * @param {function} original - The function to promisify
 * @param {object} settings - Settings object
 * @param {object} settings.thisArg - A `this` context to use. If not set, assume `settings` _is_ `thisArg`
 * @param {bool} settings.multiArgs - Should multiple arguments be returned as an array?
 * @return {function} A promisified version of `original`
 */
function promisify(target, original) {
  return function (...args) {
    // Return the promisified function
    return new Promise(function (resolve, reject) {
      // Append the callback bound to the context
      args.push(function callback(err, ...values) {
        if (err) {
          return reject(err);
        }

        resolve(values);
      });

      // Call the function
      const response = original.apply(target, args);

      // If it looks like original already returns a promise,
      // then just resolve with that promise. Hopefully, the callback function we added will just be ignored.
      if (thatLooksLikeAPromiseToMe(response)) {
        resolve(response);
      }
    });
  };
};

module.exports = function(scope, funcName) {
  return promisify(scope, scope[funcName]);
};
