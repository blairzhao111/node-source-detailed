// 'module' module

// If you feel like that the source code is TL;DR, then here is the deal:

// node.js module system follows CommonJS standard and specification.
// Which every script is considered as an individual module and exposes public objects/values through an export property of that module's module object. 
// All other stuff declared inside that module but not marked as export are considered to be private to the module.

// If you want to load some certain module, use global(more likely is in module-scope) 'require' method(it's in Module.prototype object) of a Module instance(which is the module you are working with)
// Once the module has initially been loaded, it'll get cached inside . So next time when you require it again. The same module instance would be returned. 

// The entire script/module will be executed and loaded in a Native Module Wrapper Function, this wrapper function gets invoked with five arguments
// They are following:
// 1. exports: the references to initial module.exports object, if you explicitly replace module.exports, then this reference is not valid anymore.
// 2. require: a wrapper function object that internally invokes module.require method for loading requested module. And it provides a proxy as require.cache to expose accessing to Module._cache object.
// 3. module: the module object of the module script that is going to be loaded in environment.
// 4. __filename: a variable that stores the absolute path of current file in your local file system. 
// 5. __dirname: a variable that stores the absolute path of directory that the file's located in your local file system. 

// Everytime when you use 'require' method and try to load a given module, node will try to check if there's any matches in a series of directories in cached paths.
// when require(X) from module at path Y
// 1. If X is a core module,
//    a. return the core module
//    b. STOP
// 2. If X begins with './' or '/' or '../'
//    a. LOAD_AS_FILE(Y + X)
//    b. LOAD_AS_DIRECTORY(Y + X)
// 3. LOAD_NODE_MODULES(X, dirname(Y))
// 4. THROW "not found"

// LOAD_AS_FILE(X)
// 1. If X is a file, load X as JavaScript text.  STOP
// 2. If X.js is a file, load X.js as JavaScript text.  STOP
// 3. If X.json is a file, parse X.json to a JavaScript Object.  STOP
// 4. If X.node is a file, load X.node as binary addon.  STOP

// LOAD_AS_DIRECTORY(X)
// 1. If X/package.json is a file,
//    a. Parse X/package.json, and look for "main" field.
//    b. let M = X + (json main field)
//    c. LOAD_AS_FILE(M)
// 2. If X/index.js is a file, load X/index.js as JavaScript text.  STOP
// 3. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
// 4. If X/index.node is a file, load X/index.node as binary addon.  STOP

// More details about loading a given module:
// In general speaking, every time when a given module is requested through 'require' method, it'll goes through the following steps:
// 1. Call to the wrapper 'require' function and also pass module's name/path, wrapper function internally invokes module.require method.
// 2. Then, module.require method checks if name/path is valid string and calls module._load method.
// 3. _load method gets absolute path of requested module as filename and try to do following three thing:
//     a) Check if module has been loaded before and cached in Module._cache. If it did, return its exports property.
//     b) Check if module is a native module. If it is, then load the native module and return.
//     c) Create a new Module instance and cache it into Module._cache with filename as key. Then call tryModuleLoad function to actually load the module. If successful, return module's exports property. 
// 4. tryModuleLoad function tries to load module by calling module.load method. If loading is failed, delete filename/module pair from Module._cache object.
// 5. module.load method adds filename and paths peoperties to the module object and set proper extension to the requested filename. Then, try to invoke Module._extensions[extension] function.
// 6. By default, Module._extensions[extension] could have three possible function invocations, they are:
//     a) If the extension is '.js', then try to load the file from file system using synchronous bulk read file method, after loading, try to compile it.
//     b) If the extension is '.json', then read the file from file system and try to parse the JSON file. If error occurs, throw error.
//     c) If the extension is '.node', then use system's dlopen function to load the dynamic library file.
// 7. In module._compile method, requested file is loaded and run along with necessary arguments by using methods from 'vm' module(V8 engine's API). 

'use strict';

//module dependencies 
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

// A common practice is not directly using any methods inherited from Object.prototype
// There are some small chances that they would be overriden.
// Best way is to use them in call/apply form or wrap them as bound functions.
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
// 1. id: denoted by script's absolute path(filename), the main module would be set to '.'
// 2. exports: an object stores all module's exporting values, could be overridden to any value, like another object/function/any primitive values.
// 3. parent: refernce to the parent module that loads the current one
// 4. filename: an absolute path of current module file/script in file system
// 5. loaded: a flag indicates whether current module is loaded by some other module
// 6. children: an array of modules that get loaded by the current module
// 7. paths: an array of paths for modules lookup.
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

//entire script exports this Module constructor
module.exports = Module;


//properties of Module constructor function object:

// Object used to cache all loaded modules objects, modules are cached as filename/module object pairs.
// If the module gets required first time, it would be loaded and run, and then a module object gets created and stored in this Module._cache object.
// When next time this module gets required, node would return the export property of the cached module object in Module._cache instead of reloading it.
// This's like the Singleton Pattern, only one module object exists all the time except you do something.
// If you need to load a brand new module object whenever you require it. You need to explicitly delete the previous cached one before you require the module.
Module._cache = {};

//object used to cache all paths that are the possible location for required module
Module._pathCache = {};

//object used to store all valid extensions, by default, there are three: '.js'/'.json'/'.node'
Module._extensions = {};

//paths that indicates the search directories for a given requested module/script
var modulePaths = [];
Module.globalPaths = [];

//native wrapper functions
Module.wrapper = NativeModule.wrapper;
Module.wrap = NativeModule.wrap;

//debug utility
Module._debug = util.debuglog('module');

// We use this alias for the preprocessor that filters it out
const debug = Module._debug;

// given a module name, and a list of paths to test, returns the first
// matching file in the following precedence.
//
// require("a.<ext>")
//   -> a.<ext>
//
// require("a")
//   -> a
//   -> a.<ext>
//   -> a/index.<ext>

//check if the directory is a package.json directory
const packageMainCache = {};

//what this function does is bascially go and try to locate the package.json file, if it exists, then return its 'main' property value.
function readPackage(requestPath) {
	//if it's already got cached, simply return it from the cache.
	if(hasOwnProperty(packageMainCache, requestPath)){
		return packageMainCache[requestPath];
	}

	//builds path to package.json file in the directroy and try to read that package.json file into memory
	const jsonPath = path.resolve(requestPath, 'package.json');
	const json = internalModuleReadFile(path._makeLong(jsonPath));

	//no package.json is found in the directory, simply return false
	if(json === undefined){
		return false;
	}

	//if there's a package.json, then try to parse it and return its main property, which indicates the main entry file of entire module.
	try {
		var pkg = packageMainCache[requestPath] = JSON.parse(json).main;
	} catch(e) {
		e.path = jsonPath;
		e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
    	throw e;
	}

	//if all okay, then return the value of that 'main' property in package.json file, which indicates the 
	return pkg;
}

//what this function does is to try to get the entry file name, then try to load that file without/with extensions.
function tryPackage(requestPath, exts, isMain) {
	var pkg = readPackage(requestPath);

	if(!pkg){
		return false;
	}

	var filename = path.resolve(requestPath, pkg);

	return tryFile(filename, isMain) || tryExtensions(filename, exts, isMain) || tryExtensions(path.resolve(filename, 'index'), exts, isMain);
}

// check if the file exists and is not a directory
// if using --preserve-symlinks and isMain is false,
// keep symlinks intact, otherwise resolve to the
// absolute realpath.
function tryFile(requestPath, isMain) {
	const rc = stat(requestPath);

	if(preserveSymlinks && !isMain){
		return rc === 0 && path.resolve(requestPath);
	}

	return rc === 0 && fs.realpathSync(requestPath);
}

// given a path check a the file exists with any of the set extensions
function tryExtensions(p, exts, isMain) {
	//try all extensions in extension pool, normally including '.js'/'.json'/'.node'
	for(var i = 0; i < exts.length; i++) {
		const filename = tryFile(p + exts[i], isMain);

		if(filename){
			return filename;
		}
	}

	return false;
}

var warned = false;
Module._findPath = function(request, paths, isMain) {
	if(path.isAbsolute(request)){
		paths = [''];
	} else if(!paths || paths.length === 0) {
		return false;
	}

	const cacheKey = JSON.stringify({request: request, paths: paths});
	if(Module._pathCache[cacheKey]){
		return Module._pathCache[cacheKey];
	}

	var exts;
	const trailingSlash = request.length > 0 && request.charCodeAt(request.length - 1) === 47; /*/*/

	//For each path
	for(var i = 0; i < paths.length; i++){
		// Don't search further if path doesn't exist
		const currentPath = paths[i];

		if(currentPath && stat(currentPath) < 1) continue;

		var basePath = path.resolve(currentPath, request);
		var filename;

		if(!trailingSlash){
			const rc = stat(basePath);
			if(rc === 0){ // File
				if(preserveSymlinks && !isMain){
					filename = path.resolve(basePath);
				} else {
					filename = fs.realpathSync(basePath);
				}
			} else if(rc === 1) { // Directory
				if(exts === undefined){
					exts = Object.keys(Module._extensions);
					filename = tryPackage(basePath, exts, isMain);
				}
			}

			if(!filename){
				//try it with each of the extensions
				if(exts === undefined){
					exts = Object.keys(Module._extensions);
					filename = tryExtensions(basePath, exts, isMain);
				}
			}
		}

	    if (!filename) {
	      if (exts === undefined)
	        exts = Object.keys(Module._extensions);
	      filename = tryPackage(basePath, exts, isMain);
	    }

	    if (!filename) {
	      // try it with each of the extensions at "index"
	      if (exts === undefined)
	        exts = Object.keys(Module._extensions);
	      filename = tryExtensions(path.resolve(basePath, 'index'), exts, isMain);
	    }

	    if (filename) {
	      // Warn once if '.' resolved outside the module dir
	      if (request === '.' && i > 0) {
	        warned = internalUtil.printDeprecationMessage(
	          'warning: require(\'.\') resolved outside the package ' +
	          'directory. This functionality is deprecated and will be removed ' +
	          'soon.', warned);
	    }

	    Module._pathCache[cacheKey] = filename;
	    return filename;
	}

	return false;
};

// 'node_modules' character codes reversed
var nmChars = [ 115, 101, 108, 117, 100, 111, 109, 95, 101, 100, 111, 110 ];
var nmLen = nmChars.length;
if (process.platform === 'win32') {
  // 'from' is the __dirname of the module.
  Module._nodeModulePaths = function(from) {
    // guarantee that 'from' is absolute.
    from = path.resolve(from);

    // note: this approach *only* works when the path is guaranteed
    // to be absolute.  Doing a fully-edge-case-correct path.split
    // that works on both Windows and Posix is non-trivial.

    // return root node_modules when path is 'D:\\'.
    // path.resolve will make sure from.length >=3 in Windows.
    if (from.charCodeAt(from.length - 1) === 92/*\*/ &&
        from.charCodeAt(from.length - 2) === 58/*:*/)
      return [from + 'node_modules'];

    const paths = [];
    var p = 0;
    var last = from.length;
    for (var i = from.length - 1; i >= 0; --i) {
      const code = from.charCodeAt(i);
      // The path segment separator check ('\' and '/') was used to get
      // node_modules path for every path segment.
      // Use colon as an extra condition since we can get node_modules
      // path for dirver root like 'C:\node_modules' and don't need to
      // parse driver name.
      if (code === 92/*\*/ || code === 47/*/*/ || code === 58/*:*/) {
        if (p !== nmLen)
          paths.push(from.slice(0, last) + '\\node_modules');
        last = i;
        p = 0;
      } else if (p !== -1) {
        if (nmChars[p] === code) {
          ++p;
        } else {
          p = -1;
        }
      }
    }

    return paths;
  };
} else { // posix
  // 'from' is the __dirname of the module.
  Module._nodeModulePaths = function(from) {
    // guarantee that 'from' is absolute.
    from = path.resolve(from);
    // Return early not only to avoid unnecessary work, but to *avoid* returning
    // an array of two items for a root: [ '//node_modules', '/node_modules' ]
    if (from === '/')
      return ['/node_modules'];

    // note: this approach *only* works when the path is guaranteed
    // to be absolute.  Doing a fully-edge-case-correct path.split
    // that works on both Windows and Posix is non-trivial.
    const paths = [];
    var p = 0;
    var last = from.length;
    for (var i = from.length - 1; i >= 0; --i) {
      const code = from.charCodeAt(i);
      if (code === 47/*/*/) {
        if (p !== nmLen)
          paths.push(from.slice(0, last) + '/node_modules');
        last = i;
        p = 0;
      } else if (p !== -1) {
        if (nmChars[p] === code) {
          ++p;
        } else {
          p = -1;
        }
      }
    }

    // Append /node_modules to handle root paths.
    paths.push('/node_modules');

    return paths;
  };
}


// 'index.' character codes
var indexChars = [ 105, 110, 100, 101, 120, 46 ];
var indexLen = indexChars.length;
Module._resolveLookupPaths = function(request, parent) {
  if (NativeModule.nonInternalExists(request)) {
    return [request, []];
  }

  var reqLen = request.length;
  // Check for relative path
  if (reqLen < 2 ||
      request.charCodeAt(0) !== 46/*.*/ ||
      (request.charCodeAt(1) !== 46/*.*/ &&
       request.charCodeAt(1) !== 47/*/*/)) {
    var paths = modulePaths;
    if (parent) {
      if (!parent.paths)
        paths = parent.paths = [];
      else
        paths = parent.paths.concat(paths);
    }

    // Maintain backwards compat with certain broken uses of require('.')
    // by putting the module's directory in front of the lookup paths.
    if (request === '.') {
      if (parent && parent.filename) {
        paths.unshift(path.dirname(parent.filename));
      } else {
        paths.unshift(path.resolve(request));
      }
    }

    return [request, paths];
  }

  // with --eval, parent.id is not set and parent.filename is null
  if (!parent || !parent.id || !parent.filename) {
    // make require('./path/to/foo') work - normally the path is taken
    // from realpath(__filename) but with eval there is no filename
    var mainPaths = ['.'].concat(Module._nodeModulePaths('.'), modulePaths);
    return [request, mainPaths];
  }

  // Is the parent an index module?
  // We can assume the parent has a valid extension,
  // as it already has been accepted as a module.
  const base = path.basename(parent.filename);
  var parentIdPath;
  if (base.length > indexLen) {
    var i = 0;
    for (; i < indexLen; ++i) {
      if (indexChars[i] !== base.charCodeAt(i))
        break;
    }
    if (i === indexLen) {
      // We matched 'index.', let's validate the rest
      for (; i < base.length; ++i) {
        const code = base.charCodeAt(i);
        if (code !== 95/*_*/ &&
            (code < 48/*0*/ || code > 57/*9*/) &&
            (code < 65/*A*/ || code > 90/*Z*/) &&
            (code < 97/*a*/ || code > 122/*z*/))
          break;
      }
      if (i === base.length) {
        // Is an index module
        parentIdPath = parent.id;
      } else {
        // Not an index module
        parentIdPath = path.dirname(parent.id);
      }
    } else {
      // Not an index module
      parentIdPath = path.dirname(parent.id);
    }
  } else {
    // Not an index module
    parentIdPath = path.dirname(parent.id);
  }
  var id = path.resolve(parentIdPath, request);

  // make sure require('./path') and require('path') get distinct ids, even
  // when called from the toplevel js file
  if (parentIdPath === '.' && id.indexOf('/') === -1) {
    id = './' + id;
  }

  debug('RELATIVE: requested: %s set ID to: %s from %s', request, id,
        parent.id);

  return [id, [path.dirname(parent.filename)]];
};

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

// Resolved path to process.argv[1] will be lazily placed here
// (needed for setting breakpoint when called with --debug-brk)
var resolvedArgv;

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

	// create wrapper function
	var wrapper = Module.wrap(content);

	//use 'v8' to create a compiled wrapper
	var compiledWrapper = vm.runInThisContext(wrapper, {
		filename: filename,
		lineOffset: 0,
		displayErrors: true
	});

	if(process._debugWaitConnect){
		if(!resolvedArgv){
			// we enter the repl if we're not given a filename argument.
			if (process.argv[1]) {
			resolvedArgv = Module._resolveFilename(process.argv[1], null);
			} else {
			resolvedArgv = 'repl';
			}			
		}

		// Set breakpoint on module start
		if(filename === resolvedArgv){
			delete process._debugWaitConnect;
			const Debug = vm.runInThisContext('Debug');
			Debug.setBreakPoint(compiledWrapper, 0, 0);
		}
	}

	var dirname = path.dirname(filename);

	var require = internalModule.makeRequestFunction.call(this);

	//for every module, there are five arguments that get exposed to wrapper function.
	var args = [this.exports, require, this, filename, dirname];

	var depth = internalModule.requireDepth;
	if(depth === 0)	stat.cache = new Map();
	var result = compiledWrapper.apply(this.exports, args);
	if(depth === 0) stat.cache = null;
	return result;
};


//method from loading the main module from the command line and start executions
Module.runMain = function() {
	// load the main module from command line argument
	// pass filename, set parent reference to null and mark isMain to true
	Module._load(process.argv[1], null, true);
	// Handle any nextTicks added in the first tick of the program
	process._tickCallback();
}

//add some initial paths into node module search path options
Module._initPaths = function() {
	//check if running environment's OS is windows
	const isWindows = process.platform === 'win32';

	//get user's home directory
	//in window platform, this could be accessed through environment variable, USERPROFILE
	//in unix-like platform, this could be accessed through environment variable, HOME
	var homeDir;
	if(isWindows){
		homeDir = process.env.USERPROFILE;
	} else {
		homeDir = process.env.HOME;
	}


	var paths = [path.resolve(process.execPath, '..', '..', 'lib', 'node')];

	//add paths to homeDir/.node_libraries and homeDir/.node_modules into search path array.
	if(homeDir){
		paths.unshift(path.resolve(homeDir, '.node_libraries'));
		paths.unshift(path.resolve(homeDir, '.node_modules'));
	}

	//split the node path env variable and add all valid paths into search path array.
	var nodePath = process.env['NODE_PATH'];
	if(nodePath){
		paths = nodePath.split(path.delimiter).filter(function(path){
			return !!path;
		}).concat(paths);
	}

	//set modulePaths variable to search path array
	modulePaths = paths;


  	// clone as a read-only copy, for introspection.
  	Module.globalPaths = modulePaths.slice(0);
};

Module._preloadModules = function(requests) {
	if(!Array.isArray(requests)){
		return;
	}

	// Preloaded modules have a dummy parent module which is deemed to exist
	// in the current working directory. This seeds the search path for
	// preloaded modules.
	var parent = new Module('internal/preload', null);

	try {
		parent.paths = Module._nodeModulePaths(process.cwd());
	} cache(e) {
		if(e.code !== 'ENOENT'){
			throw e;
		}
	}

	//require modules in requested list one by one
	requests.forEach(function(request) {
		parent.require(request);
	});
};

//invoke _initPaths to load all initial search paths into module system
Module._initPaths();

// backwards compatibility
Module.Module = Module;