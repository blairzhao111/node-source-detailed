//'console' module


'use strict';

const util = require('util');

//Console Construct, acccepts two writable stream as standard out and standard error.
//stderr is optional, if not provided, all data would be pushed to stdout stream.
function Console(stdout, stderr) {
	if(!(this instanceof Console)){
		return new Console(stdout, stderr);
	}

	//if no stdout provided or provided stdout is not a writable stream, then a type error would be thrown.
	if(!stdout || typeof stdout.write !== 'function'){
		throw new TypeError('Console expects a writable stream instance');
	}

	//if no stderr provided, set stderr to stdout. And stderr has to be a writable stream.
	if(!stderr){
		stderr = stdout;
	}else if(typeof stderr.write !== 'function'){
		throw new TypeError('Console expects a writable stream instance');
	}

	//add three unenumerable properties to every Console instance
	//_stdout, used to cache stdout 
	//_stderr, used to cache stderr
	//_times, used to store labelled timestamps for .time() and .timeEnd() methods.
	var prop = {
		writable: true,
		enumerable: false,
		configurable: true
	};
	prop.value = stdout;
	Object.defineProperty(this, '_stdout', prop);
	prop.value = stderr;
	Object.defineProperty(this, '_stderr', prop);
	prop.value = new Map();
	Object.defineProperty(this, '_times', prop);


	//bind the methods in Console.prototype object as BF and gets stored in this Console instance.
	//so every Console instance has these method as its own, instead of getting from Console.prototype
	//and these methods' 'this' always bind to that Console instance. 
	var keys = Object.keys(Console.prototype);
	for(var i = 0; i < keys.length; i++){
		var key = keys[i];
		this[key] = this[key].bind(this);
	}
}

//log method, send data to the specified stdout
Console.prototype.log = function(...args) {
	this._stdout.write(`${util.format.apply(null, args)}\n`);
};

//info is an alias to log
Console.prototype.info = Console.prototype.log;

//warning method, send data to specified stderr
Console.prototype.warning = function(...args) {
	this._stderr.write(`${util.format.apply(null, args)}\n`);
};

//error is an alias to warning 
Console.prototype.error = Console.prototype.warning;


Console.prototype.dir = function(object, options) {
	//add one additional property to pass-in options obj
	options = Object.assign({customInspect: false}, options);
	this._stdout.write(`${util.inspect(object, options)}\n`);
};

Console.prototype.time = function(label) {
	//process.hrtime() returns a timestamp in [second, nanosecond] format as an array.
	//store label/timestamp pair in internal map for later usage.
	//I really don't understand why it's allowed to let undefined be the key in new ES6 Map type, but that's.
	//so you actually don't need to pass any label, then when you call timeEnd, 'undefined: duration' would be returned. Weird!
	this._times.set(label, process.hrtime());
};

Console.prototype.timeEnd = function(label) {
	//get starting timestamp from internal map based on given label
	const time = this._times.get(label);
	//if no key/value pair can be found based on given label, emit an warnig through process object.
	if(!time){
		process.emitWarning(`No such label '${label}' for console.timeEnd()`);
		return;
	}
	//if timestamp is found, then
	//get duration in [second, nanosecond] format by passing previous timestamp to process.hrtime()
	const duration = process.hrtime(time);
	//convert [second, nanosecond] into ms
	const ms = duration[0]*1000 + duration[1] / 1e6;
	//log label: duration to stdout
	this.log('%s: %sms', label, ms.toFixed(3));
	//delete that lable/timestamp from internal map.
	this._times.delete(label);
};

//method for printing the track stack when an error occurs.
Console.prototype.trace = function(...args) {
  // TODO probably can to do this better with V8's debug object once that is
  // exposed.
	var error = new Error();
	error.name = 'Trace';
	error.message = util.format.apply(null, args);
	Error.catureStackTrace(error, trace);
	this.error(error.stack);
};

//a simple assertion method provided to assert given expression. 
//If the given expression is evaluated as false, then an assertion error would be thrown, your node process exits.
//You can overwrite or use subclass to create a simpe assertion method for your application, simply wrap console.assert in a try/catch block.
//if assert succeeded, print some message indicates successful. 
//If an error is caught in catch block, that means your assertion failed, then you can print someting useful.
Console.prototype.assert = function(expression, ...args) {
	if(!expression){
		require('assert').ok(false, util.format.apply(null, args));
	}
};

//module exports a global Console instance that uses process.stdout as stdout and process.stderr as stderr.
//this is the Console object that's doing the work when you're doing like console.log(...)
module.exports = new Console(process.stdout, process.stderr);
//also add Console constructor to global console object to create custom Console instance.
//like creating a logger obj to log data to files: var logger = new console.Console(writeLogFileStream, writeErrorFileStream);
module.exports.Console = Console;