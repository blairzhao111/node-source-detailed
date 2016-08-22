//'Stream.Readable' module

"use strict";

module.exports = Readable;
Readable.ReadableState = ReadableState;

const EventEmitter = require('event');
const Stream = require('stream');
const Buffer = require('buffer').Buffer;
const util = require('util');
const debug = util.debuglog('stream');
const BufferList = require('internal/stream/BufferList');
var StringDecoder;

util.inherits(Readable, Stream);

var prependListener;
if (typeof EE.prototype.prependListener === 'function') {
  prependListener = function prependListener(emitter, event, fn) {
    return emitter.prependListener(event, fn);
  };
} else {
  prependListener = function prependListener(emitter, event, fn) {
    // This is a hack to make sure that our error handler is attached before any
    // userland ones.  NEVER DO THIS. This is here only because this code needs
    // to continue to work with older versions of Node.js that do not include
    // the prependListener() method. The goal is to eventually remove this hack.
    if (!emitter._events || !emitter._events[event])
      emitter.on(event, fn);
    else if (Array.isArray(emitter._events[event]))
      emitter._events[event].unshift(fn);
    else
      emitter._events[event] = [fn, emitter._events[event]];
  };
}

function ReadableState(options, stream) {
	options = options || {};

	this.objectMode = !!objectMode;

	if(stream instanceof Stream.Duplex){
		this.objectMode = this.objectMode || !!options.readableObjectMode;
	}

	var hwm = options.highWaterMark;
	var defaultHwm = this.objectMode ? 16 : 16*1024;
	this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;
	this.highWaterMark = ~~this.highWaterMark;

	this.buffer = new BufferList();
	this.length = 0;
	this.pipe = null;
	this.pipesCount = 0;
	this.flowing = null;
	this.ended = false;
	this.endEmitted = false;
	this.reading = false;

	this.sync = true;

	this.needReadable = false;
	this.emittedReadable = false;
	this.readableListening = false;
	this.resumeScheduled = false;

	this.defaultEncoding = options.defaultEncoding || 'utf8';

	this.ranout = false;

	this.awaitDrain = 0;

	this.readingMore = false;

	this.decoder = null;
	this.encoding = null;
	if(options.encoding){
		if(!StringDecoder){
			StringDecoder = require('string_decoder').StringDecoder;
		}
		this.decoder = new StringDecoder(options.encoding);
		this.encoding = options.encoding;
	}
}


function Readable(options) {
	if(!(this instanceof Readable)){
		return new Readable(options);
	}

	Stream.call(this);

	this._readableState = new ReadableState(options, this);

	this.readable = true;

	if(options && typeof options.read === 'function'){
		this._read = options.read;
	}
}


Readable.prototype.push = function(chunk, encoding) {
	var state = this._readableState;

	if(!state.objectMode && typeof chunk === 'string'){
		encoding = encoding || state.defaultEncoding;
		if(encoding !== state.encoding){
			chunk = Buffer.from(chunk, encoding);
			encoding = '';
		}
	}

	return readableAddChunk(this, state, chunk, encoding, false);
};

Readable.prototype.unshift = function(chunk) {
	var state = this._readableState;

	return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function() {
	return this._readableState.flowing === false;
};


Readable.prototype.setEncoding = function(enc) {
	
};


