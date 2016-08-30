// "assert" module
// "assert" module follows CommonJS standard. Node's assert module is inspired originally by narwhal.js (http://narwhaljs.org).
// "assert" module defines one type: AssertionError, which's inherited from the built-in Error type.
// "assert" module provides following assertion methods:
//  1. assert.ok(value, message): throws AssertionError when given value is evaluted as false/falsy. 
//     Do nothing when value is evaluated to be true/truthy.
//  2. assert(value, message): is an alias to assert.ok, so it has same assertion logic with assert.ok()
//  3. assert.fail(actual, expected, message, operator): creates and throws an AssertionError with provided information. 
//     If message is set to falsy, a default message is provided.
//  4. assert.equal(actual, expected, message): test equality between given actual and expected values using '=='. 
//     If 'actual != expected', then an AssertionError is thrown. If necessary, type coercion is performed on values.
//  5. assert.notEqual(actual, expected, message): test inequality between given actual and expected values using '!='.
//     If 'actual == expected', then an AssertionError is thrown. If necessary, type coercion is performed on values.
//  6. assert.strictEqual(actual, expected, message): test equality between given actual and expected values using '==='.
//     If 'actual !== expected', then an AssertionError is thrown. 
//  7. assert.notStrictEqual(actual, expected, message): test inequality between given actual and expected values using '!=='.
//     If 'actual === expected', then an AssertionError is thrown.
//  8. assert.deepEqual(actual, expected, message): used to compare compound structs, like object/array/buffer/regex instances.
//  9. assert.notDeepEqual(actual, expected, message):
//  10. assert.deepStrictEqual(actual, expected, message):
//  11. assert.notdeepStrictEqual(actual, expected, message):
//  12. assert.throws(block, error, message)
//  13. assert.doesNotThrows(block, error, message)
//  14. assert.ifError(err): 

'use strict';

const compare = process.binding('buffer').compare;
const util = require('util');
const Buffer = require('buffer').Buffer;
const pToString = (obj) => Object.prototype.toString.call(obj);

// 1. The assert module provides functions that throw AssertionErrors when particular conditions are not met. 
// The assert module must conform to the following interface.

// if you do 'const assert = require('assert');', then
// assert(value, message) is an alias of assert.ok(value, message)
// if given value is falsy, an AssertionError would be thrown.
const assert = module.exports = ok;

// 2. The AssertionError is defined in assert. The AssertionError type is inherited from built-in Error type.
// An AssertionError instance has following properties:
// 1. name: which is set to 'AssertError' by default.
// 2. actual: actaul value passed into assertion
// 3. expected: expected value that actual value is supposed to match
// 4. operator: what operation operates on assertion
// 5. message: if an AssertionError is thrown, then this message is printed out
// 6. stackStartFunction: what function is the starting point of assertion, if not mentioned, by default it's set to assert.fail

// creating new instance of AssertionError: 
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

function AssertionError(options) {
	this.name = 'AssertionError';
	this.actual = options.actual;
	this.expected = options.expected;
	this.operator = options.operator;

	//if message is not provided, use getMessage to generate the proper message.
	if(options.message) {
		this.message = options.message;
		this.generatedMessage = fasle;
	} else {
		this.message = getMessage(this);
		this.generatedMessage = true;
	}

	var stackStartFunction = options.stackStartFunction || fail;
	Error.captureStackTrace(this, stackStartFunction);
};

// AssertionError is inherited from Error, an instance of AssertionError is also an instance of Error.
util.inherits(assert.AssertionError, Error);

module.exports.AssertionError = AssertionError;

//following two functions are helper function for creating default message for AssertionError instances.
function truncate(s, n) {
	return s.slice(0, n);
}

function getMessage(self) {
	return truncate(util.inspect(self.actual), 128) + ' ' + 
	self.operator + ' ' + 
	truncate(util.inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

// Simply throws an AssertionError filled with provided information. 
// If message is falsy, the error message is set as the values of actual and expected separated by the provided operator. 
// Otherwise, the error message is the value of message.
function fail(actual, expected, message, operator, stackStartFunction) {
	throw new assert.AssertionError({
		message: message,
		actual: actual,
		expected: expected,
		operator: operator,
		stackStartFunction: stackStartFunction
	});
}

module.exports.fail = fail;


// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

// Tests if given value is truthy. It is equivalent to assert.equal(!!value, true, message).
// If value is not truthy, an AssertionError is thrown with a message property set equal to the value of the message parameter. 
// If the message parameter is undefined, a default error message is assigned.
function ok(value, message) {
	if(!value) fail(value, true, message, '==', assert.ok); 
}

module.exports.ok = ok;


// 5. The equality assertion tests shallow, coercive equality with ==.
// assert.equal(actual, expected, message_opt);
function equal(actual, expected, message) {
	if(actual != expected) fail(actual, expected, message, '==', assert.equal); 
}

module.exports.equal = equal;


// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);
function notEqual(actual, expected, message) {
	if(actual == expected) fail(actual, expected, message, '!=', assert.notEqual);
}

module.exports.notEqual = notEqual;


// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);
function deepEqual(actual, expected, message) {
	if(!_deepEqual(actual, expected, false)) fail(actual, expected, message, 'deepEqual', assert.deepEqual);
}

module.exports.deepEqual = deepEqual;


function deepStrictEuqal(actual, expected, message) {
	if(!_deepEqual(actual, expected, true)) fail(actual, expected, message, "deepStrictEuqal", assert.deepStrictEuqal); 
}

module.exports.deepStrictEuqal = deepStrictEuqal;

//helper fucntion that actually performs equality tests used by assert.deepEqual and assert.deepStrictEqual
function _deepEqual(actual, expected, strict, memos) {
	 // 7.1 All identical values are equivalent, as determined by ===.
	 if(actual === expected){
	 	return true;
	 } else if(actual instanceof Buffer && expected instanceof Buffer) {
	 // 7.2 If both actual and expected are Buffer objects, then use Buffer.compare function to 
	 // test equality, if returned value is 0, it means both two buffer objects have same value.
	 	return compare(actual, expected) === 0;
	 } else if(util.isDate(actual) && util.isDate(expected)) {	 	
	 // 7.3 If the expected value is a Date object, the actual value is
	 // equivalent if it is also a Date object that refers to the same time.
	 	return actual.getTime() === expected.getTime();
	 } else if(util.isRegExp(actual) && util.isRegExp(expected)) {
	 // 7.3 If the expected value is a RegExp object, the actual value is
	 // equivalent if it is also a RegExp object with the same source and
	 // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
		return actual.source === expected.source &&
			   actual.global === expected.global &&
			   actual.multiline === expected.multiline &&
			   actual.lastIndex === expected.lastIndex &&
			   actual.ignoreCase === expected.ignoreCase;	
	 } else if((actual === null || typeof actual !== 'object') && 
	 			(expected === null || typeof expected !== 'object')) {	 	
	  // 7.4. Other pairs that do not both pass typeof value == 'object',
	  // equivalence is determined by ==.
	 	return strict ? actual === expected : actual == expected;
	 } else if (ArrayBuffer.isView(actual) && ArrayBuffer.isView(expected) &&
	 			pToString(actual) === pToString(expected) && 
	 			!(actual instanceof Float32Array || actual instanceof Float64Array)) {
	  // If both values are instances of typed arrays, wrap their underlying
	  // ArrayBuffers in a Buffer each to increase performance
	  // This optimization requires the arrays to have the same type as checked by
	  // Object.prototype.toString (aka pToString). Never perform binary
	  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
	  // bit patterns are not identical.
	 	return compare(Buffer.from(actual.buffer), Buffer.from(expected.buffer)) === 0;
	 } else {
	  // 7.5 For all other Object pairs, including Array objects, equivalence is
	  // determined by having the same number of owned properties (as verified
	  // with Object.prototype.hasOwnProperty.call), the same set of keys
	  // (although not necessarily the same order), equivalent values for every
	  // corresponding key, and an identical 'prototype' property. Note: this
	  // accounts for both named and indexed properties on Arrays.
	  	memos = memos || {actual: [], expected: []};

	  	const actualIndex = memos.actual.indexOf(actual);
	  	if(actualIndex !== -1) {
	  		if(actualIndex === memos.expected.indexOf(expected)) {
	  			return true;
	  		}
	  	}

	  	memos.actual.push(actual);
	  	memos.expected.push(expected);

	  	return objEquiv(actual, expected, strict, memos);
	 }
}


function isArguments(object) {
	return Object.prototype.toString.call(object) == '[object Arguments]';
}


function objEquiv(a, b, strict, actualVisitedObjects) {

}


// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);
function notDeepEqual(actual, expected, message) {
	if(_deepEqual(actual, expected, false)) fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual); 
}

module.exports.notDeepEqual = notDeepEqual;


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);
function strictEqual(actual, expected, message) {
	if(actual !== expected) {
		fail(actual, expected, message, '===', assert.strictEqual);
	}
}

module.exports.strictEqual = strictEqual;


// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);
function notStrictEqual(actual, expected, message) {
	if(actual === expected) {
		fail(actual, expected, message, '!==', assert.notStrictEqual);
	}
}

module.exports.notStrictEqual = notStrictEqual;


function expectedException(actual, expected) {
	if(!actual || !expected) return false;

	if(Object.prototype.toString.call(expected) == '[object RegExp]') return expected.test(actual); 

	try {
		if(actual instanceof expected) return true;
	} catch(err) {
		 // Ignore.  The instanceof check doesn't work for arrow functions.
	}

	if(Error.isPrototypeOf(expected)) return false;

	return expected.call({}, actual) === true;
}

// helper function used to invoke a given function and return error if function throws one
function _tryBlock(block) {
	var error;

	try {
		block();
	} catch(err) {
		error = err;
	}

	return error;
}

// internal helper function used by assert.throw and assert.doesNotThrow
function _throw(shouldThrow, block, expected, message) {
	var actual;

	// block argument needs to a function
	if(typeof block !== 'function') {
		throw new TypeError('"block" argument must be a function');
	}

	// if error(expected) argument is string, it's used as message and got ignored as error, 
	if(typeof expected === 'string') {
		message = expected;
		expected = null;
	}

	actual = _tryBlock(block);

	message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
	            (message ? ' ' + message : '.');

	if(shouldThrow && !actual) {
		fail(actual, expected, 'Missing expected exception' + message);
	}

	const userProvidedMessage = typeof message === 'string';
	const isUnwantedException = !shouldThrow && util.isError(actual);
	const isUnexpectedException = !shouldThrow && actual && !expected;

	if((isUnwantedException && userProvidedMessage && expectedException(actual, expected)) || isUnexpectedException) {
		fail(actual, expected, 'Got unwanted exception' + message);
	}

	if((shouldThrow && actual && expected && !expectedException(actual, expected)) || (!shouldThrow && actual)) throw actual;
} 


// 11. Expected given function to throw an error:
// block is supposed to be a function. 
// assert.throws(block, Error_opt, message_opt);
module.exports.throws = function(block, error, message) {
	_throw(true, block, error, message);
};


// EXTENSION! This is annoying to write outside this module.
module.exports.doesNotThrow = function(block, error, message) {
	_throw(false, block, error, message);
};

// 12. Throws value if value is truthy. This is useful when testing the error argument in callbacks.
module.exports.ifError = function(err) {
	if(err) throw err;
};