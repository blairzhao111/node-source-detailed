//' Stream.Duplex' module 

'use strict';

module.exports = Duplex;

const util = require('util');
const Readable = require('_stream_readable');
const Writable = require('_stream_writable');

//Stream.Duplex is directly inherited from Stream.Readable by making Duplex.prototype's [[protorype]] point to Readable.prototype.
util.inherits(Duplex, Readable);

//Simply grab all methods from Writable.prototype and stuff them into Duplex.prototype. 
//this is a commonly used technique named mixing or merge-descriptors, having serval variants, but all work in a similar way.
//used when you can't use some type as base class for your custom type but you want to use it functionities.
var keys = Object.keys(Writable);
for(let v = 0; v < keys.length; v++){
	let method = keys[v];
	if(!Duplex.prototype[method]){
		Duplex.prototype[method] = Writable.prototype[method];
	}
}

//Duplex stream constructor
function Duplex(options) {
	if(!(this instanceof Duplex)){
		return new Duplex(option);
	}

	//run through both Readable and Writable stream constructor to construct both parts of them in an instance of Duplex.
	Readable.call(this, options);
	Writable.call(this, options);

	if(options && options.readable === false){
		this.readable = false;
	}

	if(options && options.writable === false){
		this.writable = false;
	}

	//by default., Duplex allows half open.
	this.allowHalfOpen = true;
	if(options && options.allowHalfOpen === false){
		this.allowHalfOpen = false;
	}

	//register a once listener on its Readable part's 'end' event. 
	this.once('end', onend);
}

//once listener gets called when an 'end' event occurs indicating that the Readable part is ended.
function onend() {
	//if allowed half open, doesn't really matter if Writable part has ended or needs to be ended;
	//if not allowed half open, but Writable part has already ended, then both parts are ended, simply return.
	if(this.allowHalfOpen || this._writableState.ended){
		return;
	}

	//if not allowed half open and Writable part has not ended, call writable.end() to end the Writable part.
	process.nextTick(onEndNT, this);
}

function onEndNT(self) {
	self.end();
}