'use strict';

const NativeModule = require('native_module');
const util = require('util');
const internalModule = require('internal/module');
const internalUtil = require('internal/util');
const vm = require('vm');
const assert = require('assert').ok;
const fs = require('fs');
const path = require('path');
const internalModuleReadFile = process.binding('fs').internalModuleReadFile;
const internalModuleStat = process.binding('fs').internalModuleStat;
const preserveSymlinks = !!process.binding('config').preserveSymlinks;

// A helper function for isolating hasOwnProperty from Object.prototype
// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
function hasOwnProperty(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

function stat(filename) {
	filename = path._makeLong(filename);
	const cache = stat.cache;
	if(cache !== null){
		const result = cache.get(filename);
		if(result !== undefined){return result;}
	}
	const result = internalModule(filename);
	if(cache !== null){
		cache.set(filename, result);
	}
	return result;
}
stat.cache = null;

// Module Constructor
// Evert module instance has following properties:
// 1. id: denoted by script's absolute path(filename) 
// 2. exports: an object stores all module exports, could be overridden to any value
// 3. parent: refernce to the module that loads current one
// 4. filename: an absolute path of module file/script in file system
// 5. loaded: a flag indicates whether current module is loaded from some other module
// 6. children: an array of modules that get loaded by the current module
function Module(id, parent) {
	this.id = id;
	this.exports = {};
	this.parent = parent;
	if(parent && parent.children){
		parent.children.push(this);
	}

	this.filename = null;
	this.loaded = false;
	this.children = [];
}

module.exports = Module;

//object used to cache all loaded modules objects, modules are cached as filename/module obj pairs.
Module._cache = {};
//object used to
Module._pathCache = {};
//object used to store all valid extensions
Module._extensions = {};
var modulePaths = [];
Module.globalPaths = [];

Module.wrapper = NativeModule.wrapper;
Module.wrap = NativeModule.wrap;
Module._debug = util.debuglog('module');

const debug = Module._debug;

// Check the cache for the requested file.
// 1. If a module already exists in the cache: return its exports object.
// 2. If the module is native: call `NativeModule.require()` with the
//    filename and return the result.
// 3. Otherwise, create a new module for the file and save it to the cache.
//    Then have it load  the file contents before returning its exports
//    object.
Module._load = function(request, parent, isMain) {
	if(parent){
		debug('Module._load REQUEST %s parent: %s', request, parent.id);
	}

	//get requested module's absolute path
	var filename = Module._resolveFilename(request, parent, isMain);

	//check if requested module has been requested and cached in Module._cache object. If it has, then simply return module's exports object.
	var cachedModule = Module._cache[filename];
	if(cachedModule){
		return cachedModule.exports;
	}

	//check if requested module is a native module
	if(NativeModule.nonInternalExists(filename)){
	    debug('load native module %s', request);
	    return NativeModule.require(filename);
	}

	//if requested module has not been required before and also not a native module
	//simply create a new module and add it the the Module._cache object.
	var module = new Module(filename, parent);

	//if current module is the main module, then set the mainModule property of process object reference to main module
	//also reset main module id to '.'
	if(isMain){
		process.mainModule = module;
		module.id = '.';
	}
	//cache the new created module in Module._cache object.
	Module._cache[filename] = module;
	
	//try to load the module and return its exports object.
	tryModuleLoad(module, filename);

	return module.exports;
};

//function that tries to load the file with given filename 
function tryModuleLoad(module, filename) {
	var threw = true;
	try {
		//try to load given file 
		module.load(filename);
		threw = false;
	} finally {
		//if loading is failed, then delete this module from Module_cache object.
		if(threw){
			delete Module._cache[filename];
		}
	}
}

//
Module._resolveFilename = function(request, parent, isMain) {
	if(NativeModule.nonInternalExists(request)) {
		return request;
	}

	var resolvedModule = Module._resolveLookupPaths(request, parent);	
	var id = resolvedModule[0];
	var paths = resolvedModule[1];

	debug('looking for %j in %j', id, paths);

	var filename = Module._findPath(request, paths, isMain);
	if(!filename){
		var err = new Error("Cannot find module '" + request + "'");
		err.code = 'MODULE_NOT_FOUND';
		throw err;
	}
	return filename;
};

// Given a file name, pass it to the proper extension handler.
Module.prototype.load = function(filename) {
	debug('load %j for module %j', filename, this.id);

	assert(!this.loaded);
	this.filename = filename;
	this.paths = Module._nodeModulePaths(path.dirname(filename));

	//if given filename has extension, use it. Otherwise, use '.js' as default.
	var extension = path.extname(filename) || '.js';
	//if given extension is not a valid extemsion, then set extension to default '.js'.
	if(!Module._extensions[extension]){
		extension = '.js';
	}

	Module._extensions[extension](this, filename);
	//mark this module as loaded
	this.loaded = true;
};

// Loads a module at the given file path. 
// Returns that module's 'exports' property.
Module.prototype.require = function(path) {
	assert(path, 'missing path');
	assert(typeof path === 'string', 'path must be a string');
	return Module._load(path, this, false);
};

// Native extension for .js
Module._extensions['.js'] = function(module, filename) {
	//synchronously load the file with given filename and compile it.
	var content = fs.readFileSync(filename, 'utf8');
	module._compile(internalModule.stripBOM(content), filename);
};

// Native extension for .json
Module._extensions['.json'] = function(module, filename) {
	var content = fs.readFileSync(filename, 'utf8');
	try {
		module.exports = JSON.parse(internalModule.stripBOM(content));
	} catch (err) {
		err.message = filename + ':' + err.message;
		throw err;
	}
};

//Native extension for .node
Module._extensions['.node'] = function(module, filename) {
	return process.dlopen(module, path._makeLong(filename));
};

//method from loading the main module from the command line and start executions
Module.runMain = function() {
	// load the main module from command line argument
	// pass filename, set parent reference to null and mark isMain to true
	Module._load(process.argv[1], null, true);
	// Handle any nextTicks added in the first tick of the program
	process._tickCallback();
}

// Run the file contents in the correct scope or sandbox.
// Expose the correct helper variables (require, module, exports) to the file
// Return exception, if any.
Module.prototype._compile = function(content, filename) {
	var contLen = content.length;
	if(contLen >= 2) {
		if(content.charCodeAt(0) === 35 && content.charCodeAt(1) === 35) {
			if(contLen === 2){
				//Exact match
				content = '';
			}else {
				//Find end of shebang line and slice it off
				var i = 2;
				for(; i < contLen; ++i){
					var code = content.charCodeAt(i);
					//when characters are CR(\r) and LF(\n).
					if(code === 10 || code === 13){
						break;
					}
					if (i === contLen) content = '';
					else {
			          // Note that this actually includes the newline character(s) in the
			          // new output. This duplicates the behavior of the regular expression
			          // that was previously used to replace the shebang line
						content = content.slice(i);
					}
				}
			}
		}
	}
};

// backwards compatibility
Module.Module = Module;