//'util' module

'use strict';

const uv = process.binding('uv');
const Buffer = require('buffer').Buffer;
const internalUtil = require('internal/util');
const binding = process.binding('util');
const isError = internalUtil.isError;
const kDefaultMaxLength = 100;

var Debug;
var simdFormatters;


function tryStringify(arg) {
	try {
		return JSON.stringify(arg);
	} catch(_) {
	 	return '[Circular]';
	}
}

exports.format = function(f) {
	if(typeof f !== 'string') {
		const objects = new Array(arguments.length);
		for(var index = 0; index < arguments.length; index++) {
			objects[index] = inspect(arguments[index]);
		}

		return objects.join(' ');
	}

	var argLen = arguments.length;

	if(argLen === 1) return f;

	var str = '';
	var a = 1;
	var lastPos = 0;
	for(var i = 0; i< f.length;) {
		if(f.charCodeAt(i) === 37/*'%'*/ && i + 1 < f.length) {
			switch(f.charCodeAt(i + 1)) {
				case 100: // 'd'
			}
		}
	}
};


exports.deprecate = internalUtil._deprecate;


// The util.debuglog() method is used to create a function that conditionally writes 
// debug messages to stderr based on the existence of the NODE_DEBUG environment variable. 
// If the section name appears within the value of that environment variable, 
// then the returned function operates similar to console.error(). 
// If not, then the returned function is a no-op.
var debugs = {};
var debugEnviron;

exports.debuglog = function(set) {
	if(debugEnviron === undefined) debugEnviron = process.env.NODE_DEBUG || '';

	set = set.toUpperCase();

	if(!debugs[set]) {
		if(new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
			var pid = process.pid;
			debugs[set] = function() {
				var msg = exports.format.apply(exports, arguments);
				console.error('%s %d: %s', set, pid, msg);
			};
		} else {
			debugs[set] = function() {};
		}
	}

	return debugs[set];
};


/**
 * Echos the value of a value. Tries to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
	//default options
}


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
	return arg === null || (typeof arg !== 'object' && typeof arg !== 'function' && typeof arg !== 'array');
}
exports.isPrimitive = isPrimitive;


exports.isBuffer = Buffer.isBuffer;


// If given number is smaller than 10, then prepend '0' before single digit, like '05'.
function pad(n) {
	return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 
				'Oct', 'Nov', 'Dec'];

// format as 1 Sep 18:57:35
function timeStamp() {
	var d = new Date();
	var time = [pad(d.getHours()),
				pad(d.getMinutes())
				pad(d.getSeconds())].join(':');

	return [d.getDate(), months[d.getMonth()], time].join(' ');
}

// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
	console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};

/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 * @throws {TypeError} Will error if either constructor is null, or if
 *     the super constructor lacks a prototype.
 */
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


// copy all own enumerable properties from 'add' object to 'origin' object
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

// extract hasOwnProperty method from Object.prototyoe as a standalone function 
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