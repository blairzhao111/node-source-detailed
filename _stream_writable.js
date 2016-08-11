//'Writable' stream module
//commented by Junwei Zhao <blairzhao111@gmail.com>

/*
*	Writable stream usually is used as a wrapper to wrap around on underlying data sink to provide a streamful api to data sink users.
*   Its base type Writable or stream.Writable exposes two interfaces to two different groups of people, stream users and stream implementers.
*   For stream implementers, you can use subclass or pass options to provide a _write method for consuming chunks one by one, or a _writev method for consuming an array of chunks.
*   For stream implementers, when current chunk/chunks of data get consumed successfully/unsuccessfully, call the provided callback in _writev/_write method to get next round of chunk/chunks with null/error.
*   For stream users, you can use write method for passing data to stream. Write method's returned value indicates whether you should keep writing data to stream or simply pause and waiting for 'drain' signal. 
*   Stream users can call cork() on stream, by calling that, all following incoming chunks will be buffered in stream's internal buffer and stream won't not call _writev/_write until you call uncork().
*   Stream users can use setDefaultEncoding method to set/change default encoding. If not specified, default encodings are 'buffer' for Buffer object and 'utf8' for String type.
*   Predefineded events are 'error', 'close', 'finish', 'drain', 'pipe' and 'unpipe'.
*/

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;
//Writable function object has reference to WritableState function object, both works as constructor.
Writable.WritableState = WritableState;

const util = require('util');
const internalUtil = require('internal/util');
const Stream = require('stream');
const Buffer = require('buffer').Buffer;

//hook up the inheritance chain, now Writable.prototype's [[prototype]] points to Stream.prototype
util.inherits(Writable, Stream);

//a callback function replacement that does nothing, used when callback are not specified.
function nop() {}

//constructor for a wrapper type that wraps buffered data chunk, encoding info, callback, and next buffered data wrapper if they exist.
//it's similiar to list node in a linked list. Stream's internal buffer basically is a linked-list-like structure.
function WriteReq(chunk, encoding, cb) {
	this.chunk = chunk;
	this.encoding = encoding;
	this.callback = cb;
	this.next = null;
}

//Constructor for a WritableState Object contains states of Writable stream.
function WritableState(options, stream) {
	options = options || {};

	//object stream indicator, if undefined, cast to false;
	//by default, it's set to be false;
	this.objectMode = !!options.objectMode;

	if(stream instanceof Stream.Duplex) {
		this.objectMode = this.objectMode || !!options.writableObjectMode;
	}

	//when buffer level passes highWaterMark, stream.write() returns false until buffer is flushed;
	var hwm = options.highWaterMark;
	//default highWaterMark is 16kb for buffer or 16 objects when it's on objectMode.
	var defaultHwm = this.objectMode ? 16 : 16*1024;
	//note: 0 is a valid value
	this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;
	//explicitly cast to int
	this.highWaterMark = ~~this.highWaterMark;

	//flag indicates if a 'drain' event needs to be emitted.
	this.needDrain = false;
	//flag related to stream's ending state.
	this.ending = false;
	this.ended = false;
	//flag indicates if stream is finished.
	this.finished = false;

	//should we decode strings into buffers before passing to _write?
	var noDecode = (options.decodeStrings === false);
	this.decodeStrings = !noDecode;

  	// Crypto is kind of old and crusty.  Historically, its default string
  	// encoding is 'binary' so we have to make this configurable.
  	// Everything else in the universe uses 'utf8', though.
	this.defaultEncoding = options.defaultEncoding || 'utf8';

	// not an actual buffer we keep track of, but a measurement
  	// of how much(buffered data but not been pushed yet) we're waiting to get pushed to some underlying
  	// socket or file(data sink).
  	//keep tracking of the size of internal buffer
	this.length = 0;

	//a flag to indicate whether we're in the middle of a writing
	//a wiriting phase starts off from the call to doWrite function and ends at nwrite function invoked by calling provided cb in _writev/_write.
	this.writing = false;

	//when true all write will be buffered until .uncork() called
	//keeps track of how many times cork() method gets called on stream
	this.corked = 0;


	// a flag to be able to tell whether the onwrite callback of _writev/_write is called immediately(sync way)
	// or on a later tick(async way).  We set this to true at first, because any
	// actions that shouldn't happen until "later" should generally also
	// not happen before the first write call.
	this.sync = true;

	// a flag to know if we're processing previously buffered items, which
  	// may call the _write() callback in the same tick, so that we don't
  	// end up in an overlapped onwrite situation.
	this.bufferProcessing = false;

	//the callback that's passed to _write(chunk, cb)
	//when _write finishes consuming data chunk, call this callback to get next chunk of data.
	this.onwrite = function(error) {
		onwrite(stream, error);
	};

	//reference to the callback that the user supplies to write(chunk, encoding, cb).
	this.writecb = null;

	//the amount that is being written when _write is called.
	this.writelen = 0;

	//head of buffered requests chain
	this.bufferedRequest = null;
	//tail of buffered requests chain
	this.lastBufferedRequest = null;

	//number of pending user-supplied write callbacks
	//this must be 0 before 'finihs' can be emitted.
	this.pendingcb = 0;

  	// emit prefinish if the only thing we're waiting for is _write cbs
  	// This is relevant for synchronous Transform streams
	this.prefinished = false;

	// True if the error was already emitted and should not be thrown again
	this.errorEmitted = false;

	// count buffered requests
	this.bufferedRequestCount = 0;

  	// allocate the first CorkedRequest, there is always
  	// one allocated and free to use, and we maintain at most two
	this.corkedRequestsFree = new CorkedRequest(this);
}

//method for getting an array of buffered requests(buffered data), each request wraps a chunk of data.
WritableState.prototype.getBuffer = function writableStateGetBuffer() {
	//start from the head and iterate through buffered requests chain, store them in an array and return
	var current = this.bufferedRequest;
	var out = [];
	while(current){
		out.push(current);
		current = current.next;
	}
	return out;
};

//backward compatibility, when writableState.buffer gets called, an buffer array gets returned and prints deprecated message. 
Object.defineProperty(WritableState.prototype, 'buffer', {
	get: internalUtil.deprecate(function() {
		return this.getBuffer();
	}, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' +
     'instead.')
});


//Writable Constructor
//every Writable instance has it own WritableState object and writable property(legacy).
//also every Writable instance is an instance of Stream, EventEmitter, Object. 
function Writable(options) {
	if(!(this instanceof Writable) && !(this instanceof Stream.Duplex)){
		return new Writable(options);
	}

	Stream.call(this);

	this._writableState = new WritableState(options, this);

	//legacy, used to identify if 'this' object is a writable stream.
	this.writable = true;

	//options can provide _write and _writev, if provided, set them in 'this' instance.
	//which would shadow _write and _writev methods from prototype chain.
	if(options){
		if(typeof options.write === 'function'){
			this._write = options.write;
		}

		if(typeof options.writev === 'function'){
			this._writev = options.writev
		}
	}
}

//shadow pipe method from Stream.prototype, otherwise people can pipe Writable stream.
//an error is emitted when pipe() is called on a Writable instance.
Writable.prototype.pipe = function() {
	this.emit('error', new Error('Cannot pipe, not readable'));
};


//function for handling calling to write() method after a stream is ended. An error would be emitted.
function writeAfterEnd(stream, cb) {
	var err = new Error('write after end');
	stream.emit('error', err);
	process.nextTick(cb, err);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
	var isValid = true;
	var error = false;
  // Always throw error if a null is written.
  // if chunk is not a buffer, string, or undefined and we're not in object mode, then an error is thrown.
	if(chunk === null){
		error = new TypeError('May not write null values to stream');
	}else if( !(chunk instanceof Buffer) && 
		(typeof chunk !== 'string') && (chunk !== undefined) && !state.objectMode){
		error = new TypeError('Invalid non-string/buffer chunk');
	}

	if(error){
		stream.emit('error', error);
		process.nextTick(cb, error);
		isValid = false;
	}

	return isValid;
}

/************************************************************************************************************************************
* method writes some data to the stream, and calls the supplied callback once the data has been fully handled. 
* If an error occurs, the callback may or may not be called with the error as its first argument. To reliably detect write errors, add a listener for the 'error' event.
* The return value indicates whether the written chunk was buffered internally and the buffer has exceeded the highWaterMark configured when the stream was created. 
* If false is returned, further attempts to write data to the stream should be paused until the 'drain' event is emitted.
* 	chunk: the data to be written to stream
* 	encoding: if data is string, specifty the string encoding, like 'utf8'/ascii
* 	cb: callback gets called after provided the chunk of data gets flushed.
*/
Writable.prototype.write = function(chunk, encoding, cb) {
		var state = this._writableState;
		var ret = false;

		//handle write(chunk, cb) form
		if(typeof encoding === 'function'){
			cb = encoding;
			encoding = null;
		}

		//set encoding to proper type
		if(chunk instanceof Buffer){
			encoding = 'buffer';
		}else if(!encoding) {
			encoding = state.defaultEncoding;
		}

		//if callback is not provided, replace it with a do-nothing function.
		if(typeof cb !== 'function'){
			cb = nop;
		}

		if(state.ended){
			//when you call write after stream's ended.
			//an error will be emitted and callback gets called on by process.nextTick(cb, error) with error as first argument.
			writeAfterEnd(this, cb);
		}else if(validChunk(this, stream, chunk, cb)){
			//if stream's not ended and provided data chunk is valid.
			state.pendingcb++;
			//delegate write to writeOrBuffer function and return its returned value.
			ret = writeOrBuffer(this, state, chunk, encoding, cb);
		}

		return ret;
};

//method forces all written data to be buffered in memory. 
//The buffered data will be flushed when either the stream.uncork() or stream.end() methods are called.
Writable.prototype.cork = function() {
	var state = this._writableState;
	//default state is set to be 0(uncorked), which is false. Increment it sets it to true(corked).
	state.corked++;
};

//method flushes all data buffered since stream.cork() was called.
//If the writable.cork() method is called multiple times on a stream, the same number of calls to writable.uncork() must be called to flush the buffered data.
Writable.prototype.uncork = function() {
	var state = this._writableState;

	//when stream is corked
	if(state.corked){
		state.corked--;

		//when stream is not writing && not processing buffer && not finished && gets uncorked && has buffered data, then flush the data. 
		if(	!state.writing &&
			!state.corked &&
			!state.finished &&
			!state.bufferProcessing && 
			state.bufferedRequest){
			//flush all buffered data.
			clearBuffer(this, state);
		}
	}
};

//method sets the default encoding for invoked Writable stream instance. 
//method that is intended to be used by users of stream.
Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
	//node::ParseEncoding() requires lower case
	if(typeof encoding === 'string'){
		encoding = encoding.toLowerCase();
	}
	//if given encoding is invalid, throw an error.
	if(!Buffer.isEncoding(encoding)){
		throw new TypeError('Unknown encoding: ' + encoding);
	}
	//if everything' fine, change stream's defaultEncoding to given type in stream's state object.
	this._writableState.defaultEncoding = encoding;
	return this;
};

//decode given string into buffer obj if necessary
function decodeChunk(state, chunk, encoding) {
	var inObjectMode = state.objectMode;
	var ifdecodeStrings = state.decodeStrings;
	//decode data when we're not in object mode, decodeString is set to be true and given chunk are string type.
	//if given data match the criteria, decoding the data and return its buffer form. Otherwise do nothing to the data and return them.
	if(!inObjectMode && (ifdecodeStrings === true) && (typeof chunk === 'string')){
		chunk = Buffer.from(chunk, encoding);
	}
	return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
	//decode string into buffer if necessary
	chunk =decodeChunk(state, chunk, encoding);

	if(chunk instanceof Buffer){
		encoding = 'buffer';
	}

	//get current writing chunk's length
	var len = state.objectMode ? 1 : chunk.length;

	//add len to buffered data's total length
	state.length += len;

	//if current buffered data's length is smaller than configured highWaterMark, set returned result to true. Otherwise, set it to false.
	var ret = state.length < state.highWaterMark;

	// we must ensure that previous needDrain will not be reset to false.
	if(!ret){
		//if write() returns false, then set stream's needDrain flag to true.
		state.needDrain = true;
	}

	if(state.writing || state.corked){
		//if stream is writing or corked, then wrap incoming data in a WriteReq object and append it to the buffer chain.
		var last = state.lastBufferedRequest;
		state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);

		if(last){
			last.next = state.lastBufferedRequest;
		}else{
			state.bufferedRequest = state.lastBufferedRequest;
		}

		state.bufferedRequestCount += 1;
	} else {
		//otherwise, do the writing and push the data to underlying data sink.
		doWrite(stream, state, false, len, chunk, encoding, cb);
	}

	return ret; //return false when buffer.length >= hwm, true when buffer.length < hwm.
}

//this function performs writing and passes chunk to underlying dat sink by calling either _writev or _write.
function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	//length of the chunk that gets passed to the underlying data sink.
	state.writelen = len;
	//reference to the callback function for current writing phase.
	state.writecb = cb;
	//set writing to true to indicate we're in the middle of a writing phase.
	state.writing = true;
	state.sync = true;

	//push date to underlying data sink through _writev or _write functions.
	//underlying data sink would call state.onwrite callback and ask for more data if it has consumed current passed-in data.
	if(writev){
		stream._writev(chunk, state.onwrite);
	} else { 
		stream._write(chunk, encoding, state.onwrite);
	}
	//if _writev/_write performs asynchronously, then this line gets executed immediately after _writev/_write gets called.
	//then set flag to false to indicating that it's not working synchronously.
	state.sync = false;
}

//function gets called when there's an error occured in previous writing phase.
function onwriteError(stream, state, sync, err, cb) {
	//pending callback counter minus one because callback either gets called immediately or at next tick based on sync state.
	--state.pendingcb;
	if(sync){
		//if onwrite is called synchronously, then callback gets called in next tick.
		process.nextTick(cb, err);
	}else {
		//if onwrite is called asynchronously, then we can call callback immediately.
		cb(err);
	}
	//emit an error and change errorEmitted to true.
	stream._writableState.errorEmitted = true;
	stream.emit('error', err);
}

//when previous writing phase is over, update and clean up related flags and counters.
function onwriteStateUpdate(state) {
	//indicates the finish of previous writing phase
	state.writing = false;
	//clean up the refenerce for new writing phase
	state.writecb = null;
	//reomve previous chunk's length from the total buffer length
	state.length -= state.writelen;
	//clean up the counter for new writing phase
	state.writelen = 0;
}

//state.onwrite method would invoke this function to actually do the work.
//if there is failure in previous _writev/_write, then an error would be passed in.
//if no error, it indicates the previous chunk of data has been consumed successfully.
function onwrite(stream, error) {
	var state = stream._writableState;
	var sync = state.sync;  //current value indicates if this onwrite gets called synchronously or asynchronously.
	var cb = state.writecb; //preserve the reference to the callback of the previous chunk.

	onwriteStateUpdate(state);

	if(error){
		//if previous writing phase has error, then call onwriteError function to perform error related code.
		onwriteError(stream, state, sync, error, cb);
	}else {
		// Check if we're actually ready to finish, but don't emit yet
		var finished = needFinish(state);

		//if we're not ready to finish and not corked and not currently process any buffered data and stream has remaining buffered data.
		//then called clearBuffer function
		//in other words, it means we don't call clearBuffer function to pass data to underlying data sink when
		//1. stream's ready to finish 2. stream's currently corked 3. stream's currently processing buffered data 4. stream has no buffered data reamining.
		if(	!finished &&
			!state.corked &&
			!state.bufferProcessing &&
			state.bufferedRequest){
			clearBuffer(stream, state);
		}

		if(sync){
			//if onwrite gets call synchronously, then call afterWrite in next tick
			process.nextTick(afterWrite, stream, state, finished, cb);
		}else {
			//if onwrite gets call asynchronously, then call afterWrite immediately
			afterWrite(stream, state, finished, cb);
		}
	}
}

//function afterWrite gets called to perform the callback for the previous writing phase.
function afterWrite(stream, state, finished, cb) {
	if(!finished){
		//call onwriteDrain to see if it's necessary to emit a 'drain' event.
		onwriteDrain(stream, state);
	}
	//call the callback provided from the previous writing phase and decrement the counter for pending callbacks.
	state.pendingcb--;
	cb();
	//cehck possibility for emitting a 'finish' event
	finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
	//if internal buffer is empty and needDrain flag is set to be true.
	if(state.length === 0 && state.needDrain){
		//clear the flag and emit the 'drain' event.
		state.needDrain = false;
		stream.emit('drain');
	}
}

//
function clearBuffer(stream, state) {
	//start buffer processing phase, mark related flag to true
	state.bufferProcessing = true;
	//set the starting point as the head of buffer chain
	//every entry is a WriteReq wrapper objext that wraps chunk, encoding, callback and reference to next WriteReq/null
	var entry = state.bufferedRequest;

	//if uf _writev provided and buffer.length > 1, then we can pass an array of buffered data to underlying data sink. Otherwise, we use _write to consume one chunk at one time.
	if(stream._writev && entry && entry.next){
		// Fast case, pass everything remained in interanl buffer as an array to _writev()
		var l = state.bufferedRequestCount;
		var buffer = new Array(l);
		var holder = state.corkedRequestsFree;
		holder.entry = entry;

		var count = 0;
		while(entry){
			buffer[count] = entry;
			entry = entry.next;
			count++;
		}

		//call doWrite to enter a new writing phase. 
		//Now cb(holder.finish) is a wrapper function that's going to invoke all callbacks for buffered chunks one by one.
		doWrite(stream, state, true, state.length, buffer, '', holder.finish);
		//count holder.finish as a pending callback
		state.pendingcb++;
		state.lastBufferedRequest = null;

		if(holder.next){
			state.corkedRequestsFree = holder.next;
			holder.next = null;
		} else {
			state.corkedRequestsFree = new CorkedRequest(state);
		}
	}else {
		//slow case, write chunks one by one by using _write()
		while(entry){
			var chunk = entry.chunk;
			var encoding = entry.encoding;
			var cb = entry.callback;
			var len = state.objectMode ? 1 : chunk.length;

			//call doWrite to enter a new writing phase. 
			//because we are in the middle of buffer processing, so next time to onwrite won't call clearBuffer function, otherwise we're going to have an infinite loop. 
			doWrite(stream, state, false, len, chunk, encoding, cb);
			entry = entry.next;
			if(state.writing){
				break;
			}
		}

		if(entry === null){
			state.lastBufferedRequest = null;
		}
	}

	state.bufferedRequestCount = 0;
	state.bufferedRequest = entry;
	state.bufferProcessing = false;
}



Writable.prototype._write = function(chunk, encoding, cb) {
	cb(new Error('_write() method is not implemented'));
};

Writable.prototype._writev = null;

//optionally send last piece of data and indicate that no more incoming data to this stream. 
Writable.prototype.end = function(chunk, encoding, cb) {
	var state = this._writableState;

	if(typeof chunk === 'function'){
	//handle .end(cb) form
		cb = chunk;
		chunk = null;
		encoding = null;
	}else if(typeof encoding === 'function'){
	//handle .end(chunk, cb) form
		cb = encoding; 
		encoding = null;		
	}

	//if there is chunk to be written to the stream, call write() method to write the data. 
	if(chunk !== null && chunk !== undefined){
		this.write(chunk, encoding);
	}

	// .end() fully uncorks
	// if stream is corked, call end will uncork it and flush all the buffered data.
	if(state.corked){
		state.corked = 1;
		this.uncork();
	}

	//call endWritable to perform end related jobs
	if(!state.ending && !state.finished){
		endWritable(this, state, cb);
	}
};

//return true when stream is not writing, on it way to ending and no buffered data reamin in stream but stream is not set to finished.
function needFinish(state) {
	return (state.ending &&
			state.length === 0 &&
			state.bufferedRequest === null &&
			!state.finished &&
			!state.writing);
}

function prefinish(stream, state) {
	if(!state.prefinish){
		state.prefinish = true;
		stream.emit('prefinish');
	}
}

function finishMaybe(stream, state) {
	var need = needFinish(state);
	if(need){
		if(state.pendingcb === 0){
			prefinish(stream, state);
			state.finished = true;
			stream.emit('finish');
		}else {
			prefinish(stream, state);
		}
	}
	return need;
}

//
function endWritable(stream, state, cb) {
	state.ending = true;
	finishMaybe(stream, state);
	if(cb){
		//if stream is finished, then it's already emitted the 'finish' event
		if(state.finished){
			process.nextTick(cb);
		}else {
			//if 'finish' event hasn't been emitted, then register cb as once listener to 'finish' event.
			stream.once('finish', cb);
		}
	}
	state.ended = true;
	stream.writable = false;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
// used to invoke all callbacks of chunks when internal buffer gets clear.
function CorkedRequest(state) {
	this.next = null;
	this.entry = null;

	//wrap invocation of all callbacks of previous chunks in one function.
	this.finish = (err) => {
		var entry = this.entry;
		this.entry = null;
		while(entry){
			var cb = entry.callback;
			state.pendingcb--;
			cb(err);
			entry = entry.next;
		}
		if(state.corkedRequestsFree){
			state.corkedRequestsFree.next = this;
		}else {
			state.corkedRequestsFree = this;
		}
	}
}



