//"Stream.Transform" module

'use strict';

module.exports = Transform;

const Duplex = require('_stream_deuplex');
const util = require('util'); 

//Transform stream is inherited from Duplex stream.
util.inherits(Transform, Duplex);

//Constructor for state object of Transform stream.
function TransformState(stream) {
	//the callback that passes to _transform
	//gets called when data chunk is finished transformation and ready to be read out.
	this.afterTransform = function(error, data){
		return afterTransform(stream, error, data);
	};

	//flags and references:
	//flag that indicates we need transform chunk of data.
	this.needTransform = false;
	//flag that indicates if stream's in the middle of a transformation.
	this.Transforming = false;
	//reference to callback function in _write
	this.writecb = null;
	//reference to chunk got passed to _write
	this.writechunk = null;
	//store the encoding of chunk passed to _write
	this.writeencoding = null;
}

//function that gets executed when callback in _transform is invoked.
//that callback calls this function and propagate any error or data.
//_write's callback would be called either cb() or cb(error) to pull the next round of chunk.
function afterTransform(stream, error, data) {
	var ts = stream._transformState;
	//mark the current tranmation phase is over. Not in the middle of a transformation.
	ts.Transforming = false;
	//reference to the callback of _write
	var cb = ts.writecb;

	if(!cb){
		return stream.emit('error', new Error('no writecb in Transform class'));		
	}

	//because previous transformation phase is over, clean cached chunk and encoding.
	ts.writechunk = null;
	ts.writeencoding = null;

	//if there are transformed data, pass them to the Readable side.
	if(data !== null && data !== undefined){
		stream.push(data);
	}

	//invoke callback of _write to pull chunk from Writable.
	cb(error);

	var rs = stream._readableState;
	rs.reading = false;
	if(rs.needReadable || rs.length < rs.highWaterMark){
		stream._read(rs.highWaterMark);
	}
}

//Transform stream Constructor
function Transform(options) {
	if(!(this instanceof Transform)){
		return new Transform(options);
	}

	Duplex.call(options);

	//state of this Transform stream is handled by a TransformState object.
	this._transformState = new TransformState(this);

	var stream = this;

	this._readableState.needReadable = true;

	this._readableState.sync = false;

	if(options){
		if(typeof options.transform === 'function'){
			this._transform = options.transform;
		}

		if(typeof options.flush === 'function'){
			this._flush = options.flush;
		}
	}

	//attach one -time listener to stream and listen on 'prefinish' evernt issued by its Writable part.
	//when Writable part is going to end, call done() to signal the Readable part.
	this.once('prefinish', function() {
		if(typeof this._flush === 'function'){
			this._flush(function(err, data) {
				done(stream, err, data);
			});
		}else{
			done(stream);
		}
	});
}

//method that passes transformed data to Readable side. You may call 'push' zero or more times.
//under the hood, it simply calls Readable.push() to push data into Readable side.
Transform.prototype.push = function(chunk, encoding) {
	this._transformState.needTransform = false;
	//push to readable part's buffer
	return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.

// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.

// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.

//default implementation would throw you an error to indicate that implementers should override this function. 
Transform.prototype._transform = function(chunk, encoding, cb) {
	throw new Error('Not implemented');
};

//stream's Writable side 
Transform.prototype._write = function(chunk, encoding, cb) {
	var ts = this._transformState;

	//cache the chunk, encoding and reference to callback for further usage.
	ts.writecb = cb;
	ts.writechunk = chunk;
	ts.writeencoding = encoding;

	if(!ts.transforming){
		var rs = this._readableState;
		if(ts.needTransform || ts.needReadable || rs.length < rs.highWaterMark){
			//when necessary, call _read to start transformation and push transformed data into readable side.
			this._read(rs.highWaterMark);
		}
	}
};

// stream's Readable side
// Doesn't matter what the args are here.
// delegate _transform to do all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
	var ts = this._transformState;

	//if there is incoming data and we're not in the middle of transformation, then
	if(ts.writechunk !== null && ts.writecb && !ts.Transforming){
		//mark a new transformation phase starts
		ts.Transforming = true;
		//call the overridden _transform function to perform data manipulation
		this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
	}else{
	    // mark that we need a transform, so that any data that comes in
	    // will get processed, now that we've asked for it.
		ts.needTransform = true;
	}
};

function done(stream, err, data) {
	if(err){
		return stream.emit('error', err);
	}

	if(data !== null && data !== undefined){
		stream.push(data);
	}

	// check state and end Readable part 
	// if there's nothing in the write buffer, then that means
	// that nothing more will ever be provided
	var ws = stream._writableState;
	var ts = stream._transformState;

	if(ws.length){
		throw new Error('Calling transform done when ws.length != 0');
	}

	if(ts.transforming){
		throw new Error('Calling transform done when still transforming');
	}

	//signal the Readable part that there is no more incoming data.
	return stream.push(null);
}