// 'tty' module
// which represents your system's terminal
// 'tty' module has two subtypes: tty.ReadStream and tty.WriteStream, they are both inherited from net.Socket. 
// when node is running in terminal, it sets process.stdin as an instance of ReadStream that wraps upon system standard input,
// process.stdout and process.stderr as instances of WriteStream that wrap upon standard output and standard error.
// 'tty' module normally is used internally as mentioned before, user typically won't require this module and create instances of tty.ReadStream and tty.WriteStream.

'use strict';

const util = require('util');
const net = require('net');
const TTY = process.binding('tty_wrap').TTY;
const isTTY = process.binding('tty_wrap').isTTY;
const inherits = util.inherits;
const errnoException = util._errnoException;

// The tty.isatty() method returns true if the given fd is associated with a TTY and false if is not.
// fd <number> A numeric file descriptor
exports.isatty = function(fd) {
	return isTTY(fd);
};

//Constructor of tty.ReadStream
function ReadStream(fd, options) {
	if(!(this instanceof ReadStream)) {
		return new ReadStream(fd, options);
	}

	// use util._extend function to merge all own and enumerable properties of options and custom object's properties. 
	// in this case, we don't need to set options default or check if options is an object. 
	// Becasue if the second argument of util._extend is not an object. Then, function simply returns first argument and does nothing.
	options = util._extend({
		highWaterMark: 0,
		readable: true,
		writable: false,
		handle: new TTY(fd, true);
	}, options);

	// tty.ReadStream is inherited from net.Socket
	net.Socket.call(this);

	// by default, tty.ReadStream is not configured to operate as a raw device.
	this.isRaw = false;
	this.isTTY = true;
}

// hook up the inhertance chain.
inherits(ReadStream, net.Socket);

exports.ReadStream = ReadStream;

// tty.ReadStream has one method that's used to configure the stream to operate as a raw device.
ReadStream.prototype.setRawMode = function(flag) {
	//convert to boolean value
	flag = !!flag;

	//set actual wrapped tty to Raw Mode and set flag in ReadStream.
	this._handle.setRawMode(flag);

	this.isRaw = flag;
};


//Constructor of tty.WriteStream 
function WriteStream(fd) {
	if(!(this instanceof WriteStream)) {
		return new WriteStream(fd);
	}

	// call supertype cosntructor with options object as argument
	net.Socket.call(this, {
		handle: new TTY(fd, false),
		readable: false,
		writable: true
	});

	// Prevents interleaved or dropped stdout/stderr output for terminals.
	// As noted in the following reference, local TTYs tend to be quite fast and
	// this behavior has become expected due historical functionality on OS X,
	// even though it was originally intended to change in v1.0.2 (Libuv 1.2.1).
	// Ref: https://github.com/nodejs/node/pull/1771#issuecomment-119351671
	this._handle.setBlocking(process.env.NODE_TTY_UNSAFE_ASYNC !== '1');

	var winSize = [];

	// get tty terminal window's size
	var err = this._handle.getWindowSize(winSize);

	// if there's no error then set the cols and rows properties of tty.WriteStream.
	if(!err) {
		this.columns = winSize[0];
		this.rows = winSize[1];
	}	
}

// hook up inheritance chain
inherits(WriteStream, net.Socket);

exports.WriteStream = WriteStream;

WriteStream.prototype.isTTY = true;

// if terminal window's size has changed, then update tty.WriteStream instance with new cols and rows.
WriteStream.prototype._refreshSize = function() {
	var oldCols = this.columns;
	var oldRows = this.rows;
	var winSize = [];
	var err = this._handle.getWindowSize(winSize);

	if(err) {
		this.emit('error', errnoException(err, 'getWindowSize'));
		return;
	}

	var newCols = winSize[0];
	var newRows = winSize[1];

	if(oldCols !== newCols || oldRows !== newRows) {
		this.columns = newCols;
		this.rows = newRows;
		this.emit('resize');
	}
};

// backwards-compat
WriteStream.prototype.cursorTo = function(x, y) {
  require('readline').cursorTo(this, x, y);
};
WriteStream.prototype.moveCursor = function(dx, dy) {
  require('readline').moveCursor(this, dx, dy);
};
WriteStream.prototype.clearLine = function(dir) {
  require('readline').clearLine(this, dir);
};
WriteStream.prototype.clearScreenDown = function() {
  require('readline').clearScreenDown(this);
};
WriteStream.prototype.getWindowSize = function() {
  return [this.columns, this.rows];
};