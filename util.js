//'util' module

'use strict';

const uv = process.binding('uv');
const Buffer = require('buffer').Buffer;
const internalUtil = require('internal/util');
const binding = process.binding('util');




// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
exports.isArray = Array.isArray;

function isBoolean(arg) {
	return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
	return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
	return arg === null || arg === undefined;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
	return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
	return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
	return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
	return arg === undefined;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
	return binding.isRegExp(re);
}
exports.isRegExp = isRegExp;

function isObject(arg) {
	return arg !== null && typeof arg === 'object';
}
exports.isObject = isObject;

function isDate(d) {
	return binding.isDate(d);
}
exports.isDate = isDate;

exports.isError = isError;

function isFunction(arg) {
	return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
	return arg === null || (typeof arg !== 'object' && typeof arg !== 'function');
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;


//inherits function
exports.inherits = function(ctor, superCtor) {

	if(ctor === undefined || ctor === null){
		throw new TypeError('The constructor to "inherits" must not be ' +
                        	'null or undefined');
	}

	if(superCtor === undefined || superCtor === null){
	    throw new TypeError('The super constructor to "inherits" must not ' +
	                        'be null or undefined');
	}

	if(superCtor.prototype === undefined){
	    throw new TypeError('The super constructor to "inherits" must ' +
	                        'have a prototype');
	}

	ctor.super_ = superCtor;
	Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
};

exports._extend = function(origin, add) {
	// Don't do anything if add isn't an object.
	if(add === null || typeof add !== 'object') return origin;

	// get all own and enumerable properties keys of target object.
	// then, copy the value into extended object.
	var keys = Object.keys(add);
	var i = keys.length;

	while(i--) {
		origin[keys[i]] = add[keys[i]];
	}

	return origin;
};

function hasOwnProperty(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

exports._errnoException = function(err, syscall, original) {
	var errname = uv.errname(err);
	var message = syscall + ' ' + errname;

	if(original) message += ' ' + original;

	var e = new Error(message);
	e.code = errname;
	e.errno = errname;
	e.syscall = syscall;

	return e;
};