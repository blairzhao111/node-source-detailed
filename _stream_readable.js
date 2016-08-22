//'Stream.Readable' module

"use strict";

module.exports = Readable;

//store ReadableState constructor in Readable constructor.
Readable.ReadableState = ReadableState;

//module dependencies
const EventEmitter = require('event');
const Stream = require('stream');
const Buffer = require('buffer').Buffer;
const util = require('util');
const debug = util.debuglog('stream');
const BufferList = require('internal/stream/BufferList');
var StringDecoder;

//Stream.Readable inherits from Stream. A Readable instance is also an instance of Stream, EventEmitter and Obejct.
util.inherits(Readable, Stream);

//Extract the emitter.prependListener method from EventEmitter and make it work as function. 
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

//Constructor for ReadableState, an instance of ReadableState handles the states of the Readable instance that it resides in.
function ReadableState(options, stream) {
	options = options || {};

	//convert value into boolean value
	this.objectMode = !!objectMode;

	if(stream instanceof Stream.Duplex){
		this.objectMode = this.objectMode || !!options.readableObjectMode;
	}

	//set High Water Mark of current Readable instance
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

//Constructor for the Readable stream
function Readable(options) {
	if(!(this instanceof Readable)){
		return new Readable(options);
	}

	//invoke supertype constructor
	Stream.call(this);

	//create a ReadableState object to handle the states and pass the options to it.
	this._readableState = new ReadableState(options, this);

	//legacy, mark this is a readable stream.
	this.readable = true;

	//if read function is provided, then add it as _read property to current readable instance to override the default _read method.
	if(options && typeof options.read === 'function'){
		this._read = options.read;
	}
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more. 
// Returning false indicates that interanl buffer is full and no more data should be pushed into buffer until _read is called again.
Readable.prototype.push = function(chunk, encoding) {
	var state = this._readableState;

	//if stream not running in object mode and input data is string, them convert string into buffer object.
	if(!state.objectMode && typeof chunk === 'string'){
		encoding = encoding || state.defaultEncoding;
		if(encoding !== state.encoding){
			chunk = Buffer.from(chunk, encoding);
			encoding = '';
		}
	}

	//then call following function to add chunk into stream internal buffer, also mark addToFront to false.
	return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
	var state = this._readableState;

	//call following function and mark addToFront flag to true.
	return readableAddChunk(this, state, chunk, '', true);
};

// return a boolean value indicates whether stream is in pause mode or flowing mode.
Readable.prototype.isPaused = function() {
	return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
	var er = chunkInvalid(state, chunk);

	if(er) {
		stream.emit('error', er);
	}else if (chunk === null) {
		state.reading = false;
		onEofChunk(stream, state);
	} else if (state.objectMode || chunk && chunk.length > 0) {
		if(state.ended && !addToFront) {
			const e = new Error('stream.push() after EOF');
			stream.emit('error', e);
		} else if(state.endEmitted && addToFront) {
			const e = new Error('stream.unshift() after end event');
			stream.emit('error', e);
		} else {
			var skipAdd;
			if(state.decoder && !addToFront && !encoding) {
				chunk = state.decoder.write(chunk);
				skipAdd = (!state.objectMode && chunk.length === 0);
			}

			if(!addToFront) {
				state.reading = false;
			}

			// Don't add to the buffer if we've decoded to an empty string chunk and
			// we're not in object mode
			if(!skipAdd) {
				if(state.flowing && state.length === 0 && !state.sync) {
					stream.emit('data', chunk);
					stream.read(0);
				} else {

				}
			}
		}
	}
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
	if(!StringDecoder) {
		StringDecoder = require('string_decoder').StringDecoder;
	}

	this._readableState.decoder = new StringDecoder(enc);
	this._readableState.encoding = enc;
	
	return this;
};


