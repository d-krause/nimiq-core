var Module = function(Module) {
  Module = Module || {};
  var Module = Module;

// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function shell_read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }

  eval("if (typeof gc === 'function' && gc.toString().indexOf('[native code]') > 0) var gc = undefined"); // wipe out the SpiderMonkey shell 'gc' function, which can confuse closure (uses it as a minified name, and it is then initted to a non-falsey value unexpectedly)
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function shell_print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function shell_printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}
if (!Module['quit']) {
  Module['quit'] = function(status, toThrow) {
    throw toThrow;
  }
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    if (!func) return; // on null pointer, return undefined
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}




Runtime['addFunction'] = Runtime.addFunction;
Runtime['removeFunction'] = Runtime.removeFunction;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();



/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}


/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}


var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate






// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}


// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}


/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}


// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}


// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}


// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}


// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;



function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}


function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}


function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}


function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}


function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}


// Tools

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}


function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}


function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}


function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}


function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}


function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}


Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = Runtime.GLOBAL_BASE;

STATICTOP = STATIC_BASE + 40816;
/* global initializers */  __ATINIT__.push();


/* memory initializer */ allocate([8,201,188,243,103,230,9,106,59,167,202,132,133,174,103,187,43,248,148,254,114,243,110,60,241,54,29,95,58,245,79,165,209,130,230,173,127,82,14,81,31,108,62,43,140,104,5,155,107,189,65,251,171,217,131,31,121,33,126,19,25,205,224,91,42,0,0,0,0,0,0,0,34,174,40,215,152,47,138,66,205,101,239,35,145,68,55,113,47,59,77,236,207,251,192,181,188,219,137,129,165,219,181,233,56,181,72,243,91,194,86,57,25,208,5,182,241,17,241,89,155,79,25,175,164,130,63,146,24,129,109,218,213,94,28,171,66,2,3,163,152,170,7,216,190,111,112,69,1,91,131,18,140,178,228,78,190,133,49,36,226,180,255,213,195,125,12,85,111,137,123,242,116,93,190,114,177,150,22,59,254,177,222,128,53,18,199,37,167,6,220,155,148,38,105,207,116,241,155,193,210,74,241,158,193,105,155,228,227,37,79,56,134,71,190,239,181,213,140,139,198,157,193,15,101,156,172,119,204,161,12,36,117,2,43,89,111,44,233,45,131,228,166,110,170,132,116,74,212,251,65,189,220,169,176,92,181,83,17,131,218,136,249,118,171,223,102,238,82,81,62,152,16,50,180,45,109,198,49,168,63,33,251,152,200,39,3,176,228,14,239,190,199,127,89,191,194,143,168,61,243,11,224,198,37,167,10,147,71,145,167,213,111,130,3,224,81,99,202,6,112,110,14,10,103,41,41,20,252,47,210,70,133,10,183,39,38,201,38,92,56,33,27,46,237,42,196,90,252,109,44,77,223,179,149,157,19,13,56,83,222,99,175,139,84,115,10,101,168,178,119,60,187,10,106,118,230,174,237,71,46,201,194,129,59,53,130,20,133,44,114,146,100,3,241,76,161,232,191,162,1,48,66,188,75,102,26,168,145,151,248,208,112,139,75,194,48,190,84,6,163,81,108,199,24,82,239,214,25,232,146,209,16,169,101,85,36,6,153,214,42,32,113,87,133,53,14,244,184,209,187,50,112,160,106,16,200,208,210,184,22,193,164,25,83,171,65,81,8,108,55,30,153,235,142,223,76,119,72,39,168,72,155,225,181,188,176,52,99,90,201,197,179,12,28,57,203,138,65,227,74,170,216,78,115,227,99,119,79,202,156,91,163,184,178,214,243,111,46,104,252,178,239,93,238,130,143,116,96,47,23,67,111,99,165,120,114,171,240,161,20,120,200,132,236,57,100,26,8,2,199,140,40,30,99,35,250,255,190,144,233,189,130,222,235,108,80,164,21,121,198,178,247,163,249,190,43,83,114,227,242,120,113,198,156,97,38,234,206,62,39,202,7,194,192,33,199,184,134,209,30,235,224,205,214,125,218,234,120,209,110,238,127,79,125,245,186,111,23,114,170,103,240,6,166,152,200,162,197,125,99,10,174,13,249,190,4,152,63,17,27,71,28,19,53,11,113,27,132,125,4,35,245,119,219,40,147,36,199,64,123,171,202,50,188,190,201,21,10,190,158,60,76,13,16,156,196,103,29,67,182,66,62,203,190,212,197,76,42,126,101,252,156,41,127,89,236,250,214,58,171,111,203,95,23,88,71,74,140,25,68,108,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,11,0,0,0,12,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,14,0,0,0,10,0,0,0,4,0,0,0,8,0,0,0,9,0,0,0,15,0,0,0,13,0,0,0,6,0,0,0,1,0,0,0,12,0,0,0,0,0,0,0,2,0,0,0,11,0,0,0,7,0,0,0,5,0,0,0,3,0,0,0,11,0,0,0,8,0,0,0,12,0,0,0,0,0,0,0,5,0,0,0,2,0,0,0,15,0,0,0,13,0,0,0,10,0,0,0,14,0,0,0,3,0,0,0,6,0,0,0,7,0,0,0,1,0,0,0,9,0,0,0,4,0,0,0,7,0,0,0,9,0,0,0,3,0,0,0,1,0,0,0,13,0,0,0,12,0,0,0,11,0,0,0,14,0,0,0,2,0,0,0,6,0,0,0,5,0,0,0,10,0,0,0,4,0,0,0,0,0,0,0,15,0,0,0,8,0,0,0,9,0,0,0,0,0,0,0,5,0,0,0,7,0,0,0,2,0,0,0,4,0,0,0,10,0,0,0,15,0,0,0,14,0,0,0,1,0,0,0,11,0,0,0,12,0,0,0,6,0,0,0,8,0,0,0,3,0,0,0,13,0,0,0,2,0,0,0,12,0,0,0,6,0,0,0,10,0,0,0,0,0,0,0,11,0,0,0,8,0,0,0,3,0,0,0,4,0,0,0,13,0,0,0,7,0,0,0,5,0,0,0,15,0,0,0,14,0,0,0,1,0,0,0,9,0,0,0,12,0,0,0,5,0,0,0,1,0,0,0,15,0,0,0,14,0,0,0,13,0,0,0,4,0,0,0,10,0,0,0,0,0,0,0,7,0,0,0,6,0,0,0,3,0,0,0,9,0,0,0,2,0,0,0,8,0,0,0,11,0,0,0,13,0,0,0,11,0,0,0,7,0,0,0,14,0,0,0,12,0,0,0,1,0,0,0,3,0,0,0,9,0,0,0,5,0,0,0,0,0,0,0,15,0,0,0,4,0,0,0,8,0,0,0,6,0,0,0,2,0,0,0,10,0,0,0,6,0,0,0,15,0,0,0,14,0,0,0,9,0,0,0,11,0,0,0,3,0,0,0,0,0,0,0,8,0,0,0,12,0,0,0,2,0,0,0,13,0,0,0,7,0,0,0,1,0,0,0,4,0,0,0,10,0,0,0,5,0,0,0,10,0,0,0,2,0,0,0,8,0,0,0,4,0,0,0,7,0,0,0,6,0,0,0,1,0,0,0,5,0,0,0,15,0,0,0,11,0,0,0,9,0,0,0,14,0,0,0,3,0,0,0,12,0,0,0,13,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,11,0,0,0,12,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,14,0,0,0,10,0,0,0,4,0,0,0,8,0,0,0,9,0,0,0,15,0,0,0,13,0,0,0,6,0,0,0,1,0,0,0,12,0,0,0,0,0,0,0,2,0,0,0,11,0,0,0,7,0,0,0,5,0,0,0,3,0,0,0,133,59,140,1,189,241,36,255,248,37,195,1,96,220,55,0,183,76,62,255,195,66,61,0,50,76,164,1,225,164,76,255,76,61,163,255,117,62,31,0,81,145,64,255,118,65,14,0,162,115,214,255,6,138,46,0,124,230,244,255,10,138,143,0,52,26,194,0,184,244,76,0,129,143,41,1,190,244,19,255,123,170,122,255,98,129,68,0,121,213,147,0,86,101,30,255,161,103,155,0,140,89,67,255,239,229,190,1,67,11,181,0,198,240,137,254,238,69,188,255,67,151,238,0,19,42,108,255,229,85,113,1,50,68,135,255,17,106,9,0,50,103,1,255,80,1,168,1,35,152,30,255,16,168,185,1,56,89,232,255,101,210,252,0,41,250,71,0,204,170,79,255,14,46,239,255,80,77,239,0,189,214,75,255,17,141,249,0,38,80,76,255,190,85,117,0,86,228,170,0,156,216,208,1,195,207,164,255,150,66,76,255,175,225,16,255,141,80,98,1,76,219,242,0,198,162,114,0,46,218,152,0,155,43,241,254,155,160,104,255,51,187,165,0,2,17,175,0,66,84,160,1,247,58,30,0,35,65,53,254,69,236,191,0,45,134,245,1,163,123,221,0,32,110,20,255,52,23,165,0,186,214,71,0,233,176,96,0,242,239,54,1,57,89,138,0,83,0,84,255,136,160,100,0,92,142,120,254,104,124,190,0,181,177,62,255,250,41,85,0,152,130,42,1,96,252,246,0,151,151,63,254,239,133,62,0,32,56,156,0,45,167,189,255,142,133,179,1,131,86,211,0,187,179,150,254,250,170,14,255,210,163,78,0,37,52,151,0,99,77,26,0,238,156,213,255,213,192,209,1,73,46,84,0,20,65,41,1,54,206,79,0,201,131,146,254,170,111,24,255,177,33,50,254,171,38,203,255,78,247,116,0,209,221,153,0,133,128,178,1,58,44,25,0,201,39,59,1,189,19,252,0,49,229,210,1,117,187,117,0,181,179,184,1,0,114,219,0,48,94,147,0,245,41,56,0,125,13,204,254,244,173,119,0,44,221,32,254,84,234,20,0,249,160,198,1,236,126,234,255,47,99,168,254,170,226,153,255,102,179,216,0,226,141,122,255,122,66,153,254,182,245,134,0,227,228,25,1,214,57,235,255,216,173,56,255,181,231,210,0,119,128,157,255,129,95,136,255,110,126,51,0,2,169,183,255,7,130,98,254,69,176,94,255,116,4,227,1,217,242,145,255,202,173,31,1,105,1,39,255,46,175,69,0,228,47,58,255,215,224,69,254,207,56,69,255,16,254,139,255,23,207,212,255,202,20,126,255,95,213,96,255,9,176,33,0,200,5,207,255,241,42,128,254,35,33,192,255,248,229,196,1,129,17,120,0,251,103,151,255,7,52,112,255,140,56,66,255,40,226,245,255,217,70,37,254,172,214,9,255,72,67,134,1,146,192,214,255,44,38,112,0,68,184,75,255,206,90,251,0,149,235,141,0,181,170,58,0,116,244,239,0,92,157,2,0,102,173,98,0,233,137,96,1,127,49,203,0,5,155,148,0,23,148,9,255,211,122,12,0,34,134,26,255,219,204,136,0,134,8,41,255,224,83,43,254,85,25,247,0,109,127,0,254,169,136,48,0,238,119,219,255,231,173,213,0,206,18,254,254,8,186,7,255,126,9,7,1,111,42,72,0,111,52,236,254,96,63,141,0,147,191,127,254,205,78,192,255,14,106,237,1,187,219,76,0,175,243,187,254,105,89,173,0,85,25,89,1,162,243,148,0,2,118,209,254,33,158,9,0,139,163,46,255,93,70,40,0,108,42,142,254,111,252,142,255,155,223,144,0,51,229,167,255,73,252,155,255,94,116,12,255,152,160,218,255,156,238,37,255,179,234,207,255,197,0,179,255,154,164,141,0,225,196,104,0,10,35,25,254,209,212,242,255,97,253,222,254,184,101,229,0,222,18,127,1,164,136,135,255,30,207,140,254,146,97,243,0,129,192,26,254,201,84,33,255,111,10,78,255,147,81,178,255,4,4,24,0,161,238,215,255,6,141,33,0,53,215,14,255,41,181,208,255,231,139,157,0,179,203,221,255,255,185,113,0,189,226,172,255,113,66,214,255,202,62,45,255,102,64,8,255,78,174,16,254,133,117,68,255,89,241,178,254,10,229,166,255,123,221,42,254,30,20,212,0,82,128,3,0,48,209,243,0,119,121,64,255,50,227,156,255,0,110,197,1,103,27,144,0,182,120,89,255,133,114,211,0,189,110,21,255,15,10,106,0,41,192,1,0,152,232,121,255,188,60,160,255,153,113,206,255,0,183,226,254,180,13,72,255,176,160,14,254,211,201,134,255,158,24,143,0,127,105,53,0,96,12,189,0,167,215,251,255,159,76,128,254,106,101,225,255,30,252,4,0,146,12,174,0,133,59,140,1,189,241,36,255,248,37,195,1,96,220,55,0,183,76,62,255,195,66,61,0,50,76,164,1,225,164,76,255,76,61,163,255,117,62,31,0,81,145,64,255,118,65,14,0,162,115,214,255,6,138,46,0,124,230,244,255,10,138,143,0,52,26,194,0,184,244,76,0,129,143,41,1,190,244,19,255,123,170,122,255,98,129,68,0,121,213,147,0,86,101,30,255,161,103,155,0,140,89,67,255,239,229,190,1,67,11,181,0,198,240,137,254,238,69,188,255,234,113,60,255,37,255,57,255,69,178,182,254,128,208,179,0,118,26,125,254,3,7,214,255,241,50,77,255,85,203,197,255,211,135,250,255,25,48,100,255,187,213,180,254,17,88,105,0,83,209,158,1,5,115,98,0,4,174,60,254,171,55,110,255,217,181,17,255,20,188,170,0,146,156,102,254,87,214,174,255,114,122,155,1,233,44,170,0,127,8,239,1,214,236,234,0,175,5,219,0,49,106,61,255,6,66,208,255,2,106,110,255,81,234,19,255,215,107,192,255,67,151,238,0,19,42,108,255,229,85,113,1,50,68,135,255,17,106,9,0,50,103,1,255,80,1,168,1,35,152,30,255,16,168,185,1,56,89,232,255,101,210,252,0,41,250,71,0,204,170,79,255,14,46,239,255,80,77,239,0,189,214,75,255,17,141,249,0,38,80,76,255,190,85,117,0,86,228,170,0,156,216,208,1,195,207,164,255,150,66,76,255,175,225,16,255,141,80,98,1,76,219,242,0,198,162,114,0,46,218,152,0,155,43,241,254,155,160,104,255,178,9,252,254,100,110,212,0,14,5,167,0,233,239,163,255,28,151,157,1,101,146,10,255,254,158,70,254,71,249,228,0,88,30,50,0,68,58,160,255,191,24,104,1,129,66,129,255,192,50,85,255,8,179,138,255,38,250,201,0,115,80,160,0,131,230,113,0,125,88,147,0,90,68,199,0,253,76,158,0,28,255,118,0,113,250,254,0,66,75,46,0,230,218,43,0,229,120,186,1,148,68,43,0,136,124,238,1,187,107,197,255,84,53,246,255,51,116,254,255,51,187,165,0,2,17,175,0,66,84,160,1,247,58,30,0,35,65,53,254,69,236,191,0,45,134,245,1,163,123,221,0,32,110,20,255,52,23,165,0,186,214,71,0,233,176,96,0,242,239,54,1,57,89,138,0,83,0,84,255,136,160,100,0,92,142,120,254,104,124,190,0,181,177,62,255,250,41,85,0,152,130,42,1,96,252,246,0,151,151,63,254,239,133,62,0,32,56,156,0,45,167,189,255,142,133,179,1,131,86,211,0,187,179,150,254,250,170,14,255,68,113,21,255,222,186,59,255,66,7,241,1,69,6,72,0,86,156,108,254,55,167,89,0,109,52,219,254,13,176,23,255,196,44,106,255,239,149,71,255,164,140,125,255,159,173,1,0,51,41,231,0,145,62,33,0,138,111,93,1,185,83,69,0,144,115,46,0,97,151,16,255,24,228,26,0,49,217,226,0,113,75,234,254,193,153,12,255,182,48,96,255,14,13,26,0,128,195,249,254,69,193,59,0,132,37,81,254,125,106,60,0,214,240,169,1,164,227,66,0,210,163,78,0,37,52,151,0,99,77,26,0,238,156,213,255,213,192,209,1,73,46,84,0,20,65,41,1,54,206,79,0,201,131,146,254,170,111,24,255,177,33,50,254,171,38,203,255,78,247,116,0,209,221,153,0,133,128,178,1,58,44,25,0,201,39,59,1,189,19,252,0,49,229,210,1,117,187,117,0,181,179,184,1,0,114,219,0,48,94,147,0,245,41,56,0,125,13,204,254,244,173,119,0,44,221,32,254,84,234,20,0,249,160,198,1,236,126,234,255,143,62,221,0,129,89,214,255,55,139,5,254,68,20,191,255,14,204,178,1,35,195,217,0,47,51,206,1,38,246,165,0,206,27,6,254,158,87,36,0,217,52,146,255,125,123,215,255,85,60,31,255,171,13,7,0,218,245,88,254,252,35,60,0,55,214,160,255,133,101,56,0,224,32,19,254,147,64,234,0,26,145,162,1,114,118,125,0,248,252,250,0,101,94,196,255,198,141,226,254,51,42,182,0,135,12,9,254,109,172,210,255,197,236,194,1,241,65,154,0,48,156,47,255,153,67,55,255,218,165,34,254,74,180,179,0,218,66,71,1,88,122,99,0,212,181,219,255,92,42,231,255,239,0,154,0,245,77,183,255,94,81,170,1,18,213,216,0,171,93,71,0,52,94,248,0,18,151,161,254,197,209,66,255,174,244,15,254,162,48,183,0,49,61,240,254,182,93,195,0,199,228,6,1,200,5,17,255,137,45,237,255,108,148,4,0,90,79,237,255,39,63,77,255,53,82,207,1,142,22,118,255,101,232,18,1,92,26,67,0,5,200,88,255,33,168,138,255,149,225,72,0,2,209,27,255,44,245,168,1,220,237,17,255,30,211,105,254,141,238,221,0,128,80,245,254,111,254,14,0,222,95,190,1,223,9,241,0,146,76,212,255,108,205,104,255,63,117,153,0,144,69,48,0,35,228,111,0,192,33,193,255,112,214,190,254,115,152,151,0,23,102,88,0,51,74,248,0,226,199,143,254,204,162,101,255,208,97,189,1,245,104,18,0,230,246,30,255,23,148,69,0,110,88,52,254,226,181,89,255,208,47,90,254,114,161,80,255,33,116,248,0,179,152,87,255,69,144,177,1,88,238,26,255,58,32,113,1,1,77,69,0,59,121,52,255,152,238,83,0,52,8,193,0,231,39,233,255,199,34,138,0,222,68,173,0,91,57,242,254,220,210,127,255,192,7,246,254,151,35,187,0,195,236,165,0,111,93,206,0,212,247,133,1,154,133,209,255,155,231,10,0,64,78,38,0,122,249,100,1,30,19,97,255,62,91,249,1,248,133,77,0,197,63,168,254,116,10,82,0,184,236,113,254,212,203,194,255,61,100,252,254,36,5,202,255,119,91,153,255,129,79,29,0,103,103,171,254,237,215,111,255,216,53,69,0,239,240,23,0,194,149,221,255,38,225,222,0,232,255,180,254,118,82,133,255,57,209,177,1,139,232,133,0,158,176,46,254,194,115,46,0,88,247,229,1,28,103,191,0,221,222,175,254,149,235,44,0,151,228,25,254,218,105,103,0,142,85,210,0,149,129,190,255,213,65,94,254,117,134,224,255,82,198,117,0,157,221,220,0,163,101,36,0,197,114,37,0,104,172,166,254,11,182,0,0,81,72,188,255,97,188,16,255,69,6,10,0,199,147,145,255,8,9,115,1,65,214,175,255,217,173,209,0,80,127,166,0,247,229,4,254,167,183,124,255,90,28,204,254,175,59,240,255,11,41,248,1,108,40,51,255,144,177,195,254,150,250,126,0,138,91,65,1,120,60,222,255,245,193,239,0,29,214,189,255,128,2,25,0,80,154,162,0,77,220,107,1,234,205,74,255,54,166,103,255,116,72,9,0,228,94,47,255,30,200,25,255,35,214,89,255,61,176,140,255,83,226,163,255,75,130,172,0,128,38,17,0,95,137,152,255,215,124,159,1,79,93,0,0,148,82,157,254,195,130,251,255,40,202,76,255,251,126,224,0,157,99,62,254,207,7,225,255,96,68,195,0,140,186,157,255,131,19,231,255,42,128,254,0,52,219,61,254,102,203,72,0,141,7,11,255,186,164,213,0,31,122,119,0,133,242,145,0,208,252,232,255,91,213,182,255,143,4,250,254,249,215,74,0,165,30,111,1,171,9,223,0,229,123,34,1,92,130,26,255,77,155,45,1,195,139,28,255,59,224,78,0,136,17,247,0,108,121,32,0,79,250,189,255,96,227,252,254,38,241,62,0,62,174,125,255,155,111,93,255,10,230,206,1,97,197,40,255,0,49,57,254,65,250,13,0,18,251,150,255,220,109,210,255,5,174,166,254,44,129,189,0,235,35,147,255,37,247,141,255,72,141,4,255,103,107,255,0,247,90,4,0,53,44,42,0,2,30,240,0,4,59,63,0,88,78,36,0,113,167,180,0,190,71,193,255,199,158,164,255,58,8,172,0,77,33,12,0,65,63,3,0,153,77,33,255,172,254,102,1,228,221,4,255,87,30,254,1,146,41,86,255,138,204,239,254,108,141,17,255,187,242,135,0,210,208,127,0,68,45,14,254,73,96,62,0,81,60,24,255,170,6,36,255,3,249,26,0,35,213,109,0,22,129,54,255,21,35,225,255,234,61,56,255,58,217,6,0,143,124,88,0,236,126,66,0,209,38,183,255,34,238,6,255,174,145,102,0,95,22,211,0,196,15,153,254,46,84,232,255,117,34,146,1,231,250,74,255,27,134,100,1,92,187,195,255,170,198,112,0,120,28,42,0,209,70,67,0,29,81,31,0,29,168,100,1,169,173,160,0,107,35,117,0,62,96,59,255,81,12,69,1,135,239,190,255,220,252,18,0,163,220,58,255,137,137,188,255,83,102,109,0,96,6,76,0,234,222,210,255,185,174,205,1,60,158,213,255,13,241,214,0,172,129,140,0,93,104,242,0,192,156,251,0,43,117,30,0,225,81,158,0,127,232,218,0,226,28,203,0,233,27,151,255,117,43,5,255,242,14,47,255,33,20,6,0,137,251,44,254,27,31,245,255,183,214,125,254,40,121,149,0,186,158,213,255,89,8,227,0,69,88,0,254,203,135,225,0,201,174,203,0,147,71,184,0,18,121,41,254,94,5,78,0,224,214,240,254,36,5,180,0,251,135,231,1,163,138,212,0,210,249,116,254,88,129,187,0,19,8,49,254,62,14,144,255,159,76,211,0,214,51,82,0,109,117,228,254,103,223,203,255,75,252,15,1,154,71,220,255,23,13,91,1,141,168,96,255,181,182,133,0,250,51,55,0,234,234,212,254,175,63,158,0,39,240,52,1,158,189,36,255,213,40,85,1,32,180,247,255,19,102,26,1,84,24,97,255,69,21,222,0,148,139,122,255,220,213,235,1,232,203,255,0,121,57,147,0,227,7,154,0,53,22,147,1,72,1,225,0,82,134,48,254,83,60,157,255,145,72,169,0,34,103,239,0,198,233,47,0,116,19,4,255,184,106,9,255,183,129,83,0,36,176,230,1,34,103,72,0,219,162,134,0,245,42,158,0,32,149,96,254,165,44,144,0,202,239,72,254,215,150,5,0,42,66,36,1,132,215,175,0,86,174,86,255,26,197,156,255,49,232,135,254,103,182,82,0,253,128,176,1,153,178,122,0,245,250,10,0,236,24,178,0,137,106,132,0,40,29,41,0,50,30,152,255,124,105,38,0,230,191,75,0,143,43,170,0,44,131,20,255,44,13,23,255,237,255,155,1,159,109,100,255,112,181,24,255,104,220,108,0,55,211,131,0,99,12,213,255,152,151,145,255,238,5,159,0,97,155,8,0,33,108,81,0,1,3,103,0,62,109,34,255,250,155,180,0,32,71,195,255,38,70,145,1,159,95,245,0,69,229,101,1,136,28,240,0,79,224,25,0,78,110,121,255,248,168,124,0,187,128,247,0,2,147,235,254,79,11,132,0,70,58,12,1,181,8,163,255,79,137,133,255,37,170,11,255,141,243,85,255,176,231,215,255,204,150,164,255,239,215,39,255,46,87,156,254,8,163,88,255,172,34,232,0,66,44,102,255,27,54,41,254,236,99,87,255,41,123,169,1,52,114,43,0,117,134,40,0,155,134,26,0,231,207,91,254,35,132,38,255,19,102,125,254,36,227,133,255,118,3,113,255,29,13,124,0,152,96,74,1,88,146,206,255,167,191,220,254,162,18,88,255,182,100,23,0,31,117,52,0,81,46,106,1,12,2,7,0,69,80,201,1,209,246,172,0,12,48,141,1,224,211,88,0,116,226,159,0,122,98,130,0,65,236,234,1,225,226,9,255,207,226,123,1,89,214,59,0,112,135,88,1,90,244,203,255,49,11,38,1,129,108,186,0,89,112,15,1,101,46,204,255,127,204,45,254,79,255,221,255,51,73,18,255,127,42,101,255,241,21,202,0,160,227,7,0,105,50,236,0,79,52,197,255,104,202,208,1,180,15,16,0,101,197,78,255,98,77,203,0,41,185,241,1,35,193,124,0,35,155,23,255,207,53,192,0,11,125,163,1,249,158,185,255,4,131,48,0,21,93,111,255,61,121,231,1,69,200,36,255,185,48,185,255,111,238,21,255,39,50,25,255,99,215,163,255,87,212,30,255,164,147,5,255,128,6,35,1,108,223,110,255,194,76,178,0,74,101,180,0,243,47,48,0,174,25,43,255,82,173,253,1,54,114,192,255,40,55,91,0,215,108,176,255,11,56,7,0,224,233,76,0,209,98,202,254,242,25,125,0,44,193,93,254,203,8,177,0,135,176,19,0,112,71,213,255,206,59,176,1,4,67,26,0,14,143,213,254,42,55,208,255,60,67,120,0,193,21,163,0,99,164,115,0,10,20,118,0,156,212,222,254,160,7,217,255,114,245,76,1,117,59,123,0,176,194,86,254,213,15,176,0,78,206,207,254,213,129,59,0,233,251,22,1,96,55,152,255,236,255,15,255,197,89,84,255,93,149,133,0,174,160,113,0,234,99,169,255,152,116,88,0,144,164,83,255,95,29,198,255,34,47,15,255,99,120,134,255,5,236,193,0,249,247,126,255,147,187,30,0,50,230,117,255,108,217,219,255,163,81,166,255,72,25,169,254,155,121,79,255,28,155,89,254,7,126,17,0,147,65,33,1,47,234,253,0,26,51,18,0,105,83,199,255,163,196,230,0,113,248,164,0,226,254,218,0,189,209,203,255,164,247,222,254,255,35,165,0,4,188,243,1,127,179,71,0,37,237,254,255,100,186,240,0,5,57,71,254,103,72,73,255,244,18,81,254,229,210,132,255,238,6,180,255,11,229,174,255,227,221,192,1,17,49,28,0,163,215,196,254,9,118,4,255,51,240,71,0,113,129,109,255,76,240,231,0,188,177,127,0,125,71,44,1,26,175,243,0,94,169,25,254,27,230,29,0,15,139,119,1,168,170,186,255,172,197,76,255,252,75,188,0,137,124,196,0,72,22,96,255,45,151,249,1,220,145,100,0,64,192,159,255,120,239,226,0,129,178,146,0,0,192,125,0,235,138,234,0,183,157,146,0,83,199,192,255,184,172,72,255,73,225,128,0,77,6,250,255,186,65,67,0,104,246,207,0,188,32,138,255,218,24,242,0,67,138,81,254,237,129,121,255,20,207,150,1,41,199,16,255,6,20,128,0,159,118,5,0,181,16,143,255,220,38,15,0,23,64,147,254,73,26,13,0,87,228,57,1,204,124,128,0,43,24,223,0,219,99,199,0,22,75,20,255,19,27,126,0,157,62,215,0,110,29,230,0,179,167,255,1,54,252,190,0,221,204,182,254,179,158,65,255,81,157,3,0,194,218,159,0,170,223,0,0,224,11,32,255,38,197,98,0,168,164,37,0,23,88,7,1,164,186,110,0,96,36,134,0,234,242,229,0,250,121,19,0,242,254,112,255,3,47,94,1,9,239,6,255,81,134,153,254,214,253,168,255,67,124,224,0,245,95,74,0,28,30,44,254,1,109,220,255,178,89,89,0,252,36,76,0,24,198,46,255,76,77,111,0,134,234,136,255,39,94,29,0,185,72,234,255,70,68,135,255,231,102,7,254,77,231,140,0,167,47,58,1,148,97,118,255,16,27,225,1,166,206,143,255,110,178,214,255,180,131,162,0,143,141,225,1,13,218,78,255,114,153,33,1,98,104,204,0,175,114,117,1,167,206,75,0,202,196,83,1,58,64,67,0,138,47,111,1,196,247,128,255,137,224,224,254,158,112,207,0,154,100,255,1,134,37,107,0,198,128,79,255,127,209,155,255,163,254,185,254,60,14,243,0,31,219,112,254,29,217,65,0,200,13,116,254,123,60,196,255,224,59,184,254,242,89,196,0,123,16,75,254,149,16,206,0,69,254,48,1,231,116,223,255,209,160,65,1,200,80,98,0,37,194,184,254,148,63,34,0,139,240,65,255,217,144,132,255,56,38,45,254,199,120,210,0,108,177,166,255,160,222,4,0,220,126,119,254,165,107,160,255,82,220,248,1,241,175,136,0,144,141,23,255,169,138,84,0,160,137,78,255,226,118,80,255,52,27,132,255,63,96,139,255,152,250,39,0,188,155,15,0,232,51,150,254,40,15,232,255,240,229,9,255,137,175,27,255,75,73,97,1,218,212,11,0,135,5,162,1,107,185,213,0,2,249,107,255,40,242,70,0,219,200,25,0,25,157,13,0,67,82,80,255,196,249,23,255,145,20,149,0,50,72,146,0,94,76,148,1,24,251,65,0,31,192,23,0,184,212,201,255,123,233,162,1,247,173,72,0,162,87,219,254,126,134,89,0,159,11,12,254,166,105,29,0,73,27,228,1,113,120,183,255,66,163,109,1,212,143,11,255,159,231,168,1,255,128,90,0,57,14,58,254,89,52,10,255,253,8,163,1,0,145,210,255,10,129,85,1,46,181,27,0,103,136,160,254,126,188,209,255,34,35,111,0,215,219,24,255,212,11,214,254,101,5,118,0,232,197,133,255,223,167,109,255,237,80,86,255,70,139,94,0,158,193,191,1,155,15,51,255,15,190,115,0,78,135,207,255,249,10,27,1,181,125,233,0,95,172,13,254,170,213,161,255,39,236,138,255,95,93,87,255,190,128,95,0,125,15,206,0,166,150,159,0,227,15,158,255,206,158,120,255,42,141,128,0,101,178,120,1,156,109,131,0,218,14,44,254,247,168,206,255,212,112,28,0,112,17,228,255,90,16,37,1,197,222,108,0,254,207,83,255,9,90,243,255,243,244,172,0,26,88,115,255,205,116,122,0,191,230,193,0,180,100,11,1,217,37,96,255,154,78,156,0,235,234,31,255,206,178,178,255,149,192,251,0,182,250,135,0,246,22,105,0,124,193,109,255,2,210,149,255,169,17,170,0,0,96,110,255,117,9,8,1,50,123,40,255,193,189,99,0,34,227,160,0,48,80,70,254,211,51,236,0,45,122,245,254,44,174,8,0,173,37,233,255,158,65,171,0,122,69,215,255,90,80,2,255,131,106,96,254,227,114,135,0,205,49,119,254,176,62,64,255,82,51,17,255,241,20,243,255,130,13,8,254,128,217,243,255,162,27,1,254,90,118,241,0,246,198,246,255,55,16,118,255,200,159,157,0,163,17,1,0,140,107,121,0,85,161,118,255,38,0,149,0,156,47,238,0,9,166,166,1,75,98,181,255,50,74,25,0,66,15,47,0,139,225,159,0,76,3,142,255,14,238,184,0,11,207,53,255,183,192,186,1,171,32,174,255,191,76,221,1,247,170,219,0,25,172,50,254,217,9,233,0,203,126,68,255,183,92,48,0,127,167,183,1,65,49,254,0,16,63,127,1,254,21,170,255,59,224,127,254,22,48,63,255,27,78,130,254,40,195,29,0,250,132,112,254,35,203,144,0,104,169,168,0,207,253,30,255,104,40,38,254,94,228,88,0,206,16,128,255,212,55,122,255,223,22,234,0,223,197,127,0,253,181,181,1,145,102,118,0,236,153,36,255,212,217,72,255,20,38,24,254,138,62,62,0,152,140,4,0,230,220,99,255,1,21,212,255,148,201,231,0,244,123,9,254,0,171,210,0,51,58,37,255,1,255,14,255,244,183,145,254,0,242,166,0,22,74,132,0,121,216,41,0,95,195,114,254,133,24,151,255,156,226,231,255,247,5,77,255,246,148,115,254,225,92,81,255,222,80,246,254,170,123,89,255,74,199,141,0,29,20,8,255,138,136,70,255,93,75,92,0,221,147,49,254,52,126,226,0,229,124,23,0,46,9,181,0,205,64,52,1,131,254,28,0,151,158,212,0,131,64,78,0,206,25,171,0,0,230,139,0,191,253,110,254,103,247,167,0,64,40,40,1,42,165,241,255,59,75,228,254,124,243,189,255,196,92,178,255,130,140,86,255,141,89,56,1,147,198,5,255,203,248,158,254,144,162,141,0,11,172,226,0,130,42,21,255,1,167,143,255,144,36,36,255,48,88,164,254,168,170,220,0,98,71,214,0,91,208,79,0,159,76,201,1,166,42,214,255,69,255,0,255,6,128,125,255,190,1,140,0,146,83,218,255,215,238,72,1,122,127,53,0,189,116,165,255,84,8,66,255,214,3,208,255,213,110,133,0,195,168,44,1,158,231,69,0,162,64,200,254,91,58,104,0,182,58,187,254,249,228,136,0,203,134,76,254,99,221,233,0,75,254,214,254,80,69,154,0,64,152,248,254,236,136,202,255,157,105,153,254,149,175,20,0,22,35,19,255,124,121,233,0,186,250,198,254,132,229,139,0,137,80,174,255,165,125,68,0,144,202,148,254,235,239,248,0,135,184,118,0,101,94,17,255,122,72,70,254,69,130,146,0,127,222,248,1,69,127,118,255,30,82,215,254,188,74,19,255,229,167,194,254,117,25,66,255,65,234,56,254,213,22,156,0,151,59,93,254,45,28,27,255,186,126,164,255,32,6,239,0,127,114,99,1,219,52,2,255,99,96,166,254,62,190,126,255,108,222,168,1,75,226,174,0,230,226,199,0,60,117,218,255,252,248,20,1,214,188,204,0,31,194,134,254,123,69,192,255,169,173,36,254,55,98,91,0,223,42,102,254,137,1,102,0,157,90,25,0,239,122,64,255,252,6,233,0,7,54,20,255,82,116,174,0,135,37,54,255,15,186,125,0,227,112,175,255,100,180,225,255,42,237,244,255,244,173,226,254,248,18,33,0,171,99,150,255,74,235,50,255,117,82,32,254,106,168,237,0,207,109,208,1,228,9,186,0,135,60,169,254,179,92,143,0,244,170,104,255,235,45,124,255,70,99,186,0,117,137,183,0,224,31,215,0,40,9,100,0,26,16,95,1,68,217,87,0,8,151,20,255,26,100,58,255,176,165,203,1,52,118,70,0,7,32,254,254,244,254,245,255,167,144,194,255,125,113,23,255,176,121,181,0,136,84,209,0,138,6,30,255,89,48,28,0,33,155,14,255,25,240,154,0,141,205,109,1,70,115,62,255,20,40,107,254,138,154,199,255,94,223,226,255,157,171,38,0,163,177,25,254,45,118,3,255,14,222,23,1,209,190,81,255,118,123,232,1,13,213,101,255,123,55,123,254,27,246,165,0,50,99,76,255,140,214,32,255,97,65,67,255,24,12,28,0,174,86,78,1,64,247,96,0,160,135,67,0,66,55,243,255,147,204,96,255,26,6,33,255,98,51,83,1,153,213,208,255,2,184,54,255,25,218,11,0,49,67,246,254,18,149,72,255,13,25,72,0,42,79,214,0,42,4,38,1,27,139,144,255,149,187,23,0,18,164,132,0,245,84,184,254,120,198,104,255,126,218,96,0,56,117,234,255,13,29,214,254,68,47,10,255,167,154,132,254,152,38,198,0,66,178,89,255,200,46,171,255,13,99,83,255,210,187,253,255,170,45,42,1,138,209,124,0,214,162,141,0,12,230,156,0,102,36,112,254,3,147,67,0,52,215,123,255,233,171,54,255,98,137,62,0,247,218,39,255,231,218,236,0,247,191,127,0,195,146,84,0,165,176,92,255,19,212,94,255,17,74,227,0,88,40,153,1,198,147,1,255,206,67,245,254,240,3,218,255,61,141,213,255,97,183,106,0,195,232,235,254,95,86,154,0,209,48,205,254,118,209,241,255,240,120,223,1,213,29,159,0,163,127,147,255,13,218,93,0,85,24,68,254,70,20,80,255,189,5,140,1,82,97,254,255,99,99,191,255,132,84,133,255,107,218,116,255,112,122,46,0,105,17,32,0,194,160,63,255,68,222,39,1,216,253,92,0,177,105,205,255,149,201,195,0,42,225,11,255,40,162,115,0,9,7,81,0,165,218,219,0,180,22,0,254,29,146,252,255,146,207,225,1,180,135,96,0,31,163,112,0,177,11,219,255,133,12,193,254,43,78,50,0,65,113,121,1,59,217,6,255,110,94,24,1,112,172,111,0,7,15,96,0,36,85,123,0,71,150,21,255,208,73,188,0,192,11,167,1,213,245,34,0,9,230,92,0,162,142,39,255,215,90,27,0,98,97,89,0,94,79,211,0,90,157,240,0,95,220,126,1,102,176,226,0,36,30,224,254,35,31,127,0,231,232,115,1,85,83,130,0,210,73,245,255,47,143,114,255,68,65,197,0,59,72,62,255,183,133,173,254,93,121,118,255,59,177,81,255,234,69,173,255,205,128,177,0,220,244,51,0,26,244,209,1,73,222,77,255,163,8,96,254,150,149,211,0,158,254,203,1,54,127,139,0,161,224,59,0,4,109,22,255,222,42,45,255,208,146,102,255,236,142,187,0,50,205,245,255,10,74,89,254,48,79,142,0,222,76,130,255,30,166,63,0,236,12,13,255,49,184,244,0,187,113,102,0,218,101,253,0,153,57,182,254,32,150,42,0,25,198,146,1,237,241,56,0,140,68,5,0,91,164,172,255,78,145,186,254,67,52,205,0,219,207,129,1,109,115,17,0,54,143,58,1,21,248,120,255,179,255,30,0,193,236,66,255,1,255,7,255,253,192,48,255,19,69,217,1,3,214,0,255,64,101,146,1,223,125,35,255,235,73,179,255,249,167,226,0,225,175,10,1,97,162,58,0,106,112,171,1,84,172,5,255,133,140,178,255,134,245,142,0,97,90,125,255,186,203,185,255,223,77,23,255,192,92,106,0,15,198,115,255,217,152,248,0,171,178,120,255,228,134,53,0,176,54,193,1,250,251,53,0,213,10,100,1,34,199,106,0,151,31,244,254,172,224,87,255,14,237,23,255,253,85,26,255,127,39,116,255,172,104,100,0,251,14,70,255,212,208,138,255,253,211,250,0,176,49,165,0,15,76,123,255,37,218,160,255,92,135,16,1,10,126,114,255,70,5,224,255,247,249,141,0,68,20,60,1,241,210,189,255,195,217,187,1,151,3,113,0,151,92,174,0,231,62,178,255,219,183,225,0,23,23,33,255,205,181,80,0,57,184,248,255,67,180,1,255,90,123,93,255,39,0,162,255,96,248,52,255,84,66,140,0,34,127,228,255,194,138,7,1,166,110,188,0,21,17,155,1,154,190,198,255,214,80,59,255,18,7,143,0,72,29,226,1,199,217,249,0,232,161,71,1,149,190,201,0,217,175,95,254,113,147,67,255,138,143,199,255,127,204,1,0,29,182,83,1,206,230,155,255,186,204,60,0,10,125,85,255,232,96,25,255,255,89,247,255,213,254,175,1,232,193,81,0,28,43,156,254,12,69,8,0,147,24,248,0,18,198,49,0,134,60,35,0,118,246,18,255,49,88,254,254,228,21,186,255,182,65,112,1,219,22,1,255,22,126,52,255,189,53,49,255,112,25,143,0,38,127,55,255,226,101,163,254,208,133,61,255,137,69,174,1,190,118,145,255,60,98,219,255,217,13,245,255,250,136,10,0,84,254,226,0,201,31,125,1,240,51,251,255,31,131,130,255,2,138,50,255,215,215,177,1,223,12,238,255,252,149,56,255,124,91,68,255,72,126,170,254,119,255,100,0,130,135,232,255,14,79,178,0,250,131,197,0,138,198,208,0,121,216,139,254,119,18,36,255,29,193,122,0,16,42,45,255,213,240,235,1,230,190,169,255,198,35,228,254,110,173,72,0,214,221,241,255,56,148,135,0,192,117,78,254,141,93,207,255,143,65,149,0,21,18,98,255,95,44,244,1,106,191,77,0,254,85,8,254,214,110,176,255,73,173,19,254,160,196,199,255,237,90,144,0,193,172,113,255,200,155,136,254,228,90,221,0,137,49,74,1,164,221,215,255,209,189,5,255,105,236,55,255,42,31,129,1,193,255,236,0,46,217,60,0,138,88,187,255,226,82,236,255,81,69,151,255,142,190,16,1,13,134,8,0,127,122,48,255,81,64,156,0,171,243,139,0,237,35,246,0,122,143,193,254,212,122,146,0,95,41,255,1,87,132,77,0,4,212,31,0,17,31,78,0,39,45,173,254,24,142,217,255,95,9,6,255,227,83,6,0,98,59,130,254,62,30,33,0,8,115,211,1,162,97,128,255,7,184,23,254,116,28,168,255,248,138,151,255,98,244,240,0,186,118,130,0,114,248,235,255,105,173,200,1,160,124,71,255,94,36,164,1,175,65,146,255,238,241,170,254,202,198,197,0,228,71,138,254,45,246,109,255,194,52,158,0,133,187,176,0,83,252,154,254,89,189,221,255,170,73,252,0,148,58,125,0,36,68,51,254,42,69,177,255,168,76,86,255,38,100,204,255,38,53,35,0,175,19,97,0,225,238,253,255,81,81,135,0,210,27,255,254,235,73,107,0,8,207,115,0,82,127,136,0,84,99,21,254,207,19,136,0,100,164,101,0,80,208,77,255,132,207,237,255,15,3,15,255,33,166,110,0,156,95,85,255,37,185,111,1,150,106,35,255,166,151,76,0,114,87,135,255,159,194,64,0,12,122,31,255,232,7,101,254,173,119,98,0,154,71,220,254,191,57,53,255,168,232,160,255,224,32,99,255,218,156,165,0,151,153,163,0,217,13,148,1,197,113,89,0,149,28,161,254,207,23,30,0,105,132,227,255,54,230,94,255,133,173,204,255,92,183,157,255,88,144,252,254,102,33,90,0,159,97,3,0,181,218,155,255,240,114,119,0,106,214,53,255,165,190,115,1,152,91,225,255,88,106,44,255,208,61,113,0,151,52,124,0,191,27,156,255,110,54,236,1,14,30,166,255,39,127,207,1,229,199,28,0,188,228,188,254,100,157,235,0,246,218,183,1,107,22,193,255,206,160,95,0,76,239,147,0,207,161,117,0,51,166,2,255,52,117,10,254,73,56,227,255,152,193,225,0,132,94,136,255,101,191,209,0,32,107,229,255,198,43,180,1,100,210,118,0,114,67,153,255,23,88,26,255,89,154,92,1,220,120,140,255,144,114,207,255,252,115,250,255,34,206,72,0,138,133,127,255,8,178,124,1,87,75,97,0,15,229,92,254,240,67,131,255,118,123,227,254,146,120,104,255,145,213,255,1,129,187,70,255,219,119,54,0,1,19,173,0,45,150,148,1,248,83,72,0,203,233,169,1,142,107,56,0,247,249,38,1,45,242,80,255,30,233,103,0,96,82,70,0,23,201,111,0,81,39,30,255,161,183,78,255,194,234,33,255,68,227,140,254,216,206,116,0,70,27,235,255,104,144,79,0,164,230,93,254,214,135,156,0,154,187,242,254,188,20,131,255,36,109,174,0,159,112,241,0,5,110,149,1,36,165,218,0,166,29,19,1,178,46,73,0,93,43,32,254,248,189,237,0,102,155,141,0,201,93,195,255,241,139,253,255,15,111,98,255,108,65,163,254,155,79,190,255,73,174,193,254,246,40,48,255,107,88,11,254,202,97,85,255,253,204,18,255,113,242,66,0,110,160,194,254,208,18,186,0,81,21,60,0,188,104,167,255,124,166,97,254,210,133,142,0,56,242,137,254,41,111,130,0,111,151,58,1,111,213,141,255,183,172,241,255,38,6,196,255,185,7,123,255,46,11,246,0,245,105,119,1,15,2,161,255,8,206,45,255,18,202,74,255,83,124,115,1,212,141,157,0,83,8,209,254,139,15,232,255,172,54,173,254,50,247,132,0,214,189,213,0,144,184,105,0,223,254,248,0,255,147,240,255,23,188,72,0,7,51,54,0,188,25,180,254,220,180,0,255,83,160,20,0,163,189,243,255,58,209,194,255,87,73,60,0,106,24,49,0,245,249,220,0,22,173,167,0,118,11,195,255,19,126,237,0,110,159,37,255,59,82,47,0,180,187,86,0,188,148,208,1,100,37,133,255,7,112,193,0,129,188,156,255,84,106,129,255,133,225,202,0,14,236,111,255,40,20,101,0,172,172,49,254,51,54,74,255,251,185,184,255,93,155,224,255,180,249,224,1,230,178,146,0,72,57,54,254,178,62,184,0,119,205,72,0,185,239,253,255,61,15,218,0,196,67,56,255,234,32,171,1,46,219,228,0,208,108,234,255,20,63,232,255,165,53,199,1,133,228,5,255,52,205,107,0,74,238,140,255,150,156,219,254,239,172,178,255,251,189,223,254,32,142,211,255,218,15,138,1,241,196,80,0,28,36,98,254,22,234,199,0,61,237,220,255,246,57,37,0,142,17,142,255,157,62,26,0,43,238,95,254,3,217,6,255,213,25,240,1,39,220,174,255,154,205,48,254,19,13,192,255,244,34,54,254,140,16,155,0,240,181,5,254,155,193,60,0,166,128,4,255,36,145,56,255,150,240,219,0,120,51,145,0,82,153,42,1,140,236,146,0,107,92,248,1,189,10,3,0,63,136,242,0,211,39,24,0,19,202,161,1,173,27,186,255,210,204,239,254,41,209,162,255,182,254,159,255,172,116,52,0,195,103,222,254,205,69,59,0,53,22,41,1,218,48,194,0,80,210,242,0,210,188,207,0,187,161,161,254,216,17,1,0,136,225,113,0,250,184,63,0,223,30,98,254,77,168,162,0,59,53,175,0,19,201,10,255,139,224,194,0,147,193,154,255,212,189,12,254,1,200,174,255,50,133,113,1,94,179,90,0,173,182,135,0,94,177,113,0,43,89,215,255,136,252,106,255,123,134,83,254,5,245,66,255,82,49,39,1,220,2,224,0,97,129,177,0,77,59,89,0,61,29,155,1,203,171,220,255,92,78,139,0,145,33,181,255,169,24,141,1,55,150,179,0,139,60,80,255,218,39,97,0,2,147,107,255,60,248,72,0,173,230,47,1,6,83,182,255,16,105,162,254,137,212,81,255,180,184,134,1,39,222,164,255,221,105,251,1,239,112,125,0,63,7,97,0,63,104,227,255,148,58,12,0,90,60,224,255,84,212,252,0,79,215,168,0,248,221,199,1,115,121,1,0,36,172,120,0,32,162,187,255,57,107,49,255,147,42,21,0,106,198,43,1,57,74,87,0,126,203,81,255,129,135,195,0,140,31,177,0,221,139,194,0,3,222,215,0,131,68,231,0,177,86,178,254,124,151,180,0,184,124,38,1,70,163,17,0,249,251,181,1,42,55,227,0,226,161,44,0,23,236,110,0,51,149,142,1,93,5,236,0,218,183,106,254,67,24,77], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
/* memory initializer */ allocate([40,245,209,255,222,121,153,0,165,57,30,0,83,125,60,0,70,38,82,1,229,6,188,0,109,222,157,255,55,118,63,255,205,151,186,0,227,33,149,255,254,176,246,1,227,177,227,0,34,106,163,254,176,43,79,0,106,95,78,1,185,241,122,255,185,14,61,0,36,1,202,0,13,178,162,255,247,11,132,0,161,230,92,1,65,1,185,255,212,50,165,1,141,146,64,255,158,242,218,0,21,164,125,0,213,139,122,1,67,71,87,0,203,158,178,1,151,92,43,0,152,111,5,255,39,3,239,255,217,255,250,255,176,63,71,255,74,245,77,1,250,174,18,255,34,49,227,255,246,46,251,255,154,35,48,1,125,157,61,255,106,36,78,255,97,236,153,0,136,187,120,255,113,134,171,255,19,213,217,254,216,94,209,255,252,5,61,0,94,3,202,0,3,26,183,255,64,191,43,255,30,23,21,0,129,141,77,255,102,120,7,1,194,76,140,0,188,175,52,255,17,81,148,0,232,86,55,1,225,48,172,0,134,42,42,255,238,50,47,0,169,18,254,0,20,147,87,255,14,195,239,255,69,247,23,0,238,229,128,255,177,49,112,0,168,98,251,255,121,71,248,0,243,8,145,254,246,227,153,255,219,169,177,254,251,139,165,255,12,163,185,255,164,40,171,255,153,159,27,254,243,109,91,255,222,24,112,1,18,214,231,0,107,157,181,254,195,147,0,255,194,99,104,255,89,140,190,255,177,66,126,254,106,185,66,0,49,218,31,0,252,174,158,0,188,79,230,1,238,41,224,0,212,234,8,1,136,11,181,0,166,117,83,255,68,195,94,0,46,132,201,0,240,152,88,0,164,57,69,254,160,224,42,255,59,215,67,255,119,195,141,255,36,180,121,254,207,47,8,255,174,210,223,0,101,197,68,255,255,82,141,1,250,137,233,0,97,86,133,1,16,80,69,0,132,131,159,0,116,93,100,0,45,141,139,0,152,172,157,255,90,43,91,0,71,153,46,0,39,16,112,255,217,136,97,255,220,198,25,254,177,53,49,0,222,88,134,255,128,15,60,0,207,192,169,255,192,116,209,255,106,78,211,1,200,213,183,255,7,12,122,254,222,203,60,255,33,110,199,254,251,106,117,0,228,225,4,1,120,58,7,255,221,193,84,254,112,133,27,0,189,200,201,255,139,135,150,0,234,55,176,255,61,50,65,0,152,108,169,255,220,85,1,255,112,135,227,0,162,26,186,0,207,96,185,254,244,136,107,0,93,153,50,1,198,97,151,0,110,11,86,255,143,117,174,255,115,212,200,0,5,202,183,0,237,164,10,254,185,239,62,0,236,120,18,254,98,123,99,255,168,201,194,254,46,234,214,0,191,133,49,255,99,169,119,0,190,187,35,1,115,21,45,255,249,131,72,0,112,6,123,255,214,49,181,254,166,233,34,0,92,197,102,254,253,228,205,255,3,59,201,1,42,98,46,0,219,37,35,255,169,195,38,0,94,124,193,1,156,43,223,0,95,72,133,254,120,206,191,0,122,197,239,255,177,187,79,255,254,46,2,1,250,167,190,0,84,129,19,0,203,113,166,255,249,31,189,254,72,157,202,255,208,71,73,255,207,24,72,0,10,16,18,1,210,81,76,255,88,208,192,255,126,243,107,255,238,141,120,255,199,121,234,255,137,12,59,255,36,220,123,255,148,179,60,254,240,12,29,0,66,0,97,1,36,30,38,255,115,1,93,255,96,103,231,255,197,158,59,1,192,164,240,0,202,202,57,255,24,174,48,0,89,77,155,1,42,76,215,0,244,151,233,0,23,48,81,0,239,127,52,254,227,130,37,255,248,116,93,1,124,132,118,0,173,254,192,1,6,235,83,255,110,175,231,1,251,28,182,0,129,249,93,254,84,184,128,0,76,181,62,0,175,128,186,0,100,53,136,254,109,29,226,0,221,233,58,1,20,99,74,0,0,22,160,0,134,13,21,0,9,52,55,255,17,89,140,0,175,34,59,0,84,165,119,255,224,226,234,255,7,72,166,255,123,115,255,1,18,214,246,0,250,7,71,1,217,220,185,0,212,35,76,255,38,125,175,0,189,97,210,0,114,238,44,255,41,188,169,254,45,186,154,0,81,92,22,0,132,160,193,0,121,208,98,255,13,81,44,255,203,156,82,0,71,58,21,255,208,114,191,254,50,38,147,0,154,216,195,0,101,25,18,0,60,250,215,255,233,132,235,255,103,175,142,1,16,14,92,0,141,31,110,254,238,241,45,255,153,217,239,1,97,168,47,255,249,85,16,1,28,175,62,255,57,254,54,0,222,231,126,0,166,45,117,254,18,189,96,255,228,76,50,0,200,244,94,0,198,152,120,1,68,34,69,255,12,65,160,254,101,19,90,0,167,197,120,255,68,54,185,255,41,218,188,0,113,168,48,0,88,105,189,1,26,82,32,255,185,93,164,1,228,240,237,255,66,182,53,0,171,197,92,255,107,9,233,1,199,120,144,255,78,49,10,255,109,170,105,255,90,4,31,255,28,244,113,255,74,58,11,0,62,220,246,255,121,154,200,254,144,210,178,255,126,57,129,1,43,250,14,255,101,111,28,1,47,86,241,255,61,70,150,255,53,73,5,255,30,26,158,0,209,26,86,0,138,237,74,0,164,95,188,0,142,60,29,254,162,116,248,255,187,175,160,0,151,18,16,0,209,111,65,254,203,134,39,255,88,108,49,255,131,26,71,255,221,27,215,254,104,105,93,255,31,236,31,254,135,0,211,255,143,127,110,1,212,73,229,0,233,67,167,254,195,1,208,255,132,17,221,255,51,217,90,0,67,235,50,255,223,210,143,0,179,53,130,1,233,106,198,0,217,173,220,255,112,229,24,255,175,154,93,254,71,203,246,255,48,66,133,255,3,136,230,255,23,221,113,254,235,111,213,0,170,120,95,254,251,221,2,0,45,130,158,254,105,94,217,255,242,52,180,254,213,68,45,255,104,38,28,0,244,158,76,0,161,200,96,255,207,53,13,255,187,67,148,0,170,54,248,0,119,162,178,255,83,20,11,0,42,42,192,1,146,159,163,255,183,232,111,0,77,229,21,255,71,53,143,0,27,76,34,0,246,136,47,255,219,39,182,255,92,224,201,1,19,142,14,255,69,182,241,255,163,118,245,0,9,109,106,1,170,181,247,255,78,47,238,255,84,210,176,255,213,107,139,0,39,38,11,0,72,21,150,0,72,130,69,0,205,77,155,254,142,133,21,0,71,111,172,254,226,42,59,255,179,0,215,1,33,128,241,0,234,252,13,1,184,79,8,0,110,30,73,255,246,141,189,0,170,207,218,1,74,154,69,255,138,246,49,255,155,32,100,0,125,74,105,255,90,85,61,255,35,229,177,255,62,125,193,255,153,86,188,1,73,120,212,0,209,123,246,254,135,209,38,255,151,58,44,1,92,69,214,255,14,12,88,255,252,153,166,255,253,207,112,255,60,78,83,255,227,124,110,0,180,96,252,255,53,117,33,254,164,220,82,255,41,1,27,255,38,164,166,255,164,99,169,254,61,144,70,255,192,166,18,0,107,250,66,0,197,65,50,0,1,179,18,255,255,104,1,255,43,153,35,255,80,111,168,0,110,175,168,0,41,105,45,255,219,14,205,255,164,233,140,254,43,1,118,0,233,67,195,0,178,82,159,255,138,87,122,255,212,238,90,255,144,35,124,254,25,140,164,0,251,215,44,254,133,70,107,255,101,227,80,254,92,169,55,0,215,42,49,0,114,180,85,255,33,232,27,1,172,213,25,0,62,176,123,254,32,133,24,255,225,191,62,0,93,70,153,0,181,42,104,1,22,191,224,255,200,200,140,255,249,234,37,0,149,57,141,0,195,56,208,255,254,130,70,255,32,173,240,255,29,220,199,0,110,100,115,255,132,229,249,0,228,233,223,255,37,216,209,254,178,177,209,255,183,45,165,254,224,97,114,0,137,97,168,255,225,222,172,0,165,13,49,1,210,235,204,255,252,4,28,254,70,160,151,0,232,190,52,254,83,248,93,255,62,215,77,1,175,175,179,255,160,50,66,0,121,48,208,0,63,169,209,255,0,210,200,0,224,187,44,1,73,162,82,0,9,176,143,255,19,76,193,255,29,59,167,1,24,43,154,0,28,190,190,0,141,188,129,0,232,235,203,255,234,0,109,255,54,65,159,0,60,88,232,255,121,253,150,254,252,233,131,255,198,110,41,1,83,77,71,255,200,22,59,254,106,253,242,255,21,12,207,255,237,66,189,0,90,198,202,1,225,172,127,0,53,22,202,0,56,230,132,0,1,86,183,0,109,190,42,0,243,68,174,1,109,228,154,0,200,177,122,1,35,160,183,255,177,48,85,255,90,218,169,255,248,152,78,0,202,254,110,0,6,52,43,0,142,98,65,255,63,145,22,0,70,106,93,0,232,138,107,1,110,179,61,255,211,129,218,1,242,209,92,0,35,90,217,1,182,143,106,255,116,101,217,255,114,250,221,255,173,204,6,0,60,150,163,0,73,172,44,255,239,110,80,255,237,76,153,254,161,140,249,0,149,232,229,0,133,31,40,255,174,164,119,0,113,51,214,0,129,228,2,254,64,34,243,0,107,227,244,255,174,106,200,255,84,153,70,1,50,35,16,0,250,74,216,254,236,189,66,255,153,249,13,0,230,178,4,255,221,41,238,0,118,227,121,255,94,87,140,254,254,119,92,0,73,239,246,254,117,87,128,0,19,211,145,255,177,46,252,0,229,91,246,1,69,128,247,255,202,77,54,1,8,11,9,255,153,96,166,0,217,214,173,255,134,192,2,1,0,207,0,0,189,174,107,1,140,134,100,0,158,193,243,1,182,102,171,0,235,154,51,0,142,5,123,255,60,168,89,1,217,14,92,255,19,214,5,1,211,167,254,0,44,6,202,254,120,18,236,255,15,113,184,255,184,223,139,0,40,177,119,254,182,123,90,255,176,165,176,0,247,77,194,0,27,234,120,0,231,0,214,255,59,39,30,0,125,99,145,255,150,68,68,1,141,222,248,0,153,123,210,255,110,127,152,255,229,33,214,1,135,221,197,0,137,97,2,0,12,143,204,255,81,41,188,0,115,79,130,255,94,3,132,0,152,175,187,255,124,141,10,255,126,192,179,255,11,103,198,0,149,6,45,0,219,85,187,1,230,18,178,255,72,182,152,0,3,198,184,255,128,112,224,1,97,161,230,0,254,99,38,255,58,159,197,0,151,66,219,0,59,69,143,255,185,112,249,0,119,136,47,255,123,130,132,0,168,71,95,255,113,176,40,1,232,185,173,0,207,93,117,1,68,157,108,255,102,5,147,254,49,97,33,0,89,65,111,254,247,30,163,255,124,217,221,1,102,250,216,0,198,174,75,254,57,55,18,0,227,5,236,1,229,213,173,0,201,109,218,1,49,233,239,0,30,55,158,1,25,178,106,0,155,111,188,1,94,126,140,0,215,31,238,1,77,240,16,0,213,242,25,1,38,71,168,0,205,186,93,254,49,211,140,255,219,0,180,255,134,118,165,0,160,147,134,255,110,186,35,255,198,243,42,0,243,146,119,0,134,235,163,1,4,241,135,255,193,46,193,254,103,180,79,255,225,4,184,254,242,118,130,0,146,135,176,1,234,111,30,0,69,66,213,254,41,96,123,0,121,94,42,255,178,191,195,255,46,130,42,0,117,84,8,255,233,49,214,254,238,122,109,0,6,71,89,1,236,211,123,0,244,13,48,254,119,148,14,0,114,28,86,255,75,237,25,255,145,229,16,254,129,100,53,255,134,150,120,254,168,157,50,0,23,72,104,255,224,49,14,0,255,123,22,255,151,185,151,255,170,80,184,1,134,182,20,0,41,100,101,1,153,33,16,0,76,154,111,1,86,206,234,255,192,160,164,254,165,123,93,255,1,216,164,254,67,17,175,255,169,11,59,255,158,41,61,255,73,188,14,255,195,6,137,255,22,147,29,255,20,103,3,255,246,130,227,255,122,40,128,0,226,47,24,254,35,36,32,0,152,186,183,255,69,202,20,0,195,133,195,0,222,51,247,0,169,171,94,1,183,0,160,255,64,205,18,1,156,83,15,255,197,58,249,254,251,89,110,255,50,10,88,254,51,43,216,0,98,242,198,1,245,151,113,0,171,236,194,1,197,31,199,255,229,81,38,1,41,59,20,0,253,104,230,0,152,93,14,255,246,242,146,254,214,169,240,255,240,102,108,254,160,167,236,0,154,218,188,0,150,233,202,255,27,19,250,1,2,71,133,255,175,12,63,1,145,183,198,0,104,120,115,255,130,251,247,0,17,212,167,255,62,123,132,255,247,100,189,0,155,223,152,0,143,197,33,0,155,59,44,255,150,93,240,1,127,3,87,255,95,71,207,1,167,85,1,255,188,152,116,255,10,23,23,0,137,195,93,1,54,98,97,0,240,0,168,255,148,188,127,0,134,107,151,0,76,253,171,0,90,132,192,0,146,22,54,0,224,66,54,254,230,186,229,255,39,182,196,0,148,251,130,255,65,131,108,254,128,1,160,0,169,49,167,254,199,254,148,255,251,6,131,0,187,254,129,255,85,82,62,0,178,23,58,255,254,132,5,0,164,213,39,0,134,252,146,254,37,53,81,255,155,134,82,0,205,167,238,255,94,45,180,255,132,40,161,0,254,111,112,1,54,75,217,0,179,230,221,1,235,94,191,255,23,243,48,1,202,145,203,255,39,118,42,255,117,141,253,0,254,0,222,0,43,251,50,0,54,169,234,1,80,68,208,0,148,203,243,254,145,7,135,0,6,254,0,0,252,185,127,0,98,8,129,255,38,35,72,255,211,36,220,1,40,26,89,0,168,64,197,254,3,222,239,255,2,83,215,254,180,159,105,0,58,115,194,0,186,116,106,255,229,247,219,255,129,118,193,0,202,174,183,1,166,161,72,0,201,107,147,254,237,136,74,0,233,230,106,1,105,111,168,0,64,224,30,1,1,229,3,0,102,151,175,255,194,238,228,255,254,250,212,0,187,237,121,0,67,251,96,1,197,30,11,0,183,95,204,0,205,89,138,0,64,221,37,1,255,223,30,255,178,48,211,255,241,200,90,255,167,209,96,255,57,130,221,0,46,114,200,255,61,184,66,0,55,182,24,254,110,182,33,0,171,190,232,255,114,94,31,0,18,221,8,0,47,231,254,0,255,112,83,0,118,15,215,255,173,25,40,254,192,193,31,255,238,21,146,255,171,193,118,255,101,234,53,254,131,212,112,0,89,192,107,1,8,208,27,0,181,217,15,255,231,149,232,0,140,236,126,0,144,9,199,255,12,79,181,254,147,182,202,255,19,109,182,255,49,212,225,0,74,163,203,0,175,233,148,0,26,112,51,0,193,193,9,255,15,135,249,0,150,227,130,0,204,0,219,1,24,242,205,0,238,208,117,255,22,244,112,0,26,229,34,0,37,80,188,255,38,45,206,254,240,90,225,255,29,3,47,255,42,224,76,0,186,243,167,0,32,132,15,255,5,51,125,0,139,135,24,0,6,241,219,0,172,229,133,255,246,214,50,0,231,11,207,255,191,126,83,1,180,163,170,255,245,56,24,1,178,164,211,255,3,16,202,1,98,57,118,255,141,131,89,254,33,51,24,0,243,149,91,255,253,52,14,0,35,169,67,254,49,30,88,255,179,27,36,255,165,140,183,0,58,189,151,0,88,31,0,0,75,169,66,0,66,101,199,255,24,216,199,1,121,196,26,255,14,79,203,254,240,226,81,255,94,28,10,255,83,193,240,255,204,193,131,255,94,15,86,0,218,40,157,0,51,193,209,0,0,242,177,0,102,185,247,0,158,109,116,0,38,135,91,0,223,175,149,0,220,66,1,255,86,60,232,0,25,96,37,255,225,122,162,1,215,187,168,255,158,157,46,0,56,171,162,0,232,240,101,1,122,22,9,0,51,9,21,255,53,25,238,255,217,30,232,254,125,169,148,0,13,232,102,0,148,9,37,0,165,97,141,1,228,131,41,0,222,15,243,255,254,18,17,0,6,60,237,1,106,3,113,0,59,132,189,0,92,112,30,0,105,208,213,0,48,84,179,255,187,121,231,254,27,216,109,255,162,221,107,254,73,239,195,255,250,31,57,255,149,135,89,255,185,23,115,1,3,163,157,255,18,112,250,0,25,57,187,255,161,96,164,0,47,16,243,0,12,141,251,254,67,234,184,255,41,18,161,0,175,6,96,255,160,172,52,254,24,176,183,255,198,193,85,1,124,121,137,255,151,50,114,255,220,203,60,255,207,239,5,1,0,38,107,255,55,238,94,254,70,152,94,0,213,220,77,1,120,17,69,255,85,164,190,255,203,234,81,0,38,49,37,254,61,144,124,0,137,78,49,254,168,247,48,0,95,164,252,0,105,169,135,0,253,228,134,0,64,166,75,0,81,73,20,255,207,210,10,0,234,106,150,255,94,34,90,255,254,159,57,254,220,133,99,0,139,147,180,254,24,23,185,0,41,57,30,255,189,97,76,0,65,187,223,255,224,172,37,255,34,62,95,1,231,144,240,0,77,106,126,254,64,152,91,0,29,98,155,0,226,251,53,255,234,211,5,255,144,203,222,255,164,176,221,254,5,231,24,0,179,122,205,0,36,1,134,255,125,70,151,254,97,228,252,0,172,129,23,254,48,90,209,255,150,224,82,1,84,134,30,0,241,196,46,0,103,113,234,255,46,101,121,254,40,124,250,255,135,45,242,254,9,249,168,255,140,108,131,255,143,163,171,0,50,173,199,255,88,222,142,255,200,95,158,0,142,192,163,255,7,117,135,0,111,124,22,0,236,12,65,254,68,38,65,255,227,174,254,0,244,245,38,0,240,50,208,255,161,63,250,0,60,209,239,0,122,35,19,0,14,33,230,254,2,159,113,0,106,20,127,255,228,205,96,0,137,210,174,254,180,212,144,255,89,98,154,1,34,88,139,0,167,162,112,1,65,110,197,0,241,37,169,0,66,56,131,255,10,201,83,254,133,253,187,255,177,112,45,254,196,251,0,0,196,250,151,255,238,232,214,255,150,209,205,0,28,240,118,0,71,76,83,1,236,99,91,0,42,250,131,1,96,18,64,255,118,222,35,0,113,214,203,255,122,119,184,255,66,19,36,0,204,64,249,0,146,89,139,0,134,62,135,1,104,233,101,0,188,84,26,0,49,249,129,0,208,214,75,255,207,130,77,255,115,175,235,0,171,2,137,255,175,145,186,1,55,245,135,255,154,86,181,1,100,58,246,255,109,199,60,255,82,204,134,255,215,49,230,1,140,229,192,255,222,193,251,255,81,136,15,255,179,149,162,255,23,39,29,255,7,95,75,254,191,81,222,0,241,81,90,255,107,49,201,255,244,211,157,0,222,140,149,255,65,219,56,254,189,246,90,255,178,59,157,1,48,219,52,0,98,34,215,0,28,17,187,255,175,169,24,0,92,79,161,255,236,200,194,1,147,143,234,0,229,225,7,1,197,168,14,0,235,51,53,1,253,120,174,0,197,6,168,255,202,117,171,0,163,21,206,0,114,85,90,255,15,41,10,255,194,19,99,0,65,55,216,254,162,146,116,0,50,206,212,255,64,146,29,255,158,158,131,1,100,165,130,255,172,23,129,255,125,53,9,255,15,193,18,1,26,49,11,255,181,174,201,1,135,201,14,255,100,19,149,0,219,98,79,0,42,99,143,254,96,0,48,255,197,249,83,254,104,149,79,255,235,110,136,254,82,128,44,255,65,41,36,254,88,211,10,0,187,121,187,0,98,134,199,0,171,188,179,254,210,11,238,255,66,123,130,254,52,234,61,0,48,113,23,254,6,86,120,255,119,178,245,0,87,129,201,0,242,141,209,0,202,114,85,0,148,22,161,0,103,195,48,0,25,49,171,255,138,67,130,0,182,73,122,254,148,24,130,0,211,229,154,0,32,155,158,0,84,105,61,0,177,194,9,255,166,89,86,1,54,83,187,0,249,40,117,255,109,3,215,255,53,146,44,1,63,47,179,0,194,216,3,254,14,84,136,0,136,177,13,255,72,243,186,255,117,17,125,255,211,58,211,255,93,79,223,0,90,88,245,255,139,209,111,255,70,222,47,0,10,246,79,255,198,217,178,0,227,225,11,1,78,126,179,255,62,43,126,0,103,148,35,0,129,8,165,254,245,240,148,0,61,51,142,0,81,208,134,0,15,137,115,255,211,119,236,255,159,245,248,255,2,134,136,255,230,139,58,1,160,164,254,0,114,85,141,255,49,166,182,255,144,70,84,1,85,182,7,0,46,53,93,0,9,166,161,255,55,162,178,255,45,184,188,0,146,28,44,254,169,90,49,0,120,178,241,1,14,123,127,255,7,241,199,1,189,66,50,255,198,143,101,254,189,243,135,255,141,24,24,254,75,97,87,0,118,251,154,1,237,54,156,0,171,146,207,255,131,196,246,255,136,64,113,1,151,232,57,0,240,218,115,0,49,61,27,255,64,129,73,1,252,169,27,255,40,132,10,1,90,201,193,255,252,121,240,1,186,206,41,0,43,198,97,0,145,100,183,0,204,216,80,254,172,150,65,0,249,229,196,254,104,123,73,255,77,104,96,254,130,180,8,0,104,123,57,0,220,202,229,255,102,249,211,0,86,14,232,255,182,78,209,0,239,225,164,0,106,13,32,255,120,73,17,255,134,67,233,0,83,254,181,0,183,236,112,1,48,64,131,255,241,216,243,255,65,193,226,0,206,241,100,254,100,134,166,255,237,202,197,0,55,13,81,0,32,124,102,255,40,228,177,0,118,181,31,1,231,160,134,255,119,187,202,0,0,142,60,255,128,38,189,255,166,201,150,0,207,120,26,1,54,184,172,0,12,242,204,254,133,66,230,0,34,38,31,1,184,112,80,0,32,51,165,254,191,243,55,0,58,73,146,254,155,167,205,255,100,104,152,255,197,254,207,255,173,19,247,0,238,10,202,0,239,151,242,0,94,59,39,255,240,29,102,255,10,92,154,255,229,84,219,255,161,129,80,0,208,90,204,1,240,219,174,255,158,102,145,1,53,178,76,255,52,108,168,1,83,222,107,0,211,36,109,0,118,58,56,0,8,29,22,0,237,160,199,0,170,209,157,0,137,71,47,0,143,86,32,0,198,242,2,0,212,48,136,1,92,172,186,0,230,151,105,1,96,191,229,0,138,80,191,254,240,216,130,255,98,43,6,254,168,196,49,0,253,18,91,1,144,73,121,0,61,146,39,1,63,104,24,255,184,165,112,254,126,235,98,0,80,213,98,255,123,60,87,255,82,140,245,1,223,120,173,255,15,198,134,1,206,60,239,0,231,234,92,255,33,238,19,255,165,113,142,1,176,119,38,0,160,43,166,254,239,91,105,0,107,61,194,1,25,4,68,0,15,139,51,0,164,132,106,255,34,116,46,254,168,95,197,0,137,212,23,0,72,156,58,0,137,112,69,254,150,105,154,255,236,201,157,0,23,212,154,255,136,82,227,254,226,59,221,255,95,149,192,0,81,118,52,255,33,43,215,1,14,147,75,255,89,156,121,254,14,18,79,0,147,208,139,1,151,218,62,255,156,88,8,1,210,184,98,255,20,175,123,255,102,83,229,0,220,65,116,1,150,250,4,255,92,142,220,255,34,247,66,255,204,225,179,254,151,81,151,0,71,40,236,255,138,63,62,0,6,79,240,255,183,185,181,0,118,50,27,0,63,227,192,0,123,99,58,1,50,224,155,255,17,225,223,254,220,224,77,255,14,44,123,1,141,128,175,0,248,212,200,0,150,59,183,255,147,97,29,0,150,204,181,0,253,37,71,0,145,85,119,0,154,200,186,0,2,128,249,255,83,24,124,0,14,87,143,0,168,51,245,1,124,151,231,255,208,240,197,1,124,190,185,0,48,58,246,0,20,233,232,0,125,18,98,255,13,254,31,255,245,177,130,255,108,142,35,0,171,125,242,254,140,12,34,255,165,161,162,0,206,205,101,0,247,25,34,1,100,145,57,0,39,70,57,0,118,204,203,255,242,0,162,0,165,244,30,0,198,116,226,0,128,111,153,255,140,54,182,1,60,122,15,255,155,58,57,1,54,50,198,0,171,211,29,255,107,138,167,255,173,107,199,255,109,161,193,0,89,72,242,255,206,115,89,255,250,254,142,254,177,202,94,255,81,89,50,0,7,105,66,255,25,254,255,254,203,64,23,255,79,222,108,255,39,249,75,0,241,124,50,0,239,152,133,0,221,241,105,0,147,151,98,0,213,161,121,254,242,49,137,0,233,37,249,254,42,183,27,0,184,119,230,255,217,32,163,255,208,251,228,1,137,62,131,255,79,64,9,254,94,48,113,0,17,138,50,254,193,255,22,0,247,18,197,1,67,55,104,0,16,205,95,255,48,37,66,0,55,156,63,1,64,82,74,255,200,53,71,254,239,67,125,0,26,224,222,0,223,137,93,255,30,224,202,255,9,220,132,0,198,38,235,1,102,141,86,0,60,43,81,1,136,28,26,0,233,36,8,254,207,242,148,0,164,162,63,0,51,46,224,255,114,48,79,255,9,175,226,0,222,3,193,255,47,160,232,255,255,93,105,254,14,42,230,0,26,138,82,1,208,43,244,0,27,39,38,255,98,208,127,255,64,149,182,255,5,250,209,0,187,60,28,254,49,25,218,255,169,116,205,255,119,18,120,0,156,116,147,255,132,53,109,255,13,10,202,0,110,83,167,0,157,219,137,255,6,3,130,255,50,167,30,255,60,159,47,255,129,128,157,254,94,3,189,0,3,166,68,0,83,223,215,0,150,90,194,1,15,168,65,0,227,83,51,255,205,171,66,255,54,187,60,1,152,102,45,255,119,154,225,0,240,247,136,0,100,197,178,255,139,71,223,255,204,82,16,1,41,206,42,255,156,192,221,255,216,123,244,255,218,218,185,255,187,186,239,255,252,172,160,255,195,52,22,0,144,174,181,254,187,100,115,255,211,78,176,255,27,7,193,0,147,213,104,255,90,201,10,255,80,123,66,1,22,33,186,0,1,7,99,254,30,206,10,0,229,234,5,0,53,30,210,0,138,8,220,254,71,55,167,0,72,225,86,1,118,190,188,0,254,193,101,1,171,249,172,255,94,158,183,254,93,2,108,255,176,93,76,255,73,99,79,255,74,64,129,254,246,46,65,0,99,241,127,254,246,151,102,255,44,53,208,254,59,102,234,0,154,175,164,255,88,242,32,0,111,38,1,0,255,182,190,255,115,176,15,254,169,60,129,0,122,237,241,0,90,76,63,0,62,74,120,255,122,195,110,0,119,4,178,0,222,242,210,0,130,33,46,254,156,40,41,0,167,146,112,1,49,163,111,255,121,176,235,0,76,207,14,255,3,25,198,1,41,235,213,0,85,36,214,1,49,92,109,255,200,24,30,254,168,236,195,0,145,39,124,1,236,195,149,0,90,36,184,255,67,85,170,255,38,35,26,254,131,124,68,255,239,155,35,255,54,201,164,0,196,22,117,255,49,15,205,0,24,224,29,1,126,113,144,0,117,21,182,0,203,159,141,0,223,135,77,0,176,230,176,255,190,229,215,255,99,37,181,255,51,21,138,255,25,189,89,255,49,48,165,254,152,45,247,0,170,108,222,0,80,202,5,0,27,69,103,254,204,22,129,255,180,252,62,254,210,1,91,255,146,110,254,255,219,162,28,0,223,252,213,1,59,8,33,0,206,16,244,0,129,211,48,0,107,160,208,0,112,59,209,0,109,77,216,254,34,21,185,255,246,99,56,255,179,139,19,255,185,29,50,255,84,89,19,0,74,250,98,255,225,42,200,255,192,217,205,255,210,16,167,0,99,132,95,1,43,230,57,0,254,11,203,255,99,188,63,255,119,193,251,254,80,105,54,0,232,181,189,1,183,69,112,255,208,171,165,255,47,109,180,255,123,83,165,0,146,162,52,255,154,11,4,255,151,227,90,255,146,137,97,254,61,233,41,255,94,42,55,255,108,164,236,0,152,68,254,0,10,140,131,255,10,106,79,254,243,158,137,0,67,178,66,254,177,123,198,255,15,62,34,0,197,88,42,255,149,95,177,255,152,0,198,255,149,254,113,255,225,90,163,255,125,217,247,0,18,17,224,0,128,66,120,254,192,25,9,255,50,221,205,0,49,212,70,0,233,255,164,0,2,209,9,0,221,52,219,254,172,224,244,255,94,56,206,1,242,179,2,255,31,91,164,1,230,46,138,255,189,230,220,0,57,47,61,255,111,11,157,0,177,91,152,0,28,230,98,0,97,87,126,0,198,89,145,255,167,79,107,0,249,77,160,1,29,233,230,255,150,21,86,254,60,11,193,0,151,37,36,254,185,150,243,255,228,212,83,1,172,151,180,0,201,169,155,0,244,60,234,0,142,235,4,1,67,218,60,0,192,113,75,1,116,243,207,255,65,172,155,0,81,30,156,255,80,72,33,254,18,231,109,255,142,107,21,254,125,26,132,255,176,16,59,255,150,201,58,0,206,169,201,0,208,121,226,0,40,172,14,255,150,61,94,255,56,57,156,255,141,60,145,255,45,108,149,255,238,145,155,255,209,85,31,254,192,12,210,0,99,98,93,254,152,16,151,0,225,185,220,0,141,235,44,255,160,172,21,254,71,26,31,255,13,64,93,254,28,56,198,0,177,62,248,1,182,8,241,0,166,101,148,255,78,81,133,255,129,222,215,1,188,169,129,255,232,7,97,0,49,112,60,255,217,229,251,0,119,108,138,0,39,19,123,254,131,49,235,0,132,84,145,0,130,230,148,255,25,74,187,0,5,245,54,255,185,219,241,1,18,194,228,255,241,202,102,0,105,113,202,0,155,235,79,0,21,9,178,255,156,1,239,0,200,148,61,0,115,247,210,255,49,221,135,0,58,189,8,1,35,46,9,0,81,65,5,255,52,158,185,255,125,116,46,255,74,140,13,255,210,92,172,254,147,23,71,0,217,224,253,254,115,108,180,255,145,58,48,254,219,177,24,255,156,255,60,1,154,147,242,0,253,134,87,0,53,75,229,0,48,195,222,255,31,175,50,255,156,210,120,255,208,35,222,255,18,248,179,1,2,10,101,255,157,194,248,255,158,204,101,255,104,254,197,255,79,62,4,0,178,172,101,1,96,146,251,255,65,10,156,0,2,137,165,255,116,4,231,0,242,215,1,0,19,35,29,255,43,161,79,0,59,149,246,1,251,66,176,0,200,33,3,255,80,110,142,255,195,161,17,1,228,56,66,255,123,47,145,254,132,4,164,0,67,174,172,0,25,253,114,0,87,97,87,1,250,220,84,0,96,91,200,255,37,125,59,0,19,65,118,0,161,52,241,255,237,172,6,255,176,191,255,255,1,65,130,254,223,190,230,0,101,253,231,255,146,35,109,0,250,29,77,1,49,0,19,0,123,90,155,1,22,86,32,255,218,213,65,0,111,93,127,0,60,93,169,255,8,127,182,0,17,186,14,254,253,137,246,255,213,25,48,254,76,238,0,255,248,92,70,255,99,224,139,0,184,9,255,1,7,164,208,0,205,131,198,1,87,214,199,0,130,214,95,0,221,149,222,0,23,38,171,254,197,110,213,0,43,115,140,254,215,177,118,0,96,52,66,1,117,158,237,0,14,64,182,255,46,63,174,255,158,95,190,255,225,205,177,255,43,5,142,255,172,99,212,255,244,187,147,0,29,51,153,255,228,116,24,254,30,101,207,0,19,246,150,255,134,231,5,0,125,134,226,1,77,65,98,0,236,130,33,255,5,110,62,0,69,108,127,255,7,113,22,0,145,20,83,254,194,161,231,255,131,181,60,0,217,209,177,255,229,148,212,254,3,131,184,0,117,177,187,1,28,14,31,255,176,102,80,0,50,84,151,255,125,31,54,255,21,157,133,255,19,179,139,1,224,232,26,0,34,117,170,255,167,252,171,255,73,141,206,254,129,250,35,0,72,79,236,1,220,229,20,255,41,202,173,255,99,76,238,255,198,22,224,255,108,198,195,255,36,141,96,1,236,158,59,255,106,100,87,0,110,226,2,0,227,234,222,0,154,93,119,255,74,112,164,255,67,91,2,255,21,145,33,255,102,214,137,255,175,230,103,254,163,246,166,0,93,247,116,254,167,224,28,255,220,2,57,1,171,206,84,0,123,228,17,255,27,120,119,0,119,11,147,1,180,47,225,255,104,200,185,254,165,2,114,0,77,78,212,0,45,154,177,255,24,196,121,254,82,157,182,0,90,16,190,1,12,147,197,0,95,239,152,255,11,235,71,0,86,146,119,255,172,134,214,0,60,131,196,0,161,225,129,0,31,130,120,254,95,200,51,0,105,231,210,255,58,9,148,255,43,168,221,255,124,237,142,0,198,211,50,254,46,245,103,0,164,248,84,0,152,70,208,255,180,117,177,0,70,79,185,0,243,74,32,0,149,156,207,0,197,196,161,1,245,53,239,0,15,93,246,254,139,240,49,255,196,88,36,255,162,38,123,0,128,200,157,1,174,76,103,255,173,169,34,254,216,1,171,255,114,51,17,0,136,228,194,0,110,150,56,254,106,246,159,0,19,184,79,255,150,77,240,255,155,80,162,0,0,53,169,255,29,151,86,0,68,94,16,0,92,7,110,254,98,117,149,255,249,77,230,255,253,10,140,0,214,124,92,254,35,118,235,0,89,48,57,1,22,53,166,0,184,144,61,255,179,255,194,0,214,248,61,254,59,110,246,0,121,21,81,254,166,3,228,0,106,64,26,255,69,232,134,255,242,220,53,254,46,220,85,0,113,149,247,255,97,179,103,255,190,127,11,0,135,209,182,0,95,52,129,1,170,144,206,255,122,200,204,255,168,100,146,0,60,144,149,254,70,60,40,0,122,52,177,255,246,211,101,255,174,237,8,0,7,51,120,0,19,31,173,0,126,239,156,255,143,189,203,0,196,128,88,255,233,133,226,255,30,125,173,255,201,108,50,0,123,100,59,255,254,163,3,1,221,148,181,255,214,136,57,254,222,180,137,255,207,88,54,255,28,33,251,255,67,214,52,1,210,208,100,0,81,170,94,0,145,40,53,0,224,111,231,254,35,28,244,255,226,199,195,254,238,17,230,0,217,217,164,254,169,157,221,0,218,46,162,1,199,207,163,255,108,115,162,1,14,96,187,255,118,60,76,0,184,159,152,0,209,231,71,254,42,164,186,255,186,153,51,254,221,171,182,255,162,142,173,0,235,47,193,0,7,139,16,1,95,164,64,255,16,221,166,0,219,197,16,0,132,29,44,255,100,69,117,255,60,235,88,254,40,81,173,0,71,190,61,255,187,88,157,0,231,11,23,0,237,117,164,0,225,168,223,255,154,114,116,255,163,152,242,1,24,32,170,0,125,98,113,254,168,19,76,0,17,157,220,254,155,52,5,0,19,111,161,255,71,90,252,255,173,110,240,0,10,198,121,255,253,255,240,255,66,123,210,0,221,194,215,254,121,163,17,255,225,7,99,0,190,49,182,0,115,9,133,1,232,26,138,255,213,68,132,0,44,119,122,255,179,98,51,0,149,90,106,0,71,50,230,255,10,153,118,255,177,70,25,0,165,87,205,0,55,138,234,0,238,30,97,0,113,155,207,0,98,153,127,0,34,107,219,254,117,114,172,255,76,180,255,254,242,57,179,255,221,34,172,254,56,162,49,255,83,3,255,255,113,221,189,255,188,25,228,254,16,88,89,255,71,28,198,254,22,17,149,255,243,121,254,255,107,202,99,255,9,206,14,1,220,47,153,0,107,137,39,1,97,49,194,255,149,51,197,254,186,58,11,255,107,43,232,1,200,6,14,255,181,133,65,254,221,228,171,255,123,62,231,1,227,234,179,255,34,189,212,254,244,187,249,0,190,13,80,1,130,89,1,0,223,133,173,0,9,222,198,255,66,127,74,0,167,216,93,255,155,168,198,1,66,145,0,0,68,102,46,1,172,90,154,0,216,128,75,255,160,40,51,0,158,17,27,1,124,240,49,0,236,202,176,255,151,124,192,255,38,193,190,0,95,182,61,0,163,147,124,255,255,165,51,255,28,40,17,254,215,96,78,0,86,145,218,254,31,36,202,255,86,9,5,0,111,41,200,255,237,108,97,0,57,62,44,0,117,184,15,1,45,241,116,0,152,1,220,255,157,165,188,0,250,15,131,1,60,44,125,255,65,220,251,255,75,50,184,0,53,90,128,255,231,80,194,255,136,129,127,1,21,18,187,255,45,58,161,255,71,147,34,0,174,249,11,254,35,141,29,0,239,68,177,255,115,110,58,0,238,190,177,1,87,245,166,255,190,49,247,255,146,83,184,255,173,14,39,255,146,215,104,0,142,223,120,0,149,200,155,255,212,207,145,1,16,181,217,0,173,32,87,255,255,35,181,0,119,223,161,1,200,223,94,255,70,6,186,255,192,67,85,255,50,169,152,0,144,26,123,255,56,243,179,254,20,68,136,0,39,140,188,254,253,208,5,255,200,115,135,1,43,172,229,255,156,104,187,0,151,251,167,0,52,135,23,0,151,153,72,0,147,197,107,254,148,158,5,255,238,143,206,0,126,153,137,255,88,152,197,254,7,68,167,0,252,159,165,255,239,78,54,255,24,63,55,255,38,222,94,0,237,183,12,255,206,204,210,0,19,39,246,254,30,74,231,0,135,108,29,1,179,115,0,0,117,118,116,1,132,6,252,255,145,129,161,1,105,67,141,0,82,37,226,255,238,226,228,255,204,214,129,254,162,123,100,255,185,121,234,0,45,108,231,0,66,8,56,255,132,136,128,0,172,224,66,254,175,157,188,0,230,223,226,254,242,219,69,0,184,14,119,1,82,162,56,0,114,123,20,0,162,103,85,255,49,239,99,254,156,135,215,0,111,255,167,254,39,196,214,0,144,38,79,1,249,168,125,0,155,97,156,255,23,52,219,255,150,22,144,0,44,149,165,255,40,127,183,0,196,77,233,255,118,129,210,255,170,135,230,255,214,119,198,0,233,240,35,0,253,52,7,255,117,102,48,255,21,204,154,255,179,136,177,255,23,2,3,1,149,130,89,255,252,17,159,1,70,60,26,0,144,107,17,0,180,190,60,255,56,182,59,255,110,71,54,255,198,18,129,255,149,224,87,255,223,21,152,255,138,22,182,255,250,156,205,0,236,45,208,255,79,148,242,1,101,70,209,0,103,78,174,0,101,144,172,255,152,136,237,1,191,194,136,0,113,80,125,1,152,4,141,0,155,150,53,255,196,116,245,0,239,114,73,254,19,82,17,255,124,125,234,255,40,52,191,0,42,210,158,255,155,132,165,0,178,5,42,1,64,92,40,255,36,85,77,255,178,228,118,0,137,66,96,254,115,226,66,0,110,240,69,254,151,111,80,0,167,174,236,255,227,108,107,255,188,242,65,255,183,81,255,0,57,206,181,255,47,34,181,255,213,240,158,1,71,75,95,0,156,40,24,255,102,210,81,0,171,199,228,255,154,34,41,0,227,175,75,0,21,239,195,0,138,229,95,1,76,192,49,0,117,123,87,1,227,225,130,0,125,62,63,255,2,198,171,0,254,36,13,254,145,186,206,0,148,255,244,255,35,0,166,0,30,150,219,1,92,228,212,0,92,198,60,254,62,133,200,255,201,41,59,0,125,238,109,255,180,163,238,1,140,122,82,0,9,22,88,255,197,157,47,255,153,94,57,0,88,30,182,0,84,161,85,0,178,146,124,0,166,166,7,255,21,208,223,0,156,182,242,0,155,121,185,0,83,156,174,254,154,16,118,255,186,83,232,1,223,58,121,255,29,23,88,0,35,125,127,255,170,5,149,254,164,12,130,255,155,196,29,0,161,96,136,0,7,35,29,1,162,37,251,0,3,46,242,255,0,217,188,0,57,174,226,1,206,233,2,0,57,187,136,254,123,189,9,255,201,117,127,255,186,36,204,0,231,25,216,0,80,78,105,0,19,134,129,255,148,203,68,0,141,81,125,254,248,165,200,255,214,144,135,0,151,55,166,255,38,235,91,0,21,46,154,0,223,254,150,255,35,153,180,255,125,176,29,1,43,98,30,255,216,122,230,255,233,160,12,0,57,185,12,254,240,113,7,255,5,9,16,254,26,91,108,0,109,198,203,0,8,147,40,0,129,134,228,255,124,186,40,255,114,98,132,254,166,132,23,0,99,69,44,0,9,242,238,255,184,53,59,0,132,129,102,255,52,32,243,254,147,223,200,255,123,83,179,254,135,144,201,255,141,37,56,1,151,60,227,255,90,73,156,1,203,172,187,0,80,151,47,255,94,137,231,255,36,191,59,255,225,209,181,255,74,215,213,254,6,118,179,255,153,54,193,1,50,0,231,0,104,157,72,1,140,227,154,255,182,226,16,254,96,225,92,255,115,20,170,254,6,250,78,0,248,75,173,255,53,89,6,255,0,180,118,0,72,173,1,0,64,8,206,1,174,133,223,0,185,62,133,255,214,11,98,0,197,31,208,0,171,167,244,255,22,231,181,1,150,218,185,0,247,169,97,1,165,139,247,255,47,120,149,1,103,248,51,0,60,69,28,254,25,179,196,0,124,7,218,254,58,107,81,0,184,233,156,255,252,74,36,0,118,188,67,0,141,95,53,255,222,94,165,254,46,61,53,0,206,59,115,255,47,236,250,255,74,5,32,1,129,154,238,255,106,32,226,0,121,187,61,255,3,166,241,254,67,170,172,255,29,216,178,255,23,201,252,0,253,110,243,0,200,125,57,0,109,192,96,255,52,115,238,0,38,121,243,255,201,56,33,0,194,118,130,0,75,96,25,255,170,30,230,254,39,63,253,0,36,45,250,255,251,1,239,0,160,212,92,1,45,209,237,0,243,33,87,254,237,84,201,255,212,18,157,254,212,99,127,255,217,98,16,254,139,172,239,0,168,201,130,255,143,193,169,255,238,151,193,1,215,104,41,0,239,61,165,254,2,3,242,0,22,203,177,254,177,204,22,0,149,129,213,254,31,11,41,255,0,159,121,254,160,25,114,255,162,80,200,0,157,151,11,0,154,134,78,1,216,54,252,0,48,103,133,0,105,220,197,0,253,168,77,254,53,179,23,0,24,121,240,1,255,46,96,255,107,60,135,254,98,205,249,255,63,249,119,255,120,59,211,255,114,180,55,254,91,85,237,0,149,212,77,1,56,73,49,0,86,198,150,0,93,209,160,0,69,205,182,255,244,90,43,0,20,36,176,0,122,116,221,0,51,167,39,1,231,1,63,255,13,197,134,0,3,209,34,255,135,59,202,0,167,100,78,0,47,223,76,0,185,60,62,0,178,166,123,1,132,12,161,255,61,174,43,0,195,69,144,0,127,47,191,1,34,44,78,0,57,234,52,1,255,22,40,255,246,94,146,0,83,228,128,0,60,78,224,255,0,96,210,255,153,175,236,0,159,21,73,0,180,115,196,254,131,225,106,0,255,167,134,0,159,8,112,255,120,68,194,255,176,196,198,255,118,48,168,255,93,169,1,0,112,200,102,1,74,24,254,0,19,141,4,254,142,62,63,0,131,179,187,255,77,156,155,255,119,86,164,0,170,208,146,255,208,133,154,255,148,155,58,255,162,120,232,254,252,213,155,0,241,13,42,0,94,50,131,0,179,170,112,0,140,83,151,255,55,119,84,1,140,35,239,255,153,45,67,1,236,175,39,0,54,151,103,255,158,42,65,255,196,239,135,254,86,53,203,0,149,97,47,254,216,35,17,255,70,3,70,1,103,36,90,255,40,26,173,0,184,48,13,0,163,219,217,255,81,6,1,255,221,170,108,254,233,208,93,0,100,201,249,254,86,36,35,255,209,154,30,1,227,201,251,255,2,189,167,254,100,57,3,0,13,128,41,0,197,100,75,0,150,204,235,255,145,174,59,0,120,248,149,255,85,55,225,0,114,210,53,254,199,204,119,0,14,247,74,1,63,251,129,0,67,104,151,1,135,130,80,0,79,89,55,255,117,230,157,255,25,96,143,0,213,145,5,0,69,241,120,1,149,243,95,255,114,42,20,0,131,72,2,0,154,53,20,255,73,62,109,0,196,102,152,0,41,12,204,255,122,38,11,1,250,10,145,0,207,125,148,0,246,244,222,255,41,32,85,1,112,213,126,0,162,249,86,1,71,198,127,255,81,9,21,1,98,39,4,255,204,71,45,1,75,111,137,0,234,59,231,0,32,48,95,255,204,31,114,1,29,196,181,255,51,241,167,254,93,109,142,0,104,144,45,0,235,12,181,255,52,112,164,0,76,254,202,255,174,14,162,0,61,235,147,255,43,64,185,254,233,125,217,0,243,88,167,254,74,49,8,0,156,204,66,0,124,214,123,0,38,221,118,1,146,112,236,0,114,98,177,0,151,89,199,0,87,197,112,0,185,149,161,0,44,96,165,0,248,179,20,255,188,219,216,254,40,62,13,0,243,142,141,0,229,227,206,255,172,202,35,255,117,176,225,255,82,110,38,1,42,245,14,255,20,83,97,0,49,171,10,0,242,119,120,0,25,232,61,0,212,240,147,255,4,115,56,255,145,17,239,254,202,17,251,255,249,18,245,255,99,117,239,0,184,4,179,255,246,237,51,255,37,239,137,255,166,112,166,255,81,188,33,255,185,250,142,255,54,187,173,0,208,112,201,0,246,43,228,1,104,184,88,255,212,52,196,255,51,117,108,255,254,117,155,0,46,91,15,255,87,14,144,255,87,227,204,0,83,26,83,1,159,76,227,0,159,27,213,1,24,151,108,0,117,144,179,254,137,209,82,0,38,159,10,0,115,133,201,0,223,182,156,1,110,196,93,255,57,60,233,0,5,167,105,255,154,197,164,0,96,34,186,255,147,133,37,1,220,99,190,0,1,167,84,255,20,145,171,0,194,197,251,254,95,78,133,255,252,248,243,255,225,93,131,255,187,134,196,255,216,153,170,0,20,118,158,254,140,1,118], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+10240);
/* memory initializer */ allocate([86,158,15,1,45,211,41,255,147,1,100,254,113,116,76,255,211,127,108,1,103,15,48,0,193,16,102,1,69,51,95,255,107,128,157,0,137,171,233,0,90,124,144,1,106,161,182,0,175,76,236,1,200,141,172,255,163,58,104,0,233,180,52,255,240,253,14,255,162,113,254,255,38,239,138,254,52,46,166,0,241,101,33,254,131,186,156,0,111,208,62,255,124,94,160,255,31,172,254,0,112,174,56,255,188,99,27,255,67,138,251,0,125,58,128,1,156,152,174,255,178,12,247,255,252,84,158,0,82,197,14,254,172,200,83,255,37,39,46,1,106,207,167,0,24,189,34,0,131,178,144,0,206,213,4,0,161,226,210,0,72,51,105,255,97,45,187,255,78,184,223,255,176,29,251,0,79,160,86,255,116,37,178,0,82,77,213,1,82,84,141,255,226,101,212,1,175,88,199,255,245,94,247,1,172,118,109,255,166,185,190,0,131,181,120,0,87,254,93,255,134,240,73,255,32,245,143,255,139,162,103,255,179,98,18,254,217,204,112,0,147,223,120,255,53,10,243,0,166,140,150,0,125,80,200,255,14,109,219,255,91,218,1,255,252,252,47,254,109,156,116,255,115,49,127,1,204,87,211,255,148,202,217,255,26,85,249,255,14,245,134,1,76,89,169,255,242,45,230,0,59,98,172,255,114,73,132,254,78,155,49,255,158,126,84,0,49,175,43,255,16,182,84,255,157,103,35,0,104,193,109,255,67,221,154,0,201,172,1,254,8,162,88,0,165,1,29,255,125,155,229,255,30,154,220,1,103,239,92,0,220,1,109,255,202,198,1,0,94,2,142,1,36,54,44,0,235,226,158,255,170,251,214,255,185,77,9,0,97,74,242,0,219,163,149,255,240,35,118,255,223,114,88,254,192,199,3,0,106,37,24,255,201,161,118,255,97,89,99,1,224,58,103,255,101,199,147,254,222,60,99,0,234,25,59,1,52,135,27,0,102,3,91,254,168,216,235,0,229,232,136,0,104,60,129,0,46,168,238,0,39,191,67,0,75,163,47,0,143,97,98,255,56,216,168,1,168,233,252,255,35,111,22,255,92,84,43,0,26,200,87,1,91,253,152,0,202,56,70,0,142,8,77,0,80,10,175,1,252,199,76,0,22,110,82,255,129,1,194,0,11,128,61,1,87,14,145,255,253,222,190,1,15,72,174,0,85,163,86,254,58,99,44,255,45,24,188,254,26,205,15,0,19,229,210,254,248,67,195,0,99,71,184,0,154,199,37,255,151,243,121,255,38,51,75,255,201,85,130,254,44,65,250,0,57,147,243,254,146,43,59,255,89,28,53,0,33,84,24,255,179,51,18,254,189,70,83,0,11,156,179,1,98,134,119,0,158,111,111,0,119,154,73,255,200,63,140,254,45,13,13,255,154,192,2,254,81,72,42,0,46,160,185,254,44,112,6,0,146,215,149,1,26,176,104,0,68,28,87,1,236,50,153,255,179,128,250,254,206,193,191,255,166,92,137,254,53,40,239,0,210,1,204,254,168,173,35,0,141,243,45,1,36,50,109,255,15,242,194,255,227,159,122,255,176,175,202,254,70,57,72,0,40,223,56,0,208,162,58,255,183,98,93,0,15,111,12,0,30,8,76,255,132,127,246,255,45,242,103,0,69,181,15,255,10,209,30,0,3,179,121,0,241,232,218,1,123,199,88,255,2,210,202,1,188,130,81,255,94,101,208,1,103,36,45,0,76,193,24,1,95,26,241,255,165,162,187,0,36,114,140,0,202,66,5,255,37,56,147,0,152,11,243,1,127,85,232,255,250,135,212,1,185,177,113,0,90,220,75,255,69,248,146,0,50,111,50,0,92,22,80,0,244,36,115,254,163,100,82,255,25,193,6,1,127,61,36,0,253,67,30,254,65,236,170,255,161,17,215,254,63,175,140,0,55,127,4,0,79,112,233,0,109,160,40,0,143,83,7,255,65,26,238,255,217,169,140,255,78,94,189,255,0,147,190,255,147,71,186,254,106,77,127,255,233,157,233,1,135,87,237,255,208,13,236,1,155,109,36,255,180,100,218,0,180,163,18,0,190,110,9,1,17,63,123,255,179,136,180,255,165,123,123,255,144,188,81,254,71,240,108,255,25,112,11,255,227,218,51,255,167,50,234,255,114,79,108,255,31,19,115,255,183,240,99,0,227,87,143,255,72,217,248,255,102,169,95,1,129,149,149,0,238,133,12,1,227,204,35,0,208,115,26,1,102,8,234,0,112,88,143,1,144,249,14,0,240,158,172,254,100,112,119,0,194,141,153,254,40,56,83,255,121,176,46,0,42,53,76,255,158,191,154,0,91,209,92,0,173,13,16,1,5,72,226,255,204,254,149,0,80,184,207,0,100,9,122,254,118,101,171,255,252,203,0,254,160,207,54,0,56,72,249,1,56,140,13,255,10,64,107,254,91,101,52,255,225,181,248,1,139,255,132,0,230,145,17,0,233,56,23,0,119,1,241,255,213,169,151,255,99,99,9,254,185,15,191,255,173,103,109,1,174,13,251,255,178,88,7,254,27,59,68,255,10,33,2,255,248,97,59,0,26,30,146,1,176,147,10,0,95,121,207,1,188,88,24,0,185,94,254,254,115,55,201,0,24,50,70,0,120,53,6,0,142,66,146,0,228,226,249,255,104,192,222,1,173,68,219,0,162,184,36,255,143,102,137,255,157,11,23,0,125,45,98,0,235,93,225,254,56,112,160,255,70,116,243,1,153,249,55,255,129,39,17,1,241,80,244,0,87,69,21,1,94,228,73,255,78,66,65,255,194,227,231,0,61,146,87,255,173,155,23,255,112,116,219,254,216,38,11,255,131,186,133,0,94,212,187,0,100,47,91,0,204,254,175,255,222,18,215,254,173,68,108,255,227,228,79,255,38,221,213,0,163,227,150,254,31,190,18,0,160,179,11,1,10,90,94,255,220,174,88,0,163,211,229,255,199,136,52,0,130,95,221,255,140,188,231,254,139,113,128,255,117,171,236,254,49,220,20,255,59,20,171,255,228,109,188,0,20,225,32,254,195,16,174,0,227,254,136,1,135,39,105,0,150,77,206,255,210,238,226,0,55,212,132,254,239,57,124,0,170,194,93,255,249,16,247,255,24,151,62,255,10,151,10,0,79,139,178,255,120,242,202,0,26,219,213,0,62,125,35,255,144,2,108,255,230,33,83,255,81,45,216,1,224,62,17,0,214,217,125,0,98,153,153,255,179,176,106,254,131,93,138,255,109,62,36,255,178,121,32,255,120,252,70,0,220,248,37,0,204,88,103,1,128,220,251,255,236,227,7,1,106,49,198,255,60,56,107,0,99,114,238,0,220,204,94,1,73,187,1,0,89,154,34,0,78,217,165,255,14,195,249,255,9,230,253,255,205,135,245,0,26,252,7,255,84,205,27,1,134,2,112,0,37,158,32,0,231,91,237,255,191,170,204,255,152,7,222,0,109,192,49,0,193,166,146,255,232,19,181,255,105,142,52,255,103,16,27,1,253,200,165,0,195,217,4,255,52,189,144,255,123,155,160,254,87,130,54,255,78,120,61,255,14,56,41,0,25,41,125,255,87,168,245,0,214,165,70,0,212,169,6,255,219,211,194,254,72,93,164,255,197,33,103,255,43,142,141,0,131,225,172,0,244,105,28,0,68,68,225,0,136,84,13,255,130,57,40,254,139,77,56,0,84,150,53,0,54,95,157,0,144,13,177,254,95,115,186,0,117,23,118,255,244,166,241,255,11,186,135,0,178,106,203,255,97,218,93,0,43,253,45,0,164,152,4,0,139,118,239,0,96,1,24,254,235,153,211,255,168,110,20,255,50,239,176,0,114,41,232,0,193,250,53,0,254,160,111,254,136,122,41,255,97,108,67,0,215,152,23,255,140,209,212,0,42,189,163,0,202,42,50,255,106,106,189,255,190,68,217,255,233,58,117,0,229,220,243,1,197,3,4,0,37,120,54,254,4,156,134,255,36,61,171,254,165,136,100,255,212,232,14,0,90,174,10,0,216,198,65,255,12,3,64,0,116,113,115,255,248,103,8,0,231,125,18,255,160,28,197,0,30,184,35,1,223,73,249,255,123,20,46,254,135,56,37,255,173,13,229,1,119,161,34,255,245,61,73,0,205,125,112,0,137,104,134,0,217,246,30,255,237,142,143,0,65,159,102,255,108,164,190,0,219,117,173,255,34,37,120,254,200,69,80,0,31,124,218,254,74,27,160,255,186,154,199,255,71,199,252,0,104,81,159,1,17,200,39,0,211,61,192,1,26,238,91,0,148,217,12,0,59,91,213,255,11,81,183,255,129,230,122,255,114,203,145,1,119,180,66,255,72,138,180,0,224,149,106,0,119,82,104,255,208,140,43,0,98,9,182,255,205,101,134,255,18,101,38,0,95,197,166,255,203,241,147,0,62,208,145,255,133,246,251,0,2,169,14,0,13,247,184,0,142,7,254,0,36,200,23,255,88,205,223,0,91,129,52,255,21,186,30,0,143,228,210,1,247,234,248,255,230,69,31,254,176,186,135,255,238,205,52,1,139,79,43,0,17,176,217,254,32,243,67,0,242,111,233,0,44,35,9,255,227,114,81,1,4,71,12,255,38,105,191,0,7,117,50,255,81,79,16,0,63,68,65,255,157,36,110,255,77,241,3,255,226,45,251,1,142,25,206,0,120,123,209,1,28,254,238,255,5,128,126,255,91,222,215,255,162,15,191,0,86,240,73,0,135,185,81,254,44,241,163,0,212,219,210,255,112,162,155,0,207,101,118,0,168,72,56,255,196,5,52,0,72,172,242,255,126,22,157,255,146,96,59,255,162,121,152,254,140,16,95,0,195,254,200,254,82,150,162,0,119,43,145,254,204,172,78,255,166,224,159,0,104,19,237,255,245,126,208,255,226,59,213,0,117,217,197,0,152,72,237,0,220,31,23,254,14,90,231,255,188,212,64,1,60,101,246,255,85,24,86,0,1,177,109,0,146,83,32,1,75,182,192,0,119,241,224,0,185,237,27,255,184,101,82,1,235,37,77,255,253,134,19,0,232,246,122,0,60,106,179,0,195,11,12,0,109,66,235,1,125,113,59,0,61,40,164,0,175,104,240,0,2,47,187,255,50,12,141,0,194,139,181,255,135,250,104,0,97,92,222,255,217,149,201,255,203,241,118,255,79,151,67,0,122,142,218,255,149,245,239,0,138,42,200,254,80,37,97,255,124,112,167,255,36,138,87,255,130,29,147,255,241,87,78,255,204,97,19,1,177,209,22,255,247,227,127,254,99,119,83,255,212,25,198,1,16,179,179,0,145,77,172,254,89,153,14,255,218,189,167,0,107,233,59,255,35,33,243,254,44,112,112,255,161,127,79,1,204,175,10,0,40,21,138,254,104,116,228,0,199,95,137,255,133,190,168,255,146,165,234,1,183,99,39,0,183,220,54,254,255,222,133,0,162,219,121,254,63,239,6,0,225,102,54,255,251,18,246,0,4,34,129,1,135,36,131,0,206,50,59,1,15,97,183,0,171,216,135,255,101,152,43,255,150,251,91,0,38,145,95,0,34,204,38,254,178,140,83,255,25,129,243,255,76,144,37,0,106,36,26,254,118,144,172,255,68,186,229,255,107,161,213,255,46,163,68,255,149,170,253,0,187,17,15,0,218,160,165,255,171,35,246,1,96,13,19,0,165,203,117,0,214,107,192,255,244,123,177,1,100,3,104,0,178,242,97,255,251,76,130,255,211,77,42,1,250,79,70,255,63,244,80,1,105,101,246,0,61,136,58,1,238,91,213,0,14,59,98,255,167,84,77,0,17,132,46,254,57,175,197,255,185,62,184,0,76,64,207,0,172,175,208,254,175,74,37,0,138,27,211,254,148,125,194,0,10,89,81,0,168,203,101,255,43,213,209,1,235,245,54,0,30,35,226,255,9,126,70,0,226,125,94,254,156,117,20,255,57,248,112,1,230,48,64,255,164,92,166,1,224,214,230,255,36,120,143,0,55,8,43,255,251,1,245,1,106,98,165,0,74,107,106,254,53,4,54,255,90,178,150,1,3,120,123,255,244,5,89,1,114,250,61,255,254,153,82,1,77,15,17,0,57,238,90,1,95,223,230,0,236,52,47,254,103,148,164,255,121,207,36,1,18,16,185,255,75,20,74,0,187,11,101,0,46,48,129,255,22,239,210,255,77,236,129,255,111,77,204,255,61,72,97,255,199,217,251,255,42,215,204,0,133,145,201,255,57,230,146,1,235,100,198,0,146,73,35,254,108,198,20,255,182,79,210,255,82,103,136,0,246,108,176,0,34,17,60,255,19,74,114,254,168,170,78,255,157,239,20,255,149,41,168,0,58,121,28,0,79,179,134,255,231,121,135,255,174,209,98,255,243,122,190,0,171,166,205,0,212,116,48,0,29,108,66,255,162,222,182,1,14,119,21,0,213,39,249,255,254,223,228,255,183,165,198,0,133,190,48,0,124,208,109,255,119,175,85,255,9,209,121,1,48,171,189,255,195,71,134,1,136,219,51,255,182,91,141,254,49,159,72,0,35,118,245,255,112,186,227,255,59,137,31,0,137,44,163,0,114,103,60,254,8,213,150,0,162,10,113,255,194,104,72,0,220,131,116,255,178,79,92,0,203,250,213,254,93,193,189,255,130,255,34,254,212,188,151,0,136,17,20,255,20,101,83,255,212,206,166,0,229,238,73,255,151,74,3,255,168,87,215,0,155,188,133,255,166,129,73,0,240,79,133,255,178,211,81,255,203,72,163,254,193,168,165,0,14,164,199,254,30,255,204,0,65,72,91,1,166,74,102,255,200,42,0,255,194,113,227,255,66,23,208,0,229,216,100,255,24,239,26,0,10,233,62,255,123,10,178,1,26,36,174,255,119,219,199,1,45,163,190,0,16,168,42,0,166,57,198,255,28,26,26,0,126,165,231,0,251,108,100,255,61,229,121,255,58,118,138,0,76,207,17,0,13,34,112,254,89,16,168,0,37,208,105,255,35,201,215,255,40,106,101,254,6,239,114,0,40,103,226,254,246,127,110,255,63,167,58,0,132,240,142,0,5,158,88,255,129,73,158,255,94,89,146,0,230,54,146,0,8,45,173,0,79,169,1,0,115,186,247,0,84,64,131,0,67,224,253,255,207,189,64,0,154,28,81,1,45,184,54,255,87,212,224,255,0,96,73,255,129,33,235,1,52,66,80,255,251,174,155,255,4,179,37,0,234,164,93,254,93,175,253,0,198,69,87,255,224,106,46,0,99,29,210,0,62,188,114,255,44,234,8,0,169,175,247,255,23,109,137,255,229,182,39,0,192,165,94,254,245,101,217,0,191,88,96,0,196,94,99,255,106,238,11,254,53,126,243,0,94,1,101,255,46,147,2,0,201,124,124,255,141,12,218,0,13,166,157,1,48,251,237,255,155,250,124,255,106,148,146,255,182,13,202,0,28,61,167,0,217,152,8,254,220,130,45,255,200,230,255,1,55,65,87,255,93,191,97,254,114,251,14,0,32,105,92,1,26,207,141,0,24,207,13,254,21,50,48,255,186,148,116,255,211,43,225,0,37,34,162,254,164,210,42,255,68,23,96,255,182,214,8,255,245,117,137,255,66,195,50,0,75,12,83,254,80,140,164,0,9,165,36,1,228,110,227,0,241,17,90,1,25,52,212,0,6,223,12,255,139,243,57,0,12,113,75,1,246,183,191,255,213,191,69,255,230,15,142,0,1,195,196,255,138,171,47,255,64,63,106,1,16,169,214,255,207,174,56,1,88,73,133,255,182,133,140,0,177,14,25,255,147,184,53,255,10,227,161,255,120,216,244,255,73,77,233,0,157,238,139,1,59,65,233,0,70,251,216,1,41,184,153,255,32,203,112,0,146,147,253,0,87,101,109,1,44,82,133,255,244,150,53,255,94,152,232,255,59,93,39,255,88,147,220,255,78,81,13,1,32,47,252,255,160,19,114,255,93,107,39,255,118,16,211,1,185,119,209,255,227,219,127,254,88,105,236,255,162,110,23,255,36,166,110,255,91,236,221,255,66,234,116,0,111,19,244,254,10,233,26,0,32,183,6,254,2,191,242,0,218,156,53,254,41,60,70,255,168,236,111,0,121,185,126,255,238,142,207,255,55,126,52,0,220,129,208,254,80,204,164,255,67,23,144,254,218,40,108,255,127,202,164,0,203,33,3,255,2,158,0,0,37,96,188,255,192,49,74,0,109,4,0,0,111,167,10,254,91,218,135,255,203,66,173,255,150,194,226,0,201,253,6,255,174,102,121,0,205,191,110,0,53,194,4,0,81,40,45,254,35,102,143,255,12,108,198,255,16,27,232,255,252,71,186,1,176,110,114,0,142,3,117,1,113,77,142,0,19,156,197,1,92,47,252,0,53,232,22,1,54,18,235,0,46,35,189,255,236,212,129,0,2,96,208,254,200,238,199,255,59,175,164,255,146,43,231,0,194,217,52,255,3,223,12,0,138,54,178,254,85,235,207,0,232,207,34,0,49,52,50,255,166,113,89,255,10,45,216,255,62,173,28,0,111,165,246,0,118,115,91,255,128,84,60,0,167,144,203,0,87,13,243,0,22,30,228,1,177,113,146,255,129,170,230,254,252,153,129,255,145,225,43,0,70,231,5,255,122,105,126,254,86,246,148,255,110,37,154,254,209,3,91,0,68,145,62,0,228,16,165,255,55,221,249,254,178,210,91,0,83,146,226,254,69,146,186,0,93,210,104,254,16,25,173,0,231,186,38,0,189,122,140,255,251,13,112,255,105,110,93,0,251,72,170,0,192,23,223,255,24,3,202,1,225,93,228,0,153,147,199,254,109,170,22,0,248,101,246,255,178,124,12,255,178,254,102,254,55,4,65,0,125,214,180,0,183,96,147,0,45,117,23,254,132,191,249,0,143,176,203,254,136,183,54,255,146,234,177,0,146,101,86,255,44,123,143,1,33,209,152,0,192,90,41,254,83,15,125,255,213,172,82,0,215,169,144,0,16,13,34,0,32,209,100,255,84,18,249,1,197,17,236,255,217,186,230,0,49,160,176,255,111,118,97,255,237,104,235,0,79,59,92,254,69,249,11,255,35,172,74,1,19,118,68,0,222,124,165,255,180,66,35,255,86,174,246,0,43,74,111,255,126,144,86,255,228,234,91,0,242,213,24,254,69,44,235,255,220,180,35,0,8,248,7,255,102,47,92,255,240,205,102,255,113,230,171,1,31,185,201,255,194,246,70,255,122,17,187,0,134,70,199,255,149,3,150,255,117,63,103,0,65,104,123,255,212,54,19,1,6,141,88,0,83,134,243,255,136,53,103,0,169,27,180,0,177,49,24,0,111,54,167,0,195,61,215,255,31,1,108,1,60,42,70,0,185,3,162,255,194,149,40,255,246,127,38,254,190,119,38,255,61,119,8,1,96,161,219,255,42,203,221,1,177,242,164,255,245,159,10,0,116,196,0,0,5,93,205,254,128,127,179,0,125,237,246,255,149,162,217,255,87,37,20,254,140,238,192,0,9,9,193,0,97,1,226,0,29,38,10,0,0,136,63,255,229,72,210,254,38,134,92,255,78,218,208,1,104,36,84,255,12,5,193,255,242,175,61,255,191,169,46,1,179,147,147,255,113,190,139,254,125,172,31,0,3,75,252,254,215,36,15,0,193,27,24,1,255,69,149,255,110,129,118,0,203,93,249,0,138,137,64,254,38,70,6,0,153,116,222,0,161,74,123,0,193,99,79,255,118,59,94,255,61,12,43,1,146,177,157,0,46,147,191,0,16,255,38,0,11,51,31,1,60,58,98,255,111,194,77,1,154,91,244,0,140,40,144,1,173,10,251,0,203,209,50,254,108,130,78,0,228,180,90,0,174,7,250,0,31,174,60,0,41,171,30,0,116,99,82,255,118,193,139,255,187,173,198,254,218,111,56,0,185,123,216,0,249,158,52,0,52,180,93,255,201,9,91,255,56,45,166,254,132,155,203,255,58,232,110,0,52,211,89,255,253,0,162,1,9,87,183,0,145,136,44,1,94,122,245,0,85,188,171,1,147,92,198,0,0,8,104,0,30,95,174,0,221,230,52,1,247,247,235,255,137,174,53,255,35,21,204,255,71,227,214,1,232,82,194,0,11,48,227,255,170,73,184,255,198,251,252,254,44,112,34,0,131,101,131,255,72,168,187,0,132,135,125,255,138,104,97,255,238,184,168,255,243,104,84,255,135,216,226,255,139,144,237,0,188,137,150,1,80,56,140,255,86,169,167,255,194,78,25,255,220,17,180,255,17,13,193,0,117,137,212,255,141,224,151,0,49,244,175,0,193,99,175,255,19,99,154,1,255,65,62,255,156,210,55,255,242,244,3,255,250,14,149,0,158,88,217,255,157,207,134,254,251,232,28,0,46,156,251,255,171,56,184,255,239,51,234,0,142,138,131,255,25,254,243,1,10,201,194,0,63,97,75,0,210,239,162,0,192,200,31,1,117,214,243,0,24,71,222,254,54,40,232,255,76,183,111,254,144,14,87,255,214,79,136,255,216,196,212,0,132,27,140,254,131,5,253,0,124,108,19,255,28,215,75,0,76,222,55,254,233,182,63,0,68,171,191,254,52,111,222,255,10,105,77,255,80,170,235,0,143,24,88,255,45,231,121,0,148,129,224,1,61,246,84,0,253,46,219,255,239,76,33,0,49,148,18,254,230,37,69,0,67,134,22,254,142,155,94,0,31,157,211,254,213,42,30,255,4,228,247,254,252,176,13,255,39,0,31,254,241,244,255,255,170,45,10,254,253,222,249,0,222,114,132,0,255,47,6,255,180,163,179,1,84,94,151,255,89,209,82,254,229,52,169,255,213,236,0,1,214,56,228,255,135,119,151,255,112,201,193,0,83,160,53,254,6,151,66,0,18,162,17,0,233,97,91,0,131,5,78,1,181,120,53,255,117,95,63,255,237,117,185,0,191,126,136,255,144,119,233,0,183,57,97,1,47,201,187,255,167,165,119,1,45,100,126,0,21,98,6,254,145,150,95,255,120,54,152,0,209,98,104,0,143,111,30,254,184,148,249,0,235,216,46,0,248,202,148,255,57,95,22,0,242,225,163,0,233,247,232,255,71,171,19,255,103,244,49,255,84,103,93,255,68,121,244,1,82,224,13,0,41,79,43,255,249,206,167,255,215,52,21,254,192,32,22,255,247,111,60,0,101,74,38,255,22,91,84,254,29,28,13,255,198,231,215,254,244,154,200,0,223,137,237,0,211,132,14,0,95,64,206,255,17,62,247,255,233,131,121,1,93,23,77,0,205,204,52,254,81,189,136,0,180,219,138,1,143,18,94,0,204,43,140,254,188,175,219,0,111,98,143,255,151,63,162,255,211,50,71,254,19,146,53,0,146,45,83,254,178,82,238,255,16,133,84,255,226,198,93,255,201,97,20,255,120,118,35,255,114,50,231,255,162,229,156,255,211,26,12,0,114,39,115,255,206,212,134,0,197,217,160,255,116,129,94,254,199,215,219,255,75,223,249,1,253,116,181,255,232,215,104,255,228,130,246,255,185,117,86,0,14,5,8,0,239,29,61,1,237,87,133,255,125,146,137,254,204,168,223,0,46,168,245,0,154,105,22,0,220,212,161,255,107,69,24,255,137,218,181,255,241,84,198,255,130,122,211,255,141,8,153,255,190,177,118,0,96,89,178,0,255,16,48,254,122,96,105,255,117,54,232,255,34,126,105,255,204,67,166,0,232,52,138,255,211,147,12,0,25,54,7,0,44,15,215,254,51,236,45,0,190,68,129,1,106,147,225,0,28,93,45,254,236,141,15,255,17,61,161,0,220,115,192,0,236,145,24,254,111,168,169,0,224,58,63,255,127,164,188,0,82,234,75,1,224,158,134,0,209,68,110,1,217,166,217,0,70,225,166,1,187,193,143,255,16,7,88,255,10,205,140,0,117,192,156,1,17,56,38,0,27,124,108,1,171,215,55,255,95,253,212,0,155,135,168,255,246,178,153,254,154,68,74,0,232,61,96,254,105,132,59,0,33,76,199,1,189,176,130,255,9,104,25,254,75,198,102,255,233,1,112,0,108,220,20,255,114,230,70,0,140,194,133,255,57,158,164,254,146,6,80,255,169,196,97,1,85,183,130,0,70,158,222,1,59,237,234,255,96,25,26,255,232,175,97,255,11,121,248,254,88,35,194,0,219,180,252,254,74,8,227,0,195,227,73,1,184,110,161,255,49,233,164,1,128,53,47,0,82,14,121,255,193,190,58,0,48,174,117,255,132,23,32,0,40,10,134,1,22,51,25,255,240,11,176,255,110,57,146,0,117,143,239,1,157,101,118,255,54,84,76,0,205,184,18,255,47,4,72,255,78,112,85,255,193,50,66,1,93,16,52,255,8,105,134,0,12,109,72,255,58,156,251,0,144,35,204,0,44,160,117,254,50,107,194,0,1,68,165,255,111,110,162,0,158,83,40,254,76,214,234,0,58,216,205,255,171,96,147,255,40,227,114,1,176,227,241,0,70,249,183,1,136,84,139,255,60,122,247,254,143,9,117,255,177,174,137,254,73,247,143,0,236,185,126,255,62,25,247,255,45,64,56,255,161,244,6,0,34,57,56,1,105,202,83,0,128,147,208,0,6,103,10,255,74,138,65,255,97,80,100,255,214,174,33,255,50,134,74,255,110,151,130,254,111,84,172,0,84,199,75,254,248,59,112,255,8,216,178,1,9,183,95,0,238,27,8,254,170,205,220,0,195,229,135,0,98,76,237,255,226,91,26,1,82,219,39,255,225,190,199,1,217,200,121,255,81,179,8,255,140,65,206,0,178,207,87,254,250,252,46,255,104,89,110,1,253,189,158,255,144,214,158,255,160,245,54,255,53,183,92,1,21,200,194,255,146,33,113,1,209,1,255,0,235,106,43,255,167,52,232,0,157,229,221,0,51,30,25,0,250,221,27,1,65,147,87,255,79,123,196,0,65,196,223,255,76,44,17,1,85,241,68,0,202,183,249,255,65,212,212,255,9,33,154,1,71,59,80,0,175,194,59,255,141,72,9,0,100,160,244,0,230,208,56,0,59,25,75,254,80,194,194,0,18,3,200,254,160,159,115,0,132,143,247,1,111,93,57,255,58,237,11,1,134,222,135,255,122,163,108,1,123,43,190,255,251,189,206,254,80,182,72,255,208,246,224,1,17,60,9,0,161,207,38,0,141,109,91,0,216,15,211,255,136,78,110,0,98,163,104,255,21,80,121,255,173,178,183,1,127,143,4,0,104,60,82,254,214,16,13,255,96,238,33,1,158,148,230,255,127,129,62,255,51,255,210,255,62,141,236,254,157,55,224,255,114,39,244,0,192,188,250,255,228,76,53,0,98,84,81,255,173,203,61,254,147,50,55,255,204,235,191,0,52,197,244,0,88,43,211,254,27,191,119,0,188,231,154,0,66,81,161,0,92,193,160,1,250,227,120,0,123,55,226,0,184,17,72,0,133,168,10,254,22,135,156,255,41,25,103,255,48,202,58,0,186,149,81,255,188,134,239,0,235,181,189,254,217,139,188,255,74,48,82,0,46,218,229,0,189,253,251,0,50,229,12,255,211,141,191,1,128,244,25,255,169,231,122,254,86,47,189,255,132,183,23,255,37,178,150,255,51,137,253,0,200,78,31,0,22,105,50,0,130,60,0,0,132,163,91,254,23,231,187,0,192,79,239,0,157,102,164,255,192,82,20,1,24,181,103,255,240,9,234,0,1,123,164,255,133,233,0,255,202,242,242,0,60,186,245,0,241,16,199,255,224,116,158,254,191,125,91,255,224,86,207,0,121,37,231,255,227,9,198,255,15,153,239,255,121,232,217,254,75,112,82,0,95,12,57,254,51,214,105,255,148,220,97,1,199,98,36,0,156,209,12,254,10,212,52,0,217,180,55,254,212,170,232,255,216,20,84,255,157,250,135,0,157,99,127,254,1,206,41,0,149,36,70,1,54,196,201,255,87,116,0,254,235,171,150,0,27,163,234,0,202,135,180,0,208,95,0,254,123,156,93,0,183,62,75,0,137,235,182,0,204,225,255,255,214,139,210,255,2,115,8,255,29,12,111,0,52,156,1,0,253,21,251,255,37,165,31,254,12,130,211,0,106,18,53,254,42,99,154,0,14,217,61,254,216,11,92,255,200,197,112,254,147,38,199,0,36,252,120,254,107,169,77,0,1,123,159,255,207,75,102,0,163,175,196,0,44,1,240,0,120,186,176,254,13,98,76,255,237,124,241,255,232,146,188,255,200,96,224,0,204,31,41,0,208,200,13,0,21,225,96,255,175,156,196,0,247,208,126,0,62,184,244,254,2,171,81,0,85,115,158,0,54,64,45,255,19,138,114,0,135,71,205,0,227,47,147,1,218,231,66,0,253,209,28,0,244,15,173,255,6,15,118,254,16,150,208,255,185,22,50,255,86,112,207,255,75,113,215,1,63,146,43,255,4,225,19,254,227,23,62,255,14,255,214,254,45,8,205,255,87,197,151,254,210,82,215,255,245,248,247,255,128,248,70,0,225,247,87,0,90,120,70,0,213,245,92,0,13,133,226,0,47,181,5,1,92,163,105,255,6,30,133,254,232,178,61,255,230,149,24,255,18,49,158,0,228,100,61,254,116,243,251,255,77,75,92,1,81,219,147,255,76,163,254,254,141,213,246,0,232,37,152,254,97,44,100,0,201,37,50,1,212,244,57,0,174,171,183,255,249,74,112,0,166,156,30,0,222,221,97,255,243,93,73,254,251,101,100,255,216,217,93,255,254,138,187,255,142,190,52,255,59,203,177,255,200,94,52,0,115,114,158,255,165,152,104,1,126,99,226,255,118,157,244,1,107,200,16,0,193,90,229,0,121,6,88,0,156,32,93,254,125,241,211,255,14,237,157,255,165,154,21,255,184,224,22,255,250,24,152,255,113,77,31,0,247,171,23,255,237,177,204,255,52,137,145,255,194,182,114,0,224,234,149,0,10,111,103,1,201,129,4,0,238,142,78,0,52,6,40,255,110,213,165,254,60,207,253,0,62,215,69,0,96,97,0,255,49,45,202,0,120,121,22,255,235,139,48,1,198,45,34,255,182,50,27,1,131,210,91,255,46,54,128,0,175,123,105,255,198,141,78,254,67,244,239,255,245,54,103,254,78,38,242,255,2,92,249,254,251,174,87,255,139,63,144,0,24,108,27,255,34,102,18,1,34,22,152,0,66,229,118,254,50,143,99,0,144,169,149,1,118,30,152,0,178,8,121,1,8,159,18,0,90,101,230,255,129,29,119,0,68,36,11,1,232,183,55,0,23,255,96,255,161,41,193,255,63,139,222,0,15,179,243,0,255,100,15,255,82,53,135,0,137,57,149,1,99,240,170,255,22,230,228,254,49,180,82,255,61,82,43,0,110,245,217,0,199,125,61,0,46,253,52,0,141,197,219,0,211,159,193,0,55,121,105,254,183,20,129,0,169,119,170,255,203,178,139,255,135,40,182,255,172,13,202,255,65,178,148,0,8,207,43,0,122,53,127,1,74,161,48,0,227,214,128,254,86,11,243,255,100,86,7,1,245,68,134,255,61,43,21,1,152,84,94,255,190,60,250,254,239,118,232,255,214,136,37,1,113,76,107,255,93,104,100,1,144,206,23,255,110,150,154,1,228,103,185,0,218,49,50,254,135,77,139,255,185,1,78,0,0,161,148,255,97,29,233,255,207,148,149,255,160,168,0,0,91,128,171,255,6,28,19,254,11,111,247,0,39,187,150,255,138,232,149,0,117,62,68,255,63,216,188,255,235,234,32,254,29,57,160,255,25,12,241,1,169,60,191,0,32,131,141,255,237,159,123,255,94,197,94,254,116,254,3,255,92,179,97,254,121,97,92,255,170,112,14,0,21,149,248,0,248,227,3,0,80,96,109,0,75,192,74,1,12,90,226,255,161,106,68,1,208,114,127,255,114,42,255,254,74,26,74,255,247,179,150,254,121,140,60,0,147,70,200,255,214,40,161,255,161,188,201,255,141,65,135,255,242,115,252,0,62,47,202,0,180,149,255,254,130,55,237,0,165,17,186,255,10,169,194,0,156,109,218,255,112,140,123,255,104,128,223,254,177,142,108,255,121,37,219,255,128,77,18,255,111,108,23,1,91,192,75,0,174,245,22,255,4,236,62,255,43,64,153,1,227,173,254,0,237,122,132,1,127,89,186,255,142,82,128,254,252,84,174,0,90,179,177,1,243,214,87,255,103,60,162,255,208,130,14,255,11,130,139,0,206,129,219,255,94,217,157,255,239,230,230,255,116,115,159,254,164,107,95,0,51,218,2,1,216,125,198,255,140,202,128,254,11,95,68,255,55,9,93,254,174,153,6,255,204,172,96,0,69,160,110,0,213,38,49,254,27,80,213,0,118,125,114,0,70,70,67,255,15,142,73,255,131,122,185,255,243,20,50,254,130,237,40,0,210,159,140,1,197,151,65,255,84,153,66,0,195,126,90,0,16,238,236,1,118,187,102,255,3,24,133,255,187,69,230,0,56,197,92,1,213,69,94,255,80,138,229,1,206,7,230,0,222,111,230,1,91,233,119,255,9,89,7,1,2,98,1,0,148,74,133,255,51,246,180,255,228,177,112,1,58,189,108,255,194,203,237,254,21,209,195,0,147,10,35,1,86,157,226,0,31,163,139,254,56,7,75,255,62,90,116,0,181,60,169,0,138,162,212,254,81,167,31,0,205,90,112,255,33,112,227,0,83,151,117,1,177,224,73,255,174,144,217,255,230,204,79,255,22,77,232,255,114,78,234,0,224,57,126,254,9,49,141,0,242,147,165,1,104,182,140,255,167,132,12,1,123,68,127,0,225,87,39,1,251,108,8,0,198,193,143,1,121,135,207,255,172,22,70,0,50,68,116,255,101,175,40,255,248,105,233,0,166,203,7,0,110,197,218,0,215,254,26,254,168,226,253,0,31,143,96,0,11,103,41,0,183,129,203,254,100,247,74,255,213,126,132,0,210,147,44,0,199,234,27,1,148,47,181,0,155,91,158,1,54,105,175,255,2,78,145,254,102,154,95,0,128,207,127,254,52,124,236,255,130,84,71,0,221,243,211,0,152,170,207,0,222,106,199,0,183,84,94,254,92,200,56,255,138,182,115,1,142,96,146,0,133,136,228,0,97,18,150,0,55,251,66,0,140,102,4,0,202,103,151,0,30,19,248,255,51,184,207,0,202,198,89,0,55,197,225,254,169,95,249,255,66,65,68,255,188,234,126,0,166,223,100,1,112,239,244,0,144,23,194,0,58,39,182,0,244,44,24,254,175,68,179,255,152,118,154,1,176,162,130,0,217,114,204,254,173,126,78,255,33,222,30,255,36,2,91,255,2,143,243,0,9,235,215,0,3,171,151,1,24,215,245,255,168,47,164,254,241,146,207,0,69,129,180,0,68,243,113,0,144,53,72,254,251,45,14,0,23,110,168,0,68,68,79,255,110,70,95,254,174,91,144,255,33,206,95,255,137,41,7,255,19,187,153,254,35,255,112,255,9,145,185,254,50,157,37,0,11,112,49,1,102,8,190,255,234,243,169,1,60,85,23,0,74,39,189,0,116,49,239,0,173,213,210,0,46,161,108,255,159,150,37,0,196,120,185,255,34,98,6,255,153,195,62,255,97,230,71,255,102,61,76,0,26,212,236,255,164,97,16,0,198,59,146,0,163,23,196,0,56,24,61,0,181,98,193,0,251,147,229,255,98,189,24,255,46,54,206,255,234,82,246,0,183,103,38,1,109,62,204,0,10,240,224,0,146,22,117,255,142,154,120,0,69,212,35,0,208,99,118,1,121,255,3,255,72,6,194,0,117,17,197,255,125,15,23,0,154,79,153,0,214,94,197,255,185,55,147,255,62,254,78,254,127,82,153,0,110,102,63,255,108,82,161,255,105,187,212,1,80,138,39,0,60,255,93,255,72,12,186,0,210,251,31,1,190,167,144,255,228,44,19,254,128,67,232,0,214,249,107,254,136,145,86,255,132,46,176,0,189,187,227,255,208,22,140,0,217,211,116,0,50,81,186,254,139,250,31,0,30,64,198,1,135,155,100,0,160,206,23,254,187,162,211,255,16,188,63,0,254,208,49,0,85,84,191,0,241,192,242,255,153,126,145,1,234,162,162,255,230,97,216,1,64,135,126,0,190,148,223,1,52,0,43,255,28,39,189,1,64,136,238,0,175,196,185,0,98,226,213,255,127,159,244,1,226,175,60,0,160,233,142,1,180,243,207,255,69,152,89,1,31,101,21,0,144,25,164,254,139,191,209,0,91,25,121,0,32,147,5,0,39,186,123,255,63,115,230,255,93,167,198,255,143,213,220,255,179,156,19,255,25,66,122,0,214,160,217,255,2,45,62,255,106,79,146,254,51,137,99,255,87,100,231,255,175,145,232,255,101,184,1,255,174,9,125,0,82,37,161,1,36,114,141,255,48,222,142,255,245,186,154,0,5,174,221,254,63,114,155,255,135,55,160,1,80,31,135,0,126,250,179,1,236,218,45,0,20,28,145,1,16,147,73,0,249,189,132,1,17,189,192,255,223,142,198,255,72,20,15,255,250,53,237,254,15,11,18,0,27,211,113,254,213,107,56,255,174,147,146,255,96,126,48,0,23,193,109,1,37,162,94,0,199,157,249,254,24,128,187,255,205,49,178,254,93,164,42,255,43,119,235,1,88,183,237,255,218,210,1,255,107,254,42,0,230,10,99,255,162,0,226,0,219,237,91,0,129,178,203,0,208,50,95,254,206,208,95,255,247,191,89,254,110,234,79,255,165,61,243,0,20,122,112,255,246,246,185,254,103,4,123,0,233,99,230,1,219,91,252,255,199,222,22,255,179,245,233,255,211,241,234,0,111,250,192,255,85,84,136,0,101,58,50,255,131,173,156,254,119,45,51,255,118,233,16,254,242,90,214,0,94,159,219,1,3,3,234,255,98,76,92,254,80,54,230,0,5,228,231,254,53,24,223,255,113,56,118,1,20,132,1,255,171,210,236,0,56,241,158,255,186,115,19,255,8,229,174,0,48,44,0,1,114,114,166,255,6,73,226,255,205,89,244,0,137,227,75,1,248,173,56,0,74,120,246,254,119,3,11,255,81,120,198,255,136,122,98,255,146,241,221,1,109,194,78,255,223,241,70,1,214,200,169,255,97,190,47,255,47,103,174,255,99,92,72,254,118,233,180,255,193,35,233,254,26,229,32,255,222,252,198,0,204,43,71,255,199,84,172,0,134,102,190,0,111,238,97,254,230,40,230,0,227,205,64,254,200,12,225,0,166,25,222,0,113,69,51,255,143,159,24,0,167,184,74,0,29,224,116,254,158,208,233,0,193,116,126,255,212,11,133,255,22,58,140,1,204,36,51,255,232,30,43,0,235,70,181,255,64,56,146,254,169,18,84,255,226,1,13,255,200,50,176,255,52,213,245,254,168,209,97,0,191,71,55,0,34,78,156,0,232,144,58,1,185,74,189,0,186,142,149,254,64,69,127,255,161,203,147,255,176,151,191,0,136,231,203,254,163,182,137,0,161,126,251,254,233,32,66,0,68,207,66,0,30,28,37,0,93,114,96,1,254,92,247,255,44,171,69,0,202,119,11,255,188,118,50,1,255,83,136,255,71,82,26,0,70,227,2,0,32,235,121,1,181,41,154,0,71,134,229,254,202,255,36,0,41,152,5,0,154,63,73,255,34,182,124,0,121,221,150,255,26,204,213,1,41,172,87,0,90,157,146,255,109,130,20,0,71,107,200,255,243,102,189,0,1,195,145,254,46,88,117,0,8,206,227,0,191,110,253,255,109,128,20,254,134,85,51,255,137,177,112,1,216,34,22,255,131,16,208,255,121,149,170,0,114,19,23,1,166,80,31,255,113,240,122,0,232,179,250,0,68,110,180,254,210,170,119,0,223,108,164,255,207,79,233,255,27,229,226,254,209,98,81,255,79,68,7,0,131,185,100,0,170,29,162,255,17,162,107,255,57,21,11,1,100,200,181,255,127,65,166,1,165,134,204,0,104,167,168,0,1,164,79,0,146,135,59,1,70,50,128,255,102,119,13,254,227,6,135,0,162,142,179,255,160,100,222,0,27,224,219,1,158,93,195,255,234,141,137,0,16,24,125,255,238,206,47,255,97,17,98,255,116,110,12,255,96,115,77,0,91,227,232,255,248,254,79,255,92,229,6,254,88,198,139,0,206,75,129,0,250,77,206,255,141,244,123,1,138,69,220,0,32,151,6,1,131,167,22,255,237,68,167,254,199,189,150,0,163,171,138,255,51,188,6,255,95,29,137,254,148,226,179,0,181,107,208,255,134,31,82,255,151,101,45,255,129,202,225,0,224,72,147,0,48,138,151,255,195,64,206,254,237,218,158,0,106,29,137,254,253,189,233,255,103,15,17,255,194,97,255,0,178,45,169,254,198,225,155,0,39,48,117,255,135,106,115,0,97,38,181,0,150,47,65,255,83,130,229,254,246,38,129,0,92,239,154,254,91,99,127,0,161,111,33,255,238,217,242,255,131,185,195,255,213,191,158,255,41,150,218,0,132,169,131,0,89,84,252,1,171,70,128,255,163,248,203,254,1,50,180,255,124,76,85,1,251,111,80,0,99,66,239,255,154,237,182,255,221,126,133,254,74,204,99,255,65,147,119,255,99,56,167,255,79,248,149,255,116,155,228,255,237,43,14,254,69,137,11,255,22,250,241,1,91,122,143,255,205,249,243,0,212,26,60,255,48,182,176,1,48,23,191,255,203,121,152,254,45,74,213,255,62,90,18,254,245,163,230,255,185,106,116,255,83,35,159,0,12,33,2,255,80,34,62,0,16,87,174,255,173,101,85,0,202,36,81,254,160,69,204,255,64,225,187,0,58,206,94,0,86,144,47,0,229,86,245,0,63,145,190,1,37,5,39,0,109,251,26,0,137,147,234,0,162,121,145,255,144,116,206,255,197,232,185,255,183,190,140,255,73,12,254,255,139,20,242,255,170,90,239,255,97,66,187,255,245,181,135,254,222,136,52,0,245,5,51,254,203,47,78,0,152,101,216,0,73,23,125,0,254,96,33,1,235,210,73,255,43,209,88,1,7,129,109,0,122,104,228,254,170,242,203,0,242,204,135,255,202,28,233,255,65,6,127,0,159,144,71,0,100,140,95,0,78,150,13,0,251,107,118,1,182,58,125,255,1,38,108,255,141,189,209,255,8,155,125,1,113,163,91,255,121,79,190,255,134,239,108,255,76,47,248,0,163,228,239,0,17,111,10,0,88,149,75,255,215,235,239,0,167,159,24,255,47,151,108,255,107,209,188,0,233,231,99,254,28,202,148,255,174,35,138,255,110,24,68,255,2,69,181,0,107,102,82,0,102,237,7,0,92,36,237,255,221,162,83,1,55,202,6,255,135,234,135,255,24,250,222,0,65,94,168,254,245,248,210,255,167,108,201,254,255,161,111,0,205,8,254,0,136,13,116,0,100,176,132,255,43,215,126,255,177,133,130,255,158,79,148,0,67,224,37,1,12,206,21,255,62,34,110,1,237,104,175,255,80,132,111,255,142,174,72,0,84,229,180,254,105,179,140,0,64,248,15,255,233,138,16,0,245,67,123,254,218,121,212,255,63,95,218,1,213,133,137,255,143,182,82,255,48,28,11,0,244,114,141,1,209,175,76,255,157,181,150,255,186,229,3,255,164,157,111,1,231,189,139,0,119,202,190,255,218,106,64,255,68,235,63,254,96,26,172,255,187,47,11,1,215,18,251,255,81,84,89,0,68,58,128,0,94,113,5,1,92,129,208,255,97,15,83,254,9,28,188,0,239,9,164,0,60,205,152,0,192,163,98,255,184,18,60,0,217,182,139,0,109,59,120,255,4,192,251,0,169,210,240,255,37,172,92,254,148,211,245,255,179,65,52,0,253,13,115,0,185,174,206,1,114,188,149,255,237,90,173,0,43,199,192,255,88,108,113,0,52,35,76,0,66,25,148,255,221,4,7,255,151,241,114,255,190,209,232,0,98,50,199,0,151,150,213,255,18,74,36,1,53,40,7,0,19,135,65,255,26,172,69,0,174,237,85,0,99,95,41,0,3,56,16,0,39,160,177,255,200,106,218,254,185,68,84,255,91,186,61,254,67,143,141,255,13,244,166,255,99,114,198,0,199,110,163,255,193,18,186,0,124,239,246,1,110,68,22,0,2,235,46,1,212,60,107,0,105,42,105,1,14,230,152,0,7,5,131,0,141,104,154,255,213,3,6,0,131,228,162,255,179,100,28,1,231,123,85,255,206,14,223,1,253,96,230,0,38,152,149,1,98,137,122,0,214,205,3,255,226,152,179,255,6,133,137,0,158,69,140,255,113,162,154,255,180,243,172,255,27,189,115,255,143,46,220,255,213,134,225,255,126,29,69,0,188,43,137,1,242,70,9,0,90,204,255,255,231,170,147,0,23,56,19,254,56,125,157,255,48,179,218,255,79,182,253,255,38,212,191,1,41,235,124,0,96,151,28,0,135,148,190,0,205,249,39,254,52,96,136,255,212,44,136,255,67,209,131,255,252,130,23,255,219,128,20,255,198,129,118,0,108,101,11,0,178,5,146,1,62,7,100,255,181,236,94,254,28,26,164,0,76,22,112,255,120,102,79,0,202,192,229,1,200,176,215,0,41,64,244,255,206,184,78,0,167,45,63,1,160,35,0,255,59,12,142,255,204,9,144,255,219,94,229,1,122,27,112,0,189,105,109,255,64,208,74,255,251,127,55,1,2,226,198,0,44,76,209,0,151,152,77,255,210,23,46,1,201,171,69,255,44,211,231,0,190,37,224,255,245,196,62,255,169,181,222,255,34,211,17,0,119,241,197,255,229,35,152,1,21,69,40,255,178,226,161,0,148,179,193,0,219,194,254,1,40,206,51,255], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+20480);
/* memory initializer */ allocate([231,92,250,1,67,153,170,0,21,148,241,0,170,69,82,255,121,18,231,255,92,114,3,0,184,62,230,0,225,201,87,255,146,96,162,255,181,242,220,0,173,187,221,1,226,62,170,255,56,126,217,1,117,13,227,255,179,44,239,0,157,141,155,255,144,221,83,0,235,209,208,0,42,17,165,1,251,81,133,0,124,245,201,254,97,211,24,255,83,214,166,0,154,36,9,255,248,47,127,0,90,219,140,255,161,217,38,254,212,147,63,255,66,84,148,1,207,3,1,0,230,134,89,1,127,78,122,255,224,155,1,255,82,136,74,0,178,156,208,255,186,25,49,255,222,3,210,1,229,150,190,255,85,162,52,255,41,84,141,255,73,123,84,254,93,17,150,0,119,19,28,1,32,22,215,255,28,23,204,255,142,241,52,255,228,52,125,0,29,76,207,0,215,167,250,254,175,164,230,0,55,207,105,1,109,187,245,255,161,44,220,1,41,101,128,255,167,16,94,0,93,214,107,255,118,72,0,254,80,61,234,255,121,175,125,0,139,169,251,0,97,39,147,254,250,196,49,255,165,179,110,254,223,70,187,255,22,142,125,1,154,179,138,255,118,176,42,1,10,174,153,0,156,92,102,0,168,13,161,255,143,16,32,0,250,197,180,255,203,163,44,1,87,32,36,0,161,153,20,255,123,252,15,0,25,227,80,0,60,88,142,0,17,22,201,1,154,205,77,255,39,63,47,0,8,122,141,0,128,23,182,254,204,39,19,255,4,112,29,255,23,36,140,255,210,234,116,254,53,50,63,255,121,171,104,255,160,219,94,0,87,82,14,254,231,42,5,0,165,139,127,254,86,78,38,0,130,60,66,254,203,30,45,255,46,196,122,1,249,53,162,255,136,143,103,254,215,210,114,0,231,7,160,254,169,152,42,255,111,45,246,0,142,131,135,255,131,71,204,255,36,226,11,0,0,28,242,255,225,138,213,255,247,46,216,254,245,3,183,0,108,252,74,1,206,26,48,255,205,54,246,255,211,198,36,255,121,35,50,0,52,216,202,255,38,139,129,254,242,73,148,0,67,231,141,255,42,47,204,0,78,116,25,1,4,225,191,255,6,147,228,0,58,88,177,0,122,165,229,255,252,83,201,255,224,167,96,1,177,184,158,255,242,105,179,1,248,198,240,0,133,66,203,1,254,36,47,0,45,24,115,255,119,62,254,0,196,225,186,254,123,141,172,0,26,85,41,255,226,111,183,0,213,231,151,0,4,59,7,255,238,138,148,0,66,147,33,255,31,246,141,255,209,141,116,255,104,112,31,0,88,161,172,0,83,215,230,254,47,111,151,0,45,38,52,1,132,45,204,0,138,128,109,254,233,117,134,255,243,190,173,254,241,236,240,0,82,127,236,254,40,223,161,255,110,182,225,255,123,174,239,0,135,242,145,1,51,209,154,0,150,3,115,254,217,164,252,255,55,156,69,1,84,94,255,255,232,73,45,1,20,19,212,255,96,197,59,254,96,251,33,0,38,199,73,1,64,172,247,255,117,116,56,255,228,17,18,0,62,138,103,1,246,229,164,255,244,118,201,254,86,32,159,255,109,34,137,1,85,211,186,0,10,193,193,254,122,194,177,0,122,238,102,255,162,218,171,0,108,217,161,1,158,170,34,0,176,47,155,1,181,228,11,255,8,156,0,0,16,75,93,0,206,98,255,1,58,154,35,0,12,243,184,254,67,117,66,255,230,229,123,0,201,42,110,0,134,228,178,254,186,108,118,255,58,19,154,255,82,169,62,255,114,143,115,1,239,196,50,255,173,48,193,255,147,2,84,255,150,134,147,254,95,232,73,0,109,227,52,254,191,137,10,0,40,204,30,254,76,52,97,255,164,235,126,0,254,124,188,0,74,182,21,1,121,29,35,255,241,30,7,254,85,218,214,255,7,84,150,254,81,27,117,255,160,159,152,254,66,24,221,255,227,10,60,1,141,135,102,0,208,189,150,1,117,179,92,0,132,22,136,255,120,199,28,0,21,129,79,254,182,9,65,0,218,163,169,0,246,147,198,255,107,38,144,1,78,175,205,255,214,5,250,254,47,88,29,255,164,47,204,255,43,55,6,255,131,134,207,254,116,100,214,0,96,140,75,1,106,220,144,0,195,32,28,1,172,81,5,255,199,179,52,255,37,84,203,0,170,112,174,0,11,4,91,0,69,244,27,1,117,131,92,0,33,152,175,255,140,153,107,255,251,135,43,254,87,138,4,255,198,234,147,254,121,152,84,255,205,101,155,1,157,9,25,0,72,106,17,254,108,153,0,255,189,229,186,0,193,8,176,255,174,149,209,0,238,130,29,0,233,214,126,1,61,226,102,0,57,163,4,1,198,111,51,255,45,79,78,1,115,210,10,255,218,9,25,255,158,139,198,255,211,82,187,254,80,133,83,0,157,129,230,1,243,133,134,255,40,136,16,0,77,107,79,255,183,85,92,1,177,204,202,0,163,71,147,255,152,69,190,0,172,51,188,1,250,210,172,255,211,242,113,1,89,89,26,255,64,66,111,254,116,152,42,0,161,39,27,255,54,80,254,0,106,209,115,1,103,124,97,0,221,230,98,255,31,231,6,0,178,192,120,254,15,217,203,255,124,158,79,0,112,145,247,0,92,250,48,1,163,181,193,255,37,47,142,254,144,189,165,255,46,146,240,0,6,75,128,0,41,157,200,254,87,121,213,0,1,113,236,0,5,45,250,0,144,12,82,0,31,108,231,0,225,239,119,255,167,7,189,255,187,228,132,255,110,189,34,0,94,44,204,1,162,52,197,0,78,188,241,254,57,20,141,0,244,146,47,1,206,100,51,0,125,107,148,254,27,195,77,0,152,253,90,1,7,143,144,255,51,37,31,0,34,119,38,255,7,197,118,0,153,188,211,0,151,20,116,254,245,65,52,255,180,253,110,1,47,177,209,0,161,99,17,255,118,222,202,0,125,179,252,1,123,54,126,255,145,57,191,0,55,186,121,0,10,243,138,0,205,211,229,255,125,156,241,254,148,156,185,255,227,19,188,255,124,41,32,255,31,34,206,254,17,57,83,0,204,22,37,255,42,96,98,0,119,102,184,1,3,190,28,0,110,82,218,255,200,204,192,255,201,145,118,0,117,204,146,0,132,32,98,1,192,194,121,0,106,161,248,1,237,88,124,0,23,212,26,0,205,171,90,255,248,48,216,1,141,37,230,255,124,203,0,254,158,168,30,255,214,248,21,0,112,187,7,255,75,133,239,255,74,227,243,255,250,147,70,0,214,120,162,0,167,9,179,255,22,158,18,0,218,77,209,1,97,109,81,255,244,33,179,255,57,52,57,255,65,172,210,255,249,71,209,255,142,169,238,0,158,189,153,255,174,254,103,254,98,33,14,0,141,76,230,255,113,139,52,255,15,58,212,0,168,215,201,255,248,204,215,1,223,68,160,255,57,154,183,254,47,231,121,0,106,166,137,0,81,136,138,0,165,43,51,0,231,139,61,0,57,95,59,254,118,98,25,255,151,63,236,1,94,190,250,255,169,185,114,1,5,250,58,255,75,105,97,1,215,223,134,0,113,99,163,1,128,62,112,0,99,106,147,0,163,195,10,0,33,205,182,0,214,14,174,255,129,38,231,255,53,182,223,0,98,42,159,255,247,13,40,0,188,210,177,1,6,21,0,255,255,61,148,254,137,45,129,255,89,26,116,254,126,38,114,0,251,50,242,254,121,134,128,255,204,249,167,254,165,235,215,0,202,177,243,0,133,141,62,0,240,130,190,1,110,175,255,0,0,20,146,1,37,210,121,255,7,39,130,0,142,250,84,255,141,200,207,0,9,95,104,255,11,244,174,0,134,232,126,0,167,1,123,254,16,193,149,255,232,233,239,1,213,70,112,255,252,116,160,254,242,222,220,255,205,85,227,0,7,185,58,0,118,247,63,1,116,77,177,255,62,245,200,254,63,18,37,255,107,53,232,254,50,221,211,0,162,219,7,254,2,94,43,0,182,62,182,254,160,78,200,255,135,140,170,0,235,184,228,0,175,53,138,254,80,58,77,255,152,201,2,1,63,196,34,0,5,30,184,0,171,176,154,0,121,59,206,0,38,99,39,0,172,80,77,254,0,134,151,0,186,33,241,254,94,253,223,255,44,114,252,0,108,126,57,255,201,40,13,255,39,229,27,255,39,239,23,1,151,121,51,255,153,150,248,0,10,234,174,255,118,246,4,254,200,245,38,0,69,161,242,1,16,178,150,0,113,56,130,0,171,31,105,0,26,88,108,255,49,42,106,0,251,169,66,0,69,93,149,0,20,57,254,0,164,25,111,0,90,188,90,255,204,4,197,0,40,213,50,1,212,96,132,255,88,138,180,254,228,146,124,255,184,246,247,0,65,117,86,255,253,102,210,254,254,121,36,0,137,115,3,255,60,24,216,0,134,18,29,0,59,226,97,0,176,142,71,0,7,209,161,0,189,84,51,254,155,250,72,0,213,84,235,255,45,222,224,0,238,148,143,255,170,42,53,255,78,167,117,0,186,0,40,255,125,177,103,255,69,225,66,0,227,7,88,1,75,172,6,0,169,45,227,1,16,36,70,255,50,2,9,255,139,193,22,0,143,183,231,254,218,69,50,0,236,56,161,1,213,131,42,0,138,145,44,254,136,229,40,255,49,63,35,255,61,145,245,255,101,192,2,254,232,167,113,0,152,104,38,1,121,185,218,0,121,139,211,254,119,240,35,0,65,189,217,254,187,179,162,255,160,187,230,0,62,248,14,255,60,78,97,0,255,247,163,255,225,59,91,255,107,71,58,255,241,47,33,1,50,117,236,0,219,177,63,254,244,90,179,0,35,194,215,255,189,67,50,255,23,135,129,0,104,189,37,255,185,57,194,0,35,62,231,255,220,248,108,0,12,231,178,0,143,80,91,1,131,93,101,255,144,39,2,1,255,250,178,0,5,17,236,254,139,32,46,0,204,188,38,254,245,115,52,255,191,113,73,254,191,108,69,255,22,69,245,1,23,203,178,0,170,99,170,0,65,248,111,0,37,108,153,255,64,37,69,0,0,88,62,254,89,148,144,255,191,68,224,1,241,39,53,0,41,203,237,255,145,126,194,255,221,42,253,255,25,99,151,0,97,253,223,1,74,115,49,255,6,175,72,255,59,176,203,0,124,183,249,1,228,228,99,0,129,12,207,254,168,192,195,255,204,176,16,254,152,234,171,0,77,37,85,255,33,120,135,255,142,194,227,1,31,214,58,0,213,187,125,255,232,46,60,255,190,116,42,254,151,178,19,255,51,62,237,254,204,236,193,0,194,232,60,0,172,34,157,255,189,16,184,254,103,3,95,255,141,233,36,254,41,25,11,255,21,195,166,0,118,245,45,0,67,213,149,255,159,12,18,255,187,164,227,1,160,25,5,0,12,78,195,1,43,197,225,0,48,142,41,254,196,155,60,255,223,199,18,1,145,136,156,0,252,117,169,254,145,226,238,0,239,23,107,0,109,181,188,255,230,112,49,254,73,170,237,255,231,183,227,255,80,220,20,0,194,107,127,1,127,205,101,0,46,52,197,1,210,171,36,255,88,3,90,255,56,151,141,0,96,187,255,255,42,78,200,0,254,70,70,1,244,125,168,0,204,68,138,1,124,215,70,0,102,66,200,254,17,52,228,0,117,220,143,254,203,248,123,0,56,18,174,255,186,151,164,255,51,232,208,1,160,228,43,255,249,29,25,1,68,190,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,80,143,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,65,114,103,111,110,50,100,0,97,114,103,111,110,50,100,0,65,114,103,111,110,50,105,0,97,114,103,111,110,50,105,0,65,114,103,111,110,50,105,100,0,97,114,103,111,110,50,105,100,0,37,108,117,0,110,105,109,105,113,114,111,99,107,115,33,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+30720);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  
  
   
  
   
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC);   


  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    } 


   

   

   

   

   

   

   

  
    

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory


function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "invoke_iiii": invoke_iiii, "invoke_vii": invoke_vii, "invoke_iii": invoke_iii, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___setErrNo": ___setErrNo, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
'use asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var invoke_iiii=env.invoke_iiii;
  var invoke_vii=env.invoke_vii;
  var invoke_iii=env.invoke_iii;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___setErrNo=env.___setErrNo;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _argon2_type2string($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 switch ($0|0) {
 case 0:  {
  $2 = ($1|0)!=(0);
  $3 = $2 ? 33656 : 33664;
  $$0 = $3;
  break;
 }
 case 1:  {
  $4 = ($1|0)!=(0);
  $5 = $4 ? 33672 : 33680;
  $$0 = $5;
  break;
 }
 case 2:  {
  $6 = ($1|0)!=(0);
  $7 = $6 ? 33688 : 33697;
  $$0 = $7;
  break;
 }
 default: {
  $$0 = 0;
 }
 }
 return ($$0|0);
}
function _argon2_ctx($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $2 = sp;
 $3 = (_validate_inputs($0)|0);
 $4 = ($3|0)==(0);
 if (!($4)) {
  $$0 = $3;
  STACKTOP = sp;return ($$0|0);
 }
 $5 = ($1>>>0)>(2);
 if ($5) {
  $$0 = -26;
  STACKTOP = sp;return ($$0|0);
 }
 $6 = ((($0)) + 44|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 48|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $9 << 3;
 $11 = ($7>>>0)<($10>>>0);
 $$ = $11 ? $10 : $7;
 $12 = $9 << 2;
 $13 = (($$>>>0) / ($12>>>0))&-1;
 $14 = Math_imul($13, $12)|0;
 $15 = ((($0)) + 56|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($2)) + 4|0);
 HEAP32[$17>>2] = $16;
 HEAP32[$2>>2] = 0;
 $18 = ((($0)) + 40|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($2)) + 8|0);
 HEAP32[$20>>2] = $19;
 $21 = ((($2)) + 12|0);
 HEAP32[$21>>2] = $14;
 $22 = ((($2)) + 16|0);
 HEAP32[$22>>2] = $13;
 $23 = $13 << 2;
 $24 = ((($2)) + 20|0);
 HEAP32[$24>>2] = $23;
 $25 = ((($2)) + 24|0);
 HEAP32[$25>>2] = $9;
 $26 = ((($0)) + 52|0);
 $27 = HEAP32[$26>>2]|0;
 $28 = ((($2)) + 28|0);
 HEAP32[$28>>2] = $27;
 $29 = ((($2)) + 32|0);
 HEAP32[$29>>2] = $1;
 $30 = HEAP32[$25>>2]|0;
 $31 = ($27>>>0)>($30>>>0);
 if ($31) {
  HEAP32[$28>>2] = $30;
 }
 $32 = (_initialize($2,$0)|0);
 $33 = ($32|0)==(0);
 if (!($33)) {
  $$0 = $32;
  STACKTOP = sp;return ($$0|0);
 }
 $34 = (_fill_memory_blocks($2)|0);
 $35 = ($34|0)==(0);
 if (!($35)) {
  $$0 = $34;
  STACKTOP = sp;return ($$0|0);
 }
 _finalize($0,$2);
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _argon2_hash($0,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 $7 = $7|0;
 $8 = $8|0;
 $9 = $9|0;
 $10 = $10|0;
 $11 = $11|0;
 $12 = $12|0;
 var $$0 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $13 = sp;
 $14 = ($8>>>0)<(4);
 if ($14) {
  $$0 = -2;
  STACKTOP = sp;return ($$0|0);
 }
 $15 = (_malloc($8)|0);
 $16 = ($15|0)==(0|0);
 if ($16) {
  $$0 = -22;
  STACKTOP = sp;return ($$0|0);
 }
 HEAP32[$13>>2] = $15;
 $17 = ((($13)) + 4|0);
 HEAP32[$17>>2] = $8;
 $18 = ((($13)) + 8|0);
 HEAP32[$18>>2] = $3;
 $19 = ((($13)) + 12|0);
 HEAP32[$19>>2] = $4;
 $20 = ((($13)) + 16|0);
 HEAP32[$20>>2] = $5;
 $21 = ((($13)) + 20|0);
 HEAP32[$21>>2] = $6;
 $22 = ((($13)) + 24|0);
 $23 = ((($13)) + 40|0);
 ;HEAP32[$22>>2]=0|0;HEAP32[$22+4>>2]=0|0;HEAP32[$22+8>>2]=0|0;HEAP32[$22+12>>2]=0|0;
 HEAP32[$23>>2] = $0;
 $24 = ((($13)) + 44|0);
 HEAP32[$24>>2] = $1;
 $25 = ((($13)) + 48|0);
 HEAP32[$25>>2] = $2;
 $26 = ((($13)) + 52|0);
 HEAP32[$26>>2] = $2;
 $27 = ((($13)) + 60|0);
 HEAP32[$27>>2] = 0;
 $28 = ((($13)) + 64|0);
 HEAP32[$28>>2] = 0;
 $29 = ((($13)) + 68|0);
 HEAP32[$29>>2] = 0;
 $30 = ((($13)) + 56|0);
 HEAP32[$30>>2] = $12;
 $31 = (_argon2_ctx($13,$11)|0);
 $32 = ($31|0)==(0);
 if (!($32)) {
  _clear_internal_memory($15,$8);
  _free($15);
  $$0 = $31;
  STACKTOP = sp;return ($$0|0);
 }
 $33 = ($7|0)==(0|0);
 if (!($33)) {
  _memcpy(($7|0),($15|0),($8|0))|0;
 }
 $34 = ($9|0)!=(0|0);
 $35 = ($10|0)!=(0);
 $or$cond = $34 & $35;
 if ($or$cond) {
  $36 = (_encode_string($9,$10,$13,$11)|0);
  $37 = ($36|0)==(0);
  if (!($37)) {
   _clear_internal_memory($15,$8);
   _clear_internal_memory($9,$10);
   _free($15);
   $$0 = -31;
   STACKTOP = sp;return ($$0|0);
  }
 }
 _clear_internal_memory($15,$8);
 _free($15);
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _argon2d_hash_raw($0,$1,$2,$3,$4,$5,$6,$7,$8) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 $7 = $7|0;
 $8 = $8|0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $9 = (_argon2_hash($0,$1,$2,$3,$4,$5,$6,$7,$8,0,0,0,19)|0);
 return ($9|0);
}
function _blake2b_init_param($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$016 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $14 = 0, $15 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0|0);
 $3 = ($0|0)==(0|0);
 $or$cond = $3 | $2;
 if ($or$cond) {
  $$016 = -1;
  return ($$016|0);
 }
 _blake2b_init0($0);
 $4 = (_load64($1)|0);
 $5 = tempRet0;
 $6 = $0;
 $7 = $6;
 $8 = HEAP32[$7>>2]|0;
 $9 = (($6) + 4)|0;
 $10 = $9;
 $11 = HEAP32[$10>>2]|0;
 $12 = $8 ^ $4;
 $13 = $11 ^ $5;
 $14 = $0;
 $15 = $14;
 HEAP32[$15>>2] = $12;
 $16 = (($14) + 4)|0;
 $17 = $16;
 HEAP32[$17>>2] = $13;
 $18 = ((($1)) + 8|0);
 $19 = (_load64($18)|0);
 $20 = tempRet0;
 $21 = ((($0)) + 8|0);
 $22 = $21;
 $23 = $22;
 $24 = HEAP32[$23>>2]|0;
 $25 = (($22) + 4)|0;
 $26 = $25;
 $27 = HEAP32[$26>>2]|0;
 $28 = $24 ^ $19;
 $29 = $27 ^ $20;
 $30 = $21;
 $31 = $30;
 HEAP32[$31>>2] = $28;
 $32 = (($30) + 4)|0;
 $33 = $32;
 HEAP32[$33>>2] = $29;
 $34 = ((($1)) + 16|0);
 $35 = (_load64($34)|0);
 $36 = tempRet0;
 $37 = ((($0)) + 16|0);
 $38 = $37;
 $39 = $38;
 $40 = HEAP32[$39>>2]|0;
 $41 = (($38) + 4)|0;
 $42 = $41;
 $43 = HEAP32[$42>>2]|0;
 $44 = $40 ^ $35;
 $45 = $43 ^ $36;
 $46 = $37;
 $47 = $46;
 HEAP32[$47>>2] = $44;
 $48 = (($46) + 4)|0;
 $49 = $48;
 HEAP32[$49>>2] = $45;
 $50 = ((($1)) + 24|0);
 $51 = (_load64($50)|0);
 $52 = tempRet0;
 $53 = ((($0)) + 24|0);
 $54 = $53;
 $55 = $54;
 $56 = HEAP32[$55>>2]|0;
 $57 = (($54) + 4)|0;
 $58 = $57;
 $59 = HEAP32[$58>>2]|0;
 $60 = $56 ^ $51;
 $61 = $59 ^ $52;
 $62 = $53;
 $63 = $62;
 HEAP32[$63>>2] = $60;
 $64 = (($62) + 4)|0;
 $65 = $64;
 HEAP32[$65>>2] = $61;
 $66 = ((($1)) + 32|0);
 $67 = (_load64($66)|0);
 $68 = tempRet0;
 $69 = ((($0)) + 32|0);
 $70 = $69;
 $71 = $70;
 $72 = HEAP32[$71>>2]|0;
 $73 = (($70) + 4)|0;
 $74 = $73;
 $75 = HEAP32[$74>>2]|0;
 $76 = $72 ^ $67;
 $77 = $75 ^ $68;
 $78 = $69;
 $79 = $78;
 HEAP32[$79>>2] = $76;
 $80 = (($78) + 4)|0;
 $81 = $80;
 HEAP32[$81>>2] = $77;
 $82 = ((($1)) + 40|0);
 $83 = (_load64($82)|0);
 $84 = tempRet0;
 $85 = ((($0)) + 40|0);
 $86 = $85;
 $87 = $86;
 $88 = HEAP32[$87>>2]|0;
 $89 = (($86) + 4)|0;
 $90 = $89;
 $91 = HEAP32[$90>>2]|0;
 $92 = $88 ^ $83;
 $93 = $91 ^ $84;
 $94 = $85;
 $95 = $94;
 HEAP32[$95>>2] = $92;
 $96 = (($94) + 4)|0;
 $97 = $96;
 HEAP32[$97>>2] = $93;
 $98 = ((($1)) + 48|0);
 $99 = (_load64($98)|0);
 $100 = tempRet0;
 $101 = ((($0)) + 48|0);
 $102 = $101;
 $103 = $102;
 $104 = HEAP32[$103>>2]|0;
 $105 = (($102) + 4)|0;
 $106 = $105;
 $107 = HEAP32[$106>>2]|0;
 $108 = $104 ^ $99;
 $109 = $107 ^ $100;
 $110 = $101;
 $111 = $110;
 HEAP32[$111>>2] = $108;
 $112 = (($110) + 4)|0;
 $113 = $112;
 HEAP32[$113>>2] = $109;
 $114 = ((($1)) + 56|0);
 $115 = (_load64($114)|0);
 $116 = tempRet0;
 $117 = ((($0)) + 56|0);
 $118 = $117;
 $119 = $118;
 $120 = HEAP32[$119>>2]|0;
 $121 = (($118) + 4)|0;
 $122 = $121;
 $123 = HEAP32[$122>>2]|0;
 $124 = $120 ^ $115;
 $125 = $123 ^ $116;
 $126 = $117;
 $127 = $126;
 HEAP32[$127>>2] = $124;
 $128 = (($126) + 4)|0;
 $129 = $128;
 HEAP32[$129>>2] = $125;
 $130 = HEAP8[$1>>0]|0;
 $131 = $130&255;
 $132 = ((($0)) + 228|0);
 HEAP32[$132>>2] = $131;
 $$016 = 0;
 return ($$016|0);
}
function _blake2b_init0($0) {
 $0 = $0|0;
 var $1 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 64|0);
 _memset(($1|0),0,176)|0;
 dest=$0; src=8; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 return;
}
function _load64($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1;
 $3 = HEAPU8[$2>>0]|(HEAPU8[$2+1>>0]<<8)|(HEAPU8[$2+2>>0]<<16)|(HEAPU8[$2+3>>0]<<24);
 $4 = (($1) + 4)|0;
 $5 = $4;
 $6 = HEAPU8[$5>>0]|(HEAPU8[$5+1>>0]<<8)|(HEAPU8[$5+2>>0]<<16)|(HEAPU8[$5+3>>0]<<24);
 tempRet0 = ($6);
 return ($3|0);
}
function _blake2b_init($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $2 = sp;
 $3 = ($0|0)==(0|0);
 if ($3) {
  $$0 = -1;
  STACKTOP = sp;return ($$0|0);
 }
 $4 = (($1) + -1)|0;
 $5 = ($4>>>0)>(63);
 if ($5) {
  _blake2b_invalidate_state($0);
  $$0 = -1;
  STACKTOP = sp;return ($$0|0);
 } else {
  $6 = $1&255;
  HEAP8[$2>>0] = $6;
  $7 = ((($2)) + 1|0);
  HEAP8[$7>>0] = 0;
  $8 = ((($2)) + 2|0);
  HEAP8[$8>>0] = 1;
  $9 = ((($2)) + 3|0);
  HEAP8[$9>>0] = 1;
  $10 = ((($2)) + 4|0);
  dest=$10; stop=dest+60|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0));
  $11 = (_blake2b_init_param($0,$2)|0);
  $$0 = $11;
  STACKTOP = sp;return ($$0|0);
 }
 return (0)|0;
}
function _blake2b_invalidate_state($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _clear_internal_memory($0,240);
 _blake2b_set_lastblock($0);
 return;
}
function _blake2b_set_lastblock($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 232|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = ($2<<24>>24)==(0);
 if (!($3)) {
  _blake2b_set_lastnode($0);
 }
 $4 = ((($0)) + 80|0);
 $5 = $4;
 $6 = $5;
 HEAP32[$6>>2] = -1;
 $7 = (($5) + 4)|0;
 $8 = $7;
 HEAP32[$8>>2] = -1;
 return;
}
function _blake2b_set_lastnode($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 88|0);
 $2 = $1;
 $3 = $2;
 HEAP32[$3>>2] = -1;
 $4 = (($2) + 4)|0;
 $5 = $4;
 HEAP32[$5>>2] = -1;
 return;
}
function _blake2b_init_key($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 192|0;
 $4 = sp + 128|0;
 $5 = sp;
 $6 = ($0|0)==(0|0);
 if ($6) {
  $$0 = -1;
  STACKTOP = sp;return ($$0|0);
 }
 $7 = (($1) + -1)|0;
 $8 = ($7>>>0)>(63);
 if ($8) {
  _blake2b_invalidate_state($0);
  $$0 = -1;
  STACKTOP = sp;return ($$0|0);
 }
 $9 = ($2|0)==(0|0);
 $10 = (($3) + -1)|0;
 $11 = ($10>>>0)>(63);
 $12 = $9 | $11;
 if ($12) {
  _blake2b_invalidate_state($0);
  $$0 = -1;
  STACKTOP = sp;return ($$0|0);
 }
 $13 = $1&255;
 HEAP8[$4>>0] = $13;
 $14 = $3&255;
 $15 = ((($4)) + 1|0);
 HEAP8[$15>>0] = $14;
 $16 = ((($4)) + 2|0);
 HEAP8[$16>>0] = 1;
 $17 = ((($4)) + 3|0);
 HEAP8[$17>>0] = 1;
 $18 = ((($4)) + 4|0);
 dest=$18; stop=dest+60|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0));
 $19 = (_blake2b_init_param($0,$4)|0);
 $20 = ($19|0)<(0);
 if ($20) {
  _blake2b_invalidate_state($0);
  $$0 = -1;
  STACKTOP = sp;return ($$0|0);
 } else {
  $21 = ($3>>>0)>(127);
  $22 = (128 - ($3))|0;
  $23 = $21 ? 0 : $22;
  $24 = (($5) + ($3)|0);
  _memset(($24|0),0,($23|0))|0;
  _memcpy(($5|0),($2|0),($3|0))|0;
  (_blake2b_update($0,$5,128)|0);
  _clear_internal_memory($5,128);
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 return (0)|0;
}
function _blake2b_update($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$03943 = 0, $$04042 = 0, $$1 = 0, $$141 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $or$cond = 0, $scevgep = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($2|0)==(0);
 if ($3) {
  $$0 = 0;
  return ($$0|0);
 }
 $4 = ($0|0)==(0|0);
 $5 = ($1|0)==(0|0);
 $or$cond = $4 | $5;
 if ($or$cond) {
  $$0 = -1;
  return ($$0|0);
 }
 $6 = ((($0)) + 80|0);
 $7 = $6;
 $8 = $7;
 $9 = HEAP32[$8>>2]|0;
 $10 = (($7) + 4)|0;
 $11 = $10;
 $12 = HEAP32[$11>>2]|0;
 $13 = ($9|0)==(0);
 $14 = ($12|0)==(0);
 $15 = $13 & $14;
 if (!($15)) {
  $$0 = -1;
  return ($$0|0);
 }
 $16 = ((($0)) + 224|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = (($17) + ($2))|0;
 $19 = ($18>>>0)>(128);
 if ($19) {
  $20 = (128 - ($17))|0;
  $21 = (((($0)) + 96|0) + ($17)|0);
  _memcpy(($21|0),($1|0),($20|0))|0;
  _blake2b_increment_counter($0,128,0);
  $22 = ((($0)) + 96|0);
  _blake2b_compress($0,$22);
  HEAP32[$16>>2] = 0;
  $23 = (($2) - ($20))|0;
  $24 = (($1) + ($20)|0);
  $25 = ($23>>>0)>(128);
  if ($25) {
   $26 = (($17) + ($2))|0;
   $27 = (($26) + -257)|0;
   $28 = $27 & -128;
   $29 = (($28) + 256)|0;
   $30 = (($29) - ($17))|0;
   $$03943 = $23;$$04042 = $24;
   while(1) {
    _blake2b_increment_counter($0,128,0);
    _blake2b_compress($0,$$04042);
    $31 = (($$03943) + -128)|0;
    $32 = ((($$04042)) + 128|0);
    $33 = ($31>>>0)>(128);
    if ($33) {
     $$03943 = $31;$$04042 = $32;
    } else {
     break;
    }
   }
   $34 = (($26) + -256)|0;
   $35 = (($34) - ($28))|0;
   $scevgep = (($1) + ($30)|0);
   $$1 = $35;$$141 = $scevgep;
  } else {
   $$1 = $23;$$141 = $24;
  }
 } else {
  $$1 = $2;$$141 = $1;
 }
 $36 = HEAP32[$16>>2]|0;
 $37 = (((($0)) + 96|0) + ($36)|0);
 _memcpy(($37|0),($$141|0),($$1|0))|0;
 $38 = HEAP32[$16>>2]|0;
 $39 = (($38) + ($$1))|0;
 HEAP32[$16>>2] = $39;
 $$0 = 0;
 return ($$0|0);
}
function _blake2b_increment_counter($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 64|0);
 $4 = $3;
 $5 = $4;
 $6 = HEAP32[$5>>2]|0;
 $7 = (($4) + 4)|0;
 $8 = $7;
 $9 = HEAP32[$8>>2]|0;
 $10 = (_i64Add(($6|0),($9|0),($1|0),($2|0))|0);
 $11 = tempRet0;
 $12 = $3;
 $13 = $12;
 HEAP32[$13>>2] = $10;
 $14 = (($12) + 4)|0;
 $15 = $14;
 HEAP32[$15>>2] = $11;
 $16 = ($11>>>0)<($2>>>0);
 $17 = ($10>>>0)<($1>>>0);
 $18 = ($11|0)==($2|0);
 $19 = $18 & $17;
 $20 = $16 | $19;
 $21 = $20&1;
 $22 = ((($0)) + 72|0);
 $23 = $22;
 $24 = $23;
 $25 = HEAP32[$24>>2]|0;
 $26 = (($23) + 4)|0;
 $27 = $26;
 $28 = HEAP32[$27>>2]|0;
 $29 = (_i64Add(($21|0),0,($25|0),($28|0))|0);
 $30 = tempRet0;
 $31 = $22;
 $32 = $31;
 HEAP32[$32>>2] = $29;
 $33 = (($31) + 4)|0;
 $34 = $33;
 HEAP32[$34>>2] = $30;
 return;
}
function _blake2b_compress($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$045 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0;
 var $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0;
 var $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0;
 var $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0;
 var $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0;
 var $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0;
 var $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0;
 var $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0;
 var $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0;
 var $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0;
 var $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0;
 var $997 = 0, $998 = 0, $999 = 0, $exitcond = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $2 = sp + 128|0;
 $3 = sp;
 $4 = (_load64($1)|0);
 $5 = tempRet0;
 $6 = $2;
 $7 = $6;
 HEAP32[$7>>2] = $4;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = $5;
 $10 = ((($1)) + 8|0);
 $11 = (_load64($10)|0);
 $12 = tempRet0;
 $13 = ((($2)) + 8|0);
 $14 = $13;
 $15 = $14;
 HEAP32[$15>>2] = $11;
 $16 = (($14) + 4)|0;
 $17 = $16;
 HEAP32[$17>>2] = $12;
 $18 = ((($1)) + 16|0);
 $19 = (_load64($18)|0);
 $20 = tempRet0;
 $21 = ((($2)) + 16|0);
 $22 = $21;
 $23 = $22;
 HEAP32[$23>>2] = $19;
 $24 = (($22) + 4)|0;
 $25 = $24;
 HEAP32[$25>>2] = $20;
 $26 = ((($1)) + 24|0);
 $27 = (_load64($26)|0);
 $28 = tempRet0;
 $29 = ((($2)) + 24|0);
 $30 = $29;
 $31 = $30;
 HEAP32[$31>>2] = $27;
 $32 = (($30) + 4)|0;
 $33 = $32;
 HEAP32[$33>>2] = $28;
 $34 = ((($1)) + 32|0);
 $35 = (_load64($34)|0);
 $36 = tempRet0;
 $37 = ((($2)) + 32|0);
 $38 = $37;
 $39 = $38;
 HEAP32[$39>>2] = $35;
 $40 = (($38) + 4)|0;
 $41 = $40;
 HEAP32[$41>>2] = $36;
 $42 = ((($1)) + 40|0);
 $43 = (_load64($42)|0);
 $44 = tempRet0;
 $45 = ((($2)) + 40|0);
 $46 = $45;
 $47 = $46;
 HEAP32[$47>>2] = $43;
 $48 = (($46) + 4)|0;
 $49 = $48;
 HEAP32[$49>>2] = $44;
 $50 = ((($1)) + 48|0);
 $51 = (_load64($50)|0);
 $52 = tempRet0;
 $53 = ((($2)) + 48|0);
 $54 = $53;
 $55 = $54;
 HEAP32[$55>>2] = $51;
 $56 = (($54) + 4)|0;
 $57 = $56;
 HEAP32[$57>>2] = $52;
 $58 = ((($1)) + 56|0);
 $59 = (_load64($58)|0);
 $60 = tempRet0;
 $61 = ((($2)) + 56|0);
 $62 = $61;
 $63 = $62;
 HEAP32[$63>>2] = $59;
 $64 = (($62) + 4)|0;
 $65 = $64;
 HEAP32[$65>>2] = $60;
 $66 = ((($1)) + 64|0);
 $67 = (_load64($66)|0);
 $68 = tempRet0;
 $69 = ((($2)) + 64|0);
 $70 = $69;
 $71 = $70;
 HEAP32[$71>>2] = $67;
 $72 = (($70) + 4)|0;
 $73 = $72;
 HEAP32[$73>>2] = $68;
 $74 = ((($1)) + 72|0);
 $75 = (_load64($74)|0);
 $76 = tempRet0;
 $77 = ((($2)) + 72|0);
 $78 = $77;
 $79 = $78;
 HEAP32[$79>>2] = $75;
 $80 = (($78) + 4)|0;
 $81 = $80;
 HEAP32[$81>>2] = $76;
 $82 = ((($1)) + 80|0);
 $83 = (_load64($82)|0);
 $84 = tempRet0;
 $85 = ((($2)) + 80|0);
 $86 = $85;
 $87 = $86;
 HEAP32[$87>>2] = $83;
 $88 = (($86) + 4)|0;
 $89 = $88;
 HEAP32[$89>>2] = $84;
 $90 = ((($1)) + 88|0);
 $91 = (_load64($90)|0);
 $92 = tempRet0;
 $93 = ((($2)) + 88|0);
 $94 = $93;
 $95 = $94;
 HEAP32[$95>>2] = $91;
 $96 = (($94) + 4)|0;
 $97 = $96;
 HEAP32[$97>>2] = $92;
 $98 = ((($1)) + 96|0);
 $99 = (_load64($98)|0);
 $100 = tempRet0;
 $101 = ((($2)) + 96|0);
 $102 = $101;
 $103 = $102;
 HEAP32[$103>>2] = $99;
 $104 = (($102) + 4)|0;
 $105 = $104;
 HEAP32[$105>>2] = $100;
 $106 = ((($1)) + 104|0);
 $107 = (_load64($106)|0);
 $108 = tempRet0;
 $109 = ((($2)) + 104|0);
 $110 = $109;
 $111 = $110;
 HEAP32[$111>>2] = $107;
 $112 = (($110) + 4)|0;
 $113 = $112;
 HEAP32[$113>>2] = $108;
 $114 = ((($1)) + 112|0);
 $115 = (_load64($114)|0);
 $116 = tempRet0;
 $117 = ((($2)) + 112|0);
 $118 = $117;
 $119 = $118;
 HEAP32[$119>>2] = $115;
 $120 = (($118) + 4)|0;
 $121 = $120;
 HEAP32[$121>>2] = $116;
 $122 = ((($1)) + 120|0);
 $123 = (_load64($122)|0);
 $124 = tempRet0;
 $125 = ((($2)) + 120|0);
 $126 = $125;
 $127 = $126;
 HEAP32[$127>>2] = $123;
 $128 = (($126) + 4)|0;
 $129 = $128;
 HEAP32[$129>>2] = $124;
 dest=$3; src=$0; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $130 = ((($3)) + 64|0);
 $131 = $130;
 $132 = $131;
 HEAP32[$132>>2] = -205731576;
 $133 = (($131) + 4)|0;
 $134 = $133;
 HEAP32[$134>>2] = 1779033703;
 $135 = ((($3)) + 72|0);
 $136 = $135;
 $137 = $136;
 HEAP32[$137>>2] = -2067093701;
 $138 = (($136) + 4)|0;
 $139 = $138;
 HEAP32[$139>>2] = -1150833019;
 $140 = ((($3)) + 80|0);
 $141 = $140;
 $142 = $141;
 HEAP32[$142>>2] = -23791573;
 $143 = (($141) + 4)|0;
 $144 = $143;
 HEAP32[$144>>2] = 1013904242;
 $145 = ((($3)) + 88|0);
 $146 = $145;
 $147 = $146;
 HEAP32[$147>>2] = 1595750129;
 $148 = (($146) + 4)|0;
 $149 = $148;
 HEAP32[$149>>2] = -1521486534;
 $150 = ((($0)) + 64|0);
 $151 = $150;
 $152 = $151;
 $153 = HEAP32[$152>>2]|0;
 $154 = (($151) + 4)|0;
 $155 = $154;
 $156 = HEAP32[$155>>2]|0;
 $157 = $153 ^ -1377402159;
 $158 = $156 ^ 1359893119;
 $159 = ((($3)) + 96|0);
 $160 = $159;
 $161 = $160;
 HEAP32[$161>>2] = $157;
 $162 = (($160) + 4)|0;
 $163 = $162;
 HEAP32[$163>>2] = $158;
 $164 = ((($0)) + 72|0);
 $165 = $164;
 $166 = $165;
 $167 = HEAP32[$166>>2]|0;
 $168 = (($165) + 4)|0;
 $169 = $168;
 $170 = HEAP32[$169>>2]|0;
 $171 = $167 ^ 725511199;
 $172 = $170 ^ -1694144372;
 $173 = ((($3)) + 104|0);
 $174 = $173;
 $175 = $174;
 HEAP32[$175>>2] = $171;
 $176 = (($174) + 4)|0;
 $177 = $176;
 HEAP32[$177>>2] = $172;
 $178 = ((($0)) + 80|0);
 $179 = $178;
 $180 = $179;
 $181 = HEAP32[$180>>2]|0;
 $182 = (($179) + 4)|0;
 $183 = $182;
 $184 = HEAP32[$183>>2]|0;
 $185 = $181 ^ -79577749;
 $186 = $184 ^ 528734635;
 $187 = ((($3)) + 112|0);
 $188 = $187;
 $189 = $188;
 HEAP32[$189>>2] = $185;
 $190 = (($188) + 4)|0;
 $191 = $190;
 HEAP32[$191>>2] = $186;
 $192 = ((($0)) + 88|0);
 $193 = $192;
 $194 = $193;
 $195 = HEAP32[$194>>2]|0;
 $196 = (($193) + 4)|0;
 $197 = $196;
 $198 = HEAP32[$197>>2]|0;
 $199 = $195 ^ 327033209;
 $200 = $198 ^ 1541459225;
 $201 = ((($3)) + 120|0);
 $202 = $201;
 $203 = $202;
 HEAP32[$203>>2] = $199;
 $204 = (($202) + 4)|0;
 $205 = $204;
 HEAP32[$205>>2] = $200;
 $206 = ((($3)) + 32|0);
 $207 = ((($3)) + 8|0);
 $208 = ((($3)) + 40|0);
 $209 = ((($3)) + 16|0);
 $210 = ((($3)) + 48|0);
 $211 = ((($3)) + 24|0);
 $212 = ((($3)) + 56|0);
 $213 = $3;
 $214 = $213;
 $215 = HEAP32[$214>>2]|0;
 $216 = (($213) + 4)|0;
 $217 = $216;
 $218 = HEAP32[$217>>2]|0;
 $219 = $206;
 $220 = $219;
 $221 = HEAP32[$220>>2]|0;
 $222 = (($219) + 4)|0;
 $223 = $222;
 $224 = HEAP32[$223>>2]|0;
 $225 = $159;
 $226 = $225;
 $227 = HEAP32[$226>>2]|0;
 $228 = (($225) + 4)|0;
 $229 = $228;
 $230 = HEAP32[$229>>2]|0;
 $231 = $130;
 $232 = $231;
 $233 = HEAP32[$232>>2]|0;
 $234 = (($231) + 4)|0;
 $235 = $234;
 $236 = HEAP32[$235>>2]|0;
 $237 = $207;
 $238 = $237;
 $239 = HEAP32[$238>>2]|0;
 $240 = (($237) + 4)|0;
 $241 = $240;
 $242 = HEAP32[$241>>2]|0;
 $243 = $208;
 $244 = $243;
 $245 = HEAP32[$244>>2]|0;
 $246 = (($243) + 4)|0;
 $247 = $246;
 $248 = HEAP32[$247>>2]|0;
 $249 = $173;
 $250 = $249;
 $251 = HEAP32[$250>>2]|0;
 $252 = (($249) + 4)|0;
 $253 = $252;
 $254 = HEAP32[$253>>2]|0;
 $255 = $135;
 $256 = $255;
 $257 = HEAP32[$256>>2]|0;
 $258 = (($255) + 4)|0;
 $259 = $258;
 $260 = HEAP32[$259>>2]|0;
 $261 = $209;
 $262 = $261;
 $263 = HEAP32[$262>>2]|0;
 $264 = (($261) + 4)|0;
 $265 = $264;
 $266 = HEAP32[$265>>2]|0;
 $267 = $210;
 $268 = $267;
 $269 = HEAP32[$268>>2]|0;
 $270 = (($267) + 4)|0;
 $271 = $270;
 $272 = HEAP32[$271>>2]|0;
 $273 = $187;
 $274 = $273;
 $275 = HEAP32[$274>>2]|0;
 $276 = (($273) + 4)|0;
 $277 = $276;
 $278 = HEAP32[$277>>2]|0;
 $279 = $140;
 $280 = $279;
 $281 = HEAP32[$280>>2]|0;
 $282 = (($279) + 4)|0;
 $283 = $282;
 $284 = HEAP32[$283>>2]|0;
 $285 = $211;
 $286 = $285;
 $287 = HEAP32[$286>>2]|0;
 $288 = (($285) + 4)|0;
 $289 = $288;
 $290 = HEAP32[$289>>2]|0;
 $291 = $212;
 $292 = $291;
 $293 = HEAP32[$292>>2]|0;
 $294 = (($291) + 4)|0;
 $295 = $294;
 $296 = HEAP32[$295>>2]|0;
 $297 = $201;
 $298 = $297;
 $299 = HEAP32[$298>>2]|0;
 $300 = (($297) + 4)|0;
 $301 = $300;
 $302 = HEAP32[$301>>2]|0;
 $303 = $145;
 $304 = $303;
 $305 = HEAP32[$304>>2]|0;
 $306 = (($303) + 4)|0;
 $307 = $306;
 $308 = HEAP32[$307>>2]|0;
 $$045 = 0;$309 = $221;$310 = $224;$311 = $215;$312 = $218;$327 = $227;$329 = $230;$332 = $233;$333 = $236;$363 = $245;$364 = $248;$365 = $239;$366 = $242;$381 = $251;$383 = $254;$386 = $257;$387 = $260;$417 = $269;$418 = $272;$419 = $263;$420 = $266;$435 = $275;$437 = $278;$440 = $281;$441 = $284;$471 = $293;$472 = $296;$473 = $287;$474 = $290;$489 = $299;$491 = $302;$494 = $305;$495 = $308;
 while(1) {
  $313 = (_i64Add(($309|0),($310|0),($311|0),($312|0))|0);
  $314 = tempRet0;
  $315 = (720 + ($$045<<6)|0);
  $316 = HEAP32[$315>>2]|0;
  $317 = (($2) + ($316<<3)|0);
  $318 = $317;
  $319 = $318;
  $320 = HEAP32[$319>>2]|0;
  $321 = (($318) + 4)|0;
  $322 = $321;
  $323 = HEAP32[$322>>2]|0;
  $324 = (_i64Add(($313|0),($314|0),($320|0),($323|0))|0);
  $325 = tempRet0;
  $326 = $327 ^ $324;
  $328 = $329 ^ $325;
  $330 = (_rotr64($326,$328,32)|0);
  $331 = tempRet0;
  $334 = (_i64Add(($332|0),($333|0),($330|0),($331|0))|0);
  $335 = tempRet0;
  $336 = $309 ^ $334;
  $337 = $310 ^ $335;
  $338 = (_rotr64($336,$337,24)|0);
  $339 = tempRet0;
  $340 = (_i64Add(($324|0),($325|0),($338|0),($339|0))|0);
  $341 = tempRet0;
  $342 = (((720 + ($$045<<6)|0)) + 4|0);
  $343 = HEAP32[$342>>2]|0;
  $344 = (($2) + ($343<<3)|0);
  $345 = $344;
  $346 = $345;
  $347 = HEAP32[$346>>2]|0;
  $348 = (($345) + 4)|0;
  $349 = $348;
  $350 = HEAP32[$349>>2]|0;
  $351 = (_i64Add(($340|0),($341|0),($347|0),($350|0))|0);
  $352 = tempRet0;
  $353 = $330 ^ $351;
  $354 = $331 ^ $352;
  $355 = (_rotr64($353,$354,16)|0);
  $356 = tempRet0;
  $357 = (_i64Add(($334|0),($335|0),($355|0),($356|0))|0);
  $358 = tempRet0;
  $359 = $338 ^ $357;
  $360 = $339 ^ $358;
  $361 = (_rotr64($359,$360,63)|0);
  $362 = tempRet0;
  $367 = (_i64Add(($363|0),($364|0),($365|0),($366|0))|0);
  $368 = tempRet0;
  $369 = (((720 + ($$045<<6)|0)) + 8|0);
  $370 = HEAP32[$369>>2]|0;
  $371 = (($2) + ($370<<3)|0);
  $372 = $371;
  $373 = $372;
  $374 = HEAP32[$373>>2]|0;
  $375 = (($372) + 4)|0;
  $376 = $375;
  $377 = HEAP32[$376>>2]|0;
  $378 = (_i64Add(($367|0),($368|0),($374|0),($377|0))|0);
  $379 = tempRet0;
  $380 = $381 ^ $378;
  $382 = $383 ^ $379;
  $384 = (_rotr64($380,$382,32)|0);
  $385 = tempRet0;
  $388 = (_i64Add(($386|0),($387|0),($384|0),($385|0))|0);
  $389 = tempRet0;
  $390 = $363 ^ $388;
  $391 = $364 ^ $389;
  $392 = (_rotr64($390,$391,24)|0);
  $393 = tempRet0;
  $394 = (_i64Add(($378|0),($379|0),($392|0),($393|0))|0);
  $395 = tempRet0;
  $396 = (((720 + ($$045<<6)|0)) + 12|0);
  $397 = HEAP32[$396>>2]|0;
  $398 = (($2) + ($397<<3)|0);
  $399 = $398;
  $400 = $399;
  $401 = HEAP32[$400>>2]|0;
  $402 = (($399) + 4)|0;
  $403 = $402;
  $404 = HEAP32[$403>>2]|0;
  $405 = (_i64Add(($394|0),($395|0),($401|0),($404|0))|0);
  $406 = tempRet0;
  $407 = $384 ^ $405;
  $408 = $385 ^ $406;
  $409 = (_rotr64($407,$408,16)|0);
  $410 = tempRet0;
  $411 = (_i64Add(($388|0),($389|0),($409|0),($410|0))|0);
  $412 = tempRet0;
  $413 = $392 ^ $411;
  $414 = $393 ^ $412;
  $415 = (_rotr64($413,$414,63)|0);
  $416 = tempRet0;
  $421 = (_i64Add(($417|0),($418|0),($419|0),($420|0))|0);
  $422 = tempRet0;
  $423 = (((720 + ($$045<<6)|0)) + 16|0);
  $424 = HEAP32[$423>>2]|0;
  $425 = (($2) + ($424<<3)|0);
  $426 = $425;
  $427 = $426;
  $428 = HEAP32[$427>>2]|0;
  $429 = (($426) + 4)|0;
  $430 = $429;
  $431 = HEAP32[$430>>2]|0;
  $432 = (_i64Add(($421|0),($422|0),($428|0),($431|0))|0);
  $433 = tempRet0;
  $434 = $435 ^ $432;
  $436 = $437 ^ $433;
  $438 = (_rotr64($434,$436,32)|0);
  $439 = tempRet0;
  $442 = (_i64Add(($440|0),($441|0),($438|0),($439|0))|0);
  $443 = tempRet0;
  $444 = $417 ^ $442;
  $445 = $418 ^ $443;
  $446 = (_rotr64($444,$445,24)|0);
  $447 = tempRet0;
  $448 = (_i64Add(($432|0),($433|0),($446|0),($447|0))|0);
  $449 = tempRet0;
  $450 = (((720 + ($$045<<6)|0)) + 20|0);
  $451 = HEAP32[$450>>2]|0;
  $452 = (($2) + ($451<<3)|0);
  $453 = $452;
  $454 = $453;
  $455 = HEAP32[$454>>2]|0;
  $456 = (($453) + 4)|0;
  $457 = $456;
  $458 = HEAP32[$457>>2]|0;
  $459 = (_i64Add(($448|0),($449|0),($455|0),($458|0))|0);
  $460 = tempRet0;
  $461 = $438 ^ $459;
  $462 = $439 ^ $460;
  $463 = (_rotr64($461,$462,16)|0);
  $464 = tempRet0;
  $465 = (_i64Add(($442|0),($443|0),($463|0),($464|0))|0);
  $466 = tempRet0;
  $467 = $446 ^ $465;
  $468 = $447 ^ $466;
  $469 = (_rotr64($467,$468,63)|0);
  $470 = tempRet0;
  $475 = (_i64Add(($471|0),($472|0),($473|0),($474|0))|0);
  $476 = tempRet0;
  $477 = (((720 + ($$045<<6)|0)) + 24|0);
  $478 = HEAP32[$477>>2]|0;
  $479 = (($2) + ($478<<3)|0);
  $480 = $479;
  $481 = $480;
  $482 = HEAP32[$481>>2]|0;
  $483 = (($480) + 4)|0;
  $484 = $483;
  $485 = HEAP32[$484>>2]|0;
  $486 = (_i64Add(($475|0),($476|0),($482|0),($485|0))|0);
  $487 = tempRet0;
  $488 = $489 ^ $486;
  $490 = $491 ^ $487;
  $492 = (_rotr64($488,$490,32)|0);
  $493 = tempRet0;
  $496 = (_i64Add(($494|0),($495|0),($492|0),($493|0))|0);
  $497 = tempRet0;
  $498 = $471 ^ $496;
  $499 = $472 ^ $497;
  $500 = (_rotr64($498,$499,24)|0);
  $501 = tempRet0;
  $502 = (_i64Add(($486|0),($487|0),($500|0),($501|0))|0);
  $503 = tempRet0;
  $504 = (((720 + ($$045<<6)|0)) + 28|0);
  $505 = HEAP32[$504>>2]|0;
  $506 = (($2) + ($505<<3)|0);
  $507 = $506;
  $508 = $507;
  $509 = HEAP32[$508>>2]|0;
  $510 = (($507) + 4)|0;
  $511 = $510;
  $512 = HEAP32[$511>>2]|0;
  $513 = (_i64Add(($502|0),($503|0),($509|0),($512|0))|0);
  $514 = tempRet0;
  $515 = $492 ^ $513;
  $516 = $493 ^ $514;
  $517 = (_rotr64($515,$516,16)|0);
  $518 = tempRet0;
  $519 = (_i64Add(($496|0),($497|0),($517|0),($518|0))|0);
  $520 = tempRet0;
  $521 = $500 ^ $519;
  $522 = $501 ^ $520;
  $523 = (_rotr64($521,$522,63)|0);
  $524 = tempRet0;
  $525 = (_i64Add(($415|0),($416|0),($351|0),($352|0))|0);
  $526 = tempRet0;
  $527 = (((720 + ($$045<<6)|0)) + 32|0);
  $528 = HEAP32[$527>>2]|0;
  $529 = (($2) + ($528<<3)|0);
  $530 = $529;
  $531 = $530;
  $532 = HEAP32[$531>>2]|0;
  $533 = (($530) + 4)|0;
  $534 = $533;
  $535 = HEAP32[$534>>2]|0;
  $536 = (_i64Add(($525|0),($526|0),($532|0),($535|0))|0);
  $537 = tempRet0;
  $538 = $517 ^ $536;
  $539 = $518 ^ $537;
  $540 = (_rotr64($538,$539,32)|0);
  $541 = tempRet0;
  $542 = (_i64Add(($465|0),($466|0),($540|0),($541|0))|0);
  $543 = tempRet0;
  $544 = $415 ^ $542;
  $545 = $416 ^ $543;
  $546 = (_rotr64($544,$545,24)|0);
  $547 = tempRet0;
  $548 = (_i64Add(($536|0),($537|0),($546|0),($547|0))|0);
  $549 = tempRet0;
  $550 = (((720 + ($$045<<6)|0)) + 36|0);
  $551 = HEAP32[$550>>2]|0;
  $552 = (($2) + ($551<<3)|0);
  $553 = $552;
  $554 = $553;
  $555 = HEAP32[$554>>2]|0;
  $556 = (($553) + 4)|0;
  $557 = $556;
  $558 = HEAP32[$557>>2]|0;
  $559 = (_i64Add(($548|0),($549|0),($555|0),($558|0))|0);
  $560 = tempRet0;
  $561 = $540 ^ $559;
  $562 = $541 ^ $560;
  $563 = (_rotr64($561,$562,16)|0);
  $564 = tempRet0;
  $565 = (_i64Add(($542|0),($543|0),($563|0),($564|0))|0);
  $566 = tempRet0;
  $567 = $546 ^ $565;
  $568 = $547 ^ $566;
  $569 = (_rotr64($567,$568,63)|0);
  $570 = tempRet0;
  $571 = (_i64Add(($469|0),($470|0),($405|0),($406|0))|0);
  $572 = tempRet0;
  $573 = (((720 + ($$045<<6)|0)) + 40|0);
  $574 = HEAP32[$573>>2]|0;
  $575 = (($2) + ($574<<3)|0);
  $576 = $575;
  $577 = $576;
  $578 = HEAP32[$577>>2]|0;
  $579 = (($576) + 4)|0;
  $580 = $579;
  $581 = HEAP32[$580>>2]|0;
  $582 = (_i64Add(($571|0),($572|0),($578|0),($581|0))|0);
  $583 = tempRet0;
  $584 = $355 ^ $582;
  $585 = $356 ^ $583;
  $586 = (_rotr64($584,$585,32)|0);
  $587 = tempRet0;
  $588 = (_i64Add(($519|0),($520|0),($586|0),($587|0))|0);
  $589 = tempRet0;
  $590 = $469 ^ $588;
  $591 = $470 ^ $589;
  $592 = (_rotr64($590,$591,24)|0);
  $593 = tempRet0;
  $594 = (_i64Add(($582|0),($583|0),($592|0),($593|0))|0);
  $595 = tempRet0;
  $596 = (((720 + ($$045<<6)|0)) + 44|0);
  $597 = HEAP32[$596>>2]|0;
  $598 = (($2) + ($597<<3)|0);
  $599 = $598;
  $600 = $599;
  $601 = HEAP32[$600>>2]|0;
  $602 = (($599) + 4)|0;
  $603 = $602;
  $604 = HEAP32[$603>>2]|0;
  $605 = (_i64Add(($594|0),($595|0),($601|0),($604|0))|0);
  $606 = tempRet0;
  $607 = $586 ^ $605;
  $608 = $587 ^ $606;
  $609 = (_rotr64($607,$608,16)|0);
  $610 = tempRet0;
  $611 = (_i64Add(($588|0),($589|0),($609|0),($610|0))|0);
  $612 = tempRet0;
  $613 = $592 ^ $611;
  $614 = $593 ^ $612;
  $615 = (_rotr64($613,$614,63)|0);
  $616 = tempRet0;
  $617 = (_i64Add(($523|0),($524|0),($459|0),($460|0))|0);
  $618 = tempRet0;
  $619 = (((720 + ($$045<<6)|0)) + 48|0);
  $620 = HEAP32[$619>>2]|0;
  $621 = (($2) + ($620<<3)|0);
  $622 = $621;
  $623 = $622;
  $624 = HEAP32[$623>>2]|0;
  $625 = (($622) + 4)|0;
  $626 = $625;
  $627 = HEAP32[$626>>2]|0;
  $628 = (_i64Add(($617|0),($618|0),($624|0),($627|0))|0);
  $629 = tempRet0;
  $630 = $409 ^ $628;
  $631 = $410 ^ $629;
  $632 = (_rotr64($630,$631,32)|0);
  $633 = tempRet0;
  $634 = (_i64Add(($357|0),($358|0),($632|0),($633|0))|0);
  $635 = tempRet0;
  $636 = $523 ^ $634;
  $637 = $524 ^ $635;
  $638 = (_rotr64($636,$637,24)|0);
  $639 = tempRet0;
  $640 = (_i64Add(($628|0),($629|0),($638|0),($639|0))|0);
  $641 = tempRet0;
  $642 = (((720 + ($$045<<6)|0)) + 52|0);
  $643 = HEAP32[$642>>2]|0;
  $644 = (($2) + ($643<<3)|0);
  $645 = $644;
  $646 = $645;
  $647 = HEAP32[$646>>2]|0;
  $648 = (($645) + 4)|0;
  $649 = $648;
  $650 = HEAP32[$649>>2]|0;
  $651 = (_i64Add(($640|0),($641|0),($647|0),($650|0))|0);
  $652 = tempRet0;
  $653 = $632 ^ $651;
  $654 = $633 ^ $652;
  $655 = (_rotr64($653,$654,16)|0);
  $656 = tempRet0;
  $657 = (_i64Add(($634|0),($635|0),($655|0),($656|0))|0);
  $658 = tempRet0;
  $659 = $638 ^ $657;
  $660 = $639 ^ $658;
  $661 = (_rotr64($659,$660,63)|0);
  $662 = tempRet0;
  $663 = (_i64Add(($361|0),($362|0),($513|0),($514|0))|0);
  $664 = tempRet0;
  $665 = (((720 + ($$045<<6)|0)) + 56|0);
  $666 = HEAP32[$665>>2]|0;
  $667 = (($2) + ($666<<3)|0);
  $668 = $667;
  $669 = $668;
  $670 = HEAP32[$669>>2]|0;
  $671 = (($668) + 4)|0;
  $672 = $671;
  $673 = HEAP32[$672>>2]|0;
  $674 = (_i64Add(($663|0),($664|0),($670|0),($673|0))|0);
  $675 = tempRet0;
  $676 = $463 ^ $674;
  $677 = $464 ^ $675;
  $678 = (_rotr64($676,$677,32)|0);
  $679 = tempRet0;
  $680 = (_i64Add(($411|0),($412|0),($678|0),($679|0))|0);
  $681 = tempRet0;
  $682 = $361 ^ $680;
  $683 = $362 ^ $681;
  $684 = (_rotr64($682,$683,24)|0);
  $685 = tempRet0;
  $686 = (_i64Add(($674|0),($675|0),($684|0),($685|0))|0);
  $687 = tempRet0;
  $688 = (((720 + ($$045<<6)|0)) + 60|0);
  $689 = HEAP32[$688>>2]|0;
  $690 = (($2) + ($689<<3)|0);
  $691 = $690;
  $692 = $691;
  $693 = HEAP32[$692>>2]|0;
  $694 = (($691) + 4)|0;
  $695 = $694;
  $696 = HEAP32[$695>>2]|0;
  $697 = (_i64Add(($686|0),($687|0),($693|0),($696|0))|0);
  $698 = tempRet0;
  $699 = $678 ^ $697;
  $700 = $679 ^ $698;
  $701 = (_rotr64($699,$700,16)|0);
  $702 = tempRet0;
  $703 = (_i64Add(($680|0),($681|0),($701|0),($702|0))|0);
  $704 = tempRet0;
  $705 = $684 ^ $703;
  $706 = $685 ^ $704;
  $707 = (_rotr64($705,$706,63)|0);
  $708 = tempRet0;
  $709 = (($$045) + 1)|0;
  $exitcond = ($709|0)==(12);
  if ($exitcond) {
   break;
  } else {
   $$045 = $709;$309 = $707;$310 = $708;$311 = $559;$312 = $560;$327 = $609;$329 = $610;$332 = $657;$333 = $658;$363 = $569;$364 = $570;$365 = $605;$366 = $606;$381 = $655;$383 = $656;$386 = $703;$387 = $704;$417 = $615;$418 = $616;$419 = $651;$420 = $652;$435 = $701;$437 = $702;$440 = $565;$441 = $566;$471 = $661;$472 = $662;$473 = $697;$474 = $698;$489 = $563;$491 = $564;$494 = $611;$495 = $612;
  }
 }
 $710 = $3;
 $711 = $710;
 HEAP32[$711>>2] = $559;
 $712 = (($710) + 4)|0;
 $713 = $712;
 HEAP32[$713>>2] = $560;
 $714 = $206;
 $715 = $714;
 HEAP32[$715>>2] = $707;
 $716 = (($714) + 4)|0;
 $717 = $716;
 HEAP32[$717>>2] = $708;
 $718 = $159;
 $719 = $718;
 HEAP32[$719>>2] = $609;
 $720 = (($718) + 4)|0;
 $721 = $720;
 HEAP32[$721>>2] = $610;
 $722 = $130;
 $723 = $722;
 HEAP32[$723>>2] = $657;
 $724 = (($722) + 4)|0;
 $725 = $724;
 HEAP32[$725>>2] = $658;
 $726 = $207;
 $727 = $726;
 HEAP32[$727>>2] = $605;
 $728 = (($726) + 4)|0;
 $729 = $728;
 HEAP32[$729>>2] = $606;
 $730 = $208;
 $731 = $730;
 HEAP32[$731>>2] = $569;
 $732 = (($730) + 4)|0;
 $733 = $732;
 HEAP32[$733>>2] = $570;
 $734 = $173;
 $735 = $734;
 HEAP32[$735>>2] = $655;
 $736 = (($734) + 4)|0;
 $737 = $736;
 HEAP32[$737>>2] = $656;
 $738 = $135;
 $739 = $738;
 HEAP32[$739>>2] = $703;
 $740 = (($738) + 4)|0;
 $741 = $740;
 HEAP32[$741>>2] = $704;
 $742 = $209;
 $743 = $742;
 HEAP32[$743>>2] = $651;
 $744 = (($742) + 4)|0;
 $745 = $744;
 HEAP32[$745>>2] = $652;
 $746 = $210;
 $747 = $746;
 HEAP32[$747>>2] = $615;
 $748 = (($746) + 4)|0;
 $749 = $748;
 HEAP32[$749>>2] = $616;
 $750 = $187;
 $751 = $750;
 HEAP32[$751>>2] = $701;
 $752 = (($750) + 4)|0;
 $753 = $752;
 HEAP32[$753>>2] = $702;
 $754 = $140;
 $755 = $754;
 HEAP32[$755>>2] = $565;
 $756 = (($754) + 4)|0;
 $757 = $756;
 HEAP32[$757>>2] = $566;
 $758 = $211;
 $759 = $758;
 HEAP32[$759>>2] = $697;
 $760 = (($758) + 4)|0;
 $761 = $760;
 HEAP32[$761>>2] = $698;
 $762 = $212;
 $763 = $762;
 HEAP32[$763>>2] = $661;
 $764 = (($762) + 4)|0;
 $765 = $764;
 HEAP32[$765>>2] = $662;
 $766 = $201;
 $767 = $766;
 HEAP32[$767>>2] = $563;
 $768 = (($766) + 4)|0;
 $769 = $768;
 HEAP32[$769>>2] = $564;
 $770 = $145;
 $771 = $770;
 HEAP32[$771>>2] = $611;
 $772 = (($770) + 4)|0;
 $773 = $772;
 HEAP32[$773>>2] = $612;
 $774 = $0;
 $775 = $774;
 $776 = HEAP32[$775>>2]|0;
 $777 = (($774) + 4)|0;
 $778 = $777;
 $779 = HEAP32[$778>>2]|0;
 $780 = $3;
 $781 = $780;
 $782 = HEAP32[$781>>2]|0;
 $783 = (($780) + 4)|0;
 $784 = $783;
 $785 = HEAP32[$784>>2]|0;
 $786 = $782 ^ $776;
 $787 = $785 ^ $779;
 $788 = ((($3)) + 64|0);
 $789 = $788;
 $790 = $789;
 $791 = HEAP32[$790>>2]|0;
 $792 = (($789) + 4)|0;
 $793 = $792;
 $794 = HEAP32[$793>>2]|0;
 $795 = $786 ^ $791;
 $796 = $787 ^ $794;
 $797 = $0;
 $798 = $797;
 HEAP32[$798>>2] = $795;
 $799 = (($797) + 4)|0;
 $800 = $799;
 HEAP32[$800>>2] = $796;
 $801 = ((($0)) + 8|0);
 $802 = $801;
 $803 = $802;
 $804 = HEAP32[$803>>2]|0;
 $805 = (($802) + 4)|0;
 $806 = $805;
 $807 = HEAP32[$806>>2]|0;
 $808 = ((($3)) + 8|0);
 $809 = $808;
 $810 = $809;
 $811 = HEAP32[$810>>2]|0;
 $812 = (($809) + 4)|0;
 $813 = $812;
 $814 = HEAP32[$813>>2]|0;
 $815 = $811 ^ $804;
 $816 = $814 ^ $807;
 $817 = ((($3)) + 72|0);
 $818 = $817;
 $819 = $818;
 $820 = HEAP32[$819>>2]|0;
 $821 = (($818) + 4)|0;
 $822 = $821;
 $823 = HEAP32[$822>>2]|0;
 $824 = $815 ^ $820;
 $825 = $816 ^ $823;
 $826 = $801;
 $827 = $826;
 HEAP32[$827>>2] = $824;
 $828 = (($826) + 4)|0;
 $829 = $828;
 HEAP32[$829>>2] = $825;
 $830 = ((($0)) + 16|0);
 $831 = $830;
 $832 = $831;
 $833 = HEAP32[$832>>2]|0;
 $834 = (($831) + 4)|0;
 $835 = $834;
 $836 = HEAP32[$835>>2]|0;
 $837 = ((($3)) + 16|0);
 $838 = $837;
 $839 = $838;
 $840 = HEAP32[$839>>2]|0;
 $841 = (($838) + 4)|0;
 $842 = $841;
 $843 = HEAP32[$842>>2]|0;
 $844 = $840 ^ $833;
 $845 = $843 ^ $836;
 $846 = ((($3)) + 80|0);
 $847 = $846;
 $848 = $847;
 $849 = HEAP32[$848>>2]|0;
 $850 = (($847) + 4)|0;
 $851 = $850;
 $852 = HEAP32[$851>>2]|0;
 $853 = $844 ^ $849;
 $854 = $845 ^ $852;
 $855 = $830;
 $856 = $855;
 HEAP32[$856>>2] = $853;
 $857 = (($855) + 4)|0;
 $858 = $857;
 HEAP32[$858>>2] = $854;
 $859 = ((($0)) + 24|0);
 $860 = $859;
 $861 = $860;
 $862 = HEAP32[$861>>2]|0;
 $863 = (($860) + 4)|0;
 $864 = $863;
 $865 = HEAP32[$864>>2]|0;
 $866 = ((($3)) + 24|0);
 $867 = $866;
 $868 = $867;
 $869 = HEAP32[$868>>2]|0;
 $870 = (($867) + 4)|0;
 $871 = $870;
 $872 = HEAP32[$871>>2]|0;
 $873 = $869 ^ $862;
 $874 = $872 ^ $865;
 $875 = ((($3)) + 88|0);
 $876 = $875;
 $877 = $876;
 $878 = HEAP32[$877>>2]|0;
 $879 = (($876) + 4)|0;
 $880 = $879;
 $881 = HEAP32[$880>>2]|0;
 $882 = $873 ^ $878;
 $883 = $874 ^ $881;
 $884 = $859;
 $885 = $884;
 HEAP32[$885>>2] = $882;
 $886 = (($884) + 4)|0;
 $887 = $886;
 HEAP32[$887>>2] = $883;
 $888 = ((($0)) + 32|0);
 $889 = $888;
 $890 = $889;
 $891 = HEAP32[$890>>2]|0;
 $892 = (($889) + 4)|0;
 $893 = $892;
 $894 = HEAP32[$893>>2]|0;
 $895 = ((($3)) + 32|0);
 $896 = $895;
 $897 = $896;
 $898 = HEAP32[$897>>2]|0;
 $899 = (($896) + 4)|0;
 $900 = $899;
 $901 = HEAP32[$900>>2]|0;
 $902 = $898 ^ $891;
 $903 = $901 ^ $894;
 $904 = ((($3)) + 96|0);
 $905 = $904;
 $906 = $905;
 $907 = HEAP32[$906>>2]|0;
 $908 = (($905) + 4)|0;
 $909 = $908;
 $910 = HEAP32[$909>>2]|0;
 $911 = $902 ^ $907;
 $912 = $903 ^ $910;
 $913 = $888;
 $914 = $913;
 HEAP32[$914>>2] = $911;
 $915 = (($913) + 4)|0;
 $916 = $915;
 HEAP32[$916>>2] = $912;
 $917 = ((($0)) + 40|0);
 $918 = $917;
 $919 = $918;
 $920 = HEAP32[$919>>2]|0;
 $921 = (($918) + 4)|0;
 $922 = $921;
 $923 = HEAP32[$922>>2]|0;
 $924 = ((($3)) + 40|0);
 $925 = $924;
 $926 = $925;
 $927 = HEAP32[$926>>2]|0;
 $928 = (($925) + 4)|0;
 $929 = $928;
 $930 = HEAP32[$929>>2]|0;
 $931 = $927 ^ $920;
 $932 = $930 ^ $923;
 $933 = ((($3)) + 104|0);
 $934 = $933;
 $935 = $934;
 $936 = HEAP32[$935>>2]|0;
 $937 = (($934) + 4)|0;
 $938 = $937;
 $939 = HEAP32[$938>>2]|0;
 $940 = $931 ^ $936;
 $941 = $932 ^ $939;
 $942 = $917;
 $943 = $942;
 HEAP32[$943>>2] = $940;
 $944 = (($942) + 4)|0;
 $945 = $944;
 HEAP32[$945>>2] = $941;
 $946 = ((($0)) + 48|0);
 $947 = $946;
 $948 = $947;
 $949 = HEAP32[$948>>2]|0;
 $950 = (($947) + 4)|0;
 $951 = $950;
 $952 = HEAP32[$951>>2]|0;
 $953 = ((($3)) + 48|0);
 $954 = $953;
 $955 = $954;
 $956 = HEAP32[$955>>2]|0;
 $957 = (($954) + 4)|0;
 $958 = $957;
 $959 = HEAP32[$958>>2]|0;
 $960 = $956 ^ $949;
 $961 = $959 ^ $952;
 $962 = ((($3)) + 112|0);
 $963 = $962;
 $964 = $963;
 $965 = HEAP32[$964>>2]|0;
 $966 = (($963) + 4)|0;
 $967 = $966;
 $968 = HEAP32[$967>>2]|0;
 $969 = $960 ^ $965;
 $970 = $961 ^ $968;
 $971 = $946;
 $972 = $971;
 HEAP32[$972>>2] = $969;
 $973 = (($971) + 4)|0;
 $974 = $973;
 HEAP32[$974>>2] = $970;
 $975 = ((($0)) + 56|0);
 $976 = $975;
 $977 = $976;
 $978 = HEAP32[$977>>2]|0;
 $979 = (($976) + 4)|0;
 $980 = $979;
 $981 = HEAP32[$980>>2]|0;
 $982 = ((($3)) + 56|0);
 $983 = $982;
 $984 = $983;
 $985 = HEAP32[$984>>2]|0;
 $986 = (($983) + 4)|0;
 $987 = $986;
 $988 = HEAP32[$987>>2]|0;
 $989 = $985 ^ $978;
 $990 = $988 ^ $981;
 $991 = ((($3)) + 120|0);
 $992 = $991;
 $993 = $992;
 $994 = HEAP32[$993>>2]|0;
 $995 = (($992) + 4)|0;
 $996 = $995;
 $997 = HEAP32[$996>>2]|0;
 $998 = $989 ^ $994;
 $999 = $990 ^ $997;
 $1000 = $975;
 $1001 = $1000;
 HEAP32[$1001>>2] = $998;
 $1002 = (($1000) + 4)|0;
 $1003 = $1002;
 HEAP32[$1003>>2] = $999;
 STACKTOP = sp;return;
}
function _rotr64($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_bitshift64Lshr(($0|0),($1|0),($2|0))|0);
 $4 = tempRet0;
 $5 = (64 - ($2))|0;
 $6 = (_bitshift64Shl(($0|0),($1|0),($5|0))|0);
 $7 = tempRet0;
 $8 = $6 | $3;
 $9 = $7 | $4;
 tempRet0 = ($9);
 return ($8|0);
}
function _blake2b_final($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$024 = 0, $$025 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $exitcond = 0, $or$cond = 0, dest = 0, label = 0, sp = 0;
 var stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $3 = sp;
 dest=$3; stop=dest+64|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0));
 $4 = ($0|0)==(0|0);
 $5 = ($1|0)==(0|0);
 $or$cond = $4 | $5;
 if ($or$cond) {
  $$024 = -1;
  STACKTOP = sp;return ($$024|0);
 }
 $6 = ((($0)) + 228|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7>>>0)>($2>>>0);
 if ($8) {
  $$024 = -1;
  STACKTOP = sp;return ($$024|0);
 }
 $9 = ((($0)) + 80|0);
 $10 = $9;
 $11 = $10;
 $12 = HEAP32[$11>>2]|0;
 $13 = (($10) + 4)|0;
 $14 = $13;
 $15 = HEAP32[$14>>2]|0;
 $16 = ($12|0)==(0);
 $17 = ($15|0)==(0);
 $18 = $16 & $17;
 if (!($18)) {
  $$024 = -1;
  STACKTOP = sp;return ($$024|0);
 }
 $19 = ((($0)) + 224|0);
 $20 = HEAP32[$19>>2]|0;
 _blake2b_increment_counter($0,$20,0);
 _blake2b_set_lastblock($0);
 $21 = HEAP32[$19>>2]|0;
 $22 = (((($0)) + 96|0) + ($21)|0);
 $23 = (128 - ($21))|0;
 _memset(($22|0),0,($23|0))|0;
 $24 = ((($0)) + 96|0);
 _blake2b_compress($0,$24);
 $$025 = 0;
 while(1) {
  $25 = $$025 << 3;
  $26 = (($3) + ($25)|0);
  $27 = (($0) + ($$025<<3)|0);
  $28 = $27;
  $29 = $28;
  $30 = HEAP32[$29>>2]|0;
  $31 = (($28) + 4)|0;
  $32 = $31;
  $33 = HEAP32[$32>>2]|0;
  _store64($26,$30,$33);
  $34 = (($$025) + 1)|0;
  $exitcond = ($34|0)==(8);
  if ($exitcond) {
   break;
  } else {
   $$025 = $34;
  }
 }
 $35 = HEAP32[$6>>2]|0;
 _memcpy(($1|0),($3|0),($35|0))|0;
 _clear_internal_memory($3,64);
 _clear_internal_memory($24,128);
 _clear_internal_memory($0,64);
 $$024 = 0;
 STACKTOP = sp;return ($$024|0);
}
function _store64($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $0;
 $4 = $3;
 HEAP8[$4>>0]=$1&255;HEAP8[$4+1>>0]=($1>>8)&255;HEAP8[$4+2>>0]=($1>>16)&255;HEAP8[$4+3>>0]=$1>>24;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP8[$6>>0]=$2&255;HEAP8[$6+1>>0]=($2>>8)&255;HEAP8[$6+2>>0]=($2>>16)&255;HEAP8[$6+3>>0]=$2>>24;
 return;
}
function _blake2b($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond7 = 0;
 var $or$cond9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0;
 $6 = sp;
 $7 = ($2|0)==(0|0);
 $8 = ($3|0)!=(0);
 $or$cond = $7 & $8;
 do {
  if ($or$cond) {
   $$0 = -1;
  } else {
   $9 = ($0|0)==(0|0);
   $10 = (($1) + -1)|0;
   $11 = ($10>>>0)>(63);
   $12 = $9 | $11;
   if ($12) {
    $$0 = -1;
   } else {
    $13 = ($4|0)==(0|0);
    $14 = ($5|0)!=(0);
    $or$cond7 = $13 & $14;
    $15 = ($5>>>0)>(64);
    $or$cond9 = $15 | $or$cond7;
    if ($or$cond9) {
     $$0 = -1;
    } else {
     if ($14) {
      $16 = (_blake2b_init_key($6,$1,$4,$5)|0);
      $17 = ($16|0)<(0);
      if ($17) {
       $$0 = -1;
       break;
      }
     } else {
      $18 = (_blake2b_init($6,$1)|0);
      $19 = ($18|0)<(0);
      if ($19) {
       $$0 = -1;
       break;
      }
     }
     $20 = (_blake2b_update($6,$2,$3)|0);
     $21 = ($20|0)<(0);
     if ($21) {
      $$0 = -1;
     } else {
      $22 = (_blake2b_final($6,$0,$1)|0);
      $$0 = $22;
     }
    }
   }
  }
 } while(0);
 _clear_internal_memory($6,240);
 STACKTOP = sp;return ($$0|0);
}
function _blake2b_long($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$037 = 0, $$037$lcssa = 0, $$03743 = 0, $$03745 = 0, $$038 = 0, $$039 = 0, $$039$lcssa = 0, $$03944 = 0, $$03946 = 0, $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0;
 var stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 384|0;
 $4 = sp;
 $5 = sp + 240|0;
 $6 = sp + 312|0;
 $7 = sp + 248|0;
 HEAP32[$5>>2] = 0;
 _store32($5,$1);
 $8 = ($1>>>0)<(65);
 if ($8) {
  $9 = (_blake2b_init($4,$1)|0);
  $10 = ($9|0)<(0);
  if ($10) {
   $$1 = $9;
   _clear_internal_memory($4,240);
   STACKTOP = sp;return ($$1|0);
  }
  $11 = (_blake2b_update($4,$5,4)|0);
  $12 = ($11|0)<(0);
  if ($12) {
   $$1 = $11;
   _clear_internal_memory($4,240);
   STACKTOP = sp;return ($$1|0);
  }
  $13 = (_blake2b_update($4,$2,$3)|0);
  $14 = ($13|0)<(0);
  if ($14) {
   $$1 = $13;
   _clear_internal_memory($4,240);
   STACKTOP = sp;return ($$1|0);
  }
  $15 = (_blake2b_final($4,$0,$1)|0);
  $$1 = $15;
  _clear_internal_memory($4,240);
  STACKTOP = sp;return ($$1|0);
 }
 $16 = (_blake2b_init($4,64)|0);
 $17 = ($16|0)<(0);
 L14: do {
  if ($17) {
   $$038 = $16;
  } else {
   $18 = (_blake2b_update($4,$5,4)|0);
   $19 = ($18|0)<(0);
   if ($19) {
    $$038 = $18;
   } else {
    $20 = (_blake2b_update($4,$2,$3)|0);
    $21 = ($20|0)<(0);
    if ($21) {
     $$038 = $20;
    } else {
     $22 = (_blake2b_final($4,$6,64)|0);
     $23 = ($22|0)<(0);
     if ($23) {
      $$038 = $22;
     } else {
      dest=$0; src=$6; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
      $$03743 = (($1) + -32)|0;
      $$03944 = ((($0)) + 32|0);
      $24 = ($$03743>>>0)>(64);
      dest=$7; src=$6; stop=dest+64|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
      if ($24) {
       $$03745 = $$03743;$$03946 = $$03944;
       while(1) {
        $25 = (_blake2b($6,64,$7,64,0,0)|0);
        $26 = ($25|0)<(0);
        if ($26) {
         $$038 = $25;
         break L14;
        }
        dest=$$03946; src=$6; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
        $$037 = (($$03745) + -32)|0;
        $$039 = ((($$03946)) + 32|0);
        $27 = ($$037>>>0)>(64);
        dest=$7; src=$6; stop=dest+64|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
        if ($27) {
         $$03745 = $$037;$$03946 = $$039;
        } else {
         $$037$lcssa = $$037;$$039$lcssa = $$039;
         break;
        }
       }
      } else {
       $$037$lcssa = $$03743;$$039$lcssa = $$03944;
      }
      $28 = (_blake2b($6,$$037$lcssa,$7,64,0,0)|0);
      $29 = ($28|0)<(0);
      if ($29) {
       $$038 = $28;
      } else {
       _memcpy(($$039$lcssa|0),($6|0),($$037$lcssa|0))|0;
       $$038 = $28;
      }
     }
    }
   }
  }
 } while(0);
 $$1 = $$038;
 _clear_internal_memory($4,240);
 STACKTOP = sp;return ($$1|0);
}
function _store32($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP8[$0>>0]=$1&255;HEAP8[$0+1>>0]=($1>>8)&255;HEAP8[$0+2>>0]=($1>>16)&255;HEAP8[$0+3>>0]=$1>>24;
 return;
}
function _init_block_value($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _memset(($0|0),($1|0),1024)|0;
 return;
}
function _copy_block($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _memcpy(($0|0),($1|0),1024)|0;
 return;
}
function _xor_block($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$06 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$06 = 0;
 while(1) {
  $2 = (($1) + ($$06<<3)|0);
  $3 = $2;
  $4 = $3;
  $5 = HEAP32[$4>>2]|0;
  $6 = (($3) + 4)|0;
  $7 = $6;
  $8 = HEAP32[$7>>2]|0;
  $9 = (($0) + ($$06<<3)|0);
  $10 = $9;
  $11 = $10;
  $12 = HEAP32[$11>>2]|0;
  $13 = (($10) + 4)|0;
  $14 = $13;
  $15 = HEAP32[$14>>2]|0;
  $16 = $12 ^ $5;
  $17 = $15 ^ $8;
  $18 = $9;
  $19 = $18;
  HEAP32[$19>>2] = $16;
  $20 = (($18) + 4)|0;
  $21 = $20;
  HEAP32[$21>>2] = $17;
  $22 = (($$06) + 1)|0;
  $exitcond = ($22|0)==(128);
  if ($exitcond) {
   break;
  } else {
   $$06 = $22;
  }
 }
 return;
}
function _allocate_memory($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$ = 0, $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = Math_imul($3, $2)|0;
 $5 = ($1|0)==(0|0);
 if ($5) {
  $$0 = -22;
  return ($$0|0);
 }
 $6 = ($3|0)==(0);
 if (!($6)) {
  $7 = (($4>>>0) / ($3>>>0))&-1;
  $8 = ($7|0)==($2|0);
  if (!($8)) {
   $$0 = -22;
   return ($$0|0);
  }
 }
 $9 = ((($0)) + 60|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ($10|0)==(0|0);
 if ($11) {
  $12 = (_malloc($4)|0);
  HEAP32[$1>>2] = $12;
 } else {
  (FUNCTION_TABLE_iii[$10 & 0]($1,$4)|0);
 }
 $13 = HEAP32[$1>>2]|0;
 $14 = ($13|0)==(0|0);
 $$ = $14 ? -22 : 0;
 $$0 = $$;
 return ($$0|0);
}
function _free_memory($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = Math_imul($3, $2)|0;
 _clear_internal_memory($1,$4);
 $5 = ((($0)) + 64|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)==(0|0);
 if ($7) {
  _free($1);
  return;
 } else {
  FUNCTION_TABLE_vii[$6 & 0]($1,$4);
  return;
 }
}
function _clear_internal_memory($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (1)!=(0);
 $3 = ($0|0)!=(0|0);
 $or$cond = $3 & $2;
 if (!($or$cond)) {
  return;
 }
 _secure_wipe_memory($0,$1);
 return;
}
function _secure_wipe_memory($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 4|0;
 $3 = sp;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[$2>>2]|0;
 $5 = HEAP32[$3>>2]|0;
 _memset(($4|0),0,($5|0))|0;
 STACKTOP = sp;return;
}
function _finalize($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$020 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 2048|0;
 $2 = sp;
 $3 = sp + 1024|0;
 $4 = ($0|0)!=(0|0);
 $5 = ($1|0)!=(0|0);
 $or$cond = $4 & $5;
 if (!($or$cond)) {
  STACKTOP = sp;return;
 }
 $6 = HEAP32[$1>>2]|0;
 $7 = ((($1)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($6) + ($8<<10)|0);
 $10 = ((($9)) + -1024|0);
 _copy_block($2,$10);
 $11 = ((($1)) + 24|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ($12>>>0)>(1);
 if ($13) {
  $$020 = 1;
  while(1) {
   $14 = HEAP32[$7>>2]|0;
   $15 = Math_imul($14, $$020)|0;
   $16 = (($14) + -1)|0;
   $17 = (($16) + ($15))|0;
   $18 = HEAP32[$1>>2]|0;
   $19 = (($18) + ($17<<10)|0);
   _xor_block($2,$19);
   $20 = (($$020) + 1)|0;
   $21 = HEAP32[$11>>2]|0;
   $22 = ($20>>>0)<($21>>>0);
   if ($22) {
    $$020 = $20;
   } else {
    break;
   }
  }
 }
 _store_block($3,$2);
 $23 = HEAP32[$0>>2]|0;
 $24 = ((($0)) + 4|0);
 $25 = HEAP32[$24>>2]|0;
 (_blake2b_long($23,$25,$3,1024)|0);
 _clear_internal_memory($2,1024);
 _clear_internal_memory($3,1024);
 $26 = HEAP32[$1>>2]|0;
 $27 = ((($1)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 _free_memory($0,$26,$28,1024);
 STACKTOP = sp;return;
}
function _store_block($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$06 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$06 = 0;
 while(1) {
  $2 = $$06 << 3;
  $3 = (($0) + ($2)|0);
  $4 = (($1) + ($$06<<3)|0);
  $5 = $4;
  $6 = $5;
  $7 = HEAP32[$6>>2]|0;
  $8 = (($5) + 4)|0;
  $9 = $8;
  $10 = HEAP32[$9>>2]|0;
  _store64_5($3,$7,$10);
  $11 = (($$06) + 1)|0;
  $exitcond = ($11|0)==(128);
  if ($exitcond) {
   break;
  } else {
   $$06 = $11;
  }
 }
 return;
}
function _store64_5($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $0;
 $4 = $3;
 HEAP8[$4>>0]=$1&255;HEAP8[$4+1>>0]=($1>>8)&255;HEAP8[$4+2>>0]=($1>>16)&255;HEAP8[$4+3>>0]=$1>>24;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP8[$6>>0]=$2&255;HEAP8[$6+1>>0]=($2>>8)&255;HEAP8[$6+2>>0]=($2>>16)&255;HEAP8[$6+3>>0]=$2>>24;
 return;
}
function _index_alpha($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = HEAP32[$1>>2]|0;
 $5 = ($4|0)==(0);
 $6 = ((($1)) + 12|0);
 $7 = HEAP32[$6>>2]|0;
 do {
  if ($5) {
   $8 = ((($1)) + 8|0);
   $9 = HEAP8[$8>>0]|0;
   $10 = ($9<<24>>24)==(0);
   if ($10) {
    $11 = (($7) + -1)|0;
    $$0 = $11;
    break;
   }
   $12 = $9&255;
   $13 = ($3|0)==(0);
   $14 = ((($0)) + 16|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = Math_imul($15, $12)|0;
   if ($13) {
    $19 = ($7|0)==(0);
    $20 = $19 << 31 >> 31;
    $21 = (($16) + ($20))|0;
    $$0 = $21;
    break;
   } else {
    $17 = (($7) + -1)|0;
    $18 = (($17) + ($16))|0;
    $$0 = $18;
    break;
   }
  } else {
   $22 = ($3|0)==(0);
   $23 = ((($0)) + 20|0);
   $24 = HEAP32[$23>>2]|0;
   $25 = ((($0)) + 16|0);
   $26 = HEAP32[$25>>2]|0;
   $27 = (($24) - ($26))|0;
   if ($22) {
    $30 = ($7|0)==(0);
    $31 = $30 << 31 >> 31;
    $32 = (($27) + ($31))|0;
    $$0 = $32;
    break;
   } else {
    $28 = (($7) + -1)|0;
    $29 = (($28) + ($27))|0;
    $$0 = $29;
    break;
   }
  }
 } while(0);
 (___muldi3(($2|0),0,($2|0),0)|0);
 $33 = tempRet0;
 $34 = (($$0) + -1)|0;
 (___muldi3(($$0|0),0,($33|0),0)|0);
 $35 = tempRet0;
 $36 = (_i64Subtract(($34|0),0,($35|0),0)|0);
 $37 = tempRet0;
 $38 = HEAP32[$1>>2]|0;
 $39 = ($38|0)==(0);
 if ($39) {
  $48 = 0;$49 = 0;
 } else {
  $40 = ((($1)) + 8|0);
  $41 = HEAP8[$40>>0]|0;
  $42 = ($41<<24>>24)==(3);
  if ($42) {
   $48 = 0;$49 = 0;
  } else {
   $43 = ((($0)) + 16|0);
   $44 = $41&255;
   $45 = (($44) + 1)|0;
   $46 = HEAP32[$43>>2]|0;
   $47 = Math_imul($46, $45)|0;
   $48 = $47;$49 = 0;
  }
 }
 $50 = (_i64Add(($36|0),($37|0),($48|0),($49|0))|0);
 $51 = tempRet0;
 $52 = ((($0)) + 20|0);
 $53 = HEAP32[$52>>2]|0;
 $54 = (___uremdi3(($50|0),($51|0),($53|0),0)|0);
 $55 = tempRet0;
 return ($54|0);
}
function _fill_memory_blocks($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = -25;
 } else {
  $2 = ((($0)) + 24|0);
  $3 = HEAP32[$2>>2]|0;
  $4 = ($3|0)==(0);
  if ($4) {
   $$0 = -25;
  } else {
   _fill_memory_blocks_st($0);
   $$0 = 0;
  }
 }
 return ($$0|0);
}
function _fill_memory_blocks_st($0) {
 $0 = $0|0;
 var $$0174 = 0, $$02 = 0, $$02$1 = 0, $$02$2 = 0, $$02$3 = 0, $$byval_copy3 = 0, $$pr = 0, $$pr6 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $$byval_copy3 = sp + 16|0;
 $1 = sp;
 $2 = ((($0)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)==(0);
 if ($4) {
  STACKTOP = sp;return;
 }
 $5 = ((($0)) + 24|0);
 $6 = ((($1)) + 4|0);
 $7 = ((($1)) + 8|0);
 $8 = ((($1)) + 12|0);
 $$0174 = 0;
 while(1) {
  $9 = HEAP32[$5>>2]|0;
  $10 = ($9|0)==(0);
  if ($10) {
   label = 8;
  } else {
   $$02 = 0;
   while(1) {
    HEAP32[$1>>2] = $$0174;
    HEAP32[$6>>2] = $$02;
    HEAP8[$7>>0] = 0;
    HEAP32[$8>>2] = 0;
    ;HEAP32[$$byval_copy3>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy3+12>>2]=HEAP32[$1+12>>2]|0;
    _fill_segment($0,$$byval_copy3);
    $11 = (($$02) + 1)|0;
    $12 = HEAP32[$5>>2]|0;
    $13 = ($11>>>0)<($12>>>0);
    if ($13) {
     $$02 = $11;
    } else {
     break;
    }
   }
   $14 = ($12|0)==(0);
   if ($14) {
    label = 8;
   } else {
    $$02$1 = 0;
    while(1) {
     HEAP32[$1>>2] = $$0174;
     HEAP32[$6>>2] = $$02$1;
     HEAP8[$7>>0] = 1;
     HEAP32[$8>>2] = 0;
     ;HEAP32[$$byval_copy3>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy3+12>>2]=HEAP32[$1+12>>2]|0;
     _fill_segment($0,$$byval_copy3);
     $15 = (($$02$1) + 1)|0;
     $16 = HEAP32[$5>>2]|0;
     $17 = ($15>>>0)<($16>>>0);
     if ($17) {
      $$02$1 = $15;
     } else {
      $18 = $16;
      break;
     }
    }
   }
  }
  if ((label|0) == 8) {
   label = 0;
   $$pr = HEAP32[$5>>2]|0;
   $18 = $$pr;
  }
  $19 = ($18|0)==(0);
  if ($19) {
   $$pr6 = HEAP32[$5>>2]|0;
   $23 = $$pr6;
  } else {
   $$02$2 = 0;
   while(1) {
    HEAP32[$1>>2] = $$0174;
    HEAP32[$6>>2] = $$02$2;
    HEAP8[$7>>0] = 2;
    HEAP32[$8>>2] = 0;
    ;HEAP32[$$byval_copy3>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy3+12>>2]=HEAP32[$1+12>>2]|0;
    _fill_segment($0,$$byval_copy3);
    $20 = (($$02$2) + 1)|0;
    $21 = HEAP32[$5>>2]|0;
    $22 = ($20>>>0)<($21>>>0);
    if ($22) {
     $$02$2 = $20;
    } else {
     $23 = $21;
     break;
    }
   }
  }
  $24 = ($23|0)==(0);
  if (!($24)) {
   $$02$3 = 0;
   while(1) {
    HEAP32[$1>>2] = $$0174;
    HEAP32[$6>>2] = $$02$3;
    HEAP8[$7>>0] = 3;
    HEAP32[$8>>2] = 0;
    ;HEAP32[$$byval_copy3>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy3+12>>2]=HEAP32[$1+12>>2]|0;
    _fill_segment($0,$$byval_copy3);
    $25 = (($$02$3) + 1)|0;
    $26 = HEAP32[$5>>2]|0;
    $27 = ($25>>>0)<($26>>>0);
    if ($27) {
     $$02$3 = $25;
    } else {
     break;
    }
   }
  }
  $28 = (($$0174) + 1)|0;
  $29 = HEAP32[$2>>2]|0;
  $30 = ($28>>>0)<($29>>>0);
  if ($30) {
   $$0174 = $28;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _validate_inputs($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $cond = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $$0 = -25;
  } else {
   $2 = HEAP32[$0>>2]|0;
   $3 = ($2|0)==(0|0);
   if ($3) {
    $$0 = -1;
   } else {
    $4 = ((($0)) + 4|0);
    $5 = HEAP32[$4>>2]|0;
    $6 = ($5>>>0)<(4);
    if ($6) {
     $$0 = -2;
    } else {
     $7 = ((($0)) + 8|0);
     $8 = HEAP32[$7>>2]|0;
     $9 = ($8|0)==(0|0);
     if ($9) {
      $10 = ((($0)) + 12|0);
      $11 = HEAP32[$10>>2]|0;
      $12 = ($11|0)==(0);
      if (!($12)) {
       $$0 = -18;
       break;
      }
     }
     $13 = ((($0)) + 16|0);
     $14 = HEAP32[$13>>2]|0;
     $15 = ($14|0)!=(0|0);
     $16 = ((($0)) + 20|0);
     $17 = HEAP32[$16>>2]|0;
     $18 = ($17|0)==(0);
     $or$cond = $15 | $18;
     if ($or$cond) {
      $19 = ($17>>>0)<(8);
      if ($19) {
       $$0 = -6;
      } else {
       $20 = ((($0)) + 24|0);
       $21 = HEAP32[$20>>2]|0;
       $22 = ($21|0)==(0|0);
       if ($22) {
        $23 = ((($0)) + 28|0);
        $24 = HEAP32[$23>>2]|0;
        $25 = ($24|0)==(0);
        if (!($25)) {
         $$0 = -20;
         break;
        }
       }
       $26 = ((($0)) + 32|0);
       $27 = HEAP32[$26>>2]|0;
       $28 = ($27|0)==(0|0);
       if ($28) {
        $29 = ((($0)) + 36|0);
        $30 = HEAP32[$29>>2]|0;
        $31 = ($30|0)==(0);
        if (!($31)) {
         $$0 = -21;
         break;
        }
       }
       $32 = ((($0)) + 44|0);
       $33 = HEAP32[$32>>2]|0;
       $34 = ($33>>>0)<(8);
       if ($34) {
        $$0 = -14;
       } else {
        $35 = ($33>>>0)>(2097152);
        if ($35) {
         $$0 = -15;
        } else {
         $36 = ((($0)) + 48|0);
         $37 = HEAP32[$36>>2]|0;
         $38 = $37 << 3;
         $39 = ($33>>>0)<($38>>>0);
         if ($39) {
          $$0 = -14;
         } else {
          $40 = ((($0)) + 40|0);
          $41 = HEAP32[$40>>2]|0;
          $42 = ($41|0)==(0);
          if ($42) {
           $$0 = -12;
          } else {
           $43 = ($37|0)==(0);
           if ($43) {
            $$0 = -16;
           } else {
            $44 = ($37>>>0)>(16777215);
            if ($44) {
             $$0 = -17;
            } else {
             $45 = ((($0)) + 52|0);
             $46 = HEAP32[$45>>2]|0;
             $47 = ($46|0)==(0);
             if ($47) {
              $$0 = -28;
             } else {
              $48 = ($46>>>0)>(16777215);
              if ($48) {
               $$0 = -29;
              } else {
               $49 = ((($0)) + 60|0);
               $50 = HEAP32[$49>>2]|0;
               $cond = ($50|0)==(0|0);
               $51 = ((($0)) + 64|0);
               $52 = HEAP32[$51>>2]|0;
               $53 = ($52|0)==(0|0);
               if ($cond) {
                if (!($53)) {
                 $$0 = -24;
                 break;
                }
               } else {
                if ($53) {
                 $$0 = -23;
                 break;
                }
               }
               $$0 = 0;
              }
             }
            }
           }
          }
         }
        }
       }
      }
     } else {
      $$0 = -19;
     }
    }
   }
  }
 } while(0);
 return ($$0|0);
}
function _fill_first_blocks($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$015 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 1024|0;
 $2 = sp;
 $3 = ((($1)) + 24|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0);
 if ($5) {
  _clear_internal_memory($2,1024);
  STACKTOP = sp;return;
 }
 $6 = ((($0)) + 64|0);
 $7 = ((($0)) + 68|0);
 $8 = ((($1)) + 20|0);
 $$015 = 0;
 while(1) {
  _store32_10($6,0);
  _store32_10($7,$$015);
  (_blake2b_long($2,1024,$0,72)|0);
  $9 = HEAP32[$1>>2]|0;
  $10 = HEAP32[$8>>2]|0;
  $11 = Math_imul($10, $$015)|0;
  $12 = (($9) + ($11<<10)|0);
  _load_block($12,$2);
  _store32_10($6,1);
  (_blake2b_long($2,1024,$0,72)|0);
  $13 = HEAP32[$1>>2]|0;
  $14 = HEAP32[$8>>2]|0;
  $15 = Math_imul($14, $$015)|0;
  $16 = (($15) + 1)|0;
  $17 = (($13) + ($16<<10)|0);
  _load_block($17,$2);
  $18 = (($$015) + 1)|0;
  $19 = HEAP32[$3>>2]|0;
  $20 = ($18>>>0)<($19>>>0);
  if ($20) {
   $$015 = $18;
  } else {
   break;
  }
 }
 _clear_internal_memory($2,1024);
 STACKTOP = sp;return;
}
function _store32_10($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP8[$0>>0]=$1&255;HEAP8[$0+1>>0]=($1>>8)&255;HEAP8[$0+2>>0]=($1>>16)&255;HEAP8[$0+3>>0]=$1>>24;
 return;
}
function _load_block($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$06 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$06 = 0;
 while(1) {
  $2 = $$06 << 3;
  $3 = (($1) + ($2)|0);
  $4 = (_load64_11($3)|0);
  $5 = tempRet0;
  $6 = (($0) + ($$06<<3)|0);
  $7 = $6;
  $8 = $7;
  HEAP32[$8>>2] = $4;
  $9 = (($7) + 4)|0;
  $10 = $9;
  HEAP32[$10>>2] = $5;
  $11 = (($$06) + 1)|0;
  $exitcond = ($11|0)==(128);
  if ($exitcond) {
   break;
  } else {
   $$06 = $11;
  }
 }
 return;
}
function _load64_11($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1;
 $3 = HEAPU8[$2>>0]|(HEAPU8[$2+1>>0]<<8)|(HEAPU8[$2+2>>0]<<16)|(HEAPU8[$2+3>>0]<<24);
 $4 = (($1) + 4)|0;
 $5 = $4;
 $6 = HEAPU8[$5>>0]|(HEAPU8[$5+1>>0]<<8)|(HEAPU8[$5+2>>0]<<16)|(HEAPU8[$5+3>>0]<<24);
 tempRet0 = ($6);
 return ($3|0);
}
function _initial_hash($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $3 = sp;
 $4 = sp + 240|0;
 $5 = ($1|0)==(0|0);
 $6 = ($0|0)==(0|0);
 $or$cond = $6 | $5;
 if ($or$cond) {
  STACKTOP = sp;return;
 }
 (_blake2b_init($3,64)|0);
 $7 = ((($1)) + 48|0);
 $8 = HEAP32[$7>>2]|0;
 _store32_10($4,$8);
 (_blake2b_update($3,$4,4)|0);
 $9 = ((($1)) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 _store32_10($4,$10);
 (_blake2b_update($3,$4,4)|0);
 $11 = ((($1)) + 44|0);
 $12 = HEAP32[$11>>2]|0;
 _store32_10($4,$12);
 (_blake2b_update($3,$4,4)|0);
 $13 = ((($1)) + 40|0);
 $14 = HEAP32[$13>>2]|0;
 _store32_10($4,$14);
 (_blake2b_update($3,$4,4)|0);
 $15 = ((($1)) + 56|0);
 $16 = HEAP32[$15>>2]|0;
 _store32_10($4,$16);
 (_blake2b_update($3,$4,4)|0);
 _store32_10($4,$2);
 (_blake2b_update($3,$4,4)|0);
 $17 = ((($1)) + 12|0);
 $18 = HEAP32[$17>>2]|0;
 _store32_10($4,$18);
 (_blake2b_update($3,$4,4)|0);
 $19 = ((($1)) + 8|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($20|0)==(0|0);
 if (!($21)) {
  $22 = HEAP32[$17>>2]|0;
  (_blake2b_update($3,$20,$22)|0);
  $23 = ((($1)) + 68|0);
  $24 = HEAP32[$23>>2]|0;
  $25 = $24 & 1;
  $26 = ($25|0)==(0);
  if (!($26)) {
   $27 = HEAP32[$19>>2]|0;
   $28 = HEAP32[$17>>2]|0;
   _secure_wipe_memory($27,$28);
   HEAP32[$17>>2] = 0;
  }
 }
 $29 = ((($1)) + 20|0);
 $30 = HEAP32[$29>>2]|0;
 _store32_10($4,$30);
 (_blake2b_update($3,$4,4)|0);
 $31 = ((($1)) + 16|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ($32|0)==(0|0);
 if (!($33)) {
  $34 = HEAP32[$29>>2]|0;
  (_blake2b_update($3,$32,$34)|0);
 }
 $35 = ((($1)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 _store32_10($4,$36);
 (_blake2b_update($3,$4,4)|0);
 $37 = ((($1)) + 24|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ($38|0)==(0|0);
 if (!($39)) {
  $40 = HEAP32[$35>>2]|0;
  (_blake2b_update($3,$38,$40)|0);
  $41 = ((($1)) + 68|0);
  $42 = HEAP32[$41>>2]|0;
  $43 = $42 & 2;
  $44 = ($43|0)==(0);
  if (!($44)) {
   $45 = HEAP32[$37>>2]|0;
   $46 = HEAP32[$35>>2]|0;
   _secure_wipe_memory($45,$46);
   HEAP32[$35>>2] = 0;
  }
 }
 $47 = ((($1)) + 36|0);
 $48 = HEAP32[$47>>2]|0;
 _store32_10($4,$48);
 (_blake2b_update($3,$4,4)|0);
 $49 = ((($1)) + 32|0);
 $50 = HEAP32[$49>>2]|0;
 $51 = ($50|0)==(0|0);
 if (!($51)) {
  $52 = HEAP32[$47>>2]|0;
  (_blake2b_update($3,$50,$52)|0);
 }
 (_blake2b_final($3,$0,64)|0);
 STACKTOP = sp;return;
}
function _initialize($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $2 = sp;
 $3 = ($0|0)==(0|0);
 $4 = ($1|0)==(0|0);
 $or$cond = $3 | $4;
 if ($or$cond) {
  $$0 = -25;
  STACKTOP = sp;return ($$0|0);
 }
 $5 = ((($0)) + 40|0);
 HEAP32[$5>>2] = $1;
 $6 = ((($0)) + 12|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (_allocate_memory($1,$0,$7,1024)|0);
 $9 = ($8|0)==(0);
 if (!($9)) {
  $$0 = $8;
  STACKTOP = sp;return ($$0|0);
 }
 $10 = ((($0)) + 32|0);
 $11 = HEAP32[$10>>2]|0;
 _initial_hash($2,$1,$11);
 $12 = ((($2)) + 64|0);
 _clear_internal_memory($12,8);
 _fill_first_blocks($2,$0);
 _clear_internal_memory($2,72);
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _encode_string($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$11202 = 0, $$11215 = 0, $$14 = 0, $$232 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $8 = 0, $9 = 0, $not$261 = 0, $or$cond = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer4 = 0;
 var $vararg_buffer7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0;
 $vararg_buffer7 = sp + 96|0;
 $vararg_buffer4 = sp + 64|0;
 $vararg_buffer1 = sp + 32|0;
 $vararg_buffer = sp;
 $4 = sp + 100|0;
 $5 = (_argon2_type2string($3,0)|0);
 $6 = (_validate_inputs($2)|0);
 $7 = ($5|0)==(0|0);
 if ($7) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 $8 = ($6|0)==(0);
 if (!($8)) {
  $$14 = $6;
  STACKTOP = sp;return ($$14|0);
 }
 $9 = ($1>>>0)<(2);
 $10 = ((($0)) + 1|0);
 $11 = (($1) + -1)|0;
 if ($9) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 HEAP8[$0>>0]=36&255;HEAP8[$0+1>>0]=36>>8;
 $12 = (_strlen($5)|0);
 $13 = ($11>>>0)>($12>>>0);
 $14 = (($10) + ($12)|0);
 $15 = (($11) - ($12))|0;
 if (!($13)) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 $16 = (($12) + 1)|0;
 _memcpy(($10|0),($5|0),($16|0))|0;
 $17 = ($15>>>0)<(4);
 $18 = ((($14)) + 3|0);
 $19 = (($15) + -3)|0;
 if ($17) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 HEAP8[$14>>0]=4027940&255;HEAP8[$14+1>>0]=(4027940>>8)&255;HEAP8[$14+2>>0]=(4027940>>16)&255;HEAP8[$14+3>>0]=4027940>>24;
 $20 = ((($2)) + 56|0);
 $21 = HEAP32[$20>>2]|0;
 HEAP32[$vararg_buffer>>2] = $21;
 (_sprintf($4,33706,$vararg_buffer)|0);
 $22 = (_strlen($4)|0);
 $23 = ($19>>>0)>($22>>>0);
 $24 = (($18) + ($22)|0);
 $25 = (($19) - ($22))|0;
 if (!($23)) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 $26 = (($22) + 1)|0;
 _memcpy(($18|0),($4|0),($26|0))|0;
 $27 = ($25>>>0)<(4);
 $28 = ((($24)) + 3|0);
 $29 = (($25) + -3)|0;
 if ($27) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 HEAP8[$24>>0]=4025636&255;HEAP8[$24+1>>0]=(4025636>>8)&255;HEAP8[$24+2>>0]=(4025636>>16)&255;HEAP8[$24+3>>0]=4025636>>24;
 $30 = ((($2)) + 44|0);
 $31 = HEAP32[$30>>2]|0;
 HEAP32[$vararg_buffer1>>2] = $31;
 (_sprintf($vararg_buffer,33706,$vararg_buffer1)|0);
 $32 = (_strlen($vararg_buffer)|0);
 $33 = ($29>>>0)>($32>>>0);
 $34 = (($28) + ($32)|0);
 $35 = (($29) - ($32))|0;
 if (!($33)) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 $36 = (($32) + 1)|0;
 _memcpy(($28|0),($vararg_buffer|0),($36|0))|0;
 $37 = ($35>>>0)<(4);
 $38 = ((($34)) + 3|0);
 $39 = (($35) + -3)|0;
 if ($37) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 HEAP8[$34>>0]=4027436&255;HEAP8[$34+1>>0]=(4027436>>8)&255;HEAP8[$34+2>>0]=(4027436>>16)&255;HEAP8[$34+3>>0]=4027436>>24;
 $40 = ((($2)) + 40|0);
 $41 = HEAP32[$40>>2]|0;
 HEAP32[$vararg_buffer4>>2] = $41;
 (_sprintf($vararg_buffer1,33706,$vararg_buffer4)|0);
 $42 = (_strlen($vararg_buffer1)|0);
 $43 = ($39>>>0)>($42>>>0);
 $44 = (($38) + ($42)|0);
 $45 = (($39) - ($42))|0;
 if (!($43)) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 $46 = (($42) + 1)|0;
 _memcpy(($38|0),($vararg_buffer1|0),($46|0))|0;
 $47 = ($45>>>0)<(4);
 $48 = ((($44)) + 3|0);
 $49 = (($45) + -3)|0;
 if ($47) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 HEAP8[$44>>0]=4026412&255;HEAP8[$44+1>>0]=(4026412>>8)&255;HEAP8[$44+2>>0]=(4026412>>16)&255;HEAP8[$44+3>>0]=4026412>>24;
 $50 = ((($2)) + 48|0);
 $51 = HEAP32[$50>>2]|0;
 HEAP32[$vararg_buffer7>>2] = $51;
 (_sprintf($vararg_buffer4,33706,$vararg_buffer7)|0);
 $52 = (_strlen($vararg_buffer4)|0);
 $53 = ($49>>>0)>($52>>>0);
 $54 = (($48) + ($52)|0);
 $55 = (($49) - ($52))|0;
 if (!($53)) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 $56 = (($52) + 1)|0;
 _memcpy(($48|0),($vararg_buffer4|0),($56|0))|0;
 $57 = ($55>>>0)<(2);
 $58 = ((($54)) + 1|0);
 $59 = (($55) + -1)|0;
 if ($57) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 }
 HEAP8[$54>>0]=36&255;HEAP8[$54+1>>0]=36>>8;
 $60 = ((($2)) + 16|0);
 $61 = HEAP32[$60>>2]|0;
 $62 = ((($2)) + 20|0);
 $63 = HEAP32[$62>>2]|0;
 $64 = (_to_base64($58,$59,$61,$63)|0);
 $65 = ($64|0)==(-1);
 $66 = (($58) + ($64)|0);
 $67 = $65 ? 0 : $64;
 $$11215 = (($59) - ($67))|0;
 $$11202 = $65 ? $58 : $66;
 $68 = ($$11215>>>0)<(2);
 $or$cond = $65 | $68;
 if ($or$cond) {
  $$14 = -31;
  STACKTOP = sp;return ($$14|0);
 } else {
  $69 = (($$11215) + -1)|0;
  $70 = ((($$11202)) + 1|0);
  HEAP8[$$11202>>0]=36&255;HEAP8[$$11202+1>>0]=36>>8;
  $71 = HEAP32[$2>>2]|0;
  $72 = ((($2)) + 4|0);
  $73 = HEAP32[$72>>2]|0;
  $74 = (_to_base64($70,$69,$71,$73)|0);
  $not$261 = ($74|0)!=(-1);
  $$232 = $not$261 ? 0 : -31;
  STACKTOP = sp;return ($$232|0);
 }
 return (0)|0;
}
function _to_base64($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$02941 = 0, $$03040 = 0, $$031 = 0, $$034 = 0, $$03539 = 0, $$042 = 0, $$132 = 0, $$13637 = 0, $$138 = 0, $$2 = 0, $$in = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $trunc = 0, $trunc$clear = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (($3>>>0) / 3)&-1;
 $5 = $4 << 2;
 $6 = (($3>>>0) % 3)&-1;
 $trunc = $6&255;
 $trunc$clear = $trunc & 3;
 switch ($trunc$clear<<24>>24) {
 case 2:  {
  $7 = $5 | 1;
  $$031 = $7;
  label = 3;
  break;
 }
 case 1:  {
  $$031 = $5;
  label = 3;
  break;
 }
 default: {
  $$132 = $5;
 }
 }
 if ((label|0) == 3) {
  $8 = (($$031) + 2)|0;
  $$132 = $8;
 }
 $9 = ($$132>>>0)<($1>>>0);
 if (!($9)) {
  $$034 = -1;
  return ($$034|0);
 }
 $10 = ($3|0)==(0);
 if ($10) {
  $$2 = $0;
 } else {
  $$02941 = 0;$$03040 = $2;$$03539 = $0;$$042 = 0;$$in = $3;
  while(1) {
   $14 = $$02941 << 8;
   $15 = HEAP8[$$03040>>0]|0;
   $16 = $15&255;
   $17 = $16 | $14;
   $18 = (($$042) + 8)|0;
   $$13637 = $$03539;$$138 = $18;
   while(1) {
    $19 = (($$138) + -6)|0;
    $20 = $17 >>> $19;
    $21 = $20 & 63;
    $22 = (_b64_byte_to_char($21)|0);
    $23 = $22&255;
    $24 = ((($$13637)) + 1|0);
    HEAP8[$$13637>>0] = $23;
    $25 = ($19>>>0)>(5);
    if ($25) {
     $$13637 = $24;$$138 = $19;
    } else {
     break;
    }
   }
   $11 = (($$in) + -1)|0;
   $12 = ((($$03040)) + 1|0);
   $13 = ($11|0)==(0);
   if ($13) {
    break;
   } else {
    $$02941 = $17;$$03040 = $12;$$03539 = $24;$$042 = $19;$$in = $11;
   }
  }
  $26 = ($19|0)==(0);
  if ($26) {
   $$2 = $24;
  } else {
   $27 = ((($$13637)) + 2|0);
   $28 = (12 - ($$138))|0;
   $29 = $17 << $28;
   $30 = $29 & 63;
   $31 = (_b64_byte_to_char($30)|0);
   $32 = $31&255;
   HEAP8[$24>>0] = $32;
   $$2 = $27;
  }
 }
 HEAP8[$$2>>0] = 0;
 $$034 = $$132;
 return ($$034|0);
}
function _b64_byte_to_char($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + 65510)|0;
 $2 = $1 >>> 8;
 $3 = $2 & 255;
 $4 = (($0) + 65)|0;
 $5 = $3 & $4;
 $6 = $3 ^ 255;
 $7 = (($0) + 65484)|0;
 $8 = $7 >>> 8;
 $9 = $8 & 255;
 $10 = (($0) + 71)|0;
 $11 = $8 & $10;
 $12 = $11 & $6;
 $13 = $9 ^ 255;
 $14 = (($0) + 65474)|0;
 $15 = $14 >>> 8;
 $16 = (($0) + 252)|0;
 $17 = $15 & $16;
 $18 = $17 & $13;
 $19 = $0 ^ 62;
 $20 = (0 - ($19))|0;
 $21 = $20 >>> 8;
 $22 = $21 & 43;
 $23 = $22 ^ 43;
 $24 = $0 ^ 63;
 $25 = (0 - ($24))|0;
 $26 = $25 >>> 8;
 $27 = $26 & 47;
 $28 = $27 ^ 47;
 $29 = $23 | $5;
 $30 = $29 | $28;
 $31 = $30 | $12;
 $32 = $31 | $18;
 return ($32|0);
}
function _nimiq_htonll($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[72]|0;
 $3 = ($2<<24>>24)==(42);
 if ($3) {
  $4 = (_bswap_64($0,$1)|0);
  $5 = tempRet0;
  $6 = $5;$7 = $4;
 } else {
  $6 = $1;$7 = $0;
 }
 tempRet0 = ($6);
 return ($7|0);
}
function _bswap_64($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_bswap_32($0)|0);
 $3 = (_bswap_32($1)|0);
 tempRet0 = ($2);
 return ($3|0);
}
function _bswap_32($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0&65535;
 $2 = (_bswap_16($1)|0);
 $3 = $2&65535;
 $4 = $3 << 16;
 $5 = $0 >>> 16;
 $6 = $5&65535;
 $7 = (_bswap_16($6)|0);
 $8 = $7&65535;
 $9 = $4 | $8;
 return ($9|0);
}
function _bswap_16($0) {
 $0 = $0|0;
 var $rev = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $rev = (_llvm_bswap_i16(($0|0))|0);
 return ($rev|0);
}
function _uint256_new() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_malloc(32)|0);
 ;HEAP32[$0>>2]=0|0;HEAP32[$0+4>>2]=0|0;HEAP32[$0+8>>2]=0|0;HEAP32[$0+12>>2]=0|0;HEAP32[$0+16>>2]=0|0;HEAP32[$0+20>>2]=0|0;HEAP32[$0+24>>2]=0|0;HEAP32[$0+28>>2]=0|0;
 return ($0|0);
}
function _uint256_shift_left($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$025$lcssa = 0, $$lcssa27 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $32$phi = 0, $33 = 0, $34 = 0, $35 = 0, $35$phi = 0, $36 = 0, $37 = 0, $38 = 0, $38$phi = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $41$phi = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1&255;
 $3 = ($1&255)>(64);
 if ($3) {
  $4 = ((($0)) + 8|0);
  $5 = ((($0)) + 16|0);
  $6 = ((($0)) + 24|0);
  $7 = $4;
  $8 = $7;
  $9 = HEAP32[$8>>2]|0;
  $10 = (($7) + 4)|0;
  $11 = $10;
  $12 = HEAP32[$11>>2]|0;
  $13 = $5;
  $14 = $13;
  $15 = HEAP32[$14>>2]|0;
  $16 = (($13) + 4)|0;
  $17 = $16;
  $18 = HEAP32[$17>>2]|0;
  $19 = $6;
  $20 = $19;
  $21 = HEAP32[$20>>2]|0;
  $22 = (($19) + 4)|0;
  $23 = $22;
  $24 = HEAP32[$23>>2]|0;
  $26 = $2;$32 = $15;$35 = $18;$38 = $9;$41 = $12;$44 = $21;$47 = $24;
  while(1) {
   $25 = (($26) + 192)|0;
   $27 = $25&255;
   $28 = $25 & 255;
   $29 = ($27&255)>(64);
   if ($29) {
    $41$phi = $35;$38$phi = $32;$35$phi = $47;$32$phi = $44;$26 = $28;$44 = 0;$47 = 0;$41 = $41$phi;$38 = $38$phi;$35 = $35$phi;$32 = $32$phi;
   } else {
    break;
   }
  }
  $30 = $4;
  $31 = $30;
  HEAP32[$31>>2] = $32;
  $33 = (($30) + 4)|0;
  $34 = $33;
  HEAP32[$34>>2] = $35;
  $36 = $0;
  $37 = $36;
  HEAP32[$37>>2] = $38;
  $39 = (($36) + 4)|0;
  $40 = $39;
  HEAP32[$40>>2] = $41;
  $42 = $5;
  $43 = $42;
  HEAP32[$43>>2] = $44;
  $45 = (($42) + 4)|0;
  $46 = $45;
  HEAP32[$46>>2] = $47;
  $48 = $6;
  $49 = $48;
  HEAP32[$49>>2] = 0;
  $50 = (($48) + 4)|0;
  $51 = $50;
  HEAP32[$51>>2] = 0;
  $$025$lcssa = $27;$$lcssa27 = $28;
 } else {
  $$025$lcssa = $1;$$lcssa27 = $2;
 }
 $52 = ($$025$lcssa<<24>>24)==(0);
 if ($52) {
  return;
 }
 $53 = $$025$lcssa&255;
 $54 = (64 - ($$lcssa27))|0;
 $55 = $0;
 $56 = $55;
 $57 = HEAP32[$56>>2]|0;
 $58 = (($55) + 4)|0;
 $59 = $58;
 $60 = HEAP32[$59>>2]|0;
 $61 = (_bitshift64Shl(($57|0),($60|0),($53|0))|0);
 $62 = tempRet0;
 $63 = ((($0)) + 8|0);
 $64 = $63;
 $65 = $64;
 $66 = HEAP32[$65>>2]|0;
 $67 = (($64) + 4)|0;
 $68 = $67;
 $69 = HEAP32[$68>>2]|0;
 $70 = (_bitshift64Lshr(($66|0),($69|0),($54|0))|0);
 $71 = tempRet0;
 $72 = $70 | $61;
 $73 = $71 | $62;
 $74 = $0;
 $75 = $74;
 HEAP32[$75>>2] = $72;
 $76 = (($74) + 4)|0;
 $77 = $76;
 HEAP32[$77>>2] = $73;
 $78 = ((($0)) + 8|0);
 $79 = (_bitshift64Shl(($66|0),($69|0),($53|0))|0);
 $80 = tempRet0;
 $81 = ((($0)) + 16|0);
 $82 = $81;
 $83 = $82;
 $84 = HEAP32[$83>>2]|0;
 $85 = (($82) + 4)|0;
 $86 = $85;
 $87 = HEAP32[$86>>2]|0;
 $88 = (_bitshift64Lshr(($84|0),($87|0),($54|0))|0);
 $89 = tempRet0;
 $90 = $88 | $79;
 $91 = $89 | $80;
 $92 = $78;
 $93 = $92;
 HEAP32[$93>>2] = $90;
 $94 = (($92) + 4)|0;
 $95 = $94;
 HEAP32[$95>>2] = $91;
 $96 = ((($0)) + 16|0);
 $97 = (_bitshift64Shl(($84|0),($87|0),($53|0))|0);
 $98 = tempRet0;
 $99 = ((($0)) + 24|0);
 $100 = $99;
 $101 = $100;
 $102 = HEAP32[$101>>2]|0;
 $103 = (($100) + 4)|0;
 $104 = $103;
 $105 = HEAP32[$104>>2]|0;
 $106 = (_bitshift64Lshr(($102|0),($105|0),($54|0))|0);
 $107 = tempRet0;
 $108 = $106 | $97;
 $109 = $107 | $98;
 $110 = $96;
 $111 = $110;
 HEAP32[$111>>2] = $108;
 $112 = (($110) + 4)|0;
 $113 = $112;
 HEAP32[$113>>2] = $109;
 $114 = ((($0)) + 24|0);
 $115 = (_bitshift64Shl(($102|0),($105|0),($53|0))|0);
 $116 = tempRet0;
 $117 = $114;
 $118 = $117;
 HEAP32[$118>>2] = $115;
 $119 = (($117) + 4)|0;
 $120 = $119;
 HEAP32[$120>>2] = $116;
 return;
}
function _uint256_set($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 24|0);
 $4 = $3;
 $5 = $4;
 HEAP32[$5>>2] = $1;
 $6 = (($4) + 4)|0;
 $7 = $6;
 HEAP32[$7>>2] = $2;
 return;
}
function _uint256_set_compact($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 & 16777215;
 _uint256_set($0,$2,0);
 $3 = $1 >>> 24;
 $4 = $3 << 3;
 $5 = (($4) + 232)|0;
 $6 = $5&255;
 _uint256_shift_left($0,$6);
 return;
}
function _uint256_set_bytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = (_nimiq_htonll($4,$7)|0);
 $9 = tempRet0;
 $10 = $0;
 $11 = $10;
 HEAP32[$11>>2] = $8;
 $12 = (($10) + 4)|0;
 $13 = $12;
 HEAP32[$13>>2] = $9;
 $14 = ((($1)) + 8|0);
 $15 = $14;
 $16 = $15;
 $17 = HEAP32[$16>>2]|0;
 $18 = (($15) + 4)|0;
 $19 = $18;
 $20 = HEAP32[$19>>2]|0;
 $21 = (_nimiq_htonll($17,$20)|0);
 $22 = tempRet0;
 $23 = ((($0)) + 8|0);
 $24 = $23;
 $25 = $24;
 HEAP32[$25>>2] = $21;
 $26 = (($24) + 4)|0;
 $27 = $26;
 HEAP32[$27>>2] = $22;
 $28 = ((($1)) + 16|0);
 $29 = $28;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = (($29) + 4)|0;
 $33 = $32;
 $34 = HEAP32[$33>>2]|0;
 $35 = (_nimiq_htonll($31,$34)|0);
 $36 = tempRet0;
 $37 = ((($0)) + 16|0);
 $38 = $37;
 $39 = $38;
 HEAP32[$39>>2] = $35;
 $40 = (($38) + 4)|0;
 $41 = $40;
 HEAP32[$41>>2] = $36;
 $42 = ((($1)) + 24|0);
 $43 = $42;
 $44 = $43;
 $45 = HEAP32[$44>>2]|0;
 $46 = (($43) + 4)|0;
 $47 = $46;
 $48 = HEAP32[$47>>2]|0;
 $49 = (_nimiq_htonll($45,$48)|0);
 $50 = tempRet0;
 $51 = ((($0)) + 24|0);
 $52 = $51;
 $53 = $52;
 HEAP32[$53>>2] = $49;
 $54 = (($52) + 4)|0;
 $55 = $54;
 HEAP32[$55>>2] = $50;
 return;
}
function _uint256_compare($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $0;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = $1;
 $9 = $8;
 $10 = HEAP32[$9>>2]|0;
 $11 = (($8) + 4)|0;
 $12 = $11;
 $13 = HEAP32[$12>>2]|0;
 $14 = ($7>>>0)<($13>>>0);
 $15 = ($4>>>0)<($10>>>0);
 $16 = ($7|0)==($13|0);
 $17 = $16 & $15;
 $18 = $14 | $17;
 if ($18) {
  $43 = -1;
  return ($43|0);
 }
 $38 = ($7>>>0)>($13>>>0);
 $39 = ($4>>>0)>($10>>>0);
 $40 = ($7|0)==($13|0);
 $41 = $40 & $39;
 $42 = $38 | $41;
 if ($42) {
  $43 = 1;
  return ($43|0);
 }
 $19 = ((($0)) + 8|0);
 $20 = $19;
 $21 = $20;
 $22 = HEAP32[$21>>2]|0;
 $23 = (($20) + 4)|0;
 $24 = $23;
 $25 = HEAP32[$24>>2]|0;
 $26 = ((($1)) + 8|0);
 $27 = $26;
 $28 = $27;
 $29 = HEAP32[$28>>2]|0;
 $30 = (($27) + 4)|0;
 $31 = $30;
 $32 = HEAP32[$31>>2]|0;
 $33 = ($25>>>0)<($32>>>0);
 $34 = ($22>>>0)<($29>>>0);
 $35 = ($25|0)==($32|0);
 $36 = $35 & $34;
 $37 = $33 | $36;
 if ($37) {
  $43 = -1;
  return ($43|0);
 }
 $44 = ($25>>>0)>($32>>>0);
 $45 = ($22>>>0)>($29>>>0);
 $46 = ($25|0)==($32|0);
 $47 = $46 & $45;
 $48 = $44 | $47;
 if ($48) {
  $43 = 1;
  return ($43|0);
 }
 $49 = ((($0)) + 16|0);
 $50 = $49;
 $51 = $50;
 $52 = HEAP32[$51>>2]|0;
 $53 = (($50) + 4)|0;
 $54 = $53;
 $55 = HEAP32[$54>>2]|0;
 $56 = ((($1)) + 16|0);
 $57 = $56;
 $58 = $57;
 $59 = HEAP32[$58>>2]|0;
 $60 = (($57) + 4)|0;
 $61 = $60;
 $62 = HEAP32[$61>>2]|0;
 $63 = ($55>>>0)<($62>>>0);
 $64 = ($52>>>0)<($59>>>0);
 $65 = ($55|0)==($62|0);
 $66 = $65 & $64;
 $67 = $63 | $66;
 if ($67) {
  $43 = -1;
  return ($43|0);
 }
 $68 = ($55>>>0)>($62>>>0);
 $69 = ($52>>>0)>($59>>>0);
 $70 = ($55|0)==($62|0);
 $71 = $70 & $69;
 $72 = $68 | $71;
 if ($72) {
  $43 = 1;
  return ($43|0);
 }
 $73 = ((($0)) + 24|0);
 $74 = $73;
 $75 = $74;
 $76 = HEAP32[$75>>2]|0;
 $77 = (($74) + 4)|0;
 $78 = $77;
 $79 = HEAP32[$78>>2]|0;
 $80 = ((($1)) + 24|0);
 $81 = $80;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (($81) + 4)|0;
 $85 = $84;
 $86 = HEAP32[$85>>2]|0;
 $87 = ($79>>>0)<($86>>>0);
 $88 = ($76>>>0)<($83>>>0);
 $89 = ($79|0)==($86|0);
 $90 = $89 & $88;
 $91 = $87 | $90;
 if ($91) {
  $43 = -1;
  return ($43|0);
 } else {
  $92 = ($79>>>0)>($86>>>0);
  $93 = ($76>>>0)>($83>>>0);
  $94 = ($79|0)==($86|0);
  $95 = $94 & $93;
  $96 = $92 | $95;
  $$ = $96&1;
  return ($$|0);
 }
 return (0)|0;
}
function _nimiq_light_hash($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_blake2b($0,32,$1,$2,0,0)|0);
 return ($3|0);
}
function _nimiq_hard_hash($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ($3|0)==(0);
 $5 = $4 ? 1024 : $3;
 $6 = (_argon2d_hash_raw(1,$5,1,$1,$2,33710,11,$0,32)|0);
 return ($6|0);
}
function _nimiq_hard_hash_target($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $7 = (($1) + ($2)|0);
 $8 = ((($7)) + -4|0);
 $9 = (_uint256_new()|0);
 $10 = (_uint256_new()|0);
 _uint256_set_compact($9,$3);
 $11 = (_htonl($4)|0);
 HEAP32[$8>>2] = $11;
 $12 = (_ntohl($11)|0);
 $13 = ($12>>>0)<($5>>>0);
 L1: do {
  if ($13) {
   while(1) {
    (_nimiq_hard_hash($0,$1,$2,$6)|0);
    _uint256_set_bytes($10,$0);
    $14 = (_uint256_compare($9,$10)|0);
    $15 = ($14<<24>>24)>(0);
    if ($15) {
     break L1;
    }
    $16 = HEAP32[$8>>2]|0;
    $17 = (_ntohl($16)|0);
    $18 = (($17) + 1)|0;
    $19 = (_htonl($18)|0);
    HEAP32[$8>>2] = $19;
    $20 = (_ntohl($19)|0);
    $21 = ($20>>>0)<($5>>>0);
    if (!($21)) {
     break;
    }
   }
  }
 } while(0);
 _free($10);
 _free($9);
 $22 = HEAP32[$8>>2]|0;
 $23 = (_ntohl($22)|0);
 return ($23|0);
}
function _nimiq_hard_verify($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (_malloc(32)|0);
 (_nimiq_hard_hash($4,$1,$2,$3)|0);
 $5 = (_memcmp($0,$4,32)|0);
 _free($4);
 return ($5|0);
}
function _fill_segment($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$$1 = 0, $$068 = 0, $$06976 = 0, $$070 = 0, $$070$in = 0, $$072$in = 0, $$077 = 0, $$175 = 0, $$mux = 0, $$not = 0, $$not73 = 0, $$op = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0;
 var $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0;
 var $125 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $brmerge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 3072|0;
 $2 = sp + 2048|0;
 $3 = sp + 1024|0;
 $4 = sp;
 $5 = ($0|0)==(0|0);
 if ($5) {
  STACKTOP = sp;return;
 }
 $6 = ((($0)) + 32|0);
 $7 = HEAP32[$6>>2]|0;
 switch ($7|0) {
 case 1:  {
  label = 5;
  break;
 }
 case 2:  {
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0);
  if ($9) {
   $10 = ((($1)) + 8|0);
   $11 = HEAP8[$10>>0]|0;
   $12 = ($11&255)<(2);
   if ($12) {
    label = 5;
   } else {
    $57 = 0;
   }
  } else {
   $57 = 0;
  }
  break;
 }
 default: {
  $57 = 0;
 }
 }
 if ((label|0) == 5) {
  _init_block_value($4,0);
  _init_block_value($3,0);
  $13 = HEAP32[$1>>2]|0;
  $14 = $3;
  $15 = $14;
  HEAP32[$15>>2] = $13;
  $16 = (($14) + 4)|0;
  $17 = $16;
  HEAP32[$17>>2] = 0;
  $18 = ((($1)) + 4|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = ((($3)) + 8|0);
  $21 = $20;
  $22 = $21;
  HEAP32[$22>>2] = $19;
  $23 = (($21) + 4)|0;
  $24 = $23;
  HEAP32[$24>>2] = 0;
  $25 = ((($1)) + 8|0);
  $26 = HEAP8[$25>>0]|0;
  $27 = $26&255;
  $28 = ((($3)) + 16|0);
  $29 = $28;
  $30 = $29;
  HEAP32[$30>>2] = $27;
  $31 = (($29) + 4)|0;
  $32 = $31;
  HEAP32[$32>>2] = 0;
  $33 = ((($0)) + 12|0);
  $34 = HEAP32[$33>>2]|0;
  $35 = ((($3)) + 24|0);
  $36 = $35;
  $37 = $36;
  HEAP32[$37>>2] = $34;
  $38 = (($36) + 4)|0;
  $39 = $38;
  HEAP32[$39>>2] = 0;
  $40 = ((($0)) + 8|0);
  $41 = HEAP32[$40>>2]|0;
  $42 = ((($3)) + 32|0);
  $43 = $42;
  $44 = $43;
  HEAP32[$44>>2] = $41;
  $45 = (($43) + 4)|0;
  $46 = $45;
  HEAP32[$46>>2] = 0;
  $47 = HEAP32[$6>>2]|0;
  $48 = ((($3)) + 40|0);
  $49 = $48;
  $50 = $49;
  HEAP32[$50>>2] = $47;
  $51 = (($49) + 4)|0;
  $52 = $51;
  HEAP32[$52>>2] = 0;
  $57 = 1;
 }
 $53 = HEAP32[$1>>2]|0;
 $54 = ($53|0)==(0);
 if ($54) {
  $55 = ((($1)) + 8|0);
  $56 = HEAP8[$55>>0]|0;
  $$not = ($56<<24>>24)!=(0);
  $$not73 = $57 ^ 1;
  $brmerge = $$not | $$not73;
  $$mux = $$not ? 0 : 2;
  if ($brmerge) {
   $$068 = $$mux;
  } else {
   _next_addresses($2,$3,$4);
   $$068 = 2;
  }
 } else {
  $$068 = 0;
 }
 $58 = ((($1)) + 4|0);
 $59 = HEAP32[$58>>2]|0;
 $60 = ((($0)) + 20|0);
 $61 = HEAP32[$60>>2]|0;
 $62 = Math_imul($61, $59)|0;
 $63 = ((($1)) + 8|0);
 $64 = HEAP8[$63>>0]|0;
 $65 = $64&255;
 $66 = ((($0)) + 16|0);
 $67 = HEAP32[$66>>2]|0;
 $68 = Math_imul($65, $67)|0;
 $69 = (($62) + ($$068))|0;
 $70 = (($69) + ($68))|0;
 $71 = ($$068>>>0)<($67>>>0);
 if (!($71)) {
  STACKTOP = sp;return;
 }
 $72 = (($70>>>0) % ($61>>>0))&-1;
 $73 = ($72|0)==(0);
 $$op = (($61) + -1)|0;
 $$070$in = $73 ? $$op : -1;
 $$070 = (($$070$in) + ($70))|0;
 $74 = ((($0)) + 24|0);
 $75 = ((($1)) + 12|0);
 $76 = ((($0)) + 4|0);
 $$06976 = $70;$$077 = $$068;$$175 = $$070;
 while(1) {
  $77 = HEAP32[$60>>2]|0;
  $78 = (($$06976>>>0) % ($77>>>0))&-1;
  $79 = ($78|0)==(1);
  $80 = (($$06976) + -1)|0;
  $$$1 = $79 ? $80 : $$175;
  if ($57) {
   $81 = $$077 & 127;
   $82 = ($81|0)==(0);
   if ($82) {
    _next_addresses($2,$3,$4);
   }
   $83 = (($2) + ($81<<3)|0);
   $$072$in = $83;
  } else {
   $84 = HEAP32[$0>>2]|0;
   $85 = (($84) + ($$$1<<10)|0);
   $$072$in = $85;
  }
  $86 = $$072$in;
  $87 = $86;
  $88 = HEAP32[$87>>2]|0;
  $89 = (($86) + 4)|0;
  $90 = $89;
  $91 = HEAP32[$90>>2]|0;
  $92 = HEAP32[$74>>2]|0;
  $93 = (___uremdi3(($91|0),0,($92|0),0)|0);
  $94 = tempRet0;
  $95 = HEAP32[$1>>2]|0;
  $96 = ($95|0)==(0);
  if ($96) {
   $97 = HEAP8[$63>>0]|0;
   $98 = ($97<<24>>24)==(0);
   if ($98) {
    $99 = HEAP32[$58>>2]|0;
    $101 = $99;$103 = 0;
   } else {
    $101 = $93;$103 = $94;
   }
  } else {
   $101 = $93;$103 = $94;
  }
  HEAP32[$75>>2] = $$077;
  $100 = HEAP32[$58>>2]|0;
  $102 = ($101|0)==($100|0);
  $104 = ($103|0)==(0);
  $105 = $102 & $104;
  $106 = $105&1;
  $107 = (_index_alpha($0,$1,$88,$106)|0);
  $108 = HEAP32[$0>>2]|0;
  $109 = HEAP32[$60>>2]|0;
  $110 = (___muldi3(($109|0),0,($101|0),($103|0))|0);
  $111 = tempRet0;
  $112 = (($108) + ($110<<10)|0);
  $113 = (($112) + ($107<<10)|0);
  $114 = (($108) + ($$06976<<10)|0);
  $115 = HEAP32[$76>>2]|0;
  $116 = ($115|0)==(16);
  do {
   if ($116) {
    $117 = (($108) + ($$$1<<10)|0);
    _fill_block($117,$113,$114,0);
   } else {
    $118 = HEAP32[$1>>2]|0;
    $119 = ($118|0)==(0);
    $120 = (($108) + ($$$1<<10)|0);
    if ($119) {
     _fill_block($120,$113,$114,0);
     break;
    } else {
     _fill_block($120,$113,$114,1);
     break;
    }
   }
  } while(0);
  $121 = (($$077) + 1)|0;
  $122 = (($$06976) + 1)|0;
  $123 = (($$$1) + 1)|0;
  $124 = HEAP32[$66>>2]|0;
  $125 = ($121>>>0)<($124>>>0);
  if ($125) {
   $$06976 = $122;$$077 = $121;$$175 = $123;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _next_addresses($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($1)) + 48|0);
 $4 = $3;
 $5 = $4;
 $6 = HEAP32[$5>>2]|0;
 $7 = (($4) + 4)|0;
 $8 = $7;
 $9 = HEAP32[$8>>2]|0;
 $10 = (_i64Add(($6|0),($9|0),1,0)|0);
 $11 = tempRet0;
 $12 = $3;
 $13 = $12;
 HEAP32[$13>>2] = $10;
 $14 = (($12) + 4)|0;
 $15 = $14;
 HEAP32[$15>>2] = $11;
 _fill_block($2,$1,$0,0);
 _fill_block($2,$0,$0,0);
 return;
}
function _fill_block($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0396 = 0, $$1395 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0;
 var $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0;
 var $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0;
 var $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0;
 var $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0;
 var $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0;
 var $1105 = 0, $1106 = 0, $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0;
 var $1123 = 0, $1124 = 0, $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0;
 var $1141 = 0, $1142 = 0, $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0;
 var $116 = 0, $1160 = 0, $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0;
 var $1178 = 0, $1179 = 0, $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0;
 var $1196 = 0, $1197 = 0, $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0;
 var $1213 = 0, $1214 = 0, $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0;
 var $1231 = 0, $1232 = 0, $1233 = 0, $1234 = 0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0;
 var $125 = 0, $1250 = 0, $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0;
 var $1268 = 0, $1269 = 0, $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0;
 var $1286 = 0, $1287 = 0, $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0;
 var $1303 = 0, $1304 = 0, $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0;
 var $1321 = 0, $1322 = 0, $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0;
 var $134 = 0, $1340 = 0, $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0;
 var $1358 = 0, $1359 = 0, $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0;
 var $1376 = 0, $1377 = 0, $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0;
 var $1394 = 0, $1395 = 0, $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0, $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0;
 var $1411 = 0, $1412 = 0, $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0, $142 = 0, $1420 = 0, $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0;
 var $143 = 0, $1430 = 0, $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0;
 var $1448 = 0, $1449 = 0, $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0, $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0;
 var $1466 = 0, $1467 = 0, $1468 = 0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0;
 var $1484 = 0, $1485 = 0, $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0;
 var $1501 = 0, $1502 = 0, $1503 = 0, $1504 = 0, $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0;
 var $152 = 0, $1520 = 0, $1521 = 0, $1522 = 0, $1523 = 0, $1524 = 0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0, $1532 = 0, $1533 = 0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0;
 var $1538 = 0, $1539 = 0, $154 = 0, $1540 = 0, $1541 = 0, $1542 = 0, $1543 = 0, $1544 = 0, $1545 = 0, $1546 = 0, $1547 = 0, $1548 = 0, $1549 = 0, $155 = 0, $1550 = 0, $1551 = 0, $1552 = 0, $1553 = 0, $1554 = 0, $1555 = 0;
 var $1556 = 0, $1557 = 0, $1558 = 0, $1559 = 0, $156 = 0, $1560 = 0, $1561 = 0, $1562 = 0, $1563 = 0, $1564 = 0, $1565 = 0, $1566 = 0, $1567 = 0, $1568 = 0, $1569 = 0, $157 = 0, $1570 = 0, $1571 = 0, $1572 = 0, $1573 = 0;
 var $1574 = 0, $1575 = 0, $1576 = 0, $1577 = 0, $1578 = 0, $1579 = 0, $158 = 0, $1580 = 0, $1581 = 0, $1582 = 0, $1583 = 0, $1584 = 0, $1585 = 0, $1586 = 0, $1587 = 0, $1588 = 0, $1589 = 0, $159 = 0, $1590 = 0, $1591 = 0;
 var $1592 = 0, $1593 = 0, $1594 = 0, $1595 = 0, $1596 = 0, $1597 = 0, $1598 = 0, $1599 = 0, $16 = 0, $160 = 0, $1600 = 0, $1601 = 0, $1602 = 0, $1603 = 0, $1604 = 0, $1605 = 0, $1606 = 0, $1607 = 0, $1608 = 0, $1609 = 0;
 var $161 = 0, $1610 = 0, $1611 = 0, $1612 = 0, $1613 = 0, $1614 = 0, $1615 = 0, $1616 = 0, $1617 = 0, $1618 = 0, $1619 = 0, $162 = 0, $1620 = 0, $1621 = 0, $1622 = 0, $1623 = 0, $1624 = 0, $1625 = 0, $1626 = 0, $1627 = 0;
 var $1628 = 0, $1629 = 0, $163 = 0, $1630 = 0, $1631 = 0, $1632 = 0, $1633 = 0, $1634 = 0, $1635 = 0, $1636 = 0, $1637 = 0, $1638 = 0, $1639 = 0, $164 = 0, $1640 = 0, $1641 = 0, $1642 = 0, $1643 = 0, $1644 = 0, $1645 = 0;
 var $1646 = 0, $1647 = 0, $1648 = 0, $1649 = 0, $165 = 0, $1650 = 0, $1651 = 0, $1652 = 0, $1653 = 0, $1654 = 0, $1655 = 0, $1656 = 0, $1657 = 0, $1658 = 0, $1659 = 0, $166 = 0, $1660 = 0, $1661 = 0, $1662 = 0, $1663 = 0;
 var $1664 = 0, $1665 = 0, $1666 = 0, $1667 = 0, $1668 = 0, $1669 = 0, $167 = 0, $1670 = 0, $1671 = 0, $1672 = 0, $1673 = 0, $1674 = 0, $1675 = 0, $1676 = 0, $1677 = 0, $1678 = 0, $1679 = 0, $168 = 0, $1680 = 0, $1681 = 0;
 var $1682 = 0, $1683 = 0, $1684 = 0, $1685 = 0, $1686 = 0, $1687 = 0, $1688 = 0, $1689 = 0, $169 = 0, $1690 = 0, $1691 = 0, $1692 = 0, $1693 = 0, $1694 = 0, $1695 = 0, $1696 = 0, $1697 = 0, $1698 = 0, $1699 = 0, $17 = 0;
 var $170 = 0, $1700 = 0, $1701 = 0, $1702 = 0, $1703 = 0, $1704 = 0, $1705 = 0, $1706 = 0, $1707 = 0, $1708 = 0, $1709 = 0, $171 = 0, $1710 = 0, $1711 = 0, $1712 = 0, $1713 = 0, $1714 = 0, $1715 = 0, $1716 = 0, $1717 = 0;
 var $1718 = 0, $1719 = 0, $172 = 0, $1720 = 0, $1721 = 0, $1722 = 0, $1723 = 0, $1724 = 0, $1725 = 0, $1726 = 0, $1727 = 0, $1728 = 0, $1729 = 0, $173 = 0, $1730 = 0, $1731 = 0, $1732 = 0, $1733 = 0, $1734 = 0, $1735 = 0;
 var $1736 = 0, $1737 = 0, $1738 = 0, $1739 = 0, $174 = 0, $1740 = 0, $1741 = 0, $1742 = 0, $1743 = 0, $1744 = 0, $1745 = 0, $1746 = 0, $1747 = 0, $1748 = 0, $1749 = 0, $175 = 0, $1750 = 0, $1751 = 0, $1752 = 0, $1753 = 0;
 var $1754 = 0, $1755 = 0, $1756 = 0, $1757 = 0, $1758 = 0, $1759 = 0, $176 = 0, $1760 = 0, $1761 = 0, $1762 = 0, $1763 = 0, $1764 = 0, $1765 = 0, $1766 = 0, $1767 = 0, $1768 = 0, $1769 = 0, $177 = 0, $1770 = 0, $1771 = 0;
 var $1772 = 0, $1773 = 0, $1774 = 0, $1775 = 0, $1776 = 0, $1777 = 0, $1778 = 0, $1779 = 0, $178 = 0, $1780 = 0, $1781 = 0, $1782 = 0, $1783 = 0, $1784 = 0, $1785 = 0, $1786 = 0, $1787 = 0, $1788 = 0, $1789 = 0, $179 = 0;
 var $1790 = 0, $1791 = 0, $1792 = 0, $1793 = 0, $1794 = 0, $1795 = 0, $1796 = 0, $1797 = 0, $1798 = 0, $1799 = 0, $18 = 0, $180 = 0, $1800 = 0, $1801 = 0, $1802 = 0, $1803 = 0, $1804 = 0, $1805 = 0, $1806 = 0, $1807 = 0;
 var $1808 = 0, $1809 = 0, $181 = 0, $1810 = 0, $1811 = 0, $1812 = 0, $1813 = 0, $1814 = 0, $1815 = 0, $1816 = 0, $1817 = 0, $1818 = 0, $1819 = 0, $182 = 0, $1820 = 0, $1821 = 0, $1822 = 0, $1823 = 0, $1824 = 0, $1825 = 0;
 var $1826 = 0, $1827 = 0, $1828 = 0, $1829 = 0, $183 = 0, $1830 = 0, $1831 = 0, $1832 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0;
 var $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0;
 var $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0;
 var $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0;
 var $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0;
 var $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0;
 var $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0;
 var $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0;
 var $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0;
 var $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0;
 var $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0;
 var $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0;
 var $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0;
 var $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0;
 var $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0;
 var $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0;
 var $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0;
 var $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0;
 var $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0;
 var $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0;
 var $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0;
 var $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0;
 var $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0;
 var $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0;
 var $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0;
 var $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0;
 var $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0;
 var $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0;
 var $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0;
 var $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0;
 var $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0;
 var $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0;
 var $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0;
 var $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0;
 var $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0;
 var $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0;
 var $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0;
 var $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0;
 var $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0;
 var $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0;
 var $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0;
 var $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0;
 var $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0;
 var $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0;
 var $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0;
 var $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $exitcond = 0, $exitcond397 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 2048|0;
 $4 = sp + 1024|0;
 $5 = sp;
 _copy_block($4,$1);
 _xor_block($4,$0);
 _copy_block($5,$4);
 $6 = ($3|0)==(0);
 if ($6) {
  $$0396 = 0;
 } else {
  _xor_block($5,$2);
  $$0396 = 0;
 }
 while(1) {
  $7 = $$0396 << 4;
  $8 = (($4) + ($7<<3)|0);
  $9 = $8;
  $10 = $9;
  $11 = HEAP32[$10>>2]|0;
  $12 = (($9) + 4)|0;
  $13 = $12;
  $14 = HEAP32[$13>>2]|0;
  $15 = $7 | 4;
  $16 = (($4) + ($15<<3)|0);
  $17 = $16;
  $18 = $17;
  $19 = HEAP32[$18>>2]|0;
  $20 = (($17) + 4)|0;
  $21 = $20;
  $22 = HEAP32[$21>>2]|0;
  $23 = (_fBlaMka($11,$14,$19,$22)|0);
  $24 = tempRet0;
  $25 = $8;
  $26 = $25;
  HEAP32[$26>>2] = $23;
  $27 = (($25) + 4)|0;
  $28 = $27;
  HEAP32[$28>>2] = $24;
  $29 = $7 | 12;
  $30 = (($4) + ($29<<3)|0);
  $31 = $30;
  $32 = $31;
  $33 = HEAP32[$32>>2]|0;
  $34 = (($31) + 4)|0;
  $35 = $34;
  $36 = HEAP32[$35>>2]|0;
  $37 = $33 ^ $23;
  $38 = $36 ^ $24;
  $39 = (_rotr64_46($37,$38,32)|0);
  $40 = tempRet0;
  $41 = $30;
  $42 = $41;
  HEAP32[$42>>2] = $39;
  $43 = (($41) + 4)|0;
  $44 = $43;
  HEAP32[$44>>2] = $40;
  $45 = $7 | 8;
  $46 = (($4) + ($45<<3)|0);
  $47 = $46;
  $48 = $47;
  $49 = HEAP32[$48>>2]|0;
  $50 = (($47) + 4)|0;
  $51 = $50;
  $52 = HEAP32[$51>>2]|0;
  $53 = (_fBlaMka($49,$52,$39,$40)|0);
  $54 = tempRet0;
  $55 = $46;
  $56 = $55;
  HEAP32[$56>>2] = $53;
  $57 = (($55) + 4)|0;
  $58 = $57;
  HEAP32[$58>>2] = $54;
  $59 = $16;
  $60 = $59;
  $61 = HEAP32[$60>>2]|0;
  $62 = (($59) + 4)|0;
  $63 = $62;
  $64 = HEAP32[$63>>2]|0;
  $65 = $61 ^ $53;
  $66 = $64 ^ $54;
  $67 = (_rotr64_46($65,$66,24)|0);
  $68 = tempRet0;
  $69 = $16;
  $70 = $69;
  HEAP32[$70>>2] = $67;
  $71 = (($69) + 4)|0;
  $72 = $71;
  HEAP32[$72>>2] = $68;
  $73 = $8;
  $74 = $73;
  $75 = HEAP32[$74>>2]|0;
  $76 = (($73) + 4)|0;
  $77 = $76;
  $78 = HEAP32[$77>>2]|0;
  $79 = (_fBlaMka($75,$78,$67,$68)|0);
  $80 = tempRet0;
  $81 = $8;
  $82 = $81;
  HEAP32[$82>>2] = $79;
  $83 = (($81) + 4)|0;
  $84 = $83;
  HEAP32[$84>>2] = $80;
  $85 = $30;
  $86 = $85;
  $87 = HEAP32[$86>>2]|0;
  $88 = (($85) + 4)|0;
  $89 = $88;
  $90 = HEAP32[$89>>2]|0;
  $91 = $87 ^ $79;
  $92 = $90 ^ $80;
  $93 = (_rotr64_46($91,$92,16)|0);
  $94 = tempRet0;
  $95 = $30;
  $96 = $95;
  HEAP32[$96>>2] = $93;
  $97 = (($95) + 4)|0;
  $98 = $97;
  HEAP32[$98>>2] = $94;
  $99 = $46;
  $100 = $99;
  $101 = HEAP32[$100>>2]|0;
  $102 = (($99) + 4)|0;
  $103 = $102;
  $104 = HEAP32[$103>>2]|0;
  $105 = (_fBlaMka($101,$104,$93,$94)|0);
  $106 = tempRet0;
  $107 = $46;
  $108 = $107;
  HEAP32[$108>>2] = $105;
  $109 = (($107) + 4)|0;
  $110 = $109;
  HEAP32[$110>>2] = $106;
  $111 = $16;
  $112 = $111;
  $113 = HEAP32[$112>>2]|0;
  $114 = (($111) + 4)|0;
  $115 = $114;
  $116 = HEAP32[$115>>2]|0;
  $117 = $113 ^ $105;
  $118 = $116 ^ $106;
  $119 = (_rotr64_46($117,$118,63)|0);
  $120 = tempRet0;
  $121 = $16;
  $122 = $121;
  HEAP32[$122>>2] = $119;
  $123 = (($121) + 4)|0;
  $124 = $123;
  HEAP32[$124>>2] = $120;
  $125 = $7 | 1;
  $126 = (($4) + ($125<<3)|0);
  $127 = $126;
  $128 = $127;
  $129 = HEAP32[$128>>2]|0;
  $130 = (($127) + 4)|0;
  $131 = $130;
  $132 = HEAP32[$131>>2]|0;
  $133 = $7 | 5;
  $134 = (($4) + ($133<<3)|0);
  $135 = $134;
  $136 = $135;
  $137 = HEAP32[$136>>2]|0;
  $138 = (($135) + 4)|0;
  $139 = $138;
  $140 = HEAP32[$139>>2]|0;
  $141 = (_fBlaMka($129,$132,$137,$140)|0);
  $142 = tempRet0;
  $143 = $126;
  $144 = $143;
  HEAP32[$144>>2] = $141;
  $145 = (($143) + 4)|0;
  $146 = $145;
  HEAP32[$146>>2] = $142;
  $147 = $7 | 13;
  $148 = (($4) + ($147<<3)|0);
  $149 = $148;
  $150 = $149;
  $151 = HEAP32[$150>>2]|0;
  $152 = (($149) + 4)|0;
  $153 = $152;
  $154 = HEAP32[$153>>2]|0;
  $155 = $151 ^ $141;
  $156 = $154 ^ $142;
  $157 = (_rotr64_46($155,$156,32)|0);
  $158 = tempRet0;
  $159 = $148;
  $160 = $159;
  HEAP32[$160>>2] = $157;
  $161 = (($159) + 4)|0;
  $162 = $161;
  HEAP32[$162>>2] = $158;
  $163 = $7 | 9;
  $164 = (($4) + ($163<<3)|0);
  $165 = $164;
  $166 = $165;
  $167 = HEAP32[$166>>2]|0;
  $168 = (($165) + 4)|0;
  $169 = $168;
  $170 = HEAP32[$169>>2]|0;
  $171 = (_fBlaMka($167,$170,$157,$158)|0);
  $172 = tempRet0;
  $173 = $164;
  $174 = $173;
  HEAP32[$174>>2] = $171;
  $175 = (($173) + 4)|0;
  $176 = $175;
  HEAP32[$176>>2] = $172;
  $177 = $134;
  $178 = $177;
  $179 = HEAP32[$178>>2]|0;
  $180 = (($177) + 4)|0;
  $181 = $180;
  $182 = HEAP32[$181>>2]|0;
  $183 = $179 ^ $171;
  $184 = $182 ^ $172;
  $185 = (_rotr64_46($183,$184,24)|0);
  $186 = tempRet0;
  $187 = $134;
  $188 = $187;
  HEAP32[$188>>2] = $185;
  $189 = (($187) + 4)|0;
  $190 = $189;
  HEAP32[$190>>2] = $186;
  $191 = $126;
  $192 = $191;
  $193 = HEAP32[$192>>2]|0;
  $194 = (($191) + 4)|0;
  $195 = $194;
  $196 = HEAP32[$195>>2]|0;
  $197 = (_fBlaMka($193,$196,$185,$186)|0);
  $198 = tempRet0;
  $199 = $126;
  $200 = $199;
  HEAP32[$200>>2] = $197;
  $201 = (($199) + 4)|0;
  $202 = $201;
  HEAP32[$202>>2] = $198;
  $203 = $148;
  $204 = $203;
  $205 = HEAP32[$204>>2]|0;
  $206 = (($203) + 4)|0;
  $207 = $206;
  $208 = HEAP32[$207>>2]|0;
  $209 = $205 ^ $197;
  $210 = $208 ^ $198;
  $211 = (_rotr64_46($209,$210,16)|0);
  $212 = tempRet0;
  $213 = $148;
  $214 = $213;
  HEAP32[$214>>2] = $211;
  $215 = (($213) + 4)|0;
  $216 = $215;
  HEAP32[$216>>2] = $212;
  $217 = $164;
  $218 = $217;
  $219 = HEAP32[$218>>2]|0;
  $220 = (($217) + 4)|0;
  $221 = $220;
  $222 = HEAP32[$221>>2]|0;
  $223 = (_fBlaMka($219,$222,$211,$212)|0);
  $224 = tempRet0;
  $225 = $164;
  $226 = $225;
  HEAP32[$226>>2] = $223;
  $227 = (($225) + 4)|0;
  $228 = $227;
  HEAP32[$228>>2] = $224;
  $229 = $134;
  $230 = $229;
  $231 = HEAP32[$230>>2]|0;
  $232 = (($229) + 4)|0;
  $233 = $232;
  $234 = HEAP32[$233>>2]|0;
  $235 = $231 ^ $223;
  $236 = $234 ^ $224;
  $237 = (_rotr64_46($235,$236,63)|0);
  $238 = tempRet0;
  $239 = $134;
  $240 = $239;
  HEAP32[$240>>2] = $237;
  $241 = (($239) + 4)|0;
  $242 = $241;
  HEAP32[$242>>2] = $238;
  $243 = $7 | 2;
  $244 = (($4) + ($243<<3)|0);
  $245 = $244;
  $246 = $245;
  $247 = HEAP32[$246>>2]|0;
  $248 = (($245) + 4)|0;
  $249 = $248;
  $250 = HEAP32[$249>>2]|0;
  $251 = $7 | 6;
  $252 = (($4) + ($251<<3)|0);
  $253 = $252;
  $254 = $253;
  $255 = HEAP32[$254>>2]|0;
  $256 = (($253) + 4)|0;
  $257 = $256;
  $258 = HEAP32[$257>>2]|0;
  $259 = (_fBlaMka($247,$250,$255,$258)|0);
  $260 = tempRet0;
  $261 = $244;
  $262 = $261;
  HEAP32[$262>>2] = $259;
  $263 = (($261) + 4)|0;
  $264 = $263;
  HEAP32[$264>>2] = $260;
  $265 = $7 | 14;
  $266 = (($4) + ($265<<3)|0);
  $267 = $266;
  $268 = $267;
  $269 = HEAP32[$268>>2]|0;
  $270 = (($267) + 4)|0;
  $271 = $270;
  $272 = HEAP32[$271>>2]|0;
  $273 = $269 ^ $259;
  $274 = $272 ^ $260;
  $275 = (_rotr64_46($273,$274,32)|0);
  $276 = tempRet0;
  $277 = $266;
  $278 = $277;
  HEAP32[$278>>2] = $275;
  $279 = (($277) + 4)|0;
  $280 = $279;
  HEAP32[$280>>2] = $276;
  $281 = $7 | 10;
  $282 = (($4) + ($281<<3)|0);
  $283 = $282;
  $284 = $283;
  $285 = HEAP32[$284>>2]|0;
  $286 = (($283) + 4)|0;
  $287 = $286;
  $288 = HEAP32[$287>>2]|0;
  $289 = (_fBlaMka($285,$288,$275,$276)|0);
  $290 = tempRet0;
  $291 = $282;
  $292 = $291;
  HEAP32[$292>>2] = $289;
  $293 = (($291) + 4)|0;
  $294 = $293;
  HEAP32[$294>>2] = $290;
  $295 = $252;
  $296 = $295;
  $297 = HEAP32[$296>>2]|0;
  $298 = (($295) + 4)|0;
  $299 = $298;
  $300 = HEAP32[$299>>2]|0;
  $301 = $297 ^ $289;
  $302 = $300 ^ $290;
  $303 = (_rotr64_46($301,$302,24)|0);
  $304 = tempRet0;
  $305 = $252;
  $306 = $305;
  HEAP32[$306>>2] = $303;
  $307 = (($305) + 4)|0;
  $308 = $307;
  HEAP32[$308>>2] = $304;
  $309 = $244;
  $310 = $309;
  $311 = HEAP32[$310>>2]|0;
  $312 = (($309) + 4)|0;
  $313 = $312;
  $314 = HEAP32[$313>>2]|0;
  $315 = (_fBlaMka($311,$314,$303,$304)|0);
  $316 = tempRet0;
  $317 = $244;
  $318 = $317;
  HEAP32[$318>>2] = $315;
  $319 = (($317) + 4)|0;
  $320 = $319;
  HEAP32[$320>>2] = $316;
  $321 = $266;
  $322 = $321;
  $323 = HEAP32[$322>>2]|0;
  $324 = (($321) + 4)|0;
  $325 = $324;
  $326 = HEAP32[$325>>2]|0;
  $327 = $323 ^ $315;
  $328 = $326 ^ $316;
  $329 = (_rotr64_46($327,$328,16)|0);
  $330 = tempRet0;
  $331 = $266;
  $332 = $331;
  HEAP32[$332>>2] = $329;
  $333 = (($331) + 4)|0;
  $334 = $333;
  HEAP32[$334>>2] = $330;
  $335 = $282;
  $336 = $335;
  $337 = HEAP32[$336>>2]|0;
  $338 = (($335) + 4)|0;
  $339 = $338;
  $340 = HEAP32[$339>>2]|0;
  $341 = (_fBlaMka($337,$340,$329,$330)|0);
  $342 = tempRet0;
  $343 = $282;
  $344 = $343;
  HEAP32[$344>>2] = $341;
  $345 = (($343) + 4)|0;
  $346 = $345;
  HEAP32[$346>>2] = $342;
  $347 = $252;
  $348 = $347;
  $349 = HEAP32[$348>>2]|0;
  $350 = (($347) + 4)|0;
  $351 = $350;
  $352 = HEAP32[$351>>2]|0;
  $353 = $349 ^ $341;
  $354 = $352 ^ $342;
  $355 = (_rotr64_46($353,$354,63)|0);
  $356 = tempRet0;
  $357 = $252;
  $358 = $357;
  HEAP32[$358>>2] = $355;
  $359 = (($357) + 4)|0;
  $360 = $359;
  HEAP32[$360>>2] = $356;
  $361 = $7 | 3;
  $362 = (($4) + ($361<<3)|0);
  $363 = $362;
  $364 = $363;
  $365 = HEAP32[$364>>2]|0;
  $366 = (($363) + 4)|0;
  $367 = $366;
  $368 = HEAP32[$367>>2]|0;
  $369 = $7 | 7;
  $370 = (($4) + ($369<<3)|0);
  $371 = $370;
  $372 = $371;
  $373 = HEAP32[$372>>2]|0;
  $374 = (($371) + 4)|0;
  $375 = $374;
  $376 = HEAP32[$375>>2]|0;
  $377 = (_fBlaMka($365,$368,$373,$376)|0);
  $378 = tempRet0;
  $379 = $362;
  $380 = $379;
  HEAP32[$380>>2] = $377;
  $381 = (($379) + 4)|0;
  $382 = $381;
  HEAP32[$382>>2] = $378;
  $383 = $7 | 15;
  $384 = (($4) + ($383<<3)|0);
  $385 = $384;
  $386 = $385;
  $387 = HEAP32[$386>>2]|0;
  $388 = (($385) + 4)|0;
  $389 = $388;
  $390 = HEAP32[$389>>2]|0;
  $391 = $387 ^ $377;
  $392 = $390 ^ $378;
  $393 = (_rotr64_46($391,$392,32)|0);
  $394 = tempRet0;
  $395 = $384;
  $396 = $395;
  HEAP32[$396>>2] = $393;
  $397 = (($395) + 4)|0;
  $398 = $397;
  HEAP32[$398>>2] = $394;
  $399 = $7 | 11;
  $400 = (($4) + ($399<<3)|0);
  $401 = $400;
  $402 = $401;
  $403 = HEAP32[$402>>2]|0;
  $404 = (($401) + 4)|0;
  $405 = $404;
  $406 = HEAP32[$405>>2]|0;
  $407 = (_fBlaMka($403,$406,$393,$394)|0);
  $408 = tempRet0;
  $409 = $400;
  $410 = $409;
  HEAP32[$410>>2] = $407;
  $411 = (($409) + 4)|0;
  $412 = $411;
  HEAP32[$412>>2] = $408;
  $413 = $370;
  $414 = $413;
  $415 = HEAP32[$414>>2]|0;
  $416 = (($413) + 4)|0;
  $417 = $416;
  $418 = HEAP32[$417>>2]|0;
  $419 = $415 ^ $407;
  $420 = $418 ^ $408;
  $421 = (_rotr64_46($419,$420,24)|0);
  $422 = tempRet0;
  $423 = $370;
  $424 = $423;
  HEAP32[$424>>2] = $421;
  $425 = (($423) + 4)|0;
  $426 = $425;
  HEAP32[$426>>2] = $422;
  $427 = $362;
  $428 = $427;
  $429 = HEAP32[$428>>2]|0;
  $430 = (($427) + 4)|0;
  $431 = $430;
  $432 = HEAP32[$431>>2]|0;
  $433 = (_fBlaMka($429,$432,$421,$422)|0);
  $434 = tempRet0;
  $435 = $362;
  $436 = $435;
  HEAP32[$436>>2] = $433;
  $437 = (($435) + 4)|0;
  $438 = $437;
  HEAP32[$438>>2] = $434;
  $439 = $384;
  $440 = $439;
  $441 = HEAP32[$440>>2]|0;
  $442 = (($439) + 4)|0;
  $443 = $442;
  $444 = HEAP32[$443>>2]|0;
  $445 = $441 ^ $433;
  $446 = $444 ^ $434;
  $447 = (_rotr64_46($445,$446,16)|0);
  $448 = tempRet0;
  $449 = $384;
  $450 = $449;
  HEAP32[$450>>2] = $447;
  $451 = (($449) + 4)|0;
  $452 = $451;
  HEAP32[$452>>2] = $448;
  $453 = $400;
  $454 = $453;
  $455 = HEAP32[$454>>2]|0;
  $456 = (($453) + 4)|0;
  $457 = $456;
  $458 = HEAP32[$457>>2]|0;
  $459 = (_fBlaMka($455,$458,$447,$448)|0);
  $460 = tempRet0;
  $461 = $400;
  $462 = $461;
  HEAP32[$462>>2] = $459;
  $463 = (($461) + 4)|0;
  $464 = $463;
  HEAP32[$464>>2] = $460;
  $465 = $370;
  $466 = $465;
  $467 = HEAP32[$466>>2]|0;
  $468 = (($465) + 4)|0;
  $469 = $468;
  $470 = HEAP32[$469>>2]|0;
  $471 = $467 ^ $459;
  $472 = $470 ^ $460;
  $473 = (_rotr64_46($471,$472,63)|0);
  $474 = tempRet0;
  $475 = $370;
  $476 = $475;
  HEAP32[$476>>2] = $473;
  $477 = (($475) + 4)|0;
  $478 = $477;
  HEAP32[$478>>2] = $474;
  $479 = $8;
  $480 = $479;
  $481 = HEAP32[$480>>2]|0;
  $482 = (($479) + 4)|0;
  $483 = $482;
  $484 = HEAP32[$483>>2]|0;
  $485 = $134;
  $486 = $485;
  $487 = HEAP32[$486>>2]|0;
  $488 = (($485) + 4)|0;
  $489 = $488;
  $490 = HEAP32[$489>>2]|0;
  $491 = (_fBlaMka($481,$484,$487,$490)|0);
  $492 = tempRet0;
  $493 = $8;
  $494 = $493;
  HEAP32[$494>>2] = $491;
  $495 = (($493) + 4)|0;
  $496 = $495;
  HEAP32[$496>>2] = $492;
  $497 = $384;
  $498 = $497;
  $499 = HEAP32[$498>>2]|0;
  $500 = (($497) + 4)|0;
  $501 = $500;
  $502 = HEAP32[$501>>2]|0;
  $503 = $499 ^ $491;
  $504 = $502 ^ $492;
  $505 = (_rotr64_46($503,$504,32)|0);
  $506 = tempRet0;
  $507 = $384;
  $508 = $507;
  HEAP32[$508>>2] = $505;
  $509 = (($507) + 4)|0;
  $510 = $509;
  HEAP32[$510>>2] = $506;
  $511 = $282;
  $512 = $511;
  $513 = HEAP32[$512>>2]|0;
  $514 = (($511) + 4)|0;
  $515 = $514;
  $516 = HEAP32[$515>>2]|0;
  $517 = (_fBlaMka($513,$516,$505,$506)|0);
  $518 = tempRet0;
  $519 = $282;
  $520 = $519;
  HEAP32[$520>>2] = $517;
  $521 = (($519) + 4)|0;
  $522 = $521;
  HEAP32[$522>>2] = $518;
  $523 = $134;
  $524 = $523;
  $525 = HEAP32[$524>>2]|0;
  $526 = (($523) + 4)|0;
  $527 = $526;
  $528 = HEAP32[$527>>2]|0;
  $529 = $525 ^ $517;
  $530 = $528 ^ $518;
  $531 = (_rotr64_46($529,$530,24)|0);
  $532 = tempRet0;
  $533 = $134;
  $534 = $533;
  HEAP32[$534>>2] = $531;
  $535 = (($533) + 4)|0;
  $536 = $535;
  HEAP32[$536>>2] = $532;
  $537 = $8;
  $538 = $537;
  $539 = HEAP32[$538>>2]|0;
  $540 = (($537) + 4)|0;
  $541 = $540;
  $542 = HEAP32[$541>>2]|0;
  $543 = (_fBlaMka($539,$542,$531,$532)|0);
  $544 = tempRet0;
  $545 = $8;
  $546 = $545;
  HEAP32[$546>>2] = $543;
  $547 = (($545) + 4)|0;
  $548 = $547;
  HEAP32[$548>>2] = $544;
  $549 = $384;
  $550 = $549;
  $551 = HEAP32[$550>>2]|0;
  $552 = (($549) + 4)|0;
  $553 = $552;
  $554 = HEAP32[$553>>2]|0;
  $555 = $551 ^ $543;
  $556 = $554 ^ $544;
  $557 = (_rotr64_46($555,$556,16)|0);
  $558 = tempRet0;
  $559 = $384;
  $560 = $559;
  HEAP32[$560>>2] = $557;
  $561 = (($559) + 4)|0;
  $562 = $561;
  HEAP32[$562>>2] = $558;
  $563 = $282;
  $564 = $563;
  $565 = HEAP32[$564>>2]|0;
  $566 = (($563) + 4)|0;
  $567 = $566;
  $568 = HEAP32[$567>>2]|0;
  $569 = (_fBlaMka($565,$568,$557,$558)|0);
  $570 = tempRet0;
  $571 = $282;
  $572 = $571;
  HEAP32[$572>>2] = $569;
  $573 = (($571) + 4)|0;
  $574 = $573;
  HEAP32[$574>>2] = $570;
  $575 = $134;
  $576 = $575;
  $577 = HEAP32[$576>>2]|0;
  $578 = (($575) + 4)|0;
  $579 = $578;
  $580 = HEAP32[$579>>2]|0;
  $581 = $577 ^ $569;
  $582 = $580 ^ $570;
  $583 = (_rotr64_46($581,$582,63)|0);
  $584 = tempRet0;
  $585 = $134;
  $586 = $585;
  HEAP32[$586>>2] = $583;
  $587 = (($585) + 4)|0;
  $588 = $587;
  HEAP32[$588>>2] = $584;
  $589 = $126;
  $590 = $589;
  $591 = HEAP32[$590>>2]|0;
  $592 = (($589) + 4)|0;
  $593 = $592;
  $594 = HEAP32[$593>>2]|0;
  $595 = $252;
  $596 = $595;
  $597 = HEAP32[$596>>2]|0;
  $598 = (($595) + 4)|0;
  $599 = $598;
  $600 = HEAP32[$599>>2]|0;
  $601 = (_fBlaMka($591,$594,$597,$600)|0);
  $602 = tempRet0;
  $603 = $126;
  $604 = $603;
  HEAP32[$604>>2] = $601;
  $605 = (($603) + 4)|0;
  $606 = $605;
  HEAP32[$606>>2] = $602;
  $607 = $30;
  $608 = $607;
  $609 = HEAP32[$608>>2]|0;
  $610 = (($607) + 4)|0;
  $611 = $610;
  $612 = HEAP32[$611>>2]|0;
  $613 = $609 ^ $601;
  $614 = $612 ^ $602;
  $615 = (_rotr64_46($613,$614,32)|0);
  $616 = tempRet0;
  $617 = $30;
  $618 = $617;
  HEAP32[$618>>2] = $615;
  $619 = (($617) + 4)|0;
  $620 = $619;
  HEAP32[$620>>2] = $616;
  $621 = $400;
  $622 = $621;
  $623 = HEAP32[$622>>2]|0;
  $624 = (($621) + 4)|0;
  $625 = $624;
  $626 = HEAP32[$625>>2]|0;
  $627 = (_fBlaMka($623,$626,$615,$616)|0);
  $628 = tempRet0;
  $629 = $400;
  $630 = $629;
  HEAP32[$630>>2] = $627;
  $631 = (($629) + 4)|0;
  $632 = $631;
  HEAP32[$632>>2] = $628;
  $633 = $252;
  $634 = $633;
  $635 = HEAP32[$634>>2]|0;
  $636 = (($633) + 4)|0;
  $637 = $636;
  $638 = HEAP32[$637>>2]|0;
  $639 = $635 ^ $627;
  $640 = $638 ^ $628;
  $641 = (_rotr64_46($639,$640,24)|0);
  $642 = tempRet0;
  $643 = $252;
  $644 = $643;
  HEAP32[$644>>2] = $641;
  $645 = (($643) + 4)|0;
  $646 = $645;
  HEAP32[$646>>2] = $642;
  $647 = $126;
  $648 = $647;
  $649 = HEAP32[$648>>2]|0;
  $650 = (($647) + 4)|0;
  $651 = $650;
  $652 = HEAP32[$651>>2]|0;
  $653 = (_fBlaMka($649,$652,$641,$642)|0);
  $654 = tempRet0;
  $655 = $126;
  $656 = $655;
  HEAP32[$656>>2] = $653;
  $657 = (($655) + 4)|0;
  $658 = $657;
  HEAP32[$658>>2] = $654;
  $659 = $30;
  $660 = $659;
  $661 = HEAP32[$660>>2]|0;
  $662 = (($659) + 4)|0;
  $663 = $662;
  $664 = HEAP32[$663>>2]|0;
  $665 = $661 ^ $653;
  $666 = $664 ^ $654;
  $667 = (_rotr64_46($665,$666,16)|0);
  $668 = tempRet0;
  $669 = $30;
  $670 = $669;
  HEAP32[$670>>2] = $667;
  $671 = (($669) + 4)|0;
  $672 = $671;
  HEAP32[$672>>2] = $668;
  $673 = $400;
  $674 = $673;
  $675 = HEAP32[$674>>2]|0;
  $676 = (($673) + 4)|0;
  $677 = $676;
  $678 = HEAP32[$677>>2]|0;
  $679 = (_fBlaMka($675,$678,$667,$668)|0);
  $680 = tempRet0;
  $681 = $400;
  $682 = $681;
  HEAP32[$682>>2] = $679;
  $683 = (($681) + 4)|0;
  $684 = $683;
  HEAP32[$684>>2] = $680;
  $685 = $252;
  $686 = $685;
  $687 = HEAP32[$686>>2]|0;
  $688 = (($685) + 4)|0;
  $689 = $688;
  $690 = HEAP32[$689>>2]|0;
  $691 = $687 ^ $679;
  $692 = $690 ^ $680;
  $693 = (_rotr64_46($691,$692,63)|0);
  $694 = tempRet0;
  $695 = $252;
  $696 = $695;
  HEAP32[$696>>2] = $693;
  $697 = (($695) + 4)|0;
  $698 = $697;
  HEAP32[$698>>2] = $694;
  $699 = $244;
  $700 = $699;
  $701 = HEAP32[$700>>2]|0;
  $702 = (($699) + 4)|0;
  $703 = $702;
  $704 = HEAP32[$703>>2]|0;
  $705 = $370;
  $706 = $705;
  $707 = HEAP32[$706>>2]|0;
  $708 = (($705) + 4)|0;
  $709 = $708;
  $710 = HEAP32[$709>>2]|0;
  $711 = (_fBlaMka($701,$704,$707,$710)|0);
  $712 = tempRet0;
  $713 = $244;
  $714 = $713;
  HEAP32[$714>>2] = $711;
  $715 = (($713) + 4)|0;
  $716 = $715;
  HEAP32[$716>>2] = $712;
  $717 = $148;
  $718 = $717;
  $719 = HEAP32[$718>>2]|0;
  $720 = (($717) + 4)|0;
  $721 = $720;
  $722 = HEAP32[$721>>2]|0;
  $723 = $719 ^ $711;
  $724 = $722 ^ $712;
  $725 = (_rotr64_46($723,$724,32)|0);
  $726 = tempRet0;
  $727 = $148;
  $728 = $727;
  HEAP32[$728>>2] = $725;
  $729 = (($727) + 4)|0;
  $730 = $729;
  HEAP32[$730>>2] = $726;
  $731 = $46;
  $732 = $731;
  $733 = HEAP32[$732>>2]|0;
  $734 = (($731) + 4)|0;
  $735 = $734;
  $736 = HEAP32[$735>>2]|0;
  $737 = (_fBlaMka($733,$736,$725,$726)|0);
  $738 = tempRet0;
  $739 = $46;
  $740 = $739;
  HEAP32[$740>>2] = $737;
  $741 = (($739) + 4)|0;
  $742 = $741;
  HEAP32[$742>>2] = $738;
  $743 = $370;
  $744 = $743;
  $745 = HEAP32[$744>>2]|0;
  $746 = (($743) + 4)|0;
  $747 = $746;
  $748 = HEAP32[$747>>2]|0;
  $749 = $745 ^ $737;
  $750 = $748 ^ $738;
  $751 = (_rotr64_46($749,$750,24)|0);
  $752 = tempRet0;
  $753 = $370;
  $754 = $753;
  HEAP32[$754>>2] = $751;
  $755 = (($753) + 4)|0;
  $756 = $755;
  HEAP32[$756>>2] = $752;
  $757 = $244;
  $758 = $757;
  $759 = HEAP32[$758>>2]|0;
  $760 = (($757) + 4)|0;
  $761 = $760;
  $762 = HEAP32[$761>>2]|0;
  $763 = (_fBlaMka($759,$762,$751,$752)|0);
  $764 = tempRet0;
  $765 = $244;
  $766 = $765;
  HEAP32[$766>>2] = $763;
  $767 = (($765) + 4)|0;
  $768 = $767;
  HEAP32[$768>>2] = $764;
  $769 = $148;
  $770 = $769;
  $771 = HEAP32[$770>>2]|0;
  $772 = (($769) + 4)|0;
  $773 = $772;
  $774 = HEAP32[$773>>2]|0;
  $775 = $771 ^ $763;
  $776 = $774 ^ $764;
  $777 = (_rotr64_46($775,$776,16)|0);
  $778 = tempRet0;
  $779 = $148;
  $780 = $779;
  HEAP32[$780>>2] = $777;
  $781 = (($779) + 4)|0;
  $782 = $781;
  HEAP32[$782>>2] = $778;
  $783 = $46;
  $784 = $783;
  $785 = HEAP32[$784>>2]|0;
  $786 = (($783) + 4)|0;
  $787 = $786;
  $788 = HEAP32[$787>>2]|0;
  $789 = (_fBlaMka($785,$788,$777,$778)|0);
  $790 = tempRet0;
  $791 = $46;
  $792 = $791;
  HEAP32[$792>>2] = $789;
  $793 = (($791) + 4)|0;
  $794 = $793;
  HEAP32[$794>>2] = $790;
  $795 = $370;
  $796 = $795;
  $797 = HEAP32[$796>>2]|0;
  $798 = (($795) + 4)|0;
  $799 = $798;
  $800 = HEAP32[$799>>2]|0;
  $801 = $797 ^ $789;
  $802 = $800 ^ $790;
  $803 = (_rotr64_46($801,$802,63)|0);
  $804 = tempRet0;
  $805 = $370;
  $806 = $805;
  HEAP32[$806>>2] = $803;
  $807 = (($805) + 4)|0;
  $808 = $807;
  HEAP32[$808>>2] = $804;
  $809 = $362;
  $810 = $809;
  $811 = HEAP32[$810>>2]|0;
  $812 = (($809) + 4)|0;
  $813 = $812;
  $814 = HEAP32[$813>>2]|0;
  $815 = $16;
  $816 = $815;
  $817 = HEAP32[$816>>2]|0;
  $818 = (($815) + 4)|0;
  $819 = $818;
  $820 = HEAP32[$819>>2]|0;
  $821 = (_fBlaMka($811,$814,$817,$820)|0);
  $822 = tempRet0;
  $823 = $362;
  $824 = $823;
  HEAP32[$824>>2] = $821;
  $825 = (($823) + 4)|0;
  $826 = $825;
  HEAP32[$826>>2] = $822;
  $827 = $266;
  $828 = $827;
  $829 = HEAP32[$828>>2]|0;
  $830 = (($827) + 4)|0;
  $831 = $830;
  $832 = HEAP32[$831>>2]|0;
  $833 = $829 ^ $821;
  $834 = $832 ^ $822;
  $835 = (_rotr64_46($833,$834,32)|0);
  $836 = tempRet0;
  $837 = $266;
  $838 = $837;
  HEAP32[$838>>2] = $835;
  $839 = (($837) + 4)|0;
  $840 = $839;
  HEAP32[$840>>2] = $836;
  $841 = $164;
  $842 = $841;
  $843 = HEAP32[$842>>2]|0;
  $844 = (($841) + 4)|0;
  $845 = $844;
  $846 = HEAP32[$845>>2]|0;
  $847 = (_fBlaMka($843,$846,$835,$836)|0);
  $848 = tempRet0;
  $849 = $164;
  $850 = $849;
  HEAP32[$850>>2] = $847;
  $851 = (($849) + 4)|0;
  $852 = $851;
  HEAP32[$852>>2] = $848;
  $853 = $16;
  $854 = $853;
  $855 = HEAP32[$854>>2]|0;
  $856 = (($853) + 4)|0;
  $857 = $856;
  $858 = HEAP32[$857>>2]|0;
  $859 = $855 ^ $847;
  $860 = $858 ^ $848;
  $861 = (_rotr64_46($859,$860,24)|0);
  $862 = tempRet0;
  $863 = $16;
  $864 = $863;
  HEAP32[$864>>2] = $861;
  $865 = (($863) + 4)|0;
  $866 = $865;
  HEAP32[$866>>2] = $862;
  $867 = $362;
  $868 = $867;
  $869 = HEAP32[$868>>2]|0;
  $870 = (($867) + 4)|0;
  $871 = $870;
  $872 = HEAP32[$871>>2]|0;
  $873 = (_fBlaMka($869,$872,$861,$862)|0);
  $874 = tempRet0;
  $875 = $362;
  $876 = $875;
  HEAP32[$876>>2] = $873;
  $877 = (($875) + 4)|0;
  $878 = $877;
  HEAP32[$878>>2] = $874;
  $879 = $266;
  $880 = $879;
  $881 = HEAP32[$880>>2]|0;
  $882 = (($879) + 4)|0;
  $883 = $882;
  $884 = HEAP32[$883>>2]|0;
  $885 = $881 ^ $873;
  $886 = $884 ^ $874;
  $887 = (_rotr64_46($885,$886,16)|0);
  $888 = tempRet0;
  $889 = $266;
  $890 = $889;
  HEAP32[$890>>2] = $887;
  $891 = (($889) + 4)|0;
  $892 = $891;
  HEAP32[$892>>2] = $888;
  $893 = $164;
  $894 = $893;
  $895 = HEAP32[$894>>2]|0;
  $896 = (($893) + 4)|0;
  $897 = $896;
  $898 = HEAP32[$897>>2]|0;
  $899 = (_fBlaMka($895,$898,$887,$888)|0);
  $900 = tempRet0;
  $901 = $164;
  $902 = $901;
  HEAP32[$902>>2] = $899;
  $903 = (($901) + 4)|0;
  $904 = $903;
  HEAP32[$904>>2] = $900;
  $905 = $16;
  $906 = $905;
  $907 = HEAP32[$906>>2]|0;
  $908 = (($905) + 4)|0;
  $909 = $908;
  $910 = HEAP32[$909>>2]|0;
  $911 = $907 ^ $899;
  $912 = $910 ^ $900;
  $913 = (_rotr64_46($911,$912,63)|0);
  $914 = tempRet0;
  $915 = $16;
  $916 = $915;
  HEAP32[$916>>2] = $913;
  $917 = (($915) + 4)|0;
  $918 = $917;
  HEAP32[$918>>2] = $914;
  $919 = (($$0396) + 1)|0;
  $exitcond397 = ($919|0)==(8);
  if ($exitcond397) {
   $$1395 = 0;
   break;
  } else {
   $$0396 = $919;
  }
 }
 while(1) {
  $920 = $$1395 << 1;
  $921 = (($4) + ($920<<3)|0);
  $922 = $921;
  $923 = $922;
  $924 = HEAP32[$923>>2]|0;
  $925 = (($922) + 4)|0;
  $926 = $925;
  $927 = HEAP32[$926>>2]|0;
  $928 = (($920) + 32)|0;
  $929 = (($4) + ($928<<3)|0);
  $930 = $929;
  $931 = $930;
  $932 = HEAP32[$931>>2]|0;
  $933 = (($930) + 4)|0;
  $934 = $933;
  $935 = HEAP32[$934>>2]|0;
  $936 = (_fBlaMka($924,$927,$932,$935)|0);
  $937 = tempRet0;
  $938 = $921;
  $939 = $938;
  HEAP32[$939>>2] = $936;
  $940 = (($938) + 4)|0;
  $941 = $940;
  HEAP32[$941>>2] = $937;
  $942 = (($920) + 96)|0;
  $943 = (($4) + ($942<<3)|0);
  $944 = $943;
  $945 = $944;
  $946 = HEAP32[$945>>2]|0;
  $947 = (($944) + 4)|0;
  $948 = $947;
  $949 = HEAP32[$948>>2]|0;
  $950 = $946 ^ $936;
  $951 = $949 ^ $937;
  $952 = (_rotr64_46($950,$951,32)|0);
  $953 = tempRet0;
  $954 = $943;
  $955 = $954;
  HEAP32[$955>>2] = $952;
  $956 = (($954) + 4)|0;
  $957 = $956;
  HEAP32[$957>>2] = $953;
  $958 = (($920) + 64)|0;
  $959 = (($4) + ($958<<3)|0);
  $960 = $959;
  $961 = $960;
  $962 = HEAP32[$961>>2]|0;
  $963 = (($960) + 4)|0;
  $964 = $963;
  $965 = HEAP32[$964>>2]|0;
  $966 = (_fBlaMka($962,$965,$952,$953)|0);
  $967 = tempRet0;
  $968 = $959;
  $969 = $968;
  HEAP32[$969>>2] = $966;
  $970 = (($968) + 4)|0;
  $971 = $970;
  HEAP32[$971>>2] = $967;
  $972 = $929;
  $973 = $972;
  $974 = HEAP32[$973>>2]|0;
  $975 = (($972) + 4)|0;
  $976 = $975;
  $977 = HEAP32[$976>>2]|0;
  $978 = $974 ^ $966;
  $979 = $977 ^ $967;
  $980 = (_rotr64_46($978,$979,24)|0);
  $981 = tempRet0;
  $982 = $929;
  $983 = $982;
  HEAP32[$983>>2] = $980;
  $984 = (($982) + 4)|0;
  $985 = $984;
  HEAP32[$985>>2] = $981;
  $986 = $921;
  $987 = $986;
  $988 = HEAP32[$987>>2]|0;
  $989 = (($986) + 4)|0;
  $990 = $989;
  $991 = HEAP32[$990>>2]|0;
  $992 = (_fBlaMka($988,$991,$980,$981)|0);
  $993 = tempRet0;
  $994 = $921;
  $995 = $994;
  HEAP32[$995>>2] = $992;
  $996 = (($994) + 4)|0;
  $997 = $996;
  HEAP32[$997>>2] = $993;
  $998 = $943;
  $999 = $998;
  $1000 = HEAP32[$999>>2]|0;
  $1001 = (($998) + 4)|0;
  $1002 = $1001;
  $1003 = HEAP32[$1002>>2]|0;
  $1004 = $1000 ^ $992;
  $1005 = $1003 ^ $993;
  $1006 = (_rotr64_46($1004,$1005,16)|0);
  $1007 = tempRet0;
  $1008 = $943;
  $1009 = $1008;
  HEAP32[$1009>>2] = $1006;
  $1010 = (($1008) + 4)|0;
  $1011 = $1010;
  HEAP32[$1011>>2] = $1007;
  $1012 = $959;
  $1013 = $1012;
  $1014 = HEAP32[$1013>>2]|0;
  $1015 = (($1012) + 4)|0;
  $1016 = $1015;
  $1017 = HEAP32[$1016>>2]|0;
  $1018 = (_fBlaMka($1014,$1017,$1006,$1007)|0);
  $1019 = tempRet0;
  $1020 = $959;
  $1021 = $1020;
  HEAP32[$1021>>2] = $1018;
  $1022 = (($1020) + 4)|0;
  $1023 = $1022;
  HEAP32[$1023>>2] = $1019;
  $1024 = $929;
  $1025 = $1024;
  $1026 = HEAP32[$1025>>2]|0;
  $1027 = (($1024) + 4)|0;
  $1028 = $1027;
  $1029 = HEAP32[$1028>>2]|0;
  $1030 = $1026 ^ $1018;
  $1031 = $1029 ^ $1019;
  $1032 = (_rotr64_46($1030,$1031,63)|0);
  $1033 = tempRet0;
  $1034 = $929;
  $1035 = $1034;
  HEAP32[$1035>>2] = $1032;
  $1036 = (($1034) + 4)|0;
  $1037 = $1036;
  HEAP32[$1037>>2] = $1033;
  $1038 = $920 | 1;
  $1039 = (($4) + ($1038<<3)|0);
  $1040 = $1039;
  $1041 = $1040;
  $1042 = HEAP32[$1041>>2]|0;
  $1043 = (($1040) + 4)|0;
  $1044 = $1043;
  $1045 = HEAP32[$1044>>2]|0;
  $1046 = (($920) + 33)|0;
  $1047 = (($4) + ($1046<<3)|0);
  $1048 = $1047;
  $1049 = $1048;
  $1050 = HEAP32[$1049>>2]|0;
  $1051 = (($1048) + 4)|0;
  $1052 = $1051;
  $1053 = HEAP32[$1052>>2]|0;
  $1054 = (_fBlaMka($1042,$1045,$1050,$1053)|0);
  $1055 = tempRet0;
  $1056 = $1039;
  $1057 = $1056;
  HEAP32[$1057>>2] = $1054;
  $1058 = (($1056) + 4)|0;
  $1059 = $1058;
  HEAP32[$1059>>2] = $1055;
  $1060 = (($920) + 97)|0;
  $1061 = (($4) + ($1060<<3)|0);
  $1062 = $1061;
  $1063 = $1062;
  $1064 = HEAP32[$1063>>2]|0;
  $1065 = (($1062) + 4)|0;
  $1066 = $1065;
  $1067 = HEAP32[$1066>>2]|0;
  $1068 = $1064 ^ $1054;
  $1069 = $1067 ^ $1055;
  $1070 = (_rotr64_46($1068,$1069,32)|0);
  $1071 = tempRet0;
  $1072 = $1061;
  $1073 = $1072;
  HEAP32[$1073>>2] = $1070;
  $1074 = (($1072) + 4)|0;
  $1075 = $1074;
  HEAP32[$1075>>2] = $1071;
  $1076 = (($920) + 65)|0;
  $1077 = (($4) + ($1076<<3)|0);
  $1078 = $1077;
  $1079 = $1078;
  $1080 = HEAP32[$1079>>2]|0;
  $1081 = (($1078) + 4)|0;
  $1082 = $1081;
  $1083 = HEAP32[$1082>>2]|0;
  $1084 = (_fBlaMka($1080,$1083,$1070,$1071)|0);
  $1085 = tempRet0;
  $1086 = $1077;
  $1087 = $1086;
  HEAP32[$1087>>2] = $1084;
  $1088 = (($1086) + 4)|0;
  $1089 = $1088;
  HEAP32[$1089>>2] = $1085;
  $1090 = $1047;
  $1091 = $1090;
  $1092 = HEAP32[$1091>>2]|0;
  $1093 = (($1090) + 4)|0;
  $1094 = $1093;
  $1095 = HEAP32[$1094>>2]|0;
  $1096 = $1092 ^ $1084;
  $1097 = $1095 ^ $1085;
  $1098 = (_rotr64_46($1096,$1097,24)|0);
  $1099 = tempRet0;
  $1100 = $1047;
  $1101 = $1100;
  HEAP32[$1101>>2] = $1098;
  $1102 = (($1100) + 4)|0;
  $1103 = $1102;
  HEAP32[$1103>>2] = $1099;
  $1104 = $1039;
  $1105 = $1104;
  $1106 = HEAP32[$1105>>2]|0;
  $1107 = (($1104) + 4)|0;
  $1108 = $1107;
  $1109 = HEAP32[$1108>>2]|0;
  $1110 = (_fBlaMka($1106,$1109,$1098,$1099)|0);
  $1111 = tempRet0;
  $1112 = $1039;
  $1113 = $1112;
  HEAP32[$1113>>2] = $1110;
  $1114 = (($1112) + 4)|0;
  $1115 = $1114;
  HEAP32[$1115>>2] = $1111;
  $1116 = $1061;
  $1117 = $1116;
  $1118 = HEAP32[$1117>>2]|0;
  $1119 = (($1116) + 4)|0;
  $1120 = $1119;
  $1121 = HEAP32[$1120>>2]|0;
  $1122 = $1118 ^ $1110;
  $1123 = $1121 ^ $1111;
  $1124 = (_rotr64_46($1122,$1123,16)|0);
  $1125 = tempRet0;
  $1126 = $1061;
  $1127 = $1126;
  HEAP32[$1127>>2] = $1124;
  $1128 = (($1126) + 4)|0;
  $1129 = $1128;
  HEAP32[$1129>>2] = $1125;
  $1130 = $1077;
  $1131 = $1130;
  $1132 = HEAP32[$1131>>2]|0;
  $1133 = (($1130) + 4)|0;
  $1134 = $1133;
  $1135 = HEAP32[$1134>>2]|0;
  $1136 = (_fBlaMka($1132,$1135,$1124,$1125)|0);
  $1137 = tempRet0;
  $1138 = $1077;
  $1139 = $1138;
  HEAP32[$1139>>2] = $1136;
  $1140 = (($1138) + 4)|0;
  $1141 = $1140;
  HEAP32[$1141>>2] = $1137;
  $1142 = $1047;
  $1143 = $1142;
  $1144 = HEAP32[$1143>>2]|0;
  $1145 = (($1142) + 4)|0;
  $1146 = $1145;
  $1147 = HEAP32[$1146>>2]|0;
  $1148 = $1144 ^ $1136;
  $1149 = $1147 ^ $1137;
  $1150 = (_rotr64_46($1148,$1149,63)|0);
  $1151 = tempRet0;
  $1152 = $1047;
  $1153 = $1152;
  HEAP32[$1153>>2] = $1150;
  $1154 = (($1152) + 4)|0;
  $1155 = $1154;
  HEAP32[$1155>>2] = $1151;
  $1156 = (($920) + 16)|0;
  $1157 = (($4) + ($1156<<3)|0);
  $1158 = $1157;
  $1159 = $1158;
  $1160 = HEAP32[$1159>>2]|0;
  $1161 = (($1158) + 4)|0;
  $1162 = $1161;
  $1163 = HEAP32[$1162>>2]|0;
  $1164 = (($920) + 48)|0;
  $1165 = (($4) + ($1164<<3)|0);
  $1166 = $1165;
  $1167 = $1166;
  $1168 = HEAP32[$1167>>2]|0;
  $1169 = (($1166) + 4)|0;
  $1170 = $1169;
  $1171 = HEAP32[$1170>>2]|0;
  $1172 = (_fBlaMka($1160,$1163,$1168,$1171)|0);
  $1173 = tempRet0;
  $1174 = $1157;
  $1175 = $1174;
  HEAP32[$1175>>2] = $1172;
  $1176 = (($1174) + 4)|0;
  $1177 = $1176;
  HEAP32[$1177>>2] = $1173;
  $1178 = (($920) + 112)|0;
  $1179 = (($4) + ($1178<<3)|0);
  $1180 = $1179;
  $1181 = $1180;
  $1182 = HEAP32[$1181>>2]|0;
  $1183 = (($1180) + 4)|0;
  $1184 = $1183;
  $1185 = HEAP32[$1184>>2]|0;
  $1186 = $1182 ^ $1172;
  $1187 = $1185 ^ $1173;
  $1188 = (_rotr64_46($1186,$1187,32)|0);
  $1189 = tempRet0;
  $1190 = $1179;
  $1191 = $1190;
  HEAP32[$1191>>2] = $1188;
  $1192 = (($1190) + 4)|0;
  $1193 = $1192;
  HEAP32[$1193>>2] = $1189;
  $1194 = (($920) + 80)|0;
  $1195 = (($4) + ($1194<<3)|0);
  $1196 = $1195;
  $1197 = $1196;
  $1198 = HEAP32[$1197>>2]|0;
  $1199 = (($1196) + 4)|0;
  $1200 = $1199;
  $1201 = HEAP32[$1200>>2]|0;
  $1202 = (_fBlaMka($1198,$1201,$1188,$1189)|0);
  $1203 = tempRet0;
  $1204 = $1195;
  $1205 = $1204;
  HEAP32[$1205>>2] = $1202;
  $1206 = (($1204) + 4)|0;
  $1207 = $1206;
  HEAP32[$1207>>2] = $1203;
  $1208 = $1165;
  $1209 = $1208;
  $1210 = HEAP32[$1209>>2]|0;
  $1211 = (($1208) + 4)|0;
  $1212 = $1211;
  $1213 = HEAP32[$1212>>2]|0;
  $1214 = $1210 ^ $1202;
  $1215 = $1213 ^ $1203;
  $1216 = (_rotr64_46($1214,$1215,24)|0);
  $1217 = tempRet0;
  $1218 = $1165;
  $1219 = $1218;
  HEAP32[$1219>>2] = $1216;
  $1220 = (($1218) + 4)|0;
  $1221 = $1220;
  HEAP32[$1221>>2] = $1217;
  $1222 = $1157;
  $1223 = $1222;
  $1224 = HEAP32[$1223>>2]|0;
  $1225 = (($1222) + 4)|0;
  $1226 = $1225;
  $1227 = HEAP32[$1226>>2]|0;
  $1228 = (_fBlaMka($1224,$1227,$1216,$1217)|0);
  $1229 = tempRet0;
  $1230 = $1157;
  $1231 = $1230;
  HEAP32[$1231>>2] = $1228;
  $1232 = (($1230) + 4)|0;
  $1233 = $1232;
  HEAP32[$1233>>2] = $1229;
  $1234 = $1179;
  $1235 = $1234;
  $1236 = HEAP32[$1235>>2]|0;
  $1237 = (($1234) + 4)|0;
  $1238 = $1237;
  $1239 = HEAP32[$1238>>2]|0;
  $1240 = $1236 ^ $1228;
  $1241 = $1239 ^ $1229;
  $1242 = (_rotr64_46($1240,$1241,16)|0);
  $1243 = tempRet0;
  $1244 = $1179;
  $1245 = $1244;
  HEAP32[$1245>>2] = $1242;
  $1246 = (($1244) + 4)|0;
  $1247 = $1246;
  HEAP32[$1247>>2] = $1243;
  $1248 = $1195;
  $1249 = $1248;
  $1250 = HEAP32[$1249>>2]|0;
  $1251 = (($1248) + 4)|0;
  $1252 = $1251;
  $1253 = HEAP32[$1252>>2]|0;
  $1254 = (_fBlaMka($1250,$1253,$1242,$1243)|0);
  $1255 = tempRet0;
  $1256 = $1195;
  $1257 = $1256;
  HEAP32[$1257>>2] = $1254;
  $1258 = (($1256) + 4)|0;
  $1259 = $1258;
  HEAP32[$1259>>2] = $1255;
  $1260 = $1165;
  $1261 = $1260;
  $1262 = HEAP32[$1261>>2]|0;
  $1263 = (($1260) + 4)|0;
  $1264 = $1263;
  $1265 = HEAP32[$1264>>2]|0;
  $1266 = $1262 ^ $1254;
  $1267 = $1265 ^ $1255;
  $1268 = (_rotr64_46($1266,$1267,63)|0);
  $1269 = tempRet0;
  $1270 = $1165;
  $1271 = $1270;
  HEAP32[$1271>>2] = $1268;
  $1272 = (($1270) + 4)|0;
  $1273 = $1272;
  HEAP32[$1273>>2] = $1269;
  $1274 = (($920) + 17)|0;
  $1275 = (($4) + ($1274<<3)|0);
  $1276 = $1275;
  $1277 = $1276;
  $1278 = HEAP32[$1277>>2]|0;
  $1279 = (($1276) + 4)|0;
  $1280 = $1279;
  $1281 = HEAP32[$1280>>2]|0;
  $1282 = (($920) + 49)|0;
  $1283 = (($4) + ($1282<<3)|0);
  $1284 = $1283;
  $1285 = $1284;
  $1286 = HEAP32[$1285>>2]|0;
  $1287 = (($1284) + 4)|0;
  $1288 = $1287;
  $1289 = HEAP32[$1288>>2]|0;
  $1290 = (_fBlaMka($1278,$1281,$1286,$1289)|0);
  $1291 = tempRet0;
  $1292 = $1275;
  $1293 = $1292;
  HEAP32[$1293>>2] = $1290;
  $1294 = (($1292) + 4)|0;
  $1295 = $1294;
  HEAP32[$1295>>2] = $1291;
  $1296 = (($920) + 113)|0;
  $1297 = (($4) + ($1296<<3)|0);
  $1298 = $1297;
  $1299 = $1298;
  $1300 = HEAP32[$1299>>2]|0;
  $1301 = (($1298) + 4)|0;
  $1302 = $1301;
  $1303 = HEAP32[$1302>>2]|0;
  $1304 = $1300 ^ $1290;
  $1305 = $1303 ^ $1291;
  $1306 = (_rotr64_46($1304,$1305,32)|0);
  $1307 = tempRet0;
  $1308 = $1297;
  $1309 = $1308;
  HEAP32[$1309>>2] = $1306;
  $1310 = (($1308) + 4)|0;
  $1311 = $1310;
  HEAP32[$1311>>2] = $1307;
  $1312 = (($920) + 81)|0;
  $1313 = (($4) + ($1312<<3)|0);
  $1314 = $1313;
  $1315 = $1314;
  $1316 = HEAP32[$1315>>2]|0;
  $1317 = (($1314) + 4)|0;
  $1318 = $1317;
  $1319 = HEAP32[$1318>>2]|0;
  $1320 = (_fBlaMka($1316,$1319,$1306,$1307)|0);
  $1321 = tempRet0;
  $1322 = $1313;
  $1323 = $1322;
  HEAP32[$1323>>2] = $1320;
  $1324 = (($1322) + 4)|0;
  $1325 = $1324;
  HEAP32[$1325>>2] = $1321;
  $1326 = $1283;
  $1327 = $1326;
  $1328 = HEAP32[$1327>>2]|0;
  $1329 = (($1326) + 4)|0;
  $1330 = $1329;
  $1331 = HEAP32[$1330>>2]|0;
  $1332 = $1328 ^ $1320;
  $1333 = $1331 ^ $1321;
  $1334 = (_rotr64_46($1332,$1333,24)|0);
  $1335 = tempRet0;
  $1336 = $1283;
  $1337 = $1336;
  HEAP32[$1337>>2] = $1334;
  $1338 = (($1336) + 4)|0;
  $1339 = $1338;
  HEAP32[$1339>>2] = $1335;
  $1340 = $1275;
  $1341 = $1340;
  $1342 = HEAP32[$1341>>2]|0;
  $1343 = (($1340) + 4)|0;
  $1344 = $1343;
  $1345 = HEAP32[$1344>>2]|0;
  $1346 = (_fBlaMka($1342,$1345,$1334,$1335)|0);
  $1347 = tempRet0;
  $1348 = $1275;
  $1349 = $1348;
  HEAP32[$1349>>2] = $1346;
  $1350 = (($1348) + 4)|0;
  $1351 = $1350;
  HEAP32[$1351>>2] = $1347;
  $1352 = $1297;
  $1353 = $1352;
  $1354 = HEAP32[$1353>>2]|0;
  $1355 = (($1352) + 4)|0;
  $1356 = $1355;
  $1357 = HEAP32[$1356>>2]|0;
  $1358 = $1354 ^ $1346;
  $1359 = $1357 ^ $1347;
  $1360 = (_rotr64_46($1358,$1359,16)|0);
  $1361 = tempRet0;
  $1362 = $1297;
  $1363 = $1362;
  HEAP32[$1363>>2] = $1360;
  $1364 = (($1362) + 4)|0;
  $1365 = $1364;
  HEAP32[$1365>>2] = $1361;
  $1366 = $1313;
  $1367 = $1366;
  $1368 = HEAP32[$1367>>2]|0;
  $1369 = (($1366) + 4)|0;
  $1370 = $1369;
  $1371 = HEAP32[$1370>>2]|0;
  $1372 = (_fBlaMka($1368,$1371,$1360,$1361)|0);
  $1373 = tempRet0;
  $1374 = $1313;
  $1375 = $1374;
  HEAP32[$1375>>2] = $1372;
  $1376 = (($1374) + 4)|0;
  $1377 = $1376;
  HEAP32[$1377>>2] = $1373;
  $1378 = $1283;
  $1379 = $1378;
  $1380 = HEAP32[$1379>>2]|0;
  $1381 = (($1378) + 4)|0;
  $1382 = $1381;
  $1383 = HEAP32[$1382>>2]|0;
  $1384 = $1380 ^ $1372;
  $1385 = $1383 ^ $1373;
  $1386 = (_rotr64_46($1384,$1385,63)|0);
  $1387 = tempRet0;
  $1388 = $1283;
  $1389 = $1388;
  HEAP32[$1389>>2] = $1386;
  $1390 = (($1388) + 4)|0;
  $1391 = $1390;
  HEAP32[$1391>>2] = $1387;
  $1392 = $921;
  $1393 = $1392;
  $1394 = HEAP32[$1393>>2]|0;
  $1395 = (($1392) + 4)|0;
  $1396 = $1395;
  $1397 = HEAP32[$1396>>2]|0;
  $1398 = $1047;
  $1399 = $1398;
  $1400 = HEAP32[$1399>>2]|0;
  $1401 = (($1398) + 4)|0;
  $1402 = $1401;
  $1403 = HEAP32[$1402>>2]|0;
  $1404 = (_fBlaMka($1394,$1397,$1400,$1403)|0);
  $1405 = tempRet0;
  $1406 = $921;
  $1407 = $1406;
  HEAP32[$1407>>2] = $1404;
  $1408 = (($1406) + 4)|0;
  $1409 = $1408;
  HEAP32[$1409>>2] = $1405;
  $1410 = $1297;
  $1411 = $1410;
  $1412 = HEAP32[$1411>>2]|0;
  $1413 = (($1410) + 4)|0;
  $1414 = $1413;
  $1415 = HEAP32[$1414>>2]|0;
  $1416 = $1412 ^ $1404;
  $1417 = $1415 ^ $1405;
  $1418 = (_rotr64_46($1416,$1417,32)|0);
  $1419 = tempRet0;
  $1420 = $1297;
  $1421 = $1420;
  HEAP32[$1421>>2] = $1418;
  $1422 = (($1420) + 4)|0;
  $1423 = $1422;
  HEAP32[$1423>>2] = $1419;
  $1424 = $1195;
  $1425 = $1424;
  $1426 = HEAP32[$1425>>2]|0;
  $1427 = (($1424) + 4)|0;
  $1428 = $1427;
  $1429 = HEAP32[$1428>>2]|0;
  $1430 = (_fBlaMka($1426,$1429,$1418,$1419)|0);
  $1431 = tempRet0;
  $1432 = $1195;
  $1433 = $1432;
  HEAP32[$1433>>2] = $1430;
  $1434 = (($1432) + 4)|0;
  $1435 = $1434;
  HEAP32[$1435>>2] = $1431;
  $1436 = $1047;
  $1437 = $1436;
  $1438 = HEAP32[$1437>>2]|0;
  $1439 = (($1436) + 4)|0;
  $1440 = $1439;
  $1441 = HEAP32[$1440>>2]|0;
  $1442 = $1438 ^ $1430;
  $1443 = $1441 ^ $1431;
  $1444 = (_rotr64_46($1442,$1443,24)|0);
  $1445 = tempRet0;
  $1446 = $1047;
  $1447 = $1446;
  HEAP32[$1447>>2] = $1444;
  $1448 = (($1446) + 4)|0;
  $1449 = $1448;
  HEAP32[$1449>>2] = $1445;
  $1450 = $921;
  $1451 = $1450;
  $1452 = HEAP32[$1451>>2]|0;
  $1453 = (($1450) + 4)|0;
  $1454 = $1453;
  $1455 = HEAP32[$1454>>2]|0;
  $1456 = (_fBlaMka($1452,$1455,$1444,$1445)|0);
  $1457 = tempRet0;
  $1458 = $921;
  $1459 = $1458;
  HEAP32[$1459>>2] = $1456;
  $1460 = (($1458) + 4)|0;
  $1461 = $1460;
  HEAP32[$1461>>2] = $1457;
  $1462 = $1297;
  $1463 = $1462;
  $1464 = HEAP32[$1463>>2]|0;
  $1465 = (($1462) + 4)|0;
  $1466 = $1465;
  $1467 = HEAP32[$1466>>2]|0;
  $1468 = $1464 ^ $1456;
  $1469 = $1467 ^ $1457;
  $1470 = (_rotr64_46($1468,$1469,16)|0);
  $1471 = tempRet0;
  $1472 = $1297;
  $1473 = $1472;
  HEAP32[$1473>>2] = $1470;
  $1474 = (($1472) + 4)|0;
  $1475 = $1474;
  HEAP32[$1475>>2] = $1471;
  $1476 = $1195;
  $1477 = $1476;
  $1478 = HEAP32[$1477>>2]|0;
  $1479 = (($1476) + 4)|0;
  $1480 = $1479;
  $1481 = HEAP32[$1480>>2]|0;
  $1482 = (_fBlaMka($1478,$1481,$1470,$1471)|0);
  $1483 = tempRet0;
  $1484 = $1195;
  $1485 = $1484;
  HEAP32[$1485>>2] = $1482;
  $1486 = (($1484) + 4)|0;
  $1487 = $1486;
  HEAP32[$1487>>2] = $1483;
  $1488 = $1047;
  $1489 = $1488;
  $1490 = HEAP32[$1489>>2]|0;
  $1491 = (($1488) + 4)|0;
  $1492 = $1491;
  $1493 = HEAP32[$1492>>2]|0;
  $1494 = $1490 ^ $1482;
  $1495 = $1493 ^ $1483;
  $1496 = (_rotr64_46($1494,$1495,63)|0);
  $1497 = tempRet0;
  $1498 = $1047;
  $1499 = $1498;
  HEAP32[$1499>>2] = $1496;
  $1500 = (($1498) + 4)|0;
  $1501 = $1500;
  HEAP32[$1501>>2] = $1497;
  $1502 = $1039;
  $1503 = $1502;
  $1504 = HEAP32[$1503>>2]|0;
  $1505 = (($1502) + 4)|0;
  $1506 = $1505;
  $1507 = HEAP32[$1506>>2]|0;
  $1508 = $1165;
  $1509 = $1508;
  $1510 = HEAP32[$1509>>2]|0;
  $1511 = (($1508) + 4)|0;
  $1512 = $1511;
  $1513 = HEAP32[$1512>>2]|0;
  $1514 = (_fBlaMka($1504,$1507,$1510,$1513)|0);
  $1515 = tempRet0;
  $1516 = $1039;
  $1517 = $1516;
  HEAP32[$1517>>2] = $1514;
  $1518 = (($1516) + 4)|0;
  $1519 = $1518;
  HEAP32[$1519>>2] = $1515;
  $1520 = $943;
  $1521 = $1520;
  $1522 = HEAP32[$1521>>2]|0;
  $1523 = (($1520) + 4)|0;
  $1524 = $1523;
  $1525 = HEAP32[$1524>>2]|0;
  $1526 = $1522 ^ $1514;
  $1527 = $1525 ^ $1515;
  $1528 = (_rotr64_46($1526,$1527,32)|0);
  $1529 = tempRet0;
  $1530 = $943;
  $1531 = $1530;
  HEAP32[$1531>>2] = $1528;
  $1532 = (($1530) + 4)|0;
  $1533 = $1532;
  HEAP32[$1533>>2] = $1529;
  $1534 = $1313;
  $1535 = $1534;
  $1536 = HEAP32[$1535>>2]|0;
  $1537 = (($1534) + 4)|0;
  $1538 = $1537;
  $1539 = HEAP32[$1538>>2]|0;
  $1540 = (_fBlaMka($1536,$1539,$1528,$1529)|0);
  $1541 = tempRet0;
  $1542 = $1313;
  $1543 = $1542;
  HEAP32[$1543>>2] = $1540;
  $1544 = (($1542) + 4)|0;
  $1545 = $1544;
  HEAP32[$1545>>2] = $1541;
  $1546 = $1165;
  $1547 = $1546;
  $1548 = HEAP32[$1547>>2]|0;
  $1549 = (($1546) + 4)|0;
  $1550 = $1549;
  $1551 = HEAP32[$1550>>2]|0;
  $1552 = $1548 ^ $1540;
  $1553 = $1551 ^ $1541;
  $1554 = (_rotr64_46($1552,$1553,24)|0);
  $1555 = tempRet0;
  $1556 = $1165;
  $1557 = $1556;
  HEAP32[$1557>>2] = $1554;
  $1558 = (($1556) + 4)|0;
  $1559 = $1558;
  HEAP32[$1559>>2] = $1555;
  $1560 = $1039;
  $1561 = $1560;
  $1562 = HEAP32[$1561>>2]|0;
  $1563 = (($1560) + 4)|0;
  $1564 = $1563;
  $1565 = HEAP32[$1564>>2]|0;
  $1566 = (_fBlaMka($1562,$1565,$1554,$1555)|0);
  $1567 = tempRet0;
  $1568 = $1039;
  $1569 = $1568;
  HEAP32[$1569>>2] = $1566;
  $1570 = (($1568) + 4)|0;
  $1571 = $1570;
  HEAP32[$1571>>2] = $1567;
  $1572 = $943;
  $1573 = $1572;
  $1574 = HEAP32[$1573>>2]|0;
  $1575 = (($1572) + 4)|0;
  $1576 = $1575;
  $1577 = HEAP32[$1576>>2]|0;
  $1578 = $1574 ^ $1566;
  $1579 = $1577 ^ $1567;
  $1580 = (_rotr64_46($1578,$1579,16)|0);
  $1581 = tempRet0;
  $1582 = $943;
  $1583 = $1582;
  HEAP32[$1583>>2] = $1580;
  $1584 = (($1582) + 4)|0;
  $1585 = $1584;
  HEAP32[$1585>>2] = $1581;
  $1586 = $1313;
  $1587 = $1586;
  $1588 = HEAP32[$1587>>2]|0;
  $1589 = (($1586) + 4)|0;
  $1590 = $1589;
  $1591 = HEAP32[$1590>>2]|0;
  $1592 = (_fBlaMka($1588,$1591,$1580,$1581)|0);
  $1593 = tempRet0;
  $1594 = $1313;
  $1595 = $1594;
  HEAP32[$1595>>2] = $1592;
  $1596 = (($1594) + 4)|0;
  $1597 = $1596;
  HEAP32[$1597>>2] = $1593;
  $1598 = $1165;
  $1599 = $1598;
  $1600 = HEAP32[$1599>>2]|0;
  $1601 = (($1598) + 4)|0;
  $1602 = $1601;
  $1603 = HEAP32[$1602>>2]|0;
  $1604 = $1600 ^ $1592;
  $1605 = $1603 ^ $1593;
  $1606 = (_rotr64_46($1604,$1605,63)|0);
  $1607 = tempRet0;
  $1608 = $1165;
  $1609 = $1608;
  HEAP32[$1609>>2] = $1606;
  $1610 = (($1608) + 4)|0;
  $1611 = $1610;
  HEAP32[$1611>>2] = $1607;
  $1612 = $1157;
  $1613 = $1612;
  $1614 = HEAP32[$1613>>2]|0;
  $1615 = (($1612) + 4)|0;
  $1616 = $1615;
  $1617 = HEAP32[$1616>>2]|0;
  $1618 = $1283;
  $1619 = $1618;
  $1620 = HEAP32[$1619>>2]|0;
  $1621 = (($1618) + 4)|0;
  $1622 = $1621;
  $1623 = HEAP32[$1622>>2]|0;
  $1624 = (_fBlaMka($1614,$1617,$1620,$1623)|0);
  $1625 = tempRet0;
  $1626 = $1157;
  $1627 = $1626;
  HEAP32[$1627>>2] = $1624;
  $1628 = (($1626) + 4)|0;
  $1629 = $1628;
  HEAP32[$1629>>2] = $1625;
  $1630 = $1061;
  $1631 = $1630;
  $1632 = HEAP32[$1631>>2]|0;
  $1633 = (($1630) + 4)|0;
  $1634 = $1633;
  $1635 = HEAP32[$1634>>2]|0;
  $1636 = $1632 ^ $1624;
  $1637 = $1635 ^ $1625;
  $1638 = (_rotr64_46($1636,$1637,32)|0);
  $1639 = tempRet0;
  $1640 = $1061;
  $1641 = $1640;
  HEAP32[$1641>>2] = $1638;
  $1642 = (($1640) + 4)|0;
  $1643 = $1642;
  HEAP32[$1643>>2] = $1639;
  $1644 = $959;
  $1645 = $1644;
  $1646 = HEAP32[$1645>>2]|0;
  $1647 = (($1644) + 4)|0;
  $1648 = $1647;
  $1649 = HEAP32[$1648>>2]|0;
  $1650 = (_fBlaMka($1646,$1649,$1638,$1639)|0);
  $1651 = tempRet0;
  $1652 = $959;
  $1653 = $1652;
  HEAP32[$1653>>2] = $1650;
  $1654 = (($1652) + 4)|0;
  $1655 = $1654;
  HEAP32[$1655>>2] = $1651;
  $1656 = $1283;
  $1657 = $1656;
  $1658 = HEAP32[$1657>>2]|0;
  $1659 = (($1656) + 4)|0;
  $1660 = $1659;
  $1661 = HEAP32[$1660>>2]|0;
  $1662 = $1658 ^ $1650;
  $1663 = $1661 ^ $1651;
  $1664 = (_rotr64_46($1662,$1663,24)|0);
  $1665 = tempRet0;
  $1666 = $1283;
  $1667 = $1666;
  HEAP32[$1667>>2] = $1664;
  $1668 = (($1666) + 4)|0;
  $1669 = $1668;
  HEAP32[$1669>>2] = $1665;
  $1670 = $1157;
  $1671 = $1670;
  $1672 = HEAP32[$1671>>2]|0;
  $1673 = (($1670) + 4)|0;
  $1674 = $1673;
  $1675 = HEAP32[$1674>>2]|0;
  $1676 = (_fBlaMka($1672,$1675,$1664,$1665)|0);
  $1677 = tempRet0;
  $1678 = $1157;
  $1679 = $1678;
  HEAP32[$1679>>2] = $1676;
  $1680 = (($1678) + 4)|0;
  $1681 = $1680;
  HEAP32[$1681>>2] = $1677;
  $1682 = $1061;
  $1683 = $1682;
  $1684 = HEAP32[$1683>>2]|0;
  $1685 = (($1682) + 4)|0;
  $1686 = $1685;
  $1687 = HEAP32[$1686>>2]|0;
  $1688 = $1684 ^ $1676;
  $1689 = $1687 ^ $1677;
  $1690 = (_rotr64_46($1688,$1689,16)|0);
  $1691 = tempRet0;
  $1692 = $1061;
  $1693 = $1692;
  HEAP32[$1693>>2] = $1690;
  $1694 = (($1692) + 4)|0;
  $1695 = $1694;
  HEAP32[$1695>>2] = $1691;
  $1696 = $959;
  $1697 = $1696;
  $1698 = HEAP32[$1697>>2]|0;
  $1699 = (($1696) + 4)|0;
  $1700 = $1699;
  $1701 = HEAP32[$1700>>2]|0;
  $1702 = (_fBlaMka($1698,$1701,$1690,$1691)|0);
  $1703 = tempRet0;
  $1704 = $959;
  $1705 = $1704;
  HEAP32[$1705>>2] = $1702;
  $1706 = (($1704) + 4)|0;
  $1707 = $1706;
  HEAP32[$1707>>2] = $1703;
  $1708 = $1283;
  $1709 = $1708;
  $1710 = HEAP32[$1709>>2]|0;
  $1711 = (($1708) + 4)|0;
  $1712 = $1711;
  $1713 = HEAP32[$1712>>2]|0;
  $1714 = $1710 ^ $1702;
  $1715 = $1713 ^ $1703;
  $1716 = (_rotr64_46($1714,$1715,63)|0);
  $1717 = tempRet0;
  $1718 = $1283;
  $1719 = $1718;
  HEAP32[$1719>>2] = $1716;
  $1720 = (($1718) + 4)|0;
  $1721 = $1720;
  HEAP32[$1721>>2] = $1717;
  $1722 = $1275;
  $1723 = $1722;
  $1724 = HEAP32[$1723>>2]|0;
  $1725 = (($1722) + 4)|0;
  $1726 = $1725;
  $1727 = HEAP32[$1726>>2]|0;
  $1728 = $929;
  $1729 = $1728;
  $1730 = HEAP32[$1729>>2]|0;
  $1731 = (($1728) + 4)|0;
  $1732 = $1731;
  $1733 = HEAP32[$1732>>2]|0;
  $1734 = (_fBlaMka($1724,$1727,$1730,$1733)|0);
  $1735 = tempRet0;
  $1736 = $1275;
  $1737 = $1736;
  HEAP32[$1737>>2] = $1734;
  $1738 = (($1736) + 4)|0;
  $1739 = $1738;
  HEAP32[$1739>>2] = $1735;
  $1740 = $1179;
  $1741 = $1740;
  $1742 = HEAP32[$1741>>2]|0;
  $1743 = (($1740) + 4)|0;
  $1744 = $1743;
  $1745 = HEAP32[$1744>>2]|0;
  $1746 = $1742 ^ $1734;
  $1747 = $1745 ^ $1735;
  $1748 = (_rotr64_46($1746,$1747,32)|0);
  $1749 = tempRet0;
  $1750 = $1179;
  $1751 = $1750;
  HEAP32[$1751>>2] = $1748;
  $1752 = (($1750) + 4)|0;
  $1753 = $1752;
  HEAP32[$1753>>2] = $1749;
  $1754 = $1077;
  $1755 = $1754;
  $1756 = HEAP32[$1755>>2]|0;
  $1757 = (($1754) + 4)|0;
  $1758 = $1757;
  $1759 = HEAP32[$1758>>2]|0;
  $1760 = (_fBlaMka($1756,$1759,$1748,$1749)|0);
  $1761 = tempRet0;
  $1762 = $1077;
  $1763 = $1762;
  HEAP32[$1763>>2] = $1760;
  $1764 = (($1762) + 4)|0;
  $1765 = $1764;
  HEAP32[$1765>>2] = $1761;
  $1766 = $929;
  $1767 = $1766;
  $1768 = HEAP32[$1767>>2]|0;
  $1769 = (($1766) + 4)|0;
  $1770 = $1769;
  $1771 = HEAP32[$1770>>2]|0;
  $1772 = $1768 ^ $1760;
  $1773 = $1771 ^ $1761;
  $1774 = (_rotr64_46($1772,$1773,24)|0);
  $1775 = tempRet0;
  $1776 = $929;
  $1777 = $1776;
  HEAP32[$1777>>2] = $1774;
  $1778 = (($1776) + 4)|0;
  $1779 = $1778;
  HEAP32[$1779>>2] = $1775;
  $1780 = $1275;
  $1781 = $1780;
  $1782 = HEAP32[$1781>>2]|0;
  $1783 = (($1780) + 4)|0;
  $1784 = $1783;
  $1785 = HEAP32[$1784>>2]|0;
  $1786 = (_fBlaMka($1782,$1785,$1774,$1775)|0);
  $1787 = tempRet0;
  $1788 = $1275;
  $1789 = $1788;
  HEAP32[$1789>>2] = $1786;
  $1790 = (($1788) + 4)|0;
  $1791 = $1790;
  HEAP32[$1791>>2] = $1787;
  $1792 = $1179;
  $1793 = $1792;
  $1794 = HEAP32[$1793>>2]|0;
  $1795 = (($1792) + 4)|0;
  $1796 = $1795;
  $1797 = HEAP32[$1796>>2]|0;
  $1798 = $1794 ^ $1786;
  $1799 = $1797 ^ $1787;
  $1800 = (_rotr64_46($1798,$1799,16)|0);
  $1801 = tempRet0;
  $1802 = $1179;
  $1803 = $1802;
  HEAP32[$1803>>2] = $1800;
  $1804 = (($1802) + 4)|0;
  $1805 = $1804;
  HEAP32[$1805>>2] = $1801;
  $1806 = $1077;
  $1807 = $1806;
  $1808 = HEAP32[$1807>>2]|0;
  $1809 = (($1806) + 4)|0;
  $1810 = $1809;
  $1811 = HEAP32[$1810>>2]|0;
  $1812 = (_fBlaMka($1808,$1811,$1800,$1801)|0);
  $1813 = tempRet0;
  $1814 = $1077;
  $1815 = $1814;
  HEAP32[$1815>>2] = $1812;
  $1816 = (($1814) + 4)|0;
  $1817 = $1816;
  HEAP32[$1817>>2] = $1813;
  $1818 = $929;
  $1819 = $1818;
  $1820 = HEAP32[$1819>>2]|0;
  $1821 = (($1818) + 4)|0;
  $1822 = $1821;
  $1823 = HEAP32[$1822>>2]|0;
  $1824 = $1820 ^ $1812;
  $1825 = $1823 ^ $1813;
  $1826 = (_rotr64_46($1824,$1825,63)|0);
  $1827 = tempRet0;
  $1828 = $929;
  $1829 = $1828;
  HEAP32[$1829>>2] = $1826;
  $1830 = (($1828) + 4)|0;
  $1831 = $1830;
  HEAP32[$1831>>2] = $1827;
  $1832 = (($$1395) + 1)|0;
  $exitcond = ($1832|0)==(8);
  if ($exitcond) {
   break;
  } else {
   $$1395 = $1832;
  }
 }
 _copy_block($2,$5);
 _xor_block($2,$4);
 STACKTOP = sp;return;
}
function _fBlaMka($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (_i64Add(($2|0),($3|0),($0|0),($1|0))|0);
 $5 = tempRet0;
 $6 = (_bitshift64Shl(($0|0),($1|0),1)|0);
 $7 = tempRet0;
 $8 = $6 & -2;
 $9 = $7 & 1;
 $10 = (___muldi3(($8|0),($9|0),($2|0),0)|0);
 $11 = tempRet0;
 $12 = (_i64Add(($4|0),($5|0),($10|0),($11|0))|0);
 $13 = tempRet0;
 tempRet0 = ($13);
 return ($12|0);
}
function _rotr64_46($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_bitshift64Lshr(($0|0),($1|0),($2|0))|0);
 $4 = tempRet0;
 $5 = (64 - ($2))|0;
 $6 = (_bitshift64Shl(($0|0),($1|0),($5|0))|0);
 $7 = tempRet0;
 $8 = $6 | $3;
 $9 = $7 | $4;
 tempRet0 = ($9);
 return ($8|0);
}
function _fe_0($0) {
 $0 = $0|0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 dest=$0; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return;
}
function _fe_1($0) {
 $0 = $0|0;
 var $1 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = 1;
 $1 = ((($0)) + 4|0);
 dest=$1; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return;
}
function _fe_add($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = (($22) + ($3))|0;
 $42 = (($24) + ($5))|0;
 $43 = (($26) + ($7))|0;
 $44 = (($28) + ($9))|0;
 $45 = (($30) + ($11))|0;
 $46 = (($32) + ($13))|0;
 $47 = (($34) + ($15))|0;
 $48 = (($36) + ($17))|0;
 $49 = (($38) + ($19))|0;
 $50 = (($40) + ($21))|0;
 HEAP32[$0>>2] = $41;
 $51 = ((($0)) + 4|0);
 HEAP32[$51>>2] = $42;
 $52 = ((($0)) + 8|0);
 HEAP32[$52>>2] = $43;
 $53 = ((($0)) + 12|0);
 HEAP32[$53>>2] = $44;
 $54 = ((($0)) + 16|0);
 HEAP32[$54>>2] = $45;
 $55 = ((($0)) + 20|0);
 HEAP32[$55>>2] = $46;
 $56 = ((($0)) + 24|0);
 HEAP32[$56>>2] = $47;
 $57 = ((($0)) + 28|0);
 HEAP32[$57>>2] = $48;
 $58 = ((($0)) + 32|0);
 HEAP32[$58>>2] = $49;
 $59 = ((($0)) + 36|0);
 HEAP32[$59>>2] = $50;
 return;
}
function _fe_cmov($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($0)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($0)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($0)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($0)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($0)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($0)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($0)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$1>>2]|0;
 $23 = ((($1)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($1)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($1)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($1)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($1)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($1)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($1)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($1)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($1)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = $22 ^ $3;
 $42 = $24 ^ $5;
 $43 = $26 ^ $7;
 $44 = $28 ^ $9;
 $45 = $30 ^ $11;
 $46 = $32 ^ $13;
 $47 = $34 ^ $15;
 $48 = $36 ^ $17;
 $49 = $38 ^ $19;
 $50 = $40 ^ $21;
 $51 = (0 - ($2))|0;
 $52 = $41 & $51;
 $53 = $42 & $51;
 $54 = $43 & $51;
 $55 = $44 & $51;
 $56 = $45 & $51;
 $57 = $46 & $51;
 $58 = $47 & $51;
 $59 = $48 & $51;
 $60 = $49 & $51;
 $61 = $50 & $51;
 $62 = $52 ^ $3;
 HEAP32[$0>>2] = $62;
 $63 = $53 ^ $5;
 HEAP32[$4>>2] = $63;
 $64 = $54 ^ $7;
 HEAP32[$6>>2] = $64;
 $65 = $55 ^ $9;
 HEAP32[$8>>2] = $65;
 $66 = $56 ^ $11;
 HEAP32[$10>>2] = $66;
 $67 = $57 ^ $13;
 HEAP32[$12>>2] = $67;
 $68 = $58 ^ $15;
 HEAP32[$14>>2] = $68;
 $69 = $59 ^ $17;
 HEAP32[$16>>2] = $69;
 $70 = $60 ^ $19;
 HEAP32[$18>>2] = $70;
 $71 = $61 ^ $21;
 HEAP32[$20>>2] = $71;
 return;
}
function _fe_copy($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 HEAP32[$0>>2] = $2;
 $21 = ((($0)) + 4|0);
 HEAP32[$21>>2] = $4;
 $22 = ((($0)) + 8|0);
 HEAP32[$22>>2] = $6;
 $23 = ((($0)) + 12|0);
 HEAP32[$23>>2] = $8;
 $24 = ((($0)) + 16|0);
 HEAP32[$24>>2] = $10;
 $25 = ((($0)) + 20|0);
 HEAP32[$25>>2] = $12;
 $26 = ((($0)) + 24|0);
 HEAP32[$26>>2] = $14;
 $27 = ((($0)) + 28|0);
 HEAP32[$27>>2] = $16;
 $28 = ((($0)) + 32|0);
 HEAP32[$28>>2] = $18;
 $29 = ((($0)) + 36|0);
 HEAP32[$29>>2] = $20;
 return;
}
function _fe_frombytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_load_4($1)|0);
 $3 = tempRet0;
 $4 = ((($1)) + 4|0);
 $5 = (_load_3($4)|0);
 $6 = tempRet0;
 $7 = (_bitshift64Shl(($5|0),($6|0),6)|0);
 $8 = tempRet0;
 $9 = ((($1)) + 7|0);
 $10 = (_load_3($9)|0);
 $11 = tempRet0;
 $12 = (_bitshift64Shl(($10|0),($11|0),5)|0);
 $13 = tempRet0;
 $14 = ((($1)) + 10|0);
 $15 = (_load_3($14)|0);
 $16 = tempRet0;
 $17 = (_bitshift64Shl(($15|0),($16|0),3)|0);
 $18 = tempRet0;
 $19 = ((($1)) + 13|0);
 $20 = (_load_3($19)|0);
 $21 = tempRet0;
 $22 = (_bitshift64Shl(($20|0),($21|0),2)|0);
 $23 = tempRet0;
 $24 = ((($1)) + 16|0);
 $25 = (_load_4($24)|0);
 $26 = tempRet0;
 $27 = ((($1)) + 20|0);
 $28 = (_load_3($27)|0);
 $29 = tempRet0;
 $30 = (_bitshift64Shl(($28|0),($29|0),7)|0);
 $31 = tempRet0;
 $32 = ((($1)) + 23|0);
 $33 = (_load_3($32)|0);
 $34 = tempRet0;
 $35 = (_bitshift64Shl(($33|0),($34|0),5)|0);
 $36 = tempRet0;
 $37 = ((($1)) + 26|0);
 $38 = (_load_3($37)|0);
 $39 = tempRet0;
 $40 = (_bitshift64Shl(($38|0),($39|0),4)|0);
 $41 = tempRet0;
 $42 = ((($1)) + 29|0);
 $43 = (_load_3($42)|0);
 $44 = tempRet0;
 $45 = (_bitshift64Shl(($43|0),($44|0),2)|0);
 $46 = tempRet0;
 $47 = $45 & 33554428;
 $48 = (_i64Add(($47|0),0,16777216,0)|0);
 $49 = tempRet0;
 $50 = (_bitshift64Lshr(($48|0),($49|0),25)|0);
 $51 = tempRet0;
 $52 = (_i64Subtract(0,0,($50|0),($51|0))|0);
 $53 = tempRet0;
 $54 = $52 & 19;
 $55 = (_i64Add(($54|0),0,($2|0),($3|0))|0);
 $56 = tempRet0;
 $57 = (_bitshift64Shl(($50|0),($51|0),25)|0);
 $58 = tempRet0;
 $59 = (_i64Add(($7|0),($8|0),16777216,0)|0);
 $60 = tempRet0;
 $61 = (_bitshift64Ashr(($59|0),($60|0),25)|0);
 $62 = tempRet0;
 $63 = (_i64Add(($61|0),($62|0),($12|0),($13|0))|0);
 $64 = tempRet0;
 $65 = (_bitshift64Shl(($61|0),($62|0),25)|0);
 $66 = tempRet0;
 $67 = (_i64Subtract(($7|0),($8|0),($65|0),($66|0))|0);
 $68 = tempRet0;
 $69 = (_i64Add(($17|0),($18|0),16777216,0)|0);
 $70 = tempRet0;
 $71 = (_bitshift64Ashr(($69|0),($70|0),25)|0);
 $72 = tempRet0;
 $73 = (_i64Add(($71|0),($72|0),($22|0),($23|0))|0);
 $74 = tempRet0;
 $75 = (_bitshift64Shl(($71|0),($72|0),25)|0);
 $76 = tempRet0;
 $77 = (_i64Subtract(($17|0),($18|0),($75|0),($76|0))|0);
 $78 = tempRet0;
 $79 = (_i64Add(($25|0),($26|0),16777216,0)|0);
 $80 = tempRet0;
 $81 = (_bitshift64Ashr(($79|0),($80|0),25)|0);
 $82 = tempRet0;
 $83 = (_i64Add(($30|0),($31|0),($81|0),($82|0))|0);
 $84 = tempRet0;
 $85 = (_bitshift64Shl(($81|0),($82|0),25)|0);
 $86 = tempRet0;
 $87 = (_i64Subtract(($25|0),($26|0),($85|0),($86|0))|0);
 $88 = tempRet0;
 $89 = (_i64Add(($35|0),($36|0),16777216,0)|0);
 $90 = tempRet0;
 $91 = (_bitshift64Ashr(($89|0),($90|0),25)|0);
 $92 = tempRet0;
 $93 = (_i64Add(($91|0),($92|0),($40|0),($41|0))|0);
 $94 = tempRet0;
 $95 = (_bitshift64Shl(($91|0),($92|0),25)|0);
 $96 = tempRet0;
 $97 = (_i64Add(($55|0),($56|0),33554432,0)|0);
 $98 = tempRet0;
 $99 = (_bitshift64Ashr(($97|0),($98|0),26)|0);
 $100 = tempRet0;
 $101 = (_i64Add(($67|0),($68|0),($99|0),($100|0))|0);
 $102 = tempRet0;
 $103 = (_bitshift64Shl(($99|0),($100|0),26)|0);
 $104 = tempRet0;
 $105 = (_i64Subtract(($55|0),($56|0),($103|0),($104|0))|0);
 $106 = tempRet0;
 $107 = (_i64Add(($63|0),($64|0),33554432,0)|0);
 $108 = tempRet0;
 $109 = (_bitshift64Ashr(($107|0),($108|0),26)|0);
 $110 = tempRet0;
 $111 = (_i64Add(($77|0),($78|0),($109|0),($110|0))|0);
 $112 = tempRet0;
 $113 = (_bitshift64Shl(($109|0),($110|0),26)|0);
 $114 = tempRet0;
 $115 = (_i64Subtract(($63|0),($64|0),($113|0),($114|0))|0);
 $116 = tempRet0;
 $117 = (_i64Add(($73|0),($74|0),33554432,0)|0);
 $118 = tempRet0;
 $119 = (_bitshift64Ashr(($117|0),($118|0),26)|0);
 $120 = tempRet0;
 $121 = (_i64Add(($87|0),($88|0),($119|0),($120|0))|0);
 $122 = tempRet0;
 $123 = (_bitshift64Shl(($119|0),($120|0),26)|0);
 $124 = tempRet0;
 $125 = (_i64Subtract(($73|0),($74|0),($123|0),($124|0))|0);
 $126 = tempRet0;
 $127 = (_i64Add(($83|0),($84|0),33554432,0)|0);
 $128 = tempRet0;
 $129 = (_bitshift64Ashr(($127|0),($128|0),26)|0);
 $130 = tempRet0;
 $131 = (_i64Add(($129|0),($130|0),($35|0),($36|0))|0);
 $132 = tempRet0;
 $133 = (_i64Subtract(($131|0),($132|0),($95|0),($96|0))|0);
 $134 = tempRet0;
 $135 = (_bitshift64Shl(($129|0),($130|0),26)|0);
 $136 = tempRet0;
 $137 = (_i64Subtract(($83|0),($84|0),($135|0),($136|0))|0);
 $138 = tempRet0;
 $139 = (_i64Add(($93|0),($94|0),33554432,0)|0);
 $140 = tempRet0;
 $141 = (_bitshift64Ashr(($139|0),($140|0),26)|0);
 $142 = tempRet0;
 $143 = (_i64Add(($141|0),($142|0),($47|0),0)|0);
 $144 = tempRet0;
 $145 = (_i64Subtract(($143|0),($144|0),($57|0),($58|0))|0);
 $146 = tempRet0;
 $147 = (_bitshift64Shl(($141|0),($142|0),26)|0);
 $148 = tempRet0;
 $149 = (_i64Subtract(($93|0),($94|0),($147|0),($148|0))|0);
 $150 = tempRet0;
 HEAP32[$0>>2] = $105;
 $151 = ((($0)) + 4|0);
 HEAP32[$151>>2] = $101;
 $152 = ((($0)) + 8|0);
 HEAP32[$152>>2] = $115;
 $153 = ((($0)) + 12|0);
 HEAP32[$153>>2] = $111;
 $154 = ((($0)) + 16|0);
 HEAP32[$154>>2] = $125;
 $155 = ((($0)) + 20|0);
 HEAP32[$155>>2] = $121;
 $156 = ((($0)) + 24|0);
 HEAP32[$156>>2] = $137;
 $157 = ((($0)) + 28|0);
 HEAP32[$157>>2] = $133;
 $158 = ((($0)) + 32|0);
 HEAP32[$158>>2] = $149;
 $159 = ((($0)) + 36|0);
 HEAP32[$159>>2] = $145;
 return;
}
function _load_4($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 $16 = ((($0)) + 3|0);
 $17 = HEAP8[$16>>0]|0;
 $18 = $17&255;
 $19 = (_bitshift64Shl(($18|0),0,24)|0);
 $20 = tempRet0;
 $21 = $14 | $19;
 $22 = $15 | $20;
 tempRet0 = ($22);
 return ($21|0);
}
function _load_3($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 tempRet0 = ($15);
 return ($14|0);
}
function _fe_invert($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$728 = 0, $$827 = 0, $$926 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $exitcond = 0, $exitcond34 = 0, $exitcond35 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0;
 $2 = sp + 120|0;
 $3 = sp + 80|0;
 $4 = sp + 40|0;
 $5 = sp;
 _fe_sq($2,$1);
 _fe_sq($3,$2);
 _fe_sq($3,$3);
 _fe_mul($3,$1,$3);
 _fe_mul($2,$2,$3);
 _fe_sq($4,$2);
 _fe_mul($3,$3,$4);
 _fe_sq($4,$3);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_mul($3,$4,$3);
 _fe_sq($4,$3);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_mul($4,$4,$3);
 _fe_sq($5,$4);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_sq($5,$5);
 _fe_mul($4,$5,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_mul($3,$4,$3);
 _fe_sq($4,$3);
 $$728 = 1;
 while(1) {
  _fe_sq($4,$4);
  $6 = (($$728) + 1)|0;
  $exitcond35 = ($6|0)==(50);
  if ($exitcond35) {
   break;
  } else {
   $$728 = $6;
  }
 }
 _fe_mul($4,$4,$3);
 _fe_sq($5,$4);
 $$827 = 1;
 while(1) {
  _fe_sq($5,$5);
  $7 = (($$827) + 1)|0;
  $exitcond34 = ($7|0)==(100);
  if ($exitcond34) {
   break;
  } else {
   $$827 = $7;
  }
 }
 _fe_mul($4,$5,$4);
 _fe_sq($4,$4);
 $$926 = 1;
 while(1) {
  _fe_sq($4,$4);
  $8 = (($$926) + 1)|0;
  $exitcond = ($8|0)==(50);
  if ($exitcond) {
   break;
  } else {
   $$926 = $8;
  }
 }
 _fe_mul($3,$4,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_mul($0,$3,$2);
 STACKTOP = sp;return;
}
function _fe_sq($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0;
 var $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0;
 var $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = $2 << 1;
 $22 = $4 << 1;
 $23 = $6 << 1;
 $24 = $8 << 1;
 $25 = $10 << 1;
 $26 = $12 << 1;
 $27 = $14 << 1;
 $28 = $16 << 1;
 $29 = ($12*38)|0;
 $30 = ($14*19)|0;
 $31 = ($16*38)|0;
 $32 = ($18*19)|0;
 $33 = ($20*38)|0;
 $34 = ($2|0)<(0);
 $35 = $34 << 31 >> 31;
 $36 = (___muldi3(($2|0),($35|0),($2|0),($35|0))|0);
 $37 = tempRet0;
 $38 = ($21|0)<(0);
 $39 = $38 << 31 >> 31;
 $40 = ($4|0)<(0);
 $41 = $40 << 31 >> 31;
 $42 = (___muldi3(($21|0),($39|0),($4|0),($41|0))|0);
 $43 = tempRet0;
 $44 = ($6|0)<(0);
 $45 = $44 << 31 >> 31;
 $46 = (___muldi3(($6|0),($45|0),($21|0),($39|0))|0);
 $47 = tempRet0;
 $48 = ($8|0)<(0);
 $49 = $48 << 31 >> 31;
 $50 = (___muldi3(($8|0),($49|0),($21|0),($39|0))|0);
 $51 = tempRet0;
 $52 = ($10|0)<(0);
 $53 = $52 << 31 >> 31;
 $54 = (___muldi3(($10|0),($53|0),($21|0),($39|0))|0);
 $55 = tempRet0;
 $56 = ($12|0)<(0);
 $57 = $56 << 31 >> 31;
 $58 = (___muldi3(($12|0),($57|0),($21|0),($39|0))|0);
 $59 = tempRet0;
 $60 = ($14|0)<(0);
 $61 = $60 << 31 >> 31;
 $62 = (___muldi3(($14|0),($61|0),($21|0),($39|0))|0);
 $63 = tempRet0;
 $64 = ($16|0)<(0);
 $65 = $64 << 31 >> 31;
 $66 = (___muldi3(($16|0),($65|0),($21|0),($39|0))|0);
 $67 = tempRet0;
 $68 = ($18|0)<(0);
 $69 = $68 << 31 >> 31;
 $70 = (___muldi3(($18|0),($69|0),($21|0),($39|0))|0);
 $71 = tempRet0;
 $72 = ($20|0)<(0);
 $73 = $72 << 31 >> 31;
 $74 = (___muldi3(($20|0),($73|0),($21|0),($39|0))|0);
 $75 = tempRet0;
 $76 = ($22|0)<(0);
 $77 = $76 << 31 >> 31;
 $78 = (___muldi3(($22|0),($77|0),($4|0),($41|0))|0);
 $79 = tempRet0;
 $80 = (___muldi3(($22|0),($77|0),($6|0),($45|0))|0);
 $81 = tempRet0;
 $82 = ($24|0)<(0);
 $83 = $82 << 31 >> 31;
 $84 = (___muldi3(($24|0),($83|0),($22|0),($77|0))|0);
 $85 = tempRet0;
 $86 = (___muldi3(($10|0),($53|0),($22|0),($77|0))|0);
 $87 = tempRet0;
 $88 = ($26|0)<(0);
 $89 = $88 << 31 >> 31;
 $90 = (___muldi3(($26|0),($89|0),($22|0),($77|0))|0);
 $91 = tempRet0;
 $92 = (___muldi3(($14|0),($61|0),($22|0),($77|0))|0);
 $93 = tempRet0;
 $94 = ($28|0)<(0);
 $95 = $94 << 31 >> 31;
 $96 = (___muldi3(($28|0),($95|0),($22|0),($77|0))|0);
 $97 = tempRet0;
 $98 = (___muldi3(($18|0),($69|0),($22|0),($77|0))|0);
 $99 = tempRet0;
 $100 = ($33|0)<(0);
 $101 = $100 << 31 >> 31;
 $102 = (___muldi3(($33|0),($101|0),($22|0),($77|0))|0);
 $103 = tempRet0;
 $104 = (___muldi3(($6|0),($45|0),($6|0),($45|0))|0);
 $105 = tempRet0;
 $106 = ($23|0)<(0);
 $107 = $106 << 31 >> 31;
 $108 = (___muldi3(($23|0),($107|0),($8|0),($49|0))|0);
 $109 = tempRet0;
 $110 = (___muldi3(($10|0),($53|0),($23|0),($107|0))|0);
 $111 = tempRet0;
 $112 = (___muldi3(($12|0),($57|0),($23|0),($107|0))|0);
 $113 = tempRet0;
 $114 = (___muldi3(($14|0),($61|0),($23|0),($107|0))|0);
 $115 = tempRet0;
 $116 = (___muldi3(($16|0),($65|0),($23|0),($107|0))|0);
 $117 = tempRet0;
 $118 = ($32|0)<(0);
 $119 = $118 << 31 >> 31;
 $120 = (___muldi3(($32|0),($119|0),($23|0),($107|0))|0);
 $121 = tempRet0;
 $122 = (___muldi3(($33|0),($101|0),($6|0),($45|0))|0);
 $123 = tempRet0;
 $124 = (___muldi3(($24|0),($83|0),($8|0),($49|0))|0);
 $125 = tempRet0;
 $126 = (___muldi3(($24|0),($83|0),($10|0),($53|0))|0);
 $127 = tempRet0;
 $128 = (___muldi3(($26|0),($89|0),($24|0),($83|0))|0);
 $129 = tempRet0;
 $130 = (___muldi3(($14|0),($61|0),($24|0),($83|0))|0);
 $131 = tempRet0;
 $132 = ($31|0)<(0);
 $133 = $132 << 31 >> 31;
 $134 = (___muldi3(($31|0),($133|0),($24|0),($83|0))|0);
 $135 = tempRet0;
 $136 = (___muldi3(($32|0),($119|0),($24|0),($83|0))|0);
 $137 = tempRet0;
 $138 = (___muldi3(($33|0),($101|0),($24|0),($83|0))|0);
 $139 = tempRet0;
 $140 = (___muldi3(($10|0),($53|0),($10|0),($53|0))|0);
 $141 = tempRet0;
 $142 = ($25|0)<(0);
 $143 = $142 << 31 >> 31;
 $144 = (___muldi3(($25|0),($143|0),($12|0),($57|0))|0);
 $145 = tempRet0;
 $146 = ($30|0)<(0);
 $147 = $146 << 31 >> 31;
 $148 = (___muldi3(($30|0),($147|0),($25|0),($143|0))|0);
 $149 = tempRet0;
 $150 = (___muldi3(($31|0),($133|0),($10|0),($53|0))|0);
 $151 = tempRet0;
 $152 = (___muldi3(($32|0),($119|0),($25|0),($143|0))|0);
 $153 = tempRet0;
 $154 = (___muldi3(($33|0),($101|0),($10|0),($53|0))|0);
 $155 = tempRet0;
 $156 = ($29|0)<(0);
 $157 = $156 << 31 >> 31;
 $158 = (___muldi3(($29|0),($157|0),($12|0),($57|0))|0);
 $159 = tempRet0;
 $160 = (___muldi3(($30|0),($147|0),($26|0),($89|0))|0);
 $161 = tempRet0;
 $162 = (___muldi3(($31|0),($133|0),($26|0),($89|0))|0);
 $163 = tempRet0;
 $164 = (___muldi3(($32|0),($119|0),($26|0),($89|0))|0);
 $165 = tempRet0;
 $166 = (___muldi3(($33|0),($101|0),($26|0),($89|0))|0);
 $167 = tempRet0;
 $168 = (___muldi3(($30|0),($147|0),($14|0),($61|0))|0);
 $169 = tempRet0;
 $170 = (___muldi3(($31|0),($133|0),($14|0),($61|0))|0);
 $171 = tempRet0;
 $172 = ($27|0)<(0);
 $173 = $172 << 31 >> 31;
 $174 = (___muldi3(($32|0),($119|0),($27|0),($173|0))|0);
 $175 = tempRet0;
 $176 = (___muldi3(($33|0),($101|0),($14|0),($61|0))|0);
 $177 = tempRet0;
 $178 = (___muldi3(($31|0),($133|0),($16|0),($65|0))|0);
 $179 = tempRet0;
 $180 = (___muldi3(($32|0),($119|0),($28|0),($95|0))|0);
 $181 = tempRet0;
 $182 = (___muldi3(($33|0),($101|0),($28|0),($95|0))|0);
 $183 = tempRet0;
 $184 = (___muldi3(($32|0),($119|0),($18|0),($69|0))|0);
 $185 = tempRet0;
 $186 = (___muldi3(($33|0),($101|0),($18|0),($69|0))|0);
 $187 = tempRet0;
 $188 = (___muldi3(($33|0),($101|0),($20|0),($73|0))|0);
 $189 = tempRet0;
 $190 = (_i64Add(($158|0),($159|0),($36|0),($37|0))|0);
 $191 = tempRet0;
 $192 = (_i64Add(($190|0),($191|0),($148|0),($149|0))|0);
 $193 = tempRet0;
 $194 = (_i64Add(($192|0),($193|0),($134|0),($135|0))|0);
 $195 = tempRet0;
 $196 = (_i64Add(($194|0),($195|0),($120|0),($121|0))|0);
 $197 = tempRet0;
 $198 = (_i64Add(($196|0),($197|0),($102|0),($103|0))|0);
 $199 = tempRet0;
 $200 = (_i64Add(($46|0),($47|0),($78|0),($79|0))|0);
 $201 = tempRet0;
 $202 = (_i64Add(($50|0),($51|0),($80|0),($81|0))|0);
 $203 = tempRet0;
 $204 = (_i64Add(($84|0),($85|0),($104|0),($105|0))|0);
 $205 = tempRet0;
 $206 = (_i64Add(($204|0),($205|0),($54|0),($55|0))|0);
 $207 = tempRet0;
 $208 = (_i64Add(($206|0),($207|0),($178|0),($179|0))|0);
 $209 = tempRet0;
 $210 = (_i64Add(($208|0),($209|0),($174|0),($175|0))|0);
 $211 = tempRet0;
 $212 = (_i64Add(($210|0),($211|0),($166|0),($167|0))|0);
 $213 = tempRet0;
 $214 = (_i64Add(($198|0),($199|0),33554432,0)|0);
 $215 = tempRet0;
 $216 = (_bitshift64Ashr(($214|0),($215|0),26)|0);
 $217 = tempRet0;
 $218 = (_i64Add(($160|0),($161|0),($42|0),($43|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($150|0),($151|0))|0);
 $221 = tempRet0;
 $222 = (_i64Add(($220|0),($221|0),($136|0),($137|0))|0);
 $223 = tempRet0;
 $224 = (_i64Add(($222|0),($223|0),($122|0),($123|0))|0);
 $225 = tempRet0;
 $226 = (_i64Add(($224|0),($225|0),($216|0),($217|0))|0);
 $227 = tempRet0;
 $228 = (_bitshift64Shl(($216|0),($217|0),26)|0);
 $229 = tempRet0;
 $230 = (_i64Subtract(($198|0),($199|0),($228|0),($229|0))|0);
 $231 = tempRet0;
 $232 = (_i64Add(($212|0),($213|0),33554432,0)|0);
 $233 = tempRet0;
 $234 = (_bitshift64Ashr(($232|0),($233|0),26)|0);
 $235 = tempRet0;
 $236 = (_i64Add(($86|0),($87|0),($108|0),($109|0))|0);
 $237 = tempRet0;
 $238 = (_i64Add(($236|0),($237|0),($58|0),($59|0))|0);
 $239 = tempRet0;
 $240 = (_i64Add(($238|0),($239|0),($180|0),($181|0))|0);
 $241 = tempRet0;
 $242 = (_i64Add(($240|0),($241|0),($176|0),($177|0))|0);
 $243 = tempRet0;
 $244 = (_i64Add(($242|0),($243|0),($234|0),($235|0))|0);
 $245 = tempRet0;
 $246 = (_bitshift64Shl(($234|0),($235|0),26)|0);
 $247 = tempRet0;
 $248 = (_i64Subtract(($212|0),($213|0),($246|0),($247|0))|0);
 $249 = tempRet0;
 $250 = (_i64Add(($226|0),($227|0),16777216,0)|0);
 $251 = tempRet0;
 $252 = (_bitshift64Ashr(($250|0),($251|0),25)|0);
 $253 = tempRet0;
 $254 = (_i64Add(($200|0),($201|0),($168|0),($169|0))|0);
 $255 = tempRet0;
 $256 = (_i64Add(($254|0),($255|0),($162|0),($163|0))|0);
 $257 = tempRet0;
 $258 = (_i64Add(($256|0),($257|0),($152|0),($153|0))|0);
 $259 = tempRet0;
 $260 = (_i64Add(($258|0),($259|0),($138|0),($139|0))|0);
 $261 = tempRet0;
 $262 = (_i64Add(($260|0),($261|0),($252|0),($253|0))|0);
 $263 = tempRet0;
 $264 = (_bitshift64Shl(($252|0),($253|0),25)|0);
 $265 = tempRet0;
 $266 = (_i64Subtract(($226|0),($227|0),($264|0),($265|0))|0);
 $267 = tempRet0;
 $268 = (_i64Add(($244|0),($245|0),16777216,0)|0);
 $269 = tempRet0;
 $270 = (_bitshift64Ashr(($268|0),($269|0),25)|0);
 $271 = tempRet0;
 $272 = (_i64Add(($124|0),($125|0),($110|0),($111|0))|0);
 $273 = tempRet0;
 $274 = (_i64Add(($272|0),($273|0),($90|0),($91|0))|0);
 $275 = tempRet0;
 $276 = (_i64Add(($274|0),($275|0),($62|0),($63|0))|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($184|0),($185|0))|0);
 $279 = tempRet0;
 $280 = (_i64Add(($278|0),($279|0),($182|0),($183|0))|0);
 $281 = tempRet0;
 $282 = (_i64Add(($280|0),($281|0),($270|0),($271|0))|0);
 $283 = tempRet0;
 $284 = (_bitshift64Shl(($270|0),($271|0),25)|0);
 $285 = tempRet0;
 $286 = (_i64Subtract(($244|0),($245|0),($284|0),($285|0))|0);
 $287 = tempRet0;
 $288 = (_i64Add(($262|0),($263|0),33554432,0)|0);
 $289 = tempRet0;
 $290 = (_bitshift64Ashr(($288|0),($289|0),26)|0);
 $291 = tempRet0;
 $292 = (_i64Add(($202|0),($203|0),($170|0),($171|0))|0);
 $293 = tempRet0;
 $294 = (_i64Add(($292|0),($293|0),($164|0),($165|0))|0);
 $295 = tempRet0;
 $296 = (_i64Add(($294|0),($295|0),($154|0),($155|0))|0);
 $297 = tempRet0;
 $298 = (_i64Add(($296|0),($297|0),($290|0),($291|0))|0);
 $299 = tempRet0;
 $300 = (_bitshift64Shl(($290|0),($291|0),26)|0);
 $301 = tempRet0;
 $302 = (_i64Subtract(($262|0),($263|0),($300|0),($301|0))|0);
 $303 = tempRet0;
 $304 = (_i64Add(($282|0),($283|0),33554432,0)|0);
 $305 = tempRet0;
 $306 = (_bitshift64Ashr(($304|0),($305|0),26)|0);
 $307 = tempRet0;
 $308 = (_i64Add(($112|0),($113|0),($126|0),($127|0))|0);
 $309 = tempRet0;
 $310 = (_i64Add(($308|0),($309|0),($92|0),($93|0))|0);
 $311 = tempRet0;
 $312 = (_i64Add(($310|0),($311|0),($66|0),($67|0))|0);
 $313 = tempRet0;
 $314 = (_i64Add(($312|0),($313|0),($186|0),($187|0))|0);
 $315 = tempRet0;
 $316 = (_i64Add(($314|0),($315|0),($306|0),($307|0))|0);
 $317 = tempRet0;
 $318 = (_bitshift64Shl(($306|0),($307|0),26)|0);
 $319 = tempRet0;
 $320 = (_i64Subtract(($282|0),($283|0),($318|0),($319|0))|0);
 $321 = tempRet0;
 $322 = (_i64Add(($298|0),($299|0),16777216,0)|0);
 $323 = tempRet0;
 $324 = (_bitshift64Ashr(($322|0),($323|0),25)|0);
 $325 = tempRet0;
 $326 = (_i64Add(($324|0),($325|0),($248|0),($249|0))|0);
 $327 = tempRet0;
 $328 = (_bitshift64Shl(($324|0),($325|0),25)|0);
 $329 = tempRet0;
 $330 = (_i64Subtract(($298|0),($299|0),($328|0),($329|0))|0);
 $331 = tempRet0;
 $332 = (_i64Add(($316|0),($317|0),16777216,0)|0);
 $333 = tempRet0;
 $334 = (_bitshift64Ashr(($332|0),($333|0),25)|0);
 $335 = tempRet0;
 $336 = (_i64Add(($114|0),($115|0),($140|0),($141|0))|0);
 $337 = tempRet0;
 $338 = (_i64Add(($336|0),($337|0),($128|0),($129|0))|0);
 $339 = tempRet0;
 $340 = (_i64Add(($338|0),($339|0),($96|0),($97|0))|0);
 $341 = tempRet0;
 $342 = (_i64Add(($340|0),($341|0),($70|0),($71|0))|0);
 $343 = tempRet0;
 $344 = (_i64Add(($342|0),($343|0),($188|0),($189|0))|0);
 $345 = tempRet0;
 $346 = (_i64Add(($344|0),($345|0),($334|0),($335|0))|0);
 $347 = tempRet0;
 $348 = (_bitshift64Shl(($334|0),($335|0),25)|0);
 $349 = tempRet0;
 $350 = (_i64Subtract(($316|0),($317|0),($348|0),($349|0))|0);
 $351 = tempRet0;
 $352 = (_i64Add(($326|0),($327|0),33554432,0)|0);
 $353 = tempRet0;
 $354 = (_bitshift64Ashr(($352|0),($353|0),26)|0);
 $355 = tempRet0;
 $356 = (_i64Add(($286|0),($287|0),($354|0),($355|0))|0);
 $357 = tempRet0;
 $358 = (_bitshift64Shl(($354|0),($355|0),26)|0);
 $359 = tempRet0;
 $360 = (_i64Subtract(($326|0),($327|0),($358|0),($359|0))|0);
 $361 = tempRet0;
 $362 = (_i64Add(($346|0),($347|0),33554432,0)|0);
 $363 = tempRet0;
 $364 = (_bitshift64Ashr(($362|0),($363|0),26)|0);
 $365 = tempRet0;
 $366 = (_i64Add(($130|0),($131|0),($144|0),($145|0))|0);
 $367 = tempRet0;
 $368 = (_i64Add(($366|0),($367|0),($116|0),($117|0))|0);
 $369 = tempRet0;
 $370 = (_i64Add(($368|0),($369|0),($98|0),($99|0))|0);
 $371 = tempRet0;
 $372 = (_i64Add(($370|0),($371|0),($74|0),($75|0))|0);
 $373 = tempRet0;
 $374 = (_i64Add(($372|0),($373|0),($364|0),($365|0))|0);
 $375 = tempRet0;
 $376 = (_bitshift64Shl(($364|0),($365|0),26)|0);
 $377 = tempRet0;
 $378 = (_i64Subtract(($346|0),($347|0),($376|0),($377|0))|0);
 $379 = tempRet0;
 $380 = (_i64Add(($374|0),($375|0),16777216,0)|0);
 $381 = tempRet0;
 $382 = (_bitshift64Ashr(($380|0),($381|0),25)|0);
 $383 = tempRet0;
 $384 = (___muldi3(($382|0),($383|0),19,0)|0);
 $385 = tempRet0;
 $386 = (_i64Add(($384|0),($385|0),($230|0),($231|0))|0);
 $387 = tempRet0;
 $388 = (_bitshift64Shl(($382|0),($383|0),25)|0);
 $389 = tempRet0;
 $390 = (_i64Subtract(($374|0),($375|0),($388|0),($389|0))|0);
 $391 = tempRet0;
 $392 = (_i64Add(($386|0),($387|0),33554432,0)|0);
 $393 = tempRet0;
 $394 = (_bitshift64Ashr(($392|0),($393|0),26)|0);
 $395 = tempRet0;
 $396 = (_i64Add(($266|0),($267|0),($394|0),($395|0))|0);
 $397 = tempRet0;
 $398 = (_bitshift64Shl(($394|0),($395|0),26)|0);
 $399 = tempRet0;
 $400 = (_i64Subtract(($386|0),($387|0),($398|0),($399|0))|0);
 $401 = tempRet0;
 HEAP32[$0>>2] = $400;
 $402 = ((($0)) + 4|0);
 HEAP32[$402>>2] = $396;
 $403 = ((($0)) + 8|0);
 HEAP32[$403>>2] = $302;
 $404 = ((($0)) + 12|0);
 HEAP32[$404>>2] = $330;
 $405 = ((($0)) + 16|0);
 HEAP32[$405>>2] = $360;
 $406 = ((($0)) + 20|0);
 HEAP32[$406>>2] = $356;
 $407 = ((($0)) + 24|0);
 HEAP32[$407>>2] = $320;
 $408 = ((($0)) + 28|0);
 HEAP32[$408>>2] = $350;
 $409 = ((($0)) + 32|0);
 HEAP32[$409>>2] = $378;
 $410 = ((($0)) + 36|0);
 HEAP32[$410>>2] = $390;
 return;
}
function _fe_mul($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0;
 var $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0;
 var $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0;
 var $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0;
 var $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0;
 var $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0;
 var $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0;
 var $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0;
 var $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0;
 var $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0;
 var $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0;
 var $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0;
 var $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0;
 var $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0;
 var $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0;
 var $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0;
 var $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0;
 var $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0;
 var $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = ($24*19)|0;
 $42 = ($26*19)|0;
 $43 = ($28*19)|0;
 $44 = ($30*19)|0;
 $45 = ($32*19)|0;
 $46 = ($34*19)|0;
 $47 = ($36*19)|0;
 $48 = ($38*19)|0;
 $49 = ($40*19)|0;
 $50 = $5 << 1;
 $51 = $9 << 1;
 $52 = $13 << 1;
 $53 = $17 << 1;
 $54 = $21 << 1;
 $55 = ($3|0)<(0);
 $56 = $55 << 31 >> 31;
 $57 = ($22|0)<(0);
 $58 = $57 << 31 >> 31;
 $59 = (___muldi3(($22|0),($58|0),($3|0),($56|0))|0);
 $60 = tempRet0;
 $61 = ($24|0)<(0);
 $62 = $61 << 31 >> 31;
 $63 = (___muldi3(($24|0),($62|0),($3|0),($56|0))|0);
 $64 = tempRet0;
 $65 = ($26|0)<(0);
 $66 = $65 << 31 >> 31;
 $67 = (___muldi3(($26|0),($66|0),($3|0),($56|0))|0);
 $68 = tempRet0;
 $69 = ($28|0)<(0);
 $70 = $69 << 31 >> 31;
 $71 = (___muldi3(($28|0),($70|0),($3|0),($56|0))|0);
 $72 = tempRet0;
 $73 = ($30|0)<(0);
 $74 = $73 << 31 >> 31;
 $75 = (___muldi3(($30|0),($74|0),($3|0),($56|0))|0);
 $76 = tempRet0;
 $77 = ($32|0)<(0);
 $78 = $77 << 31 >> 31;
 $79 = (___muldi3(($32|0),($78|0),($3|0),($56|0))|0);
 $80 = tempRet0;
 $81 = ($34|0)<(0);
 $82 = $81 << 31 >> 31;
 $83 = (___muldi3(($34|0),($82|0),($3|0),($56|0))|0);
 $84 = tempRet0;
 $85 = ($36|0)<(0);
 $86 = $85 << 31 >> 31;
 $87 = (___muldi3(($36|0),($86|0),($3|0),($56|0))|0);
 $88 = tempRet0;
 $89 = ($38|0)<(0);
 $90 = $89 << 31 >> 31;
 $91 = (___muldi3(($38|0),($90|0),($3|0),($56|0))|0);
 $92 = tempRet0;
 $93 = ($40|0)<(0);
 $94 = $93 << 31 >> 31;
 $95 = (___muldi3(($40|0),($94|0),($3|0),($56|0))|0);
 $96 = tempRet0;
 $97 = ($5|0)<(0);
 $98 = $97 << 31 >> 31;
 $99 = (___muldi3(($22|0),($58|0),($5|0),($98|0))|0);
 $100 = tempRet0;
 $101 = ($50|0)<(0);
 $102 = $101 << 31 >> 31;
 $103 = (___muldi3(($24|0),($62|0),($50|0),($102|0))|0);
 $104 = tempRet0;
 $105 = (___muldi3(($26|0),($66|0),($5|0),($98|0))|0);
 $106 = tempRet0;
 $107 = (___muldi3(($28|0),($70|0),($50|0),($102|0))|0);
 $108 = tempRet0;
 $109 = (___muldi3(($30|0),($74|0),($5|0),($98|0))|0);
 $110 = tempRet0;
 $111 = (___muldi3(($32|0),($78|0),($50|0),($102|0))|0);
 $112 = tempRet0;
 $113 = (___muldi3(($34|0),($82|0),($5|0),($98|0))|0);
 $114 = tempRet0;
 $115 = (___muldi3(($36|0),($86|0),($50|0),($102|0))|0);
 $116 = tempRet0;
 $117 = (___muldi3(($38|0),($90|0),($5|0),($98|0))|0);
 $118 = tempRet0;
 $119 = ($49|0)<(0);
 $120 = $119 << 31 >> 31;
 $121 = (___muldi3(($49|0),($120|0),($50|0),($102|0))|0);
 $122 = tempRet0;
 $123 = ($7|0)<(0);
 $124 = $123 << 31 >> 31;
 $125 = (___muldi3(($22|0),($58|0),($7|0),($124|0))|0);
 $126 = tempRet0;
 $127 = (___muldi3(($24|0),($62|0),($7|0),($124|0))|0);
 $128 = tempRet0;
 $129 = (___muldi3(($26|0),($66|0),($7|0),($124|0))|0);
 $130 = tempRet0;
 $131 = (___muldi3(($28|0),($70|0),($7|0),($124|0))|0);
 $132 = tempRet0;
 $133 = (___muldi3(($30|0),($74|0),($7|0),($124|0))|0);
 $134 = tempRet0;
 $135 = (___muldi3(($32|0),($78|0),($7|0),($124|0))|0);
 $136 = tempRet0;
 $137 = (___muldi3(($34|0),($82|0),($7|0),($124|0))|0);
 $138 = tempRet0;
 $139 = (___muldi3(($36|0),($86|0),($7|0),($124|0))|0);
 $140 = tempRet0;
 $141 = ($48|0)<(0);
 $142 = $141 << 31 >> 31;
 $143 = (___muldi3(($48|0),($142|0),($7|0),($124|0))|0);
 $144 = tempRet0;
 $145 = (___muldi3(($49|0),($120|0),($7|0),($124|0))|0);
 $146 = tempRet0;
 $147 = ($9|0)<(0);
 $148 = $147 << 31 >> 31;
 $149 = (___muldi3(($22|0),($58|0),($9|0),($148|0))|0);
 $150 = tempRet0;
 $151 = ($51|0)<(0);
 $152 = $151 << 31 >> 31;
 $153 = (___muldi3(($24|0),($62|0),($51|0),($152|0))|0);
 $154 = tempRet0;
 $155 = (___muldi3(($26|0),($66|0),($9|0),($148|0))|0);
 $156 = tempRet0;
 $157 = (___muldi3(($28|0),($70|0),($51|0),($152|0))|0);
 $158 = tempRet0;
 $159 = (___muldi3(($30|0),($74|0),($9|0),($148|0))|0);
 $160 = tempRet0;
 $161 = (___muldi3(($32|0),($78|0),($51|0),($152|0))|0);
 $162 = tempRet0;
 $163 = (___muldi3(($34|0),($82|0),($9|0),($148|0))|0);
 $164 = tempRet0;
 $165 = ($47|0)<(0);
 $166 = $165 << 31 >> 31;
 $167 = (___muldi3(($47|0),($166|0),($51|0),($152|0))|0);
 $168 = tempRet0;
 $169 = (___muldi3(($48|0),($142|0),($9|0),($148|0))|0);
 $170 = tempRet0;
 $171 = (___muldi3(($49|0),($120|0),($51|0),($152|0))|0);
 $172 = tempRet0;
 $173 = ($11|0)<(0);
 $174 = $173 << 31 >> 31;
 $175 = (___muldi3(($22|0),($58|0),($11|0),($174|0))|0);
 $176 = tempRet0;
 $177 = (___muldi3(($24|0),($62|0),($11|0),($174|0))|0);
 $178 = tempRet0;
 $179 = (___muldi3(($26|0),($66|0),($11|0),($174|0))|0);
 $180 = tempRet0;
 $181 = (___muldi3(($28|0),($70|0),($11|0),($174|0))|0);
 $182 = tempRet0;
 $183 = (___muldi3(($30|0),($74|0),($11|0),($174|0))|0);
 $184 = tempRet0;
 $185 = (___muldi3(($32|0),($78|0),($11|0),($174|0))|0);
 $186 = tempRet0;
 $187 = ($46|0)<(0);
 $188 = $187 << 31 >> 31;
 $189 = (___muldi3(($46|0),($188|0),($11|0),($174|0))|0);
 $190 = tempRet0;
 $191 = (___muldi3(($47|0),($166|0),($11|0),($174|0))|0);
 $192 = tempRet0;
 $193 = (___muldi3(($48|0),($142|0),($11|0),($174|0))|0);
 $194 = tempRet0;
 $195 = (___muldi3(($49|0),($120|0),($11|0),($174|0))|0);
 $196 = tempRet0;
 $197 = ($13|0)<(0);
 $198 = $197 << 31 >> 31;
 $199 = (___muldi3(($22|0),($58|0),($13|0),($198|0))|0);
 $200 = tempRet0;
 $201 = ($52|0)<(0);
 $202 = $201 << 31 >> 31;
 $203 = (___muldi3(($24|0),($62|0),($52|0),($202|0))|0);
 $204 = tempRet0;
 $205 = (___muldi3(($26|0),($66|0),($13|0),($198|0))|0);
 $206 = tempRet0;
 $207 = (___muldi3(($28|0),($70|0),($52|0),($202|0))|0);
 $208 = tempRet0;
 $209 = (___muldi3(($30|0),($74|0),($13|0),($198|0))|0);
 $210 = tempRet0;
 $211 = ($45|0)<(0);
 $212 = $211 << 31 >> 31;
 $213 = (___muldi3(($45|0),($212|0),($52|0),($202|0))|0);
 $214 = tempRet0;
 $215 = (___muldi3(($46|0),($188|0),($13|0),($198|0))|0);
 $216 = tempRet0;
 $217 = (___muldi3(($47|0),($166|0),($52|0),($202|0))|0);
 $218 = tempRet0;
 $219 = (___muldi3(($48|0),($142|0),($13|0),($198|0))|0);
 $220 = tempRet0;
 $221 = (___muldi3(($49|0),($120|0),($52|0),($202|0))|0);
 $222 = tempRet0;
 $223 = ($15|0)<(0);
 $224 = $223 << 31 >> 31;
 $225 = (___muldi3(($22|0),($58|0),($15|0),($224|0))|0);
 $226 = tempRet0;
 $227 = (___muldi3(($24|0),($62|0),($15|0),($224|0))|0);
 $228 = tempRet0;
 $229 = (___muldi3(($26|0),($66|0),($15|0),($224|0))|0);
 $230 = tempRet0;
 $231 = (___muldi3(($28|0),($70|0),($15|0),($224|0))|0);
 $232 = tempRet0;
 $233 = ($44|0)<(0);
 $234 = $233 << 31 >> 31;
 $235 = (___muldi3(($44|0),($234|0),($15|0),($224|0))|0);
 $236 = tempRet0;
 $237 = (___muldi3(($45|0),($212|0),($15|0),($224|0))|0);
 $238 = tempRet0;
 $239 = (___muldi3(($46|0),($188|0),($15|0),($224|0))|0);
 $240 = tempRet0;
 $241 = (___muldi3(($47|0),($166|0),($15|0),($224|0))|0);
 $242 = tempRet0;
 $243 = (___muldi3(($48|0),($142|0),($15|0),($224|0))|0);
 $244 = tempRet0;
 $245 = (___muldi3(($49|0),($120|0),($15|0),($224|0))|0);
 $246 = tempRet0;
 $247 = ($17|0)<(0);
 $248 = $247 << 31 >> 31;
 $249 = (___muldi3(($22|0),($58|0),($17|0),($248|0))|0);
 $250 = tempRet0;
 $251 = ($53|0)<(0);
 $252 = $251 << 31 >> 31;
 $253 = (___muldi3(($24|0),($62|0),($53|0),($252|0))|0);
 $254 = tempRet0;
 $255 = (___muldi3(($26|0),($66|0),($17|0),($248|0))|0);
 $256 = tempRet0;
 $257 = ($43|0)<(0);
 $258 = $257 << 31 >> 31;
 $259 = (___muldi3(($43|0),($258|0),($53|0),($252|0))|0);
 $260 = tempRet0;
 $261 = (___muldi3(($44|0),($234|0),($17|0),($248|0))|0);
 $262 = tempRet0;
 $263 = (___muldi3(($45|0),($212|0),($53|0),($252|0))|0);
 $264 = tempRet0;
 $265 = (___muldi3(($46|0),($188|0),($17|0),($248|0))|0);
 $266 = tempRet0;
 $267 = (___muldi3(($47|0),($166|0),($53|0),($252|0))|0);
 $268 = tempRet0;
 $269 = (___muldi3(($48|0),($142|0),($17|0),($248|0))|0);
 $270 = tempRet0;
 $271 = (___muldi3(($49|0),($120|0),($53|0),($252|0))|0);
 $272 = tempRet0;
 $273 = ($19|0)<(0);
 $274 = $273 << 31 >> 31;
 $275 = (___muldi3(($22|0),($58|0),($19|0),($274|0))|0);
 $276 = tempRet0;
 $277 = (___muldi3(($24|0),($62|0),($19|0),($274|0))|0);
 $278 = tempRet0;
 $279 = ($42|0)<(0);
 $280 = $279 << 31 >> 31;
 $281 = (___muldi3(($42|0),($280|0),($19|0),($274|0))|0);
 $282 = tempRet0;
 $283 = (___muldi3(($43|0),($258|0),($19|0),($274|0))|0);
 $284 = tempRet0;
 $285 = (___muldi3(($44|0),($234|0),($19|0),($274|0))|0);
 $286 = tempRet0;
 $287 = (___muldi3(($45|0),($212|0),($19|0),($274|0))|0);
 $288 = tempRet0;
 $289 = (___muldi3(($46|0),($188|0),($19|0),($274|0))|0);
 $290 = tempRet0;
 $291 = (___muldi3(($47|0),($166|0),($19|0),($274|0))|0);
 $292 = tempRet0;
 $293 = (___muldi3(($48|0),($142|0),($19|0),($274|0))|0);
 $294 = tempRet0;
 $295 = (___muldi3(($49|0),($120|0),($19|0),($274|0))|0);
 $296 = tempRet0;
 $297 = ($21|0)<(0);
 $298 = $297 << 31 >> 31;
 $299 = (___muldi3(($22|0),($58|0),($21|0),($298|0))|0);
 $300 = tempRet0;
 $301 = ($54|0)<(0);
 $302 = $301 << 31 >> 31;
 $303 = ($41|0)<(0);
 $304 = $303 << 31 >> 31;
 $305 = (___muldi3(($41|0),($304|0),($54|0),($302|0))|0);
 $306 = tempRet0;
 $307 = (___muldi3(($42|0),($280|0),($21|0),($298|0))|0);
 $308 = tempRet0;
 $309 = (___muldi3(($43|0),($258|0),($54|0),($302|0))|0);
 $310 = tempRet0;
 $311 = (___muldi3(($44|0),($234|0),($21|0),($298|0))|0);
 $312 = tempRet0;
 $313 = (___muldi3(($45|0),($212|0),($54|0),($302|0))|0);
 $314 = tempRet0;
 $315 = (___muldi3(($46|0),($188|0),($21|0),($298|0))|0);
 $316 = tempRet0;
 $317 = (___muldi3(($47|0),($166|0),($54|0),($302|0))|0);
 $318 = tempRet0;
 $319 = (___muldi3(($48|0),($142|0),($21|0),($298|0))|0);
 $320 = tempRet0;
 $321 = (___muldi3(($49|0),($120|0),($54|0),($302|0))|0);
 $322 = tempRet0;
 $323 = (_i64Add(($305|0),($306|0),($59|0),($60|0))|0);
 $324 = tempRet0;
 $325 = (_i64Add(($323|0),($324|0),($281|0),($282|0))|0);
 $326 = tempRet0;
 $327 = (_i64Add(($325|0),($326|0),($259|0),($260|0))|0);
 $328 = tempRet0;
 $329 = (_i64Add(($327|0),($328|0),($235|0),($236|0))|0);
 $330 = tempRet0;
 $331 = (_i64Add(($329|0),($330|0),($213|0),($214|0))|0);
 $332 = tempRet0;
 $333 = (_i64Add(($331|0),($332|0),($189|0),($190|0))|0);
 $334 = tempRet0;
 $335 = (_i64Add(($333|0),($334|0),($167|0),($168|0))|0);
 $336 = tempRet0;
 $337 = (_i64Add(($335|0),($336|0),($143|0),($144|0))|0);
 $338 = tempRet0;
 $339 = (_i64Add(($337|0),($338|0),($121|0),($122|0))|0);
 $340 = tempRet0;
 $341 = (_i64Add(($63|0),($64|0),($99|0),($100|0))|0);
 $342 = tempRet0;
 $343 = (_i64Add(($153|0),($154|0),($175|0),($176|0))|0);
 $344 = tempRet0;
 $345 = (_i64Add(($343|0),($344|0),($129|0),($130|0))|0);
 $346 = tempRet0;
 $347 = (_i64Add(($345|0),($346|0),($107|0),($108|0))|0);
 $348 = tempRet0;
 $349 = (_i64Add(($347|0),($348|0),($75|0),($76|0))|0);
 $350 = tempRet0;
 $351 = (_i64Add(($349|0),($350|0),($313|0),($314|0))|0);
 $352 = tempRet0;
 $353 = (_i64Add(($351|0),($352|0),($289|0),($290|0))|0);
 $354 = tempRet0;
 $355 = (_i64Add(($353|0),($354|0),($267|0),($268|0))|0);
 $356 = tempRet0;
 $357 = (_i64Add(($355|0),($356|0),($243|0),($244|0))|0);
 $358 = tempRet0;
 $359 = (_i64Add(($357|0),($358|0),($221|0),($222|0))|0);
 $360 = tempRet0;
 $361 = (_i64Add(($339|0),($340|0),33554432,0)|0);
 $362 = tempRet0;
 $363 = (_bitshift64Ashr(($361|0),($362|0),26)|0);
 $364 = tempRet0;
 $365 = (_i64Add(($341|0),($342|0),($307|0),($308|0))|0);
 $366 = tempRet0;
 $367 = (_i64Add(($365|0),($366|0),($283|0),($284|0))|0);
 $368 = tempRet0;
 $369 = (_i64Add(($367|0),($368|0),($261|0),($262|0))|0);
 $370 = tempRet0;
 $371 = (_i64Add(($369|0),($370|0),($237|0),($238|0))|0);
 $372 = tempRet0;
 $373 = (_i64Add(($371|0),($372|0),($215|0),($216|0))|0);
 $374 = tempRet0;
 $375 = (_i64Add(($373|0),($374|0),($191|0),($192|0))|0);
 $376 = tempRet0;
 $377 = (_i64Add(($375|0),($376|0),($169|0),($170|0))|0);
 $378 = tempRet0;
 $379 = (_i64Add(($377|0),($378|0),($145|0),($146|0))|0);
 $380 = tempRet0;
 $381 = (_i64Add(($379|0),($380|0),($363|0),($364|0))|0);
 $382 = tempRet0;
 $383 = (_bitshift64Shl(($363|0),($364|0),26)|0);
 $384 = tempRet0;
 $385 = (_i64Subtract(($339|0),($340|0),($383|0),($384|0))|0);
 $386 = tempRet0;
 $387 = (_i64Add(($359|0),($360|0),33554432,0)|0);
 $388 = tempRet0;
 $389 = (_bitshift64Ashr(($387|0),($388|0),26)|0);
 $390 = tempRet0;
 $391 = (_i64Add(($177|0),($178|0),($199|0),($200|0))|0);
 $392 = tempRet0;
 $393 = (_i64Add(($391|0),($392|0),($155|0),($156|0))|0);
 $394 = tempRet0;
 $395 = (_i64Add(($393|0),($394|0),($131|0),($132|0))|0);
 $396 = tempRet0;
 $397 = (_i64Add(($395|0),($396|0),($109|0),($110|0))|0);
 $398 = tempRet0;
 $399 = (_i64Add(($397|0),($398|0),($79|0),($80|0))|0);
 $400 = tempRet0;
 $401 = (_i64Add(($399|0),($400|0),($315|0),($316|0))|0);
 $402 = tempRet0;
 $403 = (_i64Add(($401|0),($402|0),($291|0),($292|0))|0);
 $404 = tempRet0;
 $405 = (_i64Add(($403|0),($404|0),($269|0),($270|0))|0);
 $406 = tempRet0;
 $407 = (_i64Add(($405|0),($406|0),($245|0),($246|0))|0);
 $408 = tempRet0;
 $409 = (_i64Add(($407|0),($408|0),($389|0),($390|0))|0);
 $410 = tempRet0;
 $411 = (_bitshift64Shl(($389|0),($390|0),26)|0);
 $412 = tempRet0;
 $413 = (_i64Subtract(($359|0),($360|0),($411|0),($412|0))|0);
 $414 = tempRet0;
 $415 = (_i64Add(($381|0),($382|0),16777216,0)|0);
 $416 = tempRet0;
 $417 = (_bitshift64Ashr(($415|0),($416|0),25)|0);
 $418 = tempRet0;
 $419 = (_i64Add(($103|0),($104|0),($125|0),($126|0))|0);
 $420 = tempRet0;
 $421 = (_i64Add(($419|0),($420|0),($67|0),($68|0))|0);
 $422 = tempRet0;
 $423 = (_i64Add(($421|0),($422|0),($309|0),($310|0))|0);
 $424 = tempRet0;
 $425 = (_i64Add(($423|0),($424|0),($285|0),($286|0))|0);
 $426 = tempRet0;
 $427 = (_i64Add(($425|0),($426|0),($263|0),($264|0))|0);
 $428 = tempRet0;
 $429 = (_i64Add(($427|0),($428|0),($239|0),($240|0))|0);
 $430 = tempRet0;
 $431 = (_i64Add(($429|0),($430|0),($217|0),($218|0))|0);
 $432 = tempRet0;
 $433 = (_i64Add(($431|0),($432|0),($193|0),($194|0))|0);
 $434 = tempRet0;
 $435 = (_i64Add(($433|0),($434|0),($171|0),($172|0))|0);
 $436 = tempRet0;
 $437 = (_i64Add(($435|0),($436|0),($417|0),($418|0))|0);
 $438 = tempRet0;
 $439 = (_bitshift64Shl(($417|0),($418|0),25)|0);
 $440 = tempRet0;
 $441 = (_i64Subtract(($381|0),($382|0),($439|0),($440|0))|0);
 $442 = tempRet0;
 $443 = (_i64Add(($409|0),($410|0),16777216,0)|0);
 $444 = tempRet0;
 $445 = (_bitshift64Ashr(($443|0),($444|0),25)|0);
 $446 = tempRet0;
 $447 = (_i64Add(($203|0),($204|0),($225|0),($226|0))|0);
 $448 = tempRet0;
 $449 = (_i64Add(($447|0),($448|0),($179|0),($180|0))|0);
 $450 = tempRet0;
 $451 = (_i64Add(($449|0),($450|0),($157|0),($158|0))|0);
 $452 = tempRet0;
 $453 = (_i64Add(($451|0),($452|0),($133|0),($134|0))|0);
 $454 = tempRet0;
 $455 = (_i64Add(($453|0),($454|0),($111|0),($112|0))|0);
 $456 = tempRet0;
 $457 = (_i64Add(($455|0),($456|0),($83|0),($84|0))|0);
 $458 = tempRet0;
 $459 = (_i64Add(($457|0),($458|0),($317|0),($318|0))|0);
 $460 = tempRet0;
 $461 = (_i64Add(($459|0),($460|0),($293|0),($294|0))|0);
 $462 = tempRet0;
 $463 = (_i64Add(($461|0),($462|0),($271|0),($272|0))|0);
 $464 = tempRet0;
 $465 = (_i64Add(($463|0),($464|0),($445|0),($446|0))|0);
 $466 = tempRet0;
 $467 = (_bitshift64Shl(($445|0),($446|0),25)|0);
 $468 = tempRet0;
 $469 = (_i64Subtract(($409|0),($410|0),($467|0),($468|0))|0);
 $470 = tempRet0;
 $471 = (_i64Add(($437|0),($438|0),33554432,0)|0);
 $472 = tempRet0;
 $473 = (_bitshift64Ashr(($471|0),($472|0),26)|0);
 $474 = tempRet0;
 $475 = (_i64Add(($127|0),($128|0),($149|0),($150|0))|0);
 $476 = tempRet0;
 $477 = (_i64Add(($475|0),($476|0),($105|0),($106|0))|0);
 $478 = tempRet0;
 $479 = (_i64Add(($477|0),($478|0),($71|0),($72|0))|0);
 $480 = tempRet0;
 $481 = (_i64Add(($479|0),($480|0),($311|0),($312|0))|0);
 $482 = tempRet0;
 $483 = (_i64Add(($481|0),($482|0),($287|0),($288|0))|0);
 $484 = tempRet0;
 $485 = (_i64Add(($483|0),($484|0),($265|0),($266|0))|0);
 $486 = tempRet0;
 $487 = (_i64Add(($485|0),($486|0),($241|0),($242|0))|0);
 $488 = tempRet0;
 $489 = (_i64Add(($487|0),($488|0),($219|0),($220|0))|0);
 $490 = tempRet0;
 $491 = (_i64Add(($489|0),($490|0),($195|0),($196|0))|0);
 $492 = tempRet0;
 $493 = (_i64Add(($491|0),($492|0),($473|0),($474|0))|0);
 $494 = tempRet0;
 $495 = (_bitshift64Shl(($473|0),($474|0),26)|0);
 $496 = tempRet0;
 $497 = (_i64Subtract(($437|0),($438|0),($495|0),($496|0))|0);
 $498 = tempRet0;
 $499 = (_i64Add(($465|0),($466|0),33554432,0)|0);
 $500 = tempRet0;
 $501 = (_bitshift64Ashr(($499|0),($500|0),26)|0);
 $502 = tempRet0;
 $503 = (_i64Add(($227|0),($228|0),($249|0),($250|0))|0);
 $504 = tempRet0;
 $505 = (_i64Add(($503|0),($504|0),($205|0),($206|0))|0);
 $506 = tempRet0;
 $507 = (_i64Add(($505|0),($506|0),($181|0),($182|0))|0);
 $508 = tempRet0;
 $509 = (_i64Add(($507|0),($508|0),($159|0),($160|0))|0);
 $510 = tempRet0;
 $511 = (_i64Add(($509|0),($510|0),($135|0),($136|0))|0);
 $512 = tempRet0;
 $513 = (_i64Add(($511|0),($512|0),($113|0),($114|0))|0);
 $514 = tempRet0;
 $515 = (_i64Add(($513|0),($514|0),($87|0),($88|0))|0);
 $516 = tempRet0;
 $517 = (_i64Add(($515|0),($516|0),($319|0),($320|0))|0);
 $518 = tempRet0;
 $519 = (_i64Add(($517|0),($518|0),($295|0),($296|0))|0);
 $520 = tempRet0;
 $521 = (_i64Add(($519|0),($520|0),($501|0),($502|0))|0);
 $522 = tempRet0;
 $523 = (_bitshift64Shl(($501|0),($502|0),26)|0);
 $524 = tempRet0;
 $525 = (_i64Subtract(($465|0),($466|0),($523|0),($524|0))|0);
 $526 = tempRet0;
 $527 = (_i64Add(($493|0),($494|0),16777216,0)|0);
 $528 = tempRet0;
 $529 = (_bitshift64Ashr(($527|0),($528|0),25)|0);
 $530 = tempRet0;
 $531 = (_i64Add(($529|0),($530|0),($413|0),($414|0))|0);
 $532 = tempRet0;
 $533 = (_bitshift64Shl(($529|0),($530|0),25)|0);
 $534 = tempRet0;
 $535 = (_i64Subtract(($493|0),($494|0),($533|0),($534|0))|0);
 $536 = tempRet0;
 $537 = (_i64Add(($521|0),($522|0),16777216,0)|0);
 $538 = tempRet0;
 $539 = (_bitshift64Ashr(($537|0),($538|0),25)|0);
 $540 = tempRet0;
 $541 = (_i64Add(($253|0),($254|0),($275|0),($276|0))|0);
 $542 = tempRet0;
 $543 = (_i64Add(($541|0),($542|0),($229|0),($230|0))|0);
 $544 = tempRet0;
 $545 = (_i64Add(($543|0),($544|0),($207|0),($208|0))|0);
 $546 = tempRet0;
 $547 = (_i64Add(($545|0),($546|0),($183|0),($184|0))|0);
 $548 = tempRet0;
 $549 = (_i64Add(($547|0),($548|0),($161|0),($162|0))|0);
 $550 = tempRet0;
 $551 = (_i64Add(($549|0),($550|0),($137|0),($138|0))|0);
 $552 = tempRet0;
 $553 = (_i64Add(($551|0),($552|0),($115|0),($116|0))|0);
 $554 = tempRet0;
 $555 = (_i64Add(($553|0),($554|0),($91|0),($92|0))|0);
 $556 = tempRet0;
 $557 = (_i64Add(($555|0),($556|0),($321|0),($322|0))|0);
 $558 = tempRet0;
 $559 = (_i64Add(($557|0),($558|0),($539|0),($540|0))|0);
 $560 = tempRet0;
 $561 = (_bitshift64Shl(($539|0),($540|0),25)|0);
 $562 = tempRet0;
 $563 = (_i64Subtract(($521|0),($522|0),($561|0),($562|0))|0);
 $564 = tempRet0;
 $565 = (_i64Add(($531|0),($532|0),33554432,0)|0);
 $566 = tempRet0;
 $567 = (_bitshift64Ashr(($565|0),($566|0),26)|0);
 $568 = tempRet0;
 $569 = (_i64Add(($469|0),($470|0),($567|0),($568|0))|0);
 $570 = tempRet0;
 $571 = (_bitshift64Shl(($567|0),($568|0),26)|0);
 $572 = tempRet0;
 $573 = (_i64Subtract(($531|0),($532|0),($571|0),($572|0))|0);
 $574 = tempRet0;
 $575 = (_i64Add(($559|0),($560|0),33554432,0)|0);
 $576 = tempRet0;
 $577 = (_bitshift64Ashr(($575|0),($576|0),26)|0);
 $578 = tempRet0;
 $579 = (_i64Add(($277|0),($278|0),($299|0),($300|0))|0);
 $580 = tempRet0;
 $581 = (_i64Add(($579|0),($580|0),($255|0),($256|0))|0);
 $582 = tempRet0;
 $583 = (_i64Add(($581|0),($582|0),($231|0),($232|0))|0);
 $584 = tempRet0;
 $585 = (_i64Add(($583|0),($584|0),($209|0),($210|0))|0);
 $586 = tempRet0;
 $587 = (_i64Add(($585|0),($586|0),($185|0),($186|0))|0);
 $588 = tempRet0;
 $589 = (_i64Add(($587|0),($588|0),($163|0),($164|0))|0);
 $590 = tempRet0;
 $591 = (_i64Add(($589|0),($590|0),($139|0),($140|0))|0);
 $592 = tempRet0;
 $593 = (_i64Add(($591|0),($592|0),($117|0),($118|0))|0);
 $594 = tempRet0;
 $595 = (_i64Add(($593|0),($594|0),($95|0),($96|0))|0);
 $596 = tempRet0;
 $597 = (_i64Add(($595|0),($596|0),($577|0),($578|0))|0);
 $598 = tempRet0;
 $599 = (_bitshift64Shl(($577|0),($578|0),26)|0);
 $600 = tempRet0;
 $601 = (_i64Subtract(($559|0),($560|0),($599|0),($600|0))|0);
 $602 = tempRet0;
 $603 = (_i64Add(($597|0),($598|0),16777216,0)|0);
 $604 = tempRet0;
 $605 = (_bitshift64Ashr(($603|0),($604|0),25)|0);
 $606 = tempRet0;
 $607 = (___muldi3(($605|0),($606|0),19,0)|0);
 $608 = tempRet0;
 $609 = (_i64Add(($607|0),($608|0),($385|0),($386|0))|0);
 $610 = tempRet0;
 $611 = (_bitshift64Shl(($605|0),($606|0),25)|0);
 $612 = tempRet0;
 $613 = (_i64Subtract(($597|0),($598|0),($611|0),($612|0))|0);
 $614 = tempRet0;
 $615 = (_i64Add(($609|0),($610|0),33554432,0)|0);
 $616 = tempRet0;
 $617 = (_bitshift64Ashr(($615|0),($616|0),26)|0);
 $618 = tempRet0;
 $619 = (_i64Add(($441|0),($442|0),($617|0),($618|0))|0);
 $620 = tempRet0;
 $621 = (_bitshift64Shl(($617|0),($618|0),26)|0);
 $622 = tempRet0;
 $623 = (_i64Subtract(($609|0),($610|0),($621|0),($622|0))|0);
 $624 = tempRet0;
 HEAP32[$0>>2] = $623;
 $625 = ((($0)) + 4|0);
 HEAP32[$625>>2] = $619;
 $626 = ((($0)) + 8|0);
 HEAP32[$626>>2] = $497;
 $627 = ((($0)) + 12|0);
 HEAP32[$627>>2] = $535;
 $628 = ((($0)) + 16|0);
 HEAP32[$628>>2] = $573;
 $629 = ((($0)) + 20|0);
 HEAP32[$629>>2] = $569;
 $630 = ((($0)) + 24|0);
 HEAP32[$630>>2] = $525;
 $631 = ((($0)) + 28|0);
 HEAP32[$631>>2] = $563;
 $632 = ((($0)) + 32|0);
 HEAP32[$632>>2] = $601;
 $633 = ((($0)) + 36|0);
 HEAP32[$633>>2] = $613;
 return;
}
function _fe_isnegative($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp;
 _fe_tobytes($1,$0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 & 1;
 $4 = $3&255;
 STACKTOP = sp;return ($4|0);
}
function _fe_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($20*19)|0;
 $22 = (($21) + 16777216)|0;
 $23 = $22 >> 25;
 $24 = (($23) + ($2))|0;
 $25 = $24 >> 26;
 $26 = (($25) + ($4))|0;
 $27 = $26 >> 25;
 $28 = (($27) + ($6))|0;
 $29 = $28 >> 26;
 $30 = (($29) + ($8))|0;
 $31 = $30 >> 25;
 $32 = (($31) + ($10))|0;
 $33 = $32 >> 26;
 $34 = (($33) + ($12))|0;
 $35 = $34 >> 25;
 $36 = (($35) + ($14))|0;
 $37 = $36 >> 26;
 $38 = (($37) + ($16))|0;
 $39 = $38 >> 25;
 $40 = (($39) + ($18))|0;
 $41 = $40 >> 26;
 $42 = (($41) + ($20))|0;
 $43 = $42 >> 25;
 $44 = ($43*19)|0;
 $45 = (($44) + ($2))|0;
 $46 = $45 >> 26;
 $47 = (($46) + ($4))|0;
 $48 = $46 << 26;
 $49 = (($45) - ($48))|0;
 $50 = $47 >> 25;
 $51 = (($50) + ($6))|0;
 $52 = $50 << 25;
 $53 = (($47) - ($52))|0;
 $54 = $51 >> 26;
 $55 = (($54) + ($8))|0;
 $56 = $54 << 26;
 $57 = (($51) - ($56))|0;
 $58 = $55 >> 25;
 $59 = (($58) + ($10))|0;
 $60 = $58 << 25;
 $61 = (($55) - ($60))|0;
 $62 = $59 >> 26;
 $63 = (($62) + ($12))|0;
 $64 = $62 << 26;
 $65 = (($59) - ($64))|0;
 $66 = $63 >> 25;
 $67 = (($66) + ($14))|0;
 $68 = $66 << 25;
 $69 = (($63) - ($68))|0;
 $70 = $67 >> 26;
 $71 = (($70) + ($16))|0;
 $72 = $70 << 26;
 $73 = (($67) - ($72))|0;
 $74 = $71 >> 25;
 $75 = (($74) + ($18))|0;
 $76 = $74 << 25;
 $77 = (($71) - ($76))|0;
 $78 = $75 >> 26;
 $79 = (($78) + ($20))|0;
 $80 = $78 << 26;
 $81 = (($75) - ($80))|0;
 $82 = $79 & 33554431;
 $83 = $49&255;
 HEAP8[$0>>0] = $83;
 $84 = $49 >>> 8;
 $85 = $84&255;
 $86 = ((($0)) + 1|0);
 HEAP8[$86>>0] = $85;
 $87 = $49 >>> 16;
 $88 = $87&255;
 $89 = ((($0)) + 2|0);
 HEAP8[$89>>0] = $88;
 $90 = $49 >>> 24;
 $91 = $53 << 2;
 $92 = $91 | $90;
 $93 = $92&255;
 $94 = ((($0)) + 3|0);
 HEAP8[$94>>0] = $93;
 $95 = $53 >>> 6;
 $96 = $95&255;
 $97 = ((($0)) + 4|0);
 HEAP8[$97>>0] = $96;
 $98 = $53 >>> 14;
 $99 = $98&255;
 $100 = ((($0)) + 5|0);
 HEAP8[$100>>0] = $99;
 $101 = $53 >>> 22;
 $102 = $57 << 3;
 $103 = $102 | $101;
 $104 = $103&255;
 $105 = ((($0)) + 6|0);
 HEAP8[$105>>0] = $104;
 $106 = $57 >>> 5;
 $107 = $106&255;
 $108 = ((($0)) + 7|0);
 HEAP8[$108>>0] = $107;
 $109 = $57 >>> 13;
 $110 = $109&255;
 $111 = ((($0)) + 8|0);
 HEAP8[$111>>0] = $110;
 $112 = $57 >>> 21;
 $113 = $61 << 5;
 $114 = $113 | $112;
 $115 = $114&255;
 $116 = ((($0)) + 9|0);
 HEAP8[$116>>0] = $115;
 $117 = $61 >>> 3;
 $118 = $117&255;
 $119 = ((($0)) + 10|0);
 HEAP8[$119>>0] = $118;
 $120 = $61 >>> 11;
 $121 = $120&255;
 $122 = ((($0)) + 11|0);
 HEAP8[$122>>0] = $121;
 $123 = $61 >>> 19;
 $124 = $65 << 6;
 $125 = $124 | $123;
 $126 = $125&255;
 $127 = ((($0)) + 12|0);
 HEAP8[$127>>0] = $126;
 $128 = $65 >>> 2;
 $129 = $128&255;
 $130 = ((($0)) + 13|0);
 HEAP8[$130>>0] = $129;
 $131 = $65 >>> 10;
 $132 = $131&255;
 $133 = ((($0)) + 14|0);
 HEAP8[$133>>0] = $132;
 $134 = $65 >>> 18;
 $135 = $134&255;
 $136 = ((($0)) + 15|0);
 HEAP8[$136>>0] = $135;
 $137 = $69&255;
 $138 = ((($0)) + 16|0);
 HEAP8[$138>>0] = $137;
 $139 = $69 >>> 8;
 $140 = $139&255;
 $141 = ((($0)) + 17|0);
 HEAP8[$141>>0] = $140;
 $142 = $69 >>> 16;
 $143 = $142&255;
 $144 = ((($0)) + 18|0);
 HEAP8[$144>>0] = $143;
 $145 = $69 >>> 24;
 $146 = $73 << 1;
 $147 = $146 | $145;
 $148 = $147&255;
 $149 = ((($0)) + 19|0);
 HEAP8[$149>>0] = $148;
 $150 = $73 >>> 7;
 $151 = $150&255;
 $152 = ((($0)) + 20|0);
 HEAP8[$152>>0] = $151;
 $153 = $73 >>> 15;
 $154 = $153&255;
 $155 = ((($0)) + 21|0);
 HEAP8[$155>>0] = $154;
 $156 = $73 >>> 23;
 $157 = $77 << 3;
 $158 = $157 | $156;
 $159 = $158&255;
 $160 = ((($0)) + 22|0);
 HEAP8[$160>>0] = $159;
 $161 = $77 >>> 5;
 $162 = $161&255;
 $163 = ((($0)) + 23|0);
 HEAP8[$163>>0] = $162;
 $164 = $77 >>> 13;
 $165 = $164&255;
 $166 = ((($0)) + 24|0);
 HEAP8[$166>>0] = $165;
 $167 = $77 >>> 21;
 $168 = $81 << 4;
 $169 = $168 | $167;
 $170 = $169&255;
 $171 = ((($0)) + 25|0);
 HEAP8[$171>>0] = $170;
 $172 = $81 >>> 4;
 $173 = $172&255;
 $174 = ((($0)) + 26|0);
 HEAP8[$174>>0] = $173;
 $175 = $81 >>> 12;
 $176 = $175&255;
 $177 = ((($0)) + 27|0);
 HEAP8[$177>>0] = $176;
 $178 = $81 >>> 20;
 $179 = $82 << 6;
 $180 = $178 | $179;
 $181 = $180&255;
 $182 = ((($0)) + 28|0);
 HEAP8[$182>>0] = $181;
 $183 = $79 >>> 2;
 $184 = $183&255;
 $185 = ((($0)) + 29|0);
 HEAP8[$185>>0] = $184;
 $186 = $79 >>> 10;
 $187 = $186&255;
 $188 = ((($0)) + 30|0);
 HEAP8[$188>>0] = $187;
 $189 = $82 >>> 18;
 $190 = $189&255;
 $191 = ((($0)) + 31|0);
 HEAP8[$191>>0] = $190;
 return;
}
function _fe_isnonzero($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp;
 _fe_tobytes($1,$0);
 $2 = HEAP8[$1>>0]|0;
 $3 = ((($1)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4 | $2;
 $6 = ((($1)) + 2|0);
 $7 = HEAP8[$6>>0]|0;
 $8 = $5 | $7;
 $9 = ((($1)) + 3|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $8 | $10;
 $12 = ((($1)) + 4|0);
 $13 = HEAP8[$12>>0]|0;
 $14 = $11 | $13;
 $15 = ((($1)) + 5|0);
 $16 = HEAP8[$15>>0]|0;
 $17 = $14 | $16;
 $18 = ((($1)) + 6|0);
 $19 = HEAP8[$18>>0]|0;
 $20 = $17 | $19;
 $21 = ((($1)) + 7|0);
 $22 = HEAP8[$21>>0]|0;
 $23 = $20 | $22;
 $24 = ((($1)) + 8|0);
 $25 = HEAP8[$24>>0]|0;
 $26 = $23 | $25;
 $27 = ((($1)) + 9|0);
 $28 = HEAP8[$27>>0]|0;
 $29 = $26 | $28;
 $30 = ((($1)) + 10|0);
 $31 = HEAP8[$30>>0]|0;
 $32 = $29 | $31;
 $33 = ((($1)) + 11|0);
 $34 = HEAP8[$33>>0]|0;
 $35 = $32 | $34;
 $36 = ((($1)) + 12|0);
 $37 = HEAP8[$36>>0]|0;
 $38 = $35 | $37;
 $39 = ((($1)) + 13|0);
 $40 = HEAP8[$39>>0]|0;
 $41 = $38 | $40;
 $42 = ((($1)) + 14|0);
 $43 = HEAP8[$42>>0]|0;
 $44 = $41 | $43;
 $45 = ((($1)) + 15|0);
 $46 = HEAP8[$45>>0]|0;
 $47 = $44 | $46;
 $48 = ((($1)) + 16|0);
 $49 = HEAP8[$48>>0]|0;
 $50 = $47 | $49;
 $51 = ((($1)) + 17|0);
 $52 = HEAP8[$51>>0]|0;
 $53 = $50 | $52;
 $54 = ((($1)) + 18|0);
 $55 = HEAP8[$54>>0]|0;
 $56 = $53 | $55;
 $57 = ((($1)) + 19|0);
 $58 = HEAP8[$57>>0]|0;
 $59 = $56 | $58;
 $60 = ((($1)) + 20|0);
 $61 = HEAP8[$60>>0]|0;
 $62 = $59 | $61;
 $63 = ((($1)) + 21|0);
 $64 = HEAP8[$63>>0]|0;
 $65 = $62 | $64;
 $66 = ((($1)) + 22|0);
 $67 = HEAP8[$66>>0]|0;
 $68 = $65 | $67;
 $69 = ((($1)) + 23|0);
 $70 = HEAP8[$69>>0]|0;
 $71 = $68 | $70;
 $72 = ((($1)) + 24|0);
 $73 = HEAP8[$72>>0]|0;
 $74 = $71 | $73;
 $75 = ((($1)) + 25|0);
 $76 = HEAP8[$75>>0]|0;
 $77 = $74 | $76;
 $78 = ((($1)) + 26|0);
 $79 = HEAP8[$78>>0]|0;
 $80 = $77 | $79;
 $81 = ((($1)) + 27|0);
 $82 = HEAP8[$81>>0]|0;
 $83 = $80 | $82;
 $84 = ((($1)) + 28|0);
 $85 = HEAP8[$84>>0]|0;
 $86 = $83 | $85;
 $87 = ((($1)) + 29|0);
 $88 = HEAP8[$87>>0]|0;
 $89 = $86 | $88;
 $90 = ((($1)) + 30|0);
 $91 = HEAP8[$90>>0]|0;
 $92 = $89 | $91;
 $93 = ((($1)) + 31|0);
 $94 = HEAP8[$93>>0]|0;
 $95 = $92 | $94;
 $96 = ($95<<24>>24)!=(0);
 $97 = $96&1;
 STACKTOP = sp;return ($97|0);
}
function _fe_neg($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (0 - ($2))|0;
 $22 = (0 - ($4))|0;
 $23 = (0 - ($6))|0;
 $24 = (0 - ($8))|0;
 $25 = (0 - ($10))|0;
 $26 = (0 - ($12))|0;
 $27 = (0 - ($14))|0;
 $28 = (0 - ($16))|0;
 $29 = (0 - ($18))|0;
 $30 = (0 - ($20))|0;
 HEAP32[$0>>2] = $21;
 $31 = ((($0)) + 4|0);
 HEAP32[$31>>2] = $22;
 $32 = ((($0)) + 8|0);
 HEAP32[$32>>2] = $23;
 $33 = ((($0)) + 12|0);
 HEAP32[$33>>2] = $24;
 $34 = ((($0)) + 16|0);
 HEAP32[$34>>2] = $25;
 $35 = ((($0)) + 20|0);
 HEAP32[$35>>2] = $26;
 $36 = ((($0)) + 24|0);
 HEAP32[$36>>2] = $27;
 $37 = ((($0)) + 28|0);
 HEAP32[$37>>2] = $28;
 $38 = ((($0)) + 32|0);
 HEAP32[$38>>2] = $29;
 $39 = ((($0)) + 36|0);
 HEAP32[$39>>2] = $30;
 return;
}
function _fe_pow22523($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$729 = 0, $$828 = 0, $$927 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $exitcond = 0, $exitcond35 = 0, $exitcond36 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 _fe_sq($2,$1);
 _fe_sq($3,$2);
 _fe_sq($3,$3);
 _fe_mul($3,$1,$3);
 _fe_mul($2,$2,$3);
 _fe_sq($2,$2);
 _fe_mul($2,$3,$2);
 _fe_sq($3,$2);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_mul($2,$3,$2);
 _fe_sq($3,$2);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_mul($3,$3,$2);
 _fe_sq($4,$3);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_sq($4,$4);
 _fe_mul($3,$4,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_sq($3,$3);
 _fe_mul($2,$3,$2);
 _fe_sq($3,$2);
 $$729 = 1;
 while(1) {
  _fe_sq($3,$3);
  $5 = (($$729) + 1)|0;
  $exitcond36 = ($5|0)==(50);
  if ($exitcond36) {
   break;
  } else {
   $$729 = $5;
  }
 }
 _fe_mul($3,$3,$2);
 _fe_sq($4,$3);
 $$828 = 1;
 while(1) {
  _fe_sq($4,$4);
  $6 = (($$828) + 1)|0;
  $exitcond35 = ($6|0)==(100);
  if ($exitcond35) {
   break;
  } else {
   $$828 = $6;
  }
 }
 _fe_mul($3,$4,$3);
 _fe_sq($3,$3);
 $$927 = 1;
 while(1) {
  _fe_sq($3,$3);
  $7 = (($$927) + 1)|0;
  $exitcond = ($7|0)==(50);
  if ($exitcond) {
   break;
  } else {
   $$927 = $7;
  }
 }
 _fe_mul($2,$3,$2);
 _fe_sq($2,$2);
 _fe_sq($2,$2);
 _fe_mul($0,$2,$1);
 STACKTOP = sp;return;
}
function _fe_sq2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0;
 var $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0;
 var $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0;
 var $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = $2 << 1;
 $22 = $4 << 1;
 $23 = $6 << 1;
 $24 = $8 << 1;
 $25 = $10 << 1;
 $26 = $12 << 1;
 $27 = $14 << 1;
 $28 = $16 << 1;
 $29 = ($12*38)|0;
 $30 = ($14*19)|0;
 $31 = ($16*38)|0;
 $32 = ($18*19)|0;
 $33 = ($20*38)|0;
 $34 = ($2|0)<(0);
 $35 = $34 << 31 >> 31;
 $36 = (___muldi3(($2|0),($35|0),($2|0),($35|0))|0);
 $37 = tempRet0;
 $38 = ($21|0)<(0);
 $39 = $38 << 31 >> 31;
 $40 = ($4|0)<(0);
 $41 = $40 << 31 >> 31;
 $42 = (___muldi3(($21|0),($39|0),($4|0),($41|0))|0);
 $43 = tempRet0;
 $44 = ($6|0)<(0);
 $45 = $44 << 31 >> 31;
 $46 = (___muldi3(($6|0),($45|0),($21|0),($39|0))|0);
 $47 = tempRet0;
 $48 = ($8|0)<(0);
 $49 = $48 << 31 >> 31;
 $50 = (___muldi3(($8|0),($49|0),($21|0),($39|0))|0);
 $51 = tempRet0;
 $52 = ($10|0)<(0);
 $53 = $52 << 31 >> 31;
 $54 = (___muldi3(($10|0),($53|0),($21|0),($39|0))|0);
 $55 = tempRet0;
 $56 = ($12|0)<(0);
 $57 = $56 << 31 >> 31;
 $58 = (___muldi3(($12|0),($57|0),($21|0),($39|0))|0);
 $59 = tempRet0;
 $60 = ($14|0)<(0);
 $61 = $60 << 31 >> 31;
 $62 = (___muldi3(($14|0),($61|0),($21|0),($39|0))|0);
 $63 = tempRet0;
 $64 = ($16|0)<(0);
 $65 = $64 << 31 >> 31;
 $66 = (___muldi3(($16|0),($65|0),($21|0),($39|0))|0);
 $67 = tempRet0;
 $68 = ($18|0)<(0);
 $69 = $68 << 31 >> 31;
 $70 = (___muldi3(($18|0),($69|0),($21|0),($39|0))|0);
 $71 = tempRet0;
 $72 = ($20|0)<(0);
 $73 = $72 << 31 >> 31;
 $74 = (___muldi3(($20|0),($73|0),($21|0),($39|0))|0);
 $75 = tempRet0;
 $76 = ($22|0)<(0);
 $77 = $76 << 31 >> 31;
 $78 = (___muldi3(($22|0),($77|0),($4|0),($41|0))|0);
 $79 = tempRet0;
 $80 = (___muldi3(($22|0),($77|0),($6|0),($45|0))|0);
 $81 = tempRet0;
 $82 = ($24|0)<(0);
 $83 = $82 << 31 >> 31;
 $84 = (___muldi3(($24|0),($83|0),($22|0),($77|0))|0);
 $85 = tempRet0;
 $86 = (___muldi3(($10|0),($53|0),($22|0),($77|0))|0);
 $87 = tempRet0;
 $88 = ($26|0)<(0);
 $89 = $88 << 31 >> 31;
 $90 = (___muldi3(($26|0),($89|0),($22|0),($77|0))|0);
 $91 = tempRet0;
 $92 = (___muldi3(($14|0),($61|0),($22|0),($77|0))|0);
 $93 = tempRet0;
 $94 = ($28|0)<(0);
 $95 = $94 << 31 >> 31;
 $96 = (___muldi3(($28|0),($95|0),($22|0),($77|0))|0);
 $97 = tempRet0;
 $98 = (___muldi3(($18|0),($69|0),($22|0),($77|0))|0);
 $99 = tempRet0;
 $100 = ($33|0)<(0);
 $101 = $100 << 31 >> 31;
 $102 = (___muldi3(($33|0),($101|0),($22|0),($77|0))|0);
 $103 = tempRet0;
 $104 = (___muldi3(($6|0),($45|0),($6|0),($45|0))|0);
 $105 = tempRet0;
 $106 = ($23|0)<(0);
 $107 = $106 << 31 >> 31;
 $108 = (___muldi3(($23|0),($107|0),($8|0),($49|0))|0);
 $109 = tempRet0;
 $110 = (___muldi3(($10|0),($53|0),($23|0),($107|0))|0);
 $111 = tempRet0;
 $112 = (___muldi3(($12|0),($57|0),($23|0),($107|0))|0);
 $113 = tempRet0;
 $114 = (___muldi3(($14|0),($61|0),($23|0),($107|0))|0);
 $115 = tempRet0;
 $116 = (___muldi3(($16|0),($65|0),($23|0),($107|0))|0);
 $117 = tempRet0;
 $118 = ($32|0)<(0);
 $119 = $118 << 31 >> 31;
 $120 = (___muldi3(($32|0),($119|0),($23|0),($107|0))|0);
 $121 = tempRet0;
 $122 = (___muldi3(($33|0),($101|0),($6|0),($45|0))|0);
 $123 = tempRet0;
 $124 = (___muldi3(($24|0),($83|0),($8|0),($49|0))|0);
 $125 = tempRet0;
 $126 = (___muldi3(($24|0),($83|0),($10|0),($53|0))|0);
 $127 = tempRet0;
 $128 = (___muldi3(($26|0),($89|0),($24|0),($83|0))|0);
 $129 = tempRet0;
 $130 = (___muldi3(($14|0),($61|0),($24|0),($83|0))|0);
 $131 = tempRet0;
 $132 = ($31|0)<(0);
 $133 = $132 << 31 >> 31;
 $134 = (___muldi3(($31|0),($133|0),($24|0),($83|0))|0);
 $135 = tempRet0;
 $136 = (___muldi3(($32|0),($119|0),($24|0),($83|0))|0);
 $137 = tempRet0;
 $138 = (___muldi3(($33|0),($101|0),($24|0),($83|0))|0);
 $139 = tempRet0;
 $140 = (___muldi3(($10|0),($53|0),($10|0),($53|0))|0);
 $141 = tempRet0;
 $142 = ($25|0)<(0);
 $143 = $142 << 31 >> 31;
 $144 = (___muldi3(($25|0),($143|0),($12|0),($57|0))|0);
 $145 = tempRet0;
 $146 = ($30|0)<(0);
 $147 = $146 << 31 >> 31;
 $148 = (___muldi3(($30|0),($147|0),($25|0),($143|0))|0);
 $149 = tempRet0;
 $150 = (___muldi3(($31|0),($133|0),($10|0),($53|0))|0);
 $151 = tempRet0;
 $152 = (___muldi3(($32|0),($119|0),($25|0),($143|0))|0);
 $153 = tempRet0;
 $154 = (___muldi3(($33|0),($101|0),($10|0),($53|0))|0);
 $155 = tempRet0;
 $156 = ($29|0)<(0);
 $157 = $156 << 31 >> 31;
 $158 = (___muldi3(($29|0),($157|0),($12|0),($57|0))|0);
 $159 = tempRet0;
 $160 = (___muldi3(($30|0),($147|0),($26|0),($89|0))|0);
 $161 = tempRet0;
 $162 = (___muldi3(($31|0),($133|0),($26|0),($89|0))|0);
 $163 = tempRet0;
 $164 = (___muldi3(($32|0),($119|0),($26|0),($89|0))|0);
 $165 = tempRet0;
 $166 = (___muldi3(($33|0),($101|0),($26|0),($89|0))|0);
 $167 = tempRet0;
 $168 = (___muldi3(($30|0),($147|0),($14|0),($61|0))|0);
 $169 = tempRet0;
 $170 = (___muldi3(($31|0),($133|0),($14|0),($61|0))|0);
 $171 = tempRet0;
 $172 = ($27|0)<(0);
 $173 = $172 << 31 >> 31;
 $174 = (___muldi3(($32|0),($119|0),($27|0),($173|0))|0);
 $175 = tempRet0;
 $176 = (___muldi3(($33|0),($101|0),($14|0),($61|0))|0);
 $177 = tempRet0;
 $178 = (___muldi3(($31|0),($133|0),($16|0),($65|0))|0);
 $179 = tempRet0;
 $180 = (___muldi3(($32|0),($119|0),($28|0),($95|0))|0);
 $181 = tempRet0;
 $182 = (___muldi3(($33|0),($101|0),($28|0),($95|0))|0);
 $183 = tempRet0;
 $184 = (___muldi3(($32|0),($119|0),($18|0),($69|0))|0);
 $185 = tempRet0;
 $186 = (___muldi3(($33|0),($101|0),($18|0),($69|0))|0);
 $187 = tempRet0;
 $188 = (___muldi3(($33|0),($101|0),($20|0),($73|0))|0);
 $189 = tempRet0;
 $190 = (_i64Add(($158|0),($159|0),($36|0),($37|0))|0);
 $191 = tempRet0;
 $192 = (_i64Add(($190|0),($191|0),($148|0),($149|0))|0);
 $193 = tempRet0;
 $194 = (_i64Add(($192|0),($193|0),($134|0),($135|0))|0);
 $195 = tempRet0;
 $196 = (_i64Add(($194|0),($195|0),($120|0),($121|0))|0);
 $197 = tempRet0;
 $198 = (_i64Add(($196|0),($197|0),($102|0),($103|0))|0);
 $199 = tempRet0;
 $200 = (_i64Add(($160|0),($161|0),($42|0),($43|0))|0);
 $201 = tempRet0;
 $202 = (_i64Add(($200|0),($201|0),($150|0),($151|0))|0);
 $203 = tempRet0;
 $204 = (_i64Add(($202|0),($203|0),($136|0),($137|0))|0);
 $205 = tempRet0;
 $206 = (_i64Add(($204|0),($205|0),($122|0),($123|0))|0);
 $207 = tempRet0;
 $208 = (_i64Add(($46|0),($47|0),($78|0),($79|0))|0);
 $209 = tempRet0;
 $210 = (_i64Add(($208|0),($209|0),($168|0),($169|0))|0);
 $211 = tempRet0;
 $212 = (_i64Add(($210|0),($211|0),($162|0),($163|0))|0);
 $213 = tempRet0;
 $214 = (_i64Add(($212|0),($213|0),($152|0),($153|0))|0);
 $215 = tempRet0;
 $216 = (_i64Add(($214|0),($215|0),($138|0),($139|0))|0);
 $217 = tempRet0;
 $218 = (_i64Add(($50|0),($51|0),($80|0),($81|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($170|0),($171|0))|0);
 $221 = tempRet0;
 $222 = (_i64Add(($220|0),($221|0),($164|0),($165|0))|0);
 $223 = tempRet0;
 $224 = (_i64Add(($222|0),($223|0),($154|0),($155|0))|0);
 $225 = tempRet0;
 $226 = (_i64Add(($84|0),($85|0),($104|0),($105|0))|0);
 $227 = tempRet0;
 $228 = (_i64Add(($226|0),($227|0),($54|0),($55|0))|0);
 $229 = tempRet0;
 $230 = (_i64Add(($228|0),($229|0),($178|0),($179|0))|0);
 $231 = tempRet0;
 $232 = (_i64Add(($230|0),($231|0),($174|0),($175|0))|0);
 $233 = tempRet0;
 $234 = (_i64Add(($232|0),($233|0),($166|0),($167|0))|0);
 $235 = tempRet0;
 $236 = (_i64Add(($86|0),($87|0),($108|0),($109|0))|0);
 $237 = tempRet0;
 $238 = (_i64Add(($236|0),($237|0),($58|0),($59|0))|0);
 $239 = tempRet0;
 $240 = (_i64Add(($238|0),($239|0),($180|0),($181|0))|0);
 $241 = tempRet0;
 $242 = (_i64Add(($240|0),($241|0),($176|0),($177|0))|0);
 $243 = tempRet0;
 $244 = (_i64Add(($124|0),($125|0),($110|0),($111|0))|0);
 $245 = tempRet0;
 $246 = (_i64Add(($244|0),($245|0),($90|0),($91|0))|0);
 $247 = tempRet0;
 $248 = (_i64Add(($246|0),($247|0),($62|0),($63|0))|0);
 $249 = tempRet0;
 $250 = (_i64Add(($248|0),($249|0),($184|0),($185|0))|0);
 $251 = tempRet0;
 $252 = (_i64Add(($250|0),($251|0),($182|0),($183|0))|0);
 $253 = tempRet0;
 $254 = (_i64Add(($112|0),($113|0),($126|0),($127|0))|0);
 $255 = tempRet0;
 $256 = (_i64Add(($254|0),($255|0),($92|0),($93|0))|0);
 $257 = tempRet0;
 $258 = (_i64Add(($256|0),($257|0),($66|0),($67|0))|0);
 $259 = tempRet0;
 $260 = (_i64Add(($258|0),($259|0),($186|0),($187|0))|0);
 $261 = tempRet0;
 $262 = (_i64Add(($114|0),($115|0),($140|0),($141|0))|0);
 $263 = tempRet0;
 $264 = (_i64Add(($262|0),($263|0),($128|0),($129|0))|0);
 $265 = tempRet0;
 $266 = (_i64Add(($264|0),($265|0),($96|0),($97|0))|0);
 $267 = tempRet0;
 $268 = (_i64Add(($266|0),($267|0),($70|0),($71|0))|0);
 $269 = tempRet0;
 $270 = (_i64Add(($268|0),($269|0),($188|0),($189|0))|0);
 $271 = tempRet0;
 $272 = (_i64Add(($130|0),($131|0),($144|0),($145|0))|0);
 $273 = tempRet0;
 $274 = (_i64Add(($272|0),($273|0),($116|0),($117|0))|0);
 $275 = tempRet0;
 $276 = (_i64Add(($274|0),($275|0),($98|0),($99|0))|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($74|0),($75|0))|0);
 $279 = tempRet0;
 $280 = (_bitshift64Shl(($198|0),($199|0),1)|0);
 $281 = tempRet0;
 $282 = (_bitshift64Shl(($206|0),($207|0),1)|0);
 $283 = tempRet0;
 $284 = (_bitshift64Shl(($216|0),($217|0),1)|0);
 $285 = tempRet0;
 $286 = (_bitshift64Shl(($224|0),($225|0),1)|0);
 $287 = tempRet0;
 $288 = (_bitshift64Shl(($234|0),($235|0),1)|0);
 $289 = tempRet0;
 $290 = (_bitshift64Shl(($242|0),($243|0),1)|0);
 $291 = tempRet0;
 $292 = (_bitshift64Shl(($252|0),($253|0),1)|0);
 $293 = tempRet0;
 $294 = (_bitshift64Shl(($260|0),($261|0),1)|0);
 $295 = tempRet0;
 $296 = (_bitshift64Shl(($270|0),($271|0),1)|0);
 $297 = tempRet0;
 $298 = (_bitshift64Shl(($278|0),($279|0),1)|0);
 $299 = tempRet0;
 $300 = (_i64Add(($280|0),($281|0),33554432,0)|0);
 $301 = tempRet0;
 $302 = (_bitshift64Ashr(($300|0),($301|0),26)|0);
 $303 = tempRet0;
 $304 = (_i64Add(($302|0),($303|0),($282|0),($283|0))|0);
 $305 = tempRet0;
 $306 = (_bitshift64Shl(($302|0),($303|0),26)|0);
 $307 = tempRet0;
 $308 = (_i64Subtract(($280|0),($281|0),($306|0),($307|0))|0);
 $309 = tempRet0;
 $310 = (_i64Add(($288|0),($289|0),33554432,0)|0);
 $311 = tempRet0;
 $312 = (_bitshift64Ashr(($310|0),($311|0),26)|0);
 $313 = tempRet0;
 $314 = (_i64Add(($312|0),($313|0),($290|0),($291|0))|0);
 $315 = tempRet0;
 $316 = (_bitshift64Shl(($312|0),($313|0),26)|0);
 $317 = tempRet0;
 $318 = (_i64Subtract(($288|0),($289|0),($316|0),($317|0))|0);
 $319 = tempRet0;
 $320 = (_i64Add(($304|0),($305|0),16777216,0)|0);
 $321 = tempRet0;
 $322 = (_bitshift64Ashr(($320|0),($321|0),25)|0);
 $323 = tempRet0;
 $324 = (_i64Add(($322|0),($323|0),($284|0),($285|0))|0);
 $325 = tempRet0;
 $326 = (_bitshift64Shl(($322|0),($323|0),25)|0);
 $327 = tempRet0;
 $328 = (_i64Subtract(($304|0),($305|0),($326|0),($327|0))|0);
 $329 = tempRet0;
 $330 = (_i64Add(($314|0),($315|0),16777216,0)|0);
 $331 = tempRet0;
 $332 = (_bitshift64Ashr(($330|0),($331|0),25)|0);
 $333 = tempRet0;
 $334 = (_i64Add(($332|0),($333|0),($292|0),($293|0))|0);
 $335 = tempRet0;
 $336 = (_bitshift64Shl(($332|0),($333|0),25)|0);
 $337 = tempRet0;
 $338 = (_i64Subtract(($314|0),($315|0),($336|0),($337|0))|0);
 $339 = tempRet0;
 $340 = (_i64Add(($324|0),($325|0),33554432,0)|0);
 $341 = tempRet0;
 $342 = (_bitshift64Ashr(($340|0),($341|0),26)|0);
 $343 = tempRet0;
 $344 = (_i64Add(($342|0),($343|0),($286|0),($287|0))|0);
 $345 = tempRet0;
 $346 = (_bitshift64Shl(($342|0),($343|0),26)|0);
 $347 = tempRet0;
 $348 = (_i64Subtract(($324|0),($325|0),($346|0),($347|0))|0);
 $349 = tempRet0;
 $350 = (_i64Add(($334|0),($335|0),33554432,0)|0);
 $351 = tempRet0;
 $352 = (_bitshift64Ashr(($350|0),($351|0),26)|0);
 $353 = tempRet0;
 $354 = (_i64Add(($352|0),($353|0),($294|0),($295|0))|0);
 $355 = tempRet0;
 $356 = (_bitshift64Shl(($352|0),($353|0),26)|0);
 $357 = tempRet0;
 $358 = (_i64Subtract(($334|0),($335|0),($356|0),($357|0))|0);
 $359 = tempRet0;
 $360 = (_i64Add(($344|0),($345|0),16777216,0)|0);
 $361 = tempRet0;
 $362 = (_bitshift64Ashr(($360|0),($361|0),25)|0);
 $363 = tempRet0;
 $364 = (_i64Add(($362|0),($363|0),($318|0),($319|0))|0);
 $365 = tempRet0;
 $366 = (_bitshift64Shl(($362|0),($363|0),25)|0);
 $367 = tempRet0;
 $368 = (_i64Subtract(($344|0),($345|0),($366|0),($367|0))|0);
 $369 = tempRet0;
 $370 = (_i64Add(($354|0),($355|0),16777216,0)|0);
 $371 = tempRet0;
 $372 = (_bitshift64Ashr(($370|0),($371|0),25)|0);
 $373 = tempRet0;
 $374 = (_i64Add(($372|0),($373|0),($296|0),($297|0))|0);
 $375 = tempRet0;
 $376 = (_bitshift64Shl(($372|0),($373|0),25)|0);
 $377 = tempRet0;
 $378 = (_i64Subtract(($354|0),($355|0),($376|0),($377|0))|0);
 $379 = tempRet0;
 $380 = (_i64Add(($364|0),($365|0),33554432,0)|0);
 $381 = tempRet0;
 $382 = (_bitshift64Ashr(($380|0),($381|0),26)|0);
 $383 = tempRet0;
 $384 = (_i64Add(($338|0),($339|0),($382|0),($383|0))|0);
 $385 = tempRet0;
 $386 = (_bitshift64Shl(($382|0),($383|0),26)|0);
 $387 = tempRet0;
 $388 = (_i64Subtract(($364|0),($365|0),($386|0),($387|0))|0);
 $389 = tempRet0;
 $390 = (_i64Add(($374|0),($375|0),33554432,0)|0);
 $391 = tempRet0;
 $392 = (_bitshift64Ashr(($390|0),($391|0),26)|0);
 $393 = tempRet0;
 $394 = (_i64Add(($392|0),($393|0),($298|0),($299|0))|0);
 $395 = tempRet0;
 $396 = (_bitshift64Shl(($392|0),($393|0),26)|0);
 $397 = tempRet0;
 $398 = (_i64Subtract(($374|0),($375|0),($396|0),($397|0))|0);
 $399 = tempRet0;
 $400 = (_i64Add(($394|0),($395|0),16777216,0)|0);
 $401 = tempRet0;
 $402 = (_bitshift64Ashr(($400|0),($401|0),25)|0);
 $403 = tempRet0;
 $404 = (___muldi3(($402|0),($403|0),19,0)|0);
 $405 = tempRet0;
 $406 = (_i64Add(($404|0),($405|0),($308|0),($309|0))|0);
 $407 = tempRet0;
 $408 = (_bitshift64Shl(($402|0),($403|0),25)|0);
 $409 = tempRet0;
 $410 = (_i64Subtract(($394|0),($395|0),($408|0),($409|0))|0);
 $411 = tempRet0;
 $412 = (_i64Add(($406|0),($407|0),33554432,0)|0);
 $413 = tempRet0;
 $414 = (_bitshift64Ashr(($412|0),($413|0),26)|0);
 $415 = tempRet0;
 $416 = (_i64Add(($328|0),($329|0),($414|0),($415|0))|0);
 $417 = tempRet0;
 $418 = (_bitshift64Shl(($414|0),($415|0),26)|0);
 $419 = tempRet0;
 $420 = (_i64Subtract(($406|0),($407|0),($418|0),($419|0))|0);
 $421 = tempRet0;
 HEAP32[$0>>2] = $420;
 $422 = ((($0)) + 4|0);
 HEAP32[$422>>2] = $416;
 $423 = ((($0)) + 8|0);
 HEAP32[$423>>2] = $348;
 $424 = ((($0)) + 12|0);
 HEAP32[$424>>2] = $368;
 $425 = ((($0)) + 16|0);
 HEAP32[$425>>2] = $388;
 $426 = ((($0)) + 20|0);
 HEAP32[$426>>2] = $384;
 $427 = ((($0)) + 24|0);
 HEAP32[$427>>2] = $358;
 $428 = ((($0)) + 28|0);
 HEAP32[$428>>2] = $378;
 $429 = ((($0)) + 32|0);
 HEAP32[$429>>2] = $398;
 $430 = ((($0)) + 36|0);
 HEAP32[$430>>2] = $410;
 return;
}
function _fe_sub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = (($3) - ($22))|0;
 $42 = (($5) - ($24))|0;
 $43 = (($7) - ($26))|0;
 $44 = (($9) - ($28))|0;
 $45 = (($11) - ($30))|0;
 $46 = (($13) - ($32))|0;
 $47 = (($15) - ($34))|0;
 $48 = (($17) - ($36))|0;
 $49 = (($19) - ($38))|0;
 $50 = (($21) - ($40))|0;
 HEAP32[$0>>2] = $41;
 $51 = ((($0)) + 4|0);
 HEAP32[$51>>2] = $42;
 $52 = ((($0)) + 8|0);
 HEAP32[$52>>2] = $43;
 $53 = ((($0)) + 12|0);
 HEAP32[$53>>2] = $44;
 $54 = ((($0)) + 16|0);
 HEAP32[$54>>2] = $45;
 $55 = ((($0)) + 20|0);
 HEAP32[$55>>2] = $46;
 $56 = ((($0)) + 24|0);
 HEAP32[$56>>2] = $47;
 $57 = ((($0)) + 28|0);
 HEAP32[$57>>2] = $48;
 $58 = ((($0)) + 32|0);
 HEAP32[$58>>2] = $49;
 $59 = ((($0)) + 36|0);
 HEAP32[$59>>2] = $50;
 return;
}
function _ge_add($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 _fe_mul($6,$0,$2);
 $7 = ((($2)) + 40|0);
 _fe_mul($5,$5,$7);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 120|0);
 $10 = ((($1)) + 120|0);
 _fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 $12 = ((($2)) + 80|0);
 _fe_mul($0,$11,$12);
 _fe_add($3,$0,$0);
 _fe_sub($0,$6,$5);
 _fe_add($5,$6,$5);
 _fe_add($6,$3,$8);
 _fe_sub($8,$3,$8);
 STACKTOP = sp;return;
}
function _ge_double_scalarmult_vartime($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0$lcssa = 0, $$022 = 0, $$121 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 2272|0;
 $4 = sp + 2016|0;
 $5 = sp + 1760|0;
 $6 = sp + 480|0;
 $7 = sp + 320|0;
 $8 = sp + 160|0;
 $9 = sp;
 _slide($4,$1);
 _slide($5,$3);
 _ge_p3_to_cached($6,$2);
 _ge_p3_dbl($7,$2);
 _ge_p1p1_to_p3($9,$7);
 _ge_add($7,$9,$6);
 _ge_p1p1_to_p3($8,$7);
 $10 = ((($6)) + 160|0);
 _ge_p3_to_cached($10,$8);
 _ge_add($7,$9,$10);
 _ge_p1p1_to_p3($8,$7);
 $11 = ((($6)) + 320|0);
 _ge_p3_to_cached($11,$8);
 _ge_add($7,$9,$11);
 _ge_p1p1_to_p3($8,$7);
 $12 = ((($6)) + 480|0);
 _ge_p3_to_cached($12,$8);
 _ge_add($7,$9,$12);
 _ge_p1p1_to_p3($8,$7);
 $13 = ((($6)) + 640|0);
 _ge_p3_to_cached($13,$8);
 _ge_add($7,$9,$13);
 _ge_p1p1_to_p3($8,$7);
 $14 = ((($6)) + 800|0);
 _ge_p3_to_cached($14,$8);
 _ge_add($7,$9,$14);
 _ge_p1p1_to_p3($8,$7);
 $15 = ((($6)) + 960|0);
 _ge_p3_to_cached($15,$8);
 _ge_add($7,$9,$15);
 _ge_p1p1_to_p3($8,$7);
 $16 = ((($6)) + 1120|0);
 _ge_p3_to_cached($16,$8);
 _ge_p2_0($0);
 $$022 = 255;
 while(1) {
  $17 = (($4) + ($$022)|0);
  $18 = HEAP8[$17>>0]|0;
  $19 = ($18<<24>>24)==(0);
  if (!($19)) {
   $$0$lcssa = $$022;
   break;
  }
  $20 = (($5) + ($$022)|0);
  $21 = HEAP8[$20>>0]|0;
  $22 = ($21<<24>>24)==(0);
  if (!($22)) {
   $$0$lcssa = $$022;
   break;
  }
  $24 = (($$022) + -1)|0;
  $25 = ($$022|0)>(0);
  if ($25) {
   $$022 = $24;
  } else {
   $$0$lcssa = $24;
   break;
  }
 }
 $23 = ($$0$lcssa|0)>(-1);
 if ($23) {
  $$121 = $$0$lcssa;
 } else {
  STACKTOP = sp;return;
 }
 while(1) {
  _ge_p2_dbl($7,$0);
  $26 = (($4) + ($$121)|0);
  $27 = HEAP8[$26>>0]|0;
  $28 = ($27<<24>>24)>(0);
  if ($28) {
   _ge_p1p1_to_p3($8,$7);
   $29 = HEAP8[$26>>0]|0;
   $30 = (($29<<24>>24) / 2)&-1;
   $31 = $30 << 24 >> 24;
   $32 = (($6) + (($31*160)|0)|0);
   _ge_add($7,$8,$32);
  } else {
   $33 = ($27<<24>>24)<(0);
   if ($33) {
    _ge_p1p1_to_p3($8,$7);
    $34 = HEAP8[$26>>0]|0;
    $35 = (($34<<24>>24) / -2)&-1;
    $36 = $35 << 24 >> 24;
    $37 = (($6) + (($36*160)|0)|0);
    _ge_sub($7,$8,$37);
   }
  }
  $38 = (($5) + ($$121)|0);
  $39 = HEAP8[$38>>0]|0;
  $40 = ($39<<24>>24)>(0);
  if ($40) {
   _ge_p1p1_to_p3($8,$7);
   $41 = HEAP8[$38>>0]|0;
   $42 = (($41<<24>>24) / 2)&-1;
   $43 = $42 << 24 >> 24;
   $44 = (1488 + (($43*120)|0)|0);
   _ge_madd($7,$8,$44);
  } else {
   $45 = ($39<<24>>24)<(0);
   if ($45) {
    _ge_p1p1_to_p3($8,$7);
    $46 = HEAP8[$38>>0]|0;
    $47 = (($46<<24>>24) / -2)&-1;
    $48 = $47 << 24 >> 24;
    $49 = (1488 + (($48*120)|0)|0);
    _ge_msub($7,$8,$49);
   }
  }
  _ge_p1p1_to_p2($0,$7);
  $50 = (($$121) + -1)|0;
  $51 = ($$121|0)>(0);
  if ($51) {
   $$121 = $50;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _slide($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$05559 = 0, $$05663 = 0, $$058 = 0, $$160 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $exitcond = 0, $exitcond65 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$05663 = 0;
 while(1) {
  $2 = $$05663 >> 3;
  $3 = (($1) + ($2)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = $$05663 & 7;
  $7 = $5 >>> $6;
  $8 = $7 & 1;
  $9 = $8&255;
  $10 = (($0) + ($$05663)|0);
  HEAP8[$10>>0] = $9;
  $11 = (($$05663) + 1)|0;
  $exitcond65 = ($11|0)==(256);
  if ($exitcond65) {
   $$160 = 0;
   break;
  } else {
   $$05663 = $11;
  }
 }
 while(1) {
  $12 = (($0) + ($$160)|0);
  $13 = HEAP8[$12>>0]|0;
  $14 = ($13<<24>>24)==(0);
  L5: do {
   if (!($14)) {
    $$05559 = 1;
    while(1) {
     $15 = (($$05559) + ($$160))|0;
     $16 = ($15|0)<(256);
     if (!($16)) {
      break L5;
     }
     $17 = (($0) + ($15)|0);
     $18 = HEAP8[$17>>0]|0;
     $19 = ($18<<24>>24)==(0);
     L9: do {
      if (!($19)) {
       $20 = HEAP8[$12>>0]|0;
       $21 = $20 << 24 >> 24;
       $22 = $18 << 24 >> 24;
       $23 = $22 << $$05559;
       $24 = (($21) + ($23))|0;
       $25 = ($24|0)<(16);
       if ($25) {
        $26 = $24&255;
        HEAP8[$12>>0] = $26;
        HEAP8[$17>>0] = 0;
        break;
       }
       $27 = (($21) - ($23))|0;
       $28 = ($27|0)>(-16);
       if (!($28)) {
        break L5;
       }
       $29 = $27&255;
       HEAP8[$12>>0] = $29;
       $$058 = $15;
       while(1) {
        $30 = (($0) + ($$058)|0);
        $31 = HEAP8[$30>>0]|0;
        $32 = ($31<<24>>24)==(0);
        if ($32) {
         break;
        }
        HEAP8[$30>>0] = 0;
        $33 = (($$058) + 1)|0;
        $34 = ($33|0)<(256);
        if ($34) {
         $$058 = $33;
        } else {
         break L9;
        }
       }
       HEAP8[$30>>0] = 1;
      }
     } while(0);
     $35 = (($$05559) + 1)|0;
     $36 = ($35|0)<(7);
     if ($36) {
      $$05559 = $35;
     } else {
      break;
     }
    }
   }
  } while(0);
  $37 = (($$160) + 1)|0;
  $exitcond = ($37|0)==(256);
  if ($exitcond) {
   break;
  } else {
   $$160 = $37;
  }
 }
 return;
}
function _ge_p3_to_cached($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 40|0);
 _fe_add($0,$2,$1);
 $3 = ((($0)) + 40|0);
 _fe_sub($3,$2,$1);
 $4 = ((($0)) + 80|0);
 $5 = ((($1)) + 80|0);
 _fe_copy($4,$5);
 $6 = ((($0)) + 120|0);
 $7 = ((($1)) + 120|0);
 _fe_mul($6,$7,2448);
 return;
}
function _ge_p3_dbl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp;
 _ge_p3_to_p2($2,$1);
 _ge_p2_dbl($0,$2);
 STACKTOP = sp;return;
}
function _ge_p1p1_to_p3($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 120|0);
 _fe_mul($0,$1,$2);
 $3 = ((($0)) + 40|0);
 $4 = ((($1)) + 40|0);
 $5 = ((($1)) + 80|0);
 _fe_mul($3,$4,$5);
 $6 = ((($0)) + 80|0);
 _fe_mul($6,$5,$2);
 $7 = ((($0)) + 120|0);
 _fe_mul($7,$1,$4);
 return;
}
function _ge_p2_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _fe_0($0);
 $1 = ((($0)) + 40|0);
 _fe_1($1);
 $2 = ((($0)) + 80|0);
 _fe_1($2);
 return;
}
function _ge_p2_dbl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $2 = sp;
 _fe_sq($0,$1);
 $3 = ((($0)) + 80|0);
 $4 = ((($1)) + 40|0);
 _fe_sq($3,$4);
 $5 = ((($0)) + 120|0);
 $6 = ((($1)) + 80|0);
 _fe_sq2($5,$6);
 $7 = ((($0)) + 40|0);
 _fe_add($7,$1,$4);
 _fe_sq($2,$7);
 _fe_add($7,$3,$0);
 _fe_sub($3,$3,$0);
 _fe_sub($0,$2,$7);
 _fe_sub($5,$5,$3);
 STACKTOP = sp;return;
}
function _ge_sub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 $7 = ((($2)) + 40|0);
 _fe_mul($6,$0,$7);
 _fe_mul($5,$5,$2);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 120|0);
 $10 = ((($1)) + 120|0);
 _fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 $12 = ((($2)) + 80|0);
 _fe_mul($0,$11,$12);
 _fe_add($3,$0,$0);
 _fe_sub($0,$6,$5);
 _fe_add($5,$6,$5);
 _fe_sub($6,$3,$8);
 _fe_add($8,$3,$8);
 STACKTOP = sp;return;
}
function _ge_madd($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 _fe_mul($6,$0,$2);
 $7 = ((($2)) + 40|0);
 _fe_mul($5,$5,$7);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 80|0);
 $10 = ((($1)) + 120|0);
 _fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 _fe_add($3,$11,$11);
 _fe_sub($0,$6,$5);
 _fe_add($5,$6,$5);
 _fe_add($6,$3,$8);
 _fe_sub($8,$3,$8);
 STACKTOP = sp;return;
}
function _ge_msub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 $7 = ((($2)) + 40|0);
 _fe_mul($6,$0,$7);
 _fe_mul($5,$5,$2);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 80|0);
 $10 = ((($1)) + 120|0);
 _fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 _fe_add($3,$11,$11);
 _fe_sub($0,$6,$5);
 _fe_add($5,$6,$5);
 _fe_sub($6,$3,$8);
 _fe_add($8,$3,$8);
 STACKTOP = sp;return;
}
function _ge_p1p1_to_p2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 120|0);
 _fe_mul($0,$1,$2);
 $3 = ((($0)) + 40|0);
 $4 = ((($1)) + 40|0);
 $5 = ((($1)) + 80|0);
 _fe_mul($3,$4,$5);
 $6 = ((($0)) + 80|0);
 _fe_mul($6,$5,$2);
 return;
}
function _ge_p3_to_p2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _fe_copy($0,$1);
 $2 = ((($0)) + 40|0);
 $3 = ((($1)) + 40|0);
 _fe_copy($2,$3);
 $4 = ((($0)) + 80|0);
 $5 = ((($1)) + 80|0);
 _fe_copy($4,$5);
 return;
}
function _ge_frombytes_negate_vartime($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0;
 $2 = sp + 160|0;
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp + 40|0;
 $6 = sp;
 $7 = ((($0)) + 40|0);
 _fe_frombytes($7,$1);
 $8 = ((($0)) + 80|0);
 _fe_1($8);
 _fe_sq($2,$7);
 _fe_mul($3,$2,2488);
 _fe_sub($2,$2,$8);
 _fe_add($3,$3,$8);
 _fe_sq($4,$3);
 _fe_mul($4,$4,$3);
 _fe_sq($0,$4);
 _fe_mul($0,$0,$3);
 _fe_mul($0,$0,$2);
 _fe_pow22523($0,$0);
 _fe_mul($0,$0,$4);
 _fe_mul($0,$0,$2);
 _fe_sq($5,$0);
 _fe_mul($5,$5,$3);
 _fe_sub($6,$5,$2);
 $9 = (_fe_isnonzero($6)|0);
 $10 = ($9|0)==(0);
 do {
  if (!($10)) {
   _fe_add($6,$5,$2);
   $11 = (_fe_isnonzero($6)|0);
   $12 = ($11|0)==(0);
   if ($12) {
    _fe_mul($0,$0,2528);
    break;
   } else {
    $$0 = -1;
    STACKTOP = sp;return ($$0|0);
   }
  }
 } while(0);
 $13 = (_fe_isnegative($0)|0);
 $14 = ((($1)) + 31|0);
 $15 = HEAP8[$14>>0]|0;
 $16 = $15&255;
 $17 = $16 >>> 7;
 $18 = ($13|0)==($17|0);
 if ($18) {
  _fe_neg($0,$0);
 }
 $19 = ((($0)) + 120|0);
 _fe_mul($19,$0,$7);
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _ge_p3_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _fe_0($0);
 $1 = ((($0)) + 40|0);
 _fe_1($1);
 $2 = ((($0)) + 80|0);
 _fe_1($2);
 $3 = ((($0)) + 120|0);
 _fe_0($3);
 return;
}
function _ge_p3_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 $5 = ((($1)) + 80|0);
 _fe_invert($2,$5);
 _fe_mul($3,$1,$2);
 $6 = ((($1)) + 40|0);
 _fe_mul($4,$6,$2);
 _fe_tobytes($0,$4);
 $7 = (_fe_isnegative($3)|0);
 $8 = $7 << 7;
 $9 = ((($0)) + 31|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = $11 ^ $8;
 $13 = $12&255;
 HEAP8[$9>>0] = $13;
 STACKTOP = sp;return;
}
function _ge_scalarmult_base($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$03135 = 0, $$037 = 0, $$136 = 0, $$234 = 0, $$333 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $exitcond = 0, $exitcond38 = 0, $sext = 0, $sext32 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 464|0;
 $2 = sp + 400|0;
 $3 = sp + 240|0;
 $4 = sp + 120|0;
 $5 = sp;
 $$037 = 0;
 while(1) {
  $6 = (($1) + ($$037)|0);
  $7 = HEAP8[$6>>0]|0;
  $8 = $7 & 15;
  $9 = $$037 << 1;
  $10 = (($2) + ($9)|0);
  HEAP8[$10>>0] = $8;
  $11 = ($7&255) >>> 4;
  $12 = $9 | 1;
  $13 = (($2) + ($12)|0);
  HEAP8[$13>>0] = $11;
  $14 = (($$037) + 1)|0;
  $exitcond38 = ($14|0)==(32);
  if ($exitcond38) {
   $$03135 = 0;$$136 = 0;
   break;
  } else {
   $$037 = $14;
  }
 }
 while(1) {
  $15 = (($2) + ($$136)|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = $16&255;
  $18 = (($17) + ($$03135))|0;
  $sext = $18 << 24;
  $sext32 = (($sext) + 134217728)|0;
  $19 = $sext32 >> 28;
  $20 = $19 << 4;
  $21 = (($18) - ($20))|0;
  $22 = $21&255;
  HEAP8[$15>>0] = $22;
  $23 = (($$136) + 1)|0;
  $exitcond = ($23|0)==(63);
  if ($exitcond) {
   break;
  } else {
   $$03135 = $19;$$136 = $23;
  }
 }
 $24 = ((($2)) + 63|0);
 $25 = HEAP8[$24>>0]|0;
 $26 = $25&255;
 $27 = (($26) + ($19))|0;
 $28 = $27&255;
 HEAP8[$24>>0] = $28;
 _ge_p3_0($0);
 $$234 = 1;
 while(1) {
  $29 = (($$234|0) / 2)&-1;
  $30 = (($2) + ($$234)|0);
  $31 = HEAP8[$30>>0]|0;
  _select_95($5,$29,$31);
  _ge_madd($3,$0,$5);
  _ge_p1p1_to_p3($0,$3);
  $32 = (($$234) + 2)|0;
  $33 = ($32|0)<(64);
  if ($33) {
   $$234 = $32;
  } else {
   break;
  }
 }
 _ge_p3_dbl($3,$0);
 _ge_p1p1_to_p2($4,$3);
 _ge_p2_dbl($3,$4);
 _ge_p1p1_to_p2($4,$3);
 _ge_p2_dbl($3,$4);
 _ge_p1p1_to_p2($4,$3);
 _ge_p2_dbl($3,$4);
 _ge_p1p1_to_p3($0,$3);
 $$333 = 0;
 while(1) {
  $34 = (($$333|0) / 2)&-1;
  $35 = (($2) + ($$333)|0);
  $36 = HEAP8[$35>>0]|0;
  _select_95($5,$34,$36);
  _ge_madd($3,$0,$5);
  _ge_p1p1_to_p3($0,$3);
  $37 = (($$333) + 2)|0;
  $38 = ($37|0)<(64);
  if ($38) {
   $$333 = $37;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _select_95($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $3 = sp;
 $4 = (_negative($2)|0);
 $5 = $2 << 24 >> 24;
 $6 = $4&255;
 $7 = (0 - ($6))|0;
 $8 = $5 & $7;
 $9 = $8 << 1;
 $10 = (($5) - ($9))|0;
 $11 = $10&255;
 _fe_1($0);
 $12 = ((($0)) + 40|0);
 _fe_1($12);
 $13 = ((($0)) + 80|0);
 _fe_0($13);
 $14 = (2568 + (($1*960)|0)|0);
 $15 = (_equal($11,1)|0);
 _cmov($0,$14,$15);
 $16 = (((2568 + (($1*960)|0)|0)) + 120|0);
 $17 = (_equal($11,2)|0);
 _cmov($0,$16,$17);
 $18 = (((2568 + (($1*960)|0)|0)) + 240|0);
 $19 = (_equal($11,3)|0);
 _cmov($0,$18,$19);
 $20 = (((2568 + (($1*960)|0)|0)) + 360|0);
 $21 = (_equal($11,4)|0);
 _cmov($0,$20,$21);
 $22 = (((2568 + (($1*960)|0)|0)) + 480|0);
 $23 = (_equal($11,5)|0);
 _cmov($0,$22,$23);
 $24 = (((2568 + (($1*960)|0)|0)) + 600|0);
 $25 = (_equal($11,6)|0);
 _cmov($0,$24,$25);
 $26 = (((2568 + (($1*960)|0)|0)) + 720|0);
 $27 = (_equal($11,7)|0);
 _cmov($0,$26,$27);
 $28 = (((2568 + (($1*960)|0)|0)) + 840|0);
 $29 = (_equal($11,8)|0);
 _cmov($0,$28,$29);
 _fe_copy($3,$12);
 $30 = ((($3)) + 40|0);
 _fe_copy($30,$0);
 $31 = ((($3)) + 80|0);
 _fe_neg($31,$13);
 _cmov($0,$3,$4);
 STACKTOP = sp;return;
}
function _negative($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 << 24 >> 24;
 $2 = ($1|0)<(0);
 $3 = $2 << 31 >> 31;
 $4 = (_bitshift64Lshr(($1|0),($3|0),63)|0);
 $5 = tempRet0;
 $6 = $4&255;
 return ($6|0);
}
function _equal($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 ^ $0;
 $3 = $2&255;
 $4 = (_i64Add(($3|0),0,-1,-1)|0);
 $5 = tempRet0;
 $6 = (_bitshift64Lshr(($4|0),($5|0),63)|0);
 $7 = tempRet0;
 $8 = $6&255;
 return ($8|0);
}
function _cmov($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $2&255;
 _fe_cmov($0,$1,$3);
 $4 = ((($0)) + 40|0);
 $5 = ((($1)) + 40|0);
 _fe_cmov($4,$5,$3);
 $6 = ((($0)) + 80|0);
 $7 = ((($1)) + 80|0);
 _fe_cmov($6,$7,$3);
 return;
}
function _ge_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 $5 = ((($1)) + 80|0);
 _fe_invert($2,$5);
 _fe_mul($3,$1,$2);
 $6 = ((($1)) + 40|0);
 _fe_mul($4,$6,$2);
 _fe_tobytes($0,$4);
 $7 = (_fe_isnegative($3)|0);
 $8 = $7 << 7;
 $9 = ((($0)) + 31|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = $11 ^ $8;
 $13 = $12&255;
 HEAP8[$9>>0] = $13;
 STACKTOP = sp;return;
}
function _ed25519_public_key_derive($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0;
 $2 = sp + 160|0;
 $3 = sp;
 (_sha512($1,32,$2)|0);
 $4 = HEAP8[$2>>0]|0;
 $5 = $4 & -8;
 HEAP8[$2>>0] = $5;
 $6 = ((($2)) + 31|0);
 $7 = HEAP8[$6>>0]|0;
 $8 = $7 & 63;
 $9 = $8 | 64;
 HEAP8[$6>>0] = $9;
 _ge_scalarmult_base($3,$2);
 _ge_p3_tobytes($0,$3);
 STACKTOP = sp;return;
}
function _ed25519_public_key_x($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0;
 $2 = sp;
 $3 = (_ge_frombytes_negate_vartime($2,$1)|0);
 $4 = ($3|0)==(0);
 if (!($4)) {
  STACKTOP = sp;return;
 }
 _fe_tobytes($0,$2);
 STACKTOP = sp;return;
}
function _get_static_memory_start() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (36712|0);
}
function _get_static_memory_size() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4096;
}
function _sc_reduce($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0;
 var $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0;
 var $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0;
 var $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0;
 var $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0;
 var $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0;
 var $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0;
 var $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0;
 var $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0;
 var $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0;
 var $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0;
 var $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0;
 var $997 = 0, $998 = 0, $999 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_load_3_47($0)|0);
 $2 = tempRet0;
 $3 = $1 & 2097151;
 $4 = ((($0)) + 2|0);
 $5 = (_load_4_48($4)|0);
 $6 = tempRet0;
 $7 = (_bitshift64Lshr(($5|0),($6|0),5)|0);
 $8 = tempRet0;
 $9 = $7 & 2097151;
 $10 = ((($0)) + 5|0);
 $11 = (_load_3_47($10)|0);
 $12 = tempRet0;
 $13 = (_bitshift64Lshr(($11|0),($12|0),2)|0);
 $14 = tempRet0;
 $15 = $13 & 2097151;
 $16 = ((($0)) + 7|0);
 $17 = (_load_4_48($16)|0);
 $18 = tempRet0;
 $19 = (_bitshift64Lshr(($17|0),($18|0),7)|0);
 $20 = tempRet0;
 $21 = $19 & 2097151;
 $22 = ((($0)) + 10|0);
 $23 = (_load_4_48($22)|0);
 $24 = tempRet0;
 $25 = (_bitshift64Lshr(($23|0),($24|0),4)|0);
 $26 = tempRet0;
 $27 = $25 & 2097151;
 $28 = ((($0)) + 13|0);
 $29 = (_load_3_47($28)|0);
 $30 = tempRet0;
 $31 = (_bitshift64Lshr(($29|0),($30|0),1)|0);
 $32 = tempRet0;
 $33 = $31 & 2097151;
 $34 = ((($0)) + 15|0);
 $35 = (_load_4_48($34)|0);
 $36 = tempRet0;
 $37 = (_bitshift64Lshr(($35|0),($36|0),6)|0);
 $38 = tempRet0;
 $39 = $37 & 2097151;
 $40 = ((($0)) + 18|0);
 $41 = (_load_3_47($40)|0);
 $42 = tempRet0;
 $43 = (_bitshift64Lshr(($41|0),($42|0),3)|0);
 $44 = tempRet0;
 $45 = $43 & 2097151;
 $46 = ((($0)) + 21|0);
 $47 = (_load_3_47($46)|0);
 $48 = tempRet0;
 $49 = $47 & 2097151;
 $50 = ((($0)) + 23|0);
 $51 = (_load_4_48($50)|0);
 $52 = tempRet0;
 $53 = (_bitshift64Lshr(($51|0),($52|0),5)|0);
 $54 = tempRet0;
 $55 = $53 & 2097151;
 $56 = ((($0)) + 26|0);
 $57 = (_load_3_47($56)|0);
 $58 = tempRet0;
 $59 = (_bitshift64Lshr(($57|0),($58|0),2)|0);
 $60 = tempRet0;
 $61 = $59 & 2097151;
 $62 = ((($0)) + 28|0);
 $63 = (_load_4_48($62)|0);
 $64 = tempRet0;
 $65 = (_bitshift64Lshr(($63|0),($64|0),7)|0);
 $66 = tempRet0;
 $67 = $65 & 2097151;
 $68 = ((($0)) + 31|0);
 $69 = (_load_4_48($68)|0);
 $70 = tempRet0;
 $71 = (_bitshift64Lshr(($69|0),($70|0),4)|0);
 $72 = tempRet0;
 $73 = $71 & 2097151;
 $74 = ((($0)) + 34|0);
 $75 = (_load_3_47($74)|0);
 $76 = tempRet0;
 $77 = (_bitshift64Lshr(($75|0),($76|0),1)|0);
 $78 = tempRet0;
 $79 = $77 & 2097151;
 $80 = ((($0)) + 36|0);
 $81 = (_load_4_48($80)|0);
 $82 = tempRet0;
 $83 = (_bitshift64Lshr(($81|0),($82|0),6)|0);
 $84 = tempRet0;
 $85 = $83 & 2097151;
 $86 = ((($0)) + 39|0);
 $87 = (_load_3_47($86)|0);
 $88 = tempRet0;
 $89 = (_bitshift64Lshr(($87|0),($88|0),3)|0);
 $90 = tempRet0;
 $91 = $89 & 2097151;
 $92 = ((($0)) + 42|0);
 $93 = (_load_3_47($92)|0);
 $94 = tempRet0;
 $95 = $93 & 2097151;
 $96 = ((($0)) + 44|0);
 $97 = (_load_4_48($96)|0);
 $98 = tempRet0;
 $99 = (_bitshift64Lshr(($97|0),($98|0),5)|0);
 $100 = tempRet0;
 $101 = $99 & 2097151;
 $102 = ((($0)) + 47|0);
 $103 = (_load_3_47($102)|0);
 $104 = tempRet0;
 $105 = (_bitshift64Lshr(($103|0),($104|0),2)|0);
 $106 = tempRet0;
 $107 = $105 & 2097151;
 $108 = ((($0)) + 49|0);
 $109 = (_load_4_48($108)|0);
 $110 = tempRet0;
 $111 = (_bitshift64Lshr(($109|0),($110|0),7)|0);
 $112 = tempRet0;
 $113 = $111 & 2097151;
 $114 = ((($0)) + 52|0);
 $115 = (_load_4_48($114)|0);
 $116 = tempRet0;
 $117 = (_bitshift64Lshr(($115|0),($116|0),4)|0);
 $118 = tempRet0;
 $119 = $117 & 2097151;
 $120 = ((($0)) + 55|0);
 $121 = (_load_3_47($120)|0);
 $122 = tempRet0;
 $123 = (_bitshift64Lshr(($121|0),($122|0),1)|0);
 $124 = tempRet0;
 $125 = $123 & 2097151;
 $126 = ((($0)) + 57|0);
 $127 = (_load_4_48($126)|0);
 $128 = tempRet0;
 $129 = (_bitshift64Lshr(($127|0),($128|0),6)|0);
 $130 = tempRet0;
 $131 = $129 & 2097151;
 $132 = ((($0)) + 60|0);
 $133 = (_load_4_48($132)|0);
 $134 = tempRet0;
 $135 = (_bitshift64Lshr(($133|0),($134|0),3)|0);
 $136 = tempRet0;
 $137 = (___muldi3(($135|0),($136|0),666643,0)|0);
 $138 = tempRet0;
 $139 = (___muldi3(($135|0),($136|0),470296,0)|0);
 $140 = tempRet0;
 $141 = (___muldi3(($135|0),($136|0),654183,0)|0);
 $142 = tempRet0;
 $143 = (___muldi3(($135|0),($136|0),-997805,-1)|0);
 $144 = tempRet0;
 $145 = (___muldi3(($135|0),($136|0),136657,0)|0);
 $146 = tempRet0;
 $147 = (_i64Add(($145|0),($146|0),($91|0),0)|0);
 $148 = tempRet0;
 $149 = (___muldi3(($135|0),($136|0),-683901,-1)|0);
 $150 = tempRet0;
 $151 = (_i64Add(($149|0),($150|0),($95|0),0)|0);
 $152 = tempRet0;
 $153 = (___muldi3(($131|0),0,666643,0)|0);
 $154 = tempRet0;
 $155 = (___muldi3(($131|0),0,470296,0)|0);
 $156 = tempRet0;
 $157 = (___muldi3(($131|0),0,654183,0)|0);
 $158 = tempRet0;
 $159 = (___muldi3(($131|0),0,-997805,-1)|0);
 $160 = tempRet0;
 $161 = (___muldi3(($131|0),0,136657,0)|0);
 $162 = tempRet0;
 $163 = (___muldi3(($131|0),0,-683901,-1)|0);
 $164 = tempRet0;
 $165 = (_i64Add(($147|0),($148|0),($163|0),($164|0))|0);
 $166 = tempRet0;
 $167 = (___muldi3(($125|0),0,666643,0)|0);
 $168 = tempRet0;
 $169 = (___muldi3(($125|0),0,470296,0)|0);
 $170 = tempRet0;
 $171 = (___muldi3(($125|0),0,654183,0)|0);
 $172 = tempRet0;
 $173 = (___muldi3(($125|0),0,-997805,-1)|0);
 $174 = tempRet0;
 $175 = (___muldi3(($125|0),0,136657,0)|0);
 $176 = tempRet0;
 $177 = (___muldi3(($125|0),0,-683901,-1)|0);
 $178 = tempRet0;
 $179 = (_i64Add(($177|0),($178|0),($85|0),0)|0);
 $180 = tempRet0;
 $181 = (_i64Add(($179|0),($180|0),($143|0),($144|0))|0);
 $182 = tempRet0;
 $183 = (_i64Add(($181|0),($182|0),($161|0),($162|0))|0);
 $184 = tempRet0;
 $185 = (___muldi3(($119|0),0,666643,0)|0);
 $186 = tempRet0;
 $187 = (___muldi3(($119|0),0,470296,0)|0);
 $188 = tempRet0;
 $189 = (___muldi3(($119|0),0,654183,0)|0);
 $190 = tempRet0;
 $191 = (___muldi3(($119|0),0,-997805,-1)|0);
 $192 = tempRet0;
 $193 = (___muldi3(($119|0),0,136657,0)|0);
 $194 = tempRet0;
 $195 = (___muldi3(($119|0),0,-683901,-1)|0);
 $196 = tempRet0;
 $197 = (___muldi3(($113|0),0,666643,0)|0);
 $198 = tempRet0;
 $199 = (___muldi3(($113|0),0,470296,0)|0);
 $200 = tempRet0;
 $201 = (___muldi3(($113|0),0,654183,0)|0);
 $202 = tempRet0;
 $203 = (___muldi3(($113|0),0,-997805,-1)|0);
 $204 = tempRet0;
 $205 = (___muldi3(($113|0),0,136657,0)|0);
 $206 = tempRet0;
 $207 = (___muldi3(($113|0),0,-683901,-1)|0);
 $208 = tempRet0;
 $209 = (_i64Add(($207|0),($208|0),($73|0),0)|0);
 $210 = tempRet0;
 $211 = (_i64Add(($209|0),($210|0),($193|0),($194|0))|0);
 $212 = tempRet0;
 $213 = (_i64Add(($211|0),($212|0),($173|0),($174|0))|0);
 $214 = tempRet0;
 $215 = (_i64Add(($213|0),($214|0),($139|0),($140|0))|0);
 $216 = tempRet0;
 $217 = (_i64Add(($215|0),($216|0),($157|0),($158|0))|0);
 $218 = tempRet0;
 $219 = (___muldi3(($107|0),0,666643,0)|0);
 $220 = tempRet0;
 $221 = (_i64Add(($219|0),($220|0),($39|0),0)|0);
 $222 = tempRet0;
 $223 = (___muldi3(($107|0),0,470296,0)|0);
 $224 = tempRet0;
 $225 = (___muldi3(($107|0),0,654183,0)|0);
 $226 = tempRet0;
 $227 = (_i64Add(($225|0),($226|0),($49|0),0)|0);
 $228 = tempRet0;
 $229 = (_i64Add(($227|0),($228|0),($199|0),($200|0))|0);
 $230 = tempRet0;
 $231 = (_i64Add(($229|0),($230|0),($185|0),($186|0))|0);
 $232 = tempRet0;
 $233 = (___muldi3(($107|0),0,-997805,-1)|0);
 $234 = tempRet0;
 $235 = (___muldi3(($107|0),0,136657,0)|0);
 $236 = tempRet0;
 $237 = (_i64Add(($235|0),($236|0),($61|0),0)|0);
 $238 = tempRet0;
 $239 = (_i64Add(($237|0),($238|0),($203|0),($204|0))|0);
 $240 = tempRet0;
 $241 = (_i64Add(($239|0),($240|0),($189|0),($190|0))|0);
 $242 = tempRet0;
 $243 = (_i64Add(($241|0),($242|0),($169|0),($170|0))|0);
 $244 = tempRet0;
 $245 = (_i64Add(($243|0),($244|0),($153|0),($154|0))|0);
 $246 = tempRet0;
 $247 = (___muldi3(($107|0),0,-683901,-1)|0);
 $248 = tempRet0;
 $249 = (_i64Add(($221|0),($222|0),1048576,0)|0);
 $250 = tempRet0;
 $251 = (_bitshift64Lshr(($249|0),($250|0),21)|0);
 $252 = tempRet0;
 $253 = (_i64Add(($223|0),($224|0),($45|0),0)|0);
 $254 = tempRet0;
 $255 = (_i64Add(($253|0),($254|0),($197|0),($198|0))|0);
 $256 = tempRet0;
 $257 = (_i64Add(($255|0),($256|0),($251|0),($252|0))|0);
 $258 = tempRet0;
 $259 = (_bitshift64Shl(($251|0),($252|0),21)|0);
 $260 = tempRet0;
 $261 = (_i64Subtract(($221|0),($222|0),($259|0),($260|0))|0);
 $262 = tempRet0;
 $263 = (_i64Add(($231|0),($232|0),1048576,0)|0);
 $264 = tempRet0;
 $265 = (_bitshift64Lshr(($263|0),($264|0),21)|0);
 $266 = tempRet0;
 $267 = (_i64Add(($233|0),($234|0),($55|0),0)|0);
 $268 = tempRet0;
 $269 = (_i64Add(($267|0),($268|0),($201|0),($202|0))|0);
 $270 = tempRet0;
 $271 = (_i64Add(($269|0),($270|0),($187|0),($188|0))|0);
 $272 = tempRet0;
 $273 = (_i64Add(($271|0),($272|0),($167|0),($168|0))|0);
 $274 = tempRet0;
 $275 = (_i64Add(($273|0),($274|0),($265|0),($266|0))|0);
 $276 = tempRet0;
 $277 = (_bitshift64Shl(($265|0),($266|0),21)|0);
 $278 = tempRet0;
 $279 = (_i64Add(($245|0),($246|0),1048576,0)|0);
 $280 = tempRet0;
 $281 = (_bitshift64Ashr(($279|0),($280|0),21)|0);
 $282 = tempRet0;
 $283 = (_i64Add(($247|0),($248|0),($67|0),0)|0);
 $284 = tempRet0;
 $285 = (_i64Add(($283|0),($284|0),($205|0),($206|0))|0);
 $286 = tempRet0;
 $287 = (_i64Add(($285|0),($286|0),($191|0),($192|0))|0);
 $288 = tempRet0;
 $289 = (_i64Add(($287|0),($288|0),($171|0),($172|0))|0);
 $290 = tempRet0;
 $291 = (_i64Add(($289|0),($290|0),($137|0),($138|0))|0);
 $292 = tempRet0;
 $293 = (_i64Add(($291|0),($292|0),($155|0),($156|0))|0);
 $294 = tempRet0;
 $295 = (_i64Add(($293|0),($294|0),($281|0),($282|0))|0);
 $296 = tempRet0;
 $297 = (_bitshift64Shl(($281|0),($282|0),21)|0);
 $298 = tempRet0;
 $299 = (_i64Add(($217|0),($218|0),1048576,0)|0);
 $300 = tempRet0;
 $301 = (_bitshift64Ashr(($299|0),($300|0),21)|0);
 $302 = tempRet0;
 $303 = (_i64Add(($195|0),($196|0),($79|0),0)|0);
 $304 = tempRet0;
 $305 = (_i64Add(($303|0),($304|0),($175|0),($176|0))|0);
 $306 = tempRet0;
 $307 = (_i64Add(($305|0),($306|0),($141|0),($142|0))|0);
 $308 = tempRet0;
 $309 = (_i64Add(($307|0),($308|0),($159|0),($160|0))|0);
 $310 = tempRet0;
 $311 = (_i64Add(($309|0),($310|0),($301|0),($302|0))|0);
 $312 = tempRet0;
 $313 = (_bitshift64Shl(($301|0),($302|0),21)|0);
 $314 = tempRet0;
 $315 = (_i64Subtract(($217|0),($218|0),($313|0),($314|0))|0);
 $316 = tempRet0;
 $317 = (_i64Add(($183|0),($184|0),1048576,0)|0);
 $318 = tempRet0;
 $319 = (_bitshift64Ashr(($317|0),($318|0),21)|0);
 $320 = tempRet0;
 $321 = (_i64Add(($165|0),($166|0),($319|0),($320|0))|0);
 $322 = tempRet0;
 $323 = (_bitshift64Shl(($319|0),($320|0),21)|0);
 $324 = tempRet0;
 $325 = (_i64Subtract(($183|0),($184|0),($323|0),($324|0))|0);
 $326 = tempRet0;
 $327 = (_i64Add(($151|0),($152|0),1048576,0)|0);
 $328 = tempRet0;
 $329 = (_bitshift64Ashr(($327|0),($328|0),21)|0);
 $330 = tempRet0;
 $331 = (_i64Add(($329|0),($330|0),($101|0),0)|0);
 $332 = tempRet0;
 $333 = (_bitshift64Shl(($329|0),($330|0),21)|0);
 $334 = tempRet0;
 $335 = (_i64Subtract(($151|0),($152|0),($333|0),($334|0))|0);
 $336 = tempRet0;
 $337 = (_i64Add(($257|0),($258|0),1048576,0)|0);
 $338 = tempRet0;
 $339 = (_bitshift64Lshr(($337|0),($338|0),21)|0);
 $340 = tempRet0;
 $341 = (_bitshift64Shl(($339|0),($340|0),21)|0);
 $342 = tempRet0;
 $343 = (_i64Subtract(($257|0),($258|0),($341|0),($342|0))|0);
 $344 = tempRet0;
 $345 = (_i64Add(($275|0),($276|0),1048576,0)|0);
 $346 = tempRet0;
 $347 = (_bitshift64Ashr(($345|0),($346|0),21)|0);
 $348 = tempRet0;
 $349 = (_bitshift64Shl(($347|0),($348|0),21)|0);
 $350 = tempRet0;
 $351 = (_i64Add(($295|0),($296|0),1048576,0)|0);
 $352 = tempRet0;
 $353 = (_bitshift64Ashr(($351|0),($352|0),21)|0);
 $354 = tempRet0;
 $355 = (_i64Add(($353|0),($354|0),($315|0),($316|0))|0);
 $356 = tempRet0;
 $357 = (_bitshift64Shl(($353|0),($354|0),21)|0);
 $358 = tempRet0;
 $359 = (_i64Subtract(($295|0),($296|0),($357|0),($358|0))|0);
 $360 = tempRet0;
 $361 = (_i64Add(($311|0),($312|0),1048576,0)|0);
 $362 = tempRet0;
 $363 = (_bitshift64Ashr(($361|0),($362|0),21)|0);
 $364 = tempRet0;
 $365 = (_i64Add(($363|0),($364|0),($325|0),($326|0))|0);
 $366 = tempRet0;
 $367 = (_bitshift64Shl(($363|0),($364|0),21)|0);
 $368 = tempRet0;
 $369 = (_i64Subtract(($311|0),($312|0),($367|0),($368|0))|0);
 $370 = tempRet0;
 $371 = (_i64Add(($321|0),($322|0),1048576,0)|0);
 $372 = tempRet0;
 $373 = (_bitshift64Ashr(($371|0),($372|0),21)|0);
 $374 = tempRet0;
 $375 = (_i64Add(($373|0),($374|0),($335|0),($336|0))|0);
 $376 = tempRet0;
 $377 = (_bitshift64Shl(($373|0),($374|0),21)|0);
 $378 = tempRet0;
 $379 = (_i64Subtract(($321|0),($322|0),($377|0),($378|0))|0);
 $380 = tempRet0;
 $381 = (___muldi3(($331|0),($332|0),666643,0)|0);
 $382 = tempRet0;
 $383 = (_i64Add(($381|0),($382|0),($33|0),0)|0);
 $384 = tempRet0;
 $385 = (___muldi3(($331|0),($332|0),470296,0)|0);
 $386 = tempRet0;
 $387 = (_i64Add(($261|0),($262|0),($385|0),($386|0))|0);
 $388 = tempRet0;
 $389 = (___muldi3(($331|0),($332|0),654183,0)|0);
 $390 = tempRet0;
 $391 = (_i64Add(($343|0),($344|0),($389|0),($390|0))|0);
 $392 = tempRet0;
 $393 = (___muldi3(($331|0),($332|0),-997805,-1)|0);
 $394 = tempRet0;
 $395 = (___muldi3(($331|0),($332|0),136657,0)|0);
 $396 = tempRet0;
 $397 = (___muldi3(($331|0),($332|0),-683901,-1)|0);
 $398 = tempRet0;
 $399 = (_i64Add(($397|0),($398|0),($245|0),($246|0))|0);
 $400 = tempRet0;
 $401 = (_i64Add(($399|0),($400|0),($347|0),($348|0))|0);
 $402 = tempRet0;
 $403 = (_i64Subtract(($401|0),($402|0),($297|0),($298|0))|0);
 $404 = tempRet0;
 $405 = (___muldi3(($375|0),($376|0),666643,0)|0);
 $406 = tempRet0;
 $407 = (_i64Add(($405|0),($406|0),($27|0),0)|0);
 $408 = tempRet0;
 $409 = (___muldi3(($375|0),($376|0),470296,0)|0);
 $410 = tempRet0;
 $411 = (_i64Add(($383|0),($384|0),($409|0),($410|0))|0);
 $412 = tempRet0;
 $413 = (___muldi3(($375|0),($376|0),654183,0)|0);
 $414 = tempRet0;
 $415 = (_i64Add(($387|0),($388|0),($413|0),($414|0))|0);
 $416 = tempRet0;
 $417 = (___muldi3(($375|0),($376|0),-997805,-1)|0);
 $418 = tempRet0;
 $419 = (_i64Add(($391|0),($392|0),($417|0),($418|0))|0);
 $420 = tempRet0;
 $421 = (___muldi3(($375|0),($376|0),136657,0)|0);
 $422 = tempRet0;
 $423 = (___muldi3(($375|0),($376|0),-683901,-1)|0);
 $424 = tempRet0;
 $425 = (___muldi3(($379|0),($380|0),666643,0)|0);
 $426 = tempRet0;
 $427 = (_i64Add(($425|0),($426|0),($21|0),0)|0);
 $428 = tempRet0;
 $429 = (___muldi3(($379|0),($380|0),470296,0)|0);
 $430 = tempRet0;
 $431 = (_i64Add(($407|0),($408|0),($429|0),($430|0))|0);
 $432 = tempRet0;
 $433 = (___muldi3(($379|0),($380|0),654183,0)|0);
 $434 = tempRet0;
 $435 = (_i64Add(($411|0),($412|0),($433|0),($434|0))|0);
 $436 = tempRet0;
 $437 = (___muldi3(($379|0),($380|0),-997805,-1)|0);
 $438 = tempRet0;
 $439 = (_i64Add(($415|0),($416|0),($437|0),($438|0))|0);
 $440 = tempRet0;
 $441 = (___muldi3(($379|0),($380|0),136657,0)|0);
 $442 = tempRet0;
 $443 = (_i64Add(($419|0),($420|0),($441|0),($442|0))|0);
 $444 = tempRet0;
 $445 = (___muldi3(($379|0),($380|0),-683901,-1)|0);
 $446 = tempRet0;
 $447 = (_i64Add(($339|0),($340|0),($231|0),($232|0))|0);
 $448 = tempRet0;
 $449 = (_i64Subtract(($447|0),($448|0),($277|0),($278|0))|0);
 $450 = tempRet0;
 $451 = (_i64Add(($449|0),($450|0),($393|0),($394|0))|0);
 $452 = tempRet0;
 $453 = (_i64Add(($451|0),($452|0),($421|0),($422|0))|0);
 $454 = tempRet0;
 $455 = (_i64Add(($453|0),($454|0),($445|0),($446|0))|0);
 $456 = tempRet0;
 $457 = (___muldi3(($365|0),($366|0),666643,0)|0);
 $458 = tempRet0;
 $459 = (_i64Add(($457|0),($458|0),($15|0),0)|0);
 $460 = tempRet0;
 $461 = (___muldi3(($365|0),($366|0),470296,0)|0);
 $462 = tempRet0;
 $463 = (_i64Add(($427|0),($428|0),($461|0),($462|0))|0);
 $464 = tempRet0;
 $465 = (___muldi3(($365|0),($366|0),654183,0)|0);
 $466 = tempRet0;
 $467 = (_i64Add(($431|0),($432|0),($465|0),($466|0))|0);
 $468 = tempRet0;
 $469 = (___muldi3(($365|0),($366|0),-997805,-1)|0);
 $470 = tempRet0;
 $471 = (_i64Add(($435|0),($436|0),($469|0),($470|0))|0);
 $472 = tempRet0;
 $473 = (___muldi3(($365|0),($366|0),136657,0)|0);
 $474 = tempRet0;
 $475 = (_i64Add(($439|0),($440|0),($473|0),($474|0))|0);
 $476 = tempRet0;
 $477 = (___muldi3(($365|0),($366|0),-683901,-1)|0);
 $478 = tempRet0;
 $479 = (_i64Add(($443|0),($444|0),($477|0),($478|0))|0);
 $480 = tempRet0;
 $481 = (___muldi3(($369|0),($370|0),666643,0)|0);
 $482 = tempRet0;
 $483 = (___muldi3(($369|0),($370|0),470296,0)|0);
 $484 = tempRet0;
 $485 = (___muldi3(($369|0),($370|0),654183,0)|0);
 $486 = tempRet0;
 $487 = (___muldi3(($369|0),($370|0),-997805,-1)|0);
 $488 = tempRet0;
 $489 = (___muldi3(($369|0),($370|0),136657,0)|0);
 $490 = tempRet0;
 $491 = (___muldi3(($369|0),($370|0),-683901,-1)|0);
 $492 = tempRet0;
 $493 = (_i64Add(($475|0),($476|0),($491|0),($492|0))|0);
 $494 = tempRet0;
 $495 = (___muldi3(($355|0),($356|0),666643,0)|0);
 $496 = tempRet0;
 $497 = (_i64Add(($495|0),($496|0),($3|0),0)|0);
 $498 = tempRet0;
 $499 = (___muldi3(($355|0),($356|0),470296,0)|0);
 $500 = tempRet0;
 $501 = (___muldi3(($355|0),($356|0),654183,0)|0);
 $502 = tempRet0;
 $503 = (_i64Add(($459|0),($460|0),($501|0),($502|0))|0);
 $504 = tempRet0;
 $505 = (_i64Add(($503|0),($504|0),($483|0),($484|0))|0);
 $506 = tempRet0;
 $507 = (___muldi3(($355|0),($356|0),-997805,-1)|0);
 $508 = tempRet0;
 $509 = (___muldi3(($355|0),($356|0),136657,0)|0);
 $510 = tempRet0;
 $511 = (_i64Add(($467|0),($468|0),($509|0),($510|0))|0);
 $512 = tempRet0;
 $513 = (_i64Add(($511|0),($512|0),($487|0),($488|0))|0);
 $514 = tempRet0;
 $515 = (___muldi3(($355|0),($356|0),-683901,-1)|0);
 $516 = tempRet0;
 $517 = (_i64Add(($497|0),($498|0),1048576,0)|0);
 $518 = tempRet0;
 $519 = (_bitshift64Ashr(($517|0),($518|0),21)|0);
 $520 = tempRet0;
 $521 = (_i64Add(($499|0),($500|0),($9|0),0)|0);
 $522 = tempRet0;
 $523 = (_i64Add(($521|0),($522|0),($481|0),($482|0))|0);
 $524 = tempRet0;
 $525 = (_i64Add(($523|0),($524|0),($519|0),($520|0))|0);
 $526 = tempRet0;
 $527 = (_bitshift64Shl(($519|0),($520|0),21)|0);
 $528 = tempRet0;
 $529 = (_i64Subtract(($497|0),($498|0),($527|0),($528|0))|0);
 $530 = tempRet0;
 $531 = (_i64Add(($505|0),($506|0),1048576,0)|0);
 $532 = tempRet0;
 $533 = (_bitshift64Ashr(($531|0),($532|0),21)|0);
 $534 = tempRet0;
 $535 = (_i64Add(($463|0),($464|0),($507|0),($508|0))|0);
 $536 = tempRet0;
 $537 = (_i64Add(($535|0),($536|0),($485|0),($486|0))|0);
 $538 = tempRet0;
 $539 = (_i64Add(($537|0),($538|0),($533|0),($534|0))|0);
 $540 = tempRet0;
 $541 = (_bitshift64Shl(($533|0),($534|0),21)|0);
 $542 = tempRet0;
 $543 = (_i64Add(($513|0),($514|0),1048576,0)|0);
 $544 = tempRet0;
 $545 = (_bitshift64Ashr(($543|0),($544|0),21)|0);
 $546 = tempRet0;
 $547 = (_i64Add(($471|0),($472|0),($515|0),($516|0))|0);
 $548 = tempRet0;
 $549 = (_i64Add(($547|0),($548|0),($489|0),($490|0))|0);
 $550 = tempRet0;
 $551 = (_i64Add(($549|0),($550|0),($545|0),($546|0))|0);
 $552 = tempRet0;
 $553 = (_bitshift64Shl(($545|0),($546|0),21)|0);
 $554 = tempRet0;
 $555 = (_i64Add(($493|0),($494|0),1048576,0)|0);
 $556 = tempRet0;
 $557 = (_bitshift64Ashr(($555|0),($556|0),21)|0);
 $558 = tempRet0;
 $559 = (_i64Add(($479|0),($480|0),($557|0),($558|0))|0);
 $560 = tempRet0;
 $561 = (_bitshift64Shl(($557|0),($558|0),21)|0);
 $562 = tempRet0;
 $563 = (_i64Subtract(($493|0),($494|0),($561|0),($562|0))|0);
 $564 = tempRet0;
 $565 = (_i64Add(($455|0),($456|0),1048576,0)|0);
 $566 = tempRet0;
 $567 = (_bitshift64Ashr(($565|0),($566|0),21)|0);
 $568 = tempRet0;
 $569 = (_i64Add(($395|0),($396|0),($275|0),($276|0))|0);
 $570 = tempRet0;
 $571 = (_i64Subtract(($569|0),($570|0),($349|0),($350|0))|0);
 $572 = tempRet0;
 $573 = (_i64Add(($571|0),($572|0),($423|0),($424|0))|0);
 $574 = tempRet0;
 $575 = (_i64Add(($573|0),($574|0),($567|0),($568|0))|0);
 $576 = tempRet0;
 $577 = (_bitshift64Shl(($567|0),($568|0),21)|0);
 $578 = tempRet0;
 $579 = (_i64Subtract(($455|0),($456|0),($577|0),($578|0))|0);
 $580 = tempRet0;
 $581 = (_i64Add(($403|0),($404|0),1048576,0)|0);
 $582 = tempRet0;
 $583 = (_bitshift64Ashr(($581|0),($582|0),21)|0);
 $584 = tempRet0;
 $585 = (_i64Add(($583|0),($584|0),($359|0),($360|0))|0);
 $586 = tempRet0;
 $587 = (_bitshift64Shl(($583|0),($584|0),21)|0);
 $588 = tempRet0;
 $589 = (_i64Subtract(($403|0),($404|0),($587|0),($588|0))|0);
 $590 = tempRet0;
 $591 = (_i64Add(($525|0),($526|0),1048576,0)|0);
 $592 = tempRet0;
 $593 = (_bitshift64Ashr(($591|0),($592|0),21)|0);
 $594 = tempRet0;
 $595 = (_bitshift64Shl(($593|0),($594|0),21)|0);
 $596 = tempRet0;
 $597 = (_i64Add(($539|0),($540|0),1048576,0)|0);
 $598 = tempRet0;
 $599 = (_bitshift64Ashr(($597|0),($598|0),21)|0);
 $600 = tempRet0;
 $601 = (_bitshift64Shl(($599|0),($600|0),21)|0);
 $602 = tempRet0;
 $603 = (_i64Add(($551|0),($552|0),1048576,0)|0);
 $604 = tempRet0;
 $605 = (_bitshift64Ashr(($603|0),($604|0),21)|0);
 $606 = tempRet0;
 $607 = (_i64Add(($563|0),($564|0),($605|0),($606|0))|0);
 $608 = tempRet0;
 $609 = (_bitshift64Shl(($605|0),($606|0),21)|0);
 $610 = tempRet0;
 $611 = (_i64Add(($559|0),($560|0),1048576,0)|0);
 $612 = tempRet0;
 $613 = (_bitshift64Ashr(($611|0),($612|0),21)|0);
 $614 = tempRet0;
 $615 = (_i64Add(($579|0),($580|0),($613|0),($614|0))|0);
 $616 = tempRet0;
 $617 = (_bitshift64Shl(($613|0),($614|0),21)|0);
 $618 = tempRet0;
 $619 = (_i64Subtract(($559|0),($560|0),($617|0),($618|0))|0);
 $620 = tempRet0;
 $621 = (_i64Add(($575|0),($576|0),1048576,0)|0);
 $622 = tempRet0;
 $623 = (_bitshift64Ashr(($621|0),($622|0),21)|0);
 $624 = tempRet0;
 $625 = (_i64Add(($589|0),($590|0),($623|0),($624|0))|0);
 $626 = tempRet0;
 $627 = (_bitshift64Shl(($623|0),($624|0),21)|0);
 $628 = tempRet0;
 $629 = (_i64Subtract(($575|0),($576|0),($627|0),($628|0))|0);
 $630 = tempRet0;
 $631 = (_i64Add(($585|0),($586|0),1048576,0)|0);
 $632 = tempRet0;
 $633 = (_bitshift64Ashr(($631|0),($632|0),21)|0);
 $634 = tempRet0;
 $635 = (_bitshift64Shl(($633|0),($634|0),21)|0);
 $636 = tempRet0;
 $637 = (_i64Subtract(($585|0),($586|0),($635|0),($636|0))|0);
 $638 = tempRet0;
 $639 = (___muldi3(($633|0),($634|0),666643,0)|0);
 $640 = tempRet0;
 $641 = (_i64Add(($529|0),($530|0),($639|0),($640|0))|0);
 $642 = tempRet0;
 $643 = (___muldi3(($633|0),($634|0),470296,0)|0);
 $644 = tempRet0;
 $645 = (___muldi3(($633|0),($634|0),654183,0)|0);
 $646 = tempRet0;
 $647 = (___muldi3(($633|0),($634|0),-997805,-1)|0);
 $648 = tempRet0;
 $649 = (___muldi3(($633|0),($634|0),136657,0)|0);
 $650 = tempRet0;
 $651 = (___muldi3(($633|0),($634|0),-683901,-1)|0);
 $652 = tempRet0;
 $653 = (_bitshift64Ashr(($641|0),($642|0),21)|0);
 $654 = tempRet0;
 $655 = (_i64Add(($643|0),($644|0),($525|0),($526|0))|0);
 $656 = tempRet0;
 $657 = (_i64Subtract(($655|0),($656|0),($595|0),($596|0))|0);
 $658 = tempRet0;
 $659 = (_i64Add(($657|0),($658|0),($653|0),($654|0))|0);
 $660 = tempRet0;
 $661 = (_bitshift64Shl(($653|0),($654|0),21)|0);
 $662 = tempRet0;
 $663 = (_i64Subtract(($641|0),($642|0),($661|0),($662|0))|0);
 $664 = tempRet0;
 $665 = (_bitshift64Ashr(($659|0),($660|0),21)|0);
 $666 = tempRet0;
 $667 = (_i64Add(($645|0),($646|0),($505|0),($506|0))|0);
 $668 = tempRet0;
 $669 = (_i64Subtract(($667|0),($668|0),($541|0),($542|0))|0);
 $670 = tempRet0;
 $671 = (_i64Add(($669|0),($670|0),($593|0),($594|0))|0);
 $672 = tempRet0;
 $673 = (_i64Add(($671|0),($672|0),($665|0),($666|0))|0);
 $674 = tempRet0;
 $675 = (_bitshift64Shl(($665|0),($666|0),21)|0);
 $676 = tempRet0;
 $677 = (_i64Subtract(($659|0),($660|0),($675|0),($676|0))|0);
 $678 = tempRet0;
 $679 = (_bitshift64Ashr(($673|0),($674|0),21)|0);
 $680 = tempRet0;
 $681 = (_i64Add(($539|0),($540|0),($647|0),($648|0))|0);
 $682 = tempRet0;
 $683 = (_i64Subtract(($681|0),($682|0),($601|0),($602|0))|0);
 $684 = tempRet0;
 $685 = (_i64Add(($683|0),($684|0),($679|0),($680|0))|0);
 $686 = tempRet0;
 $687 = (_bitshift64Shl(($679|0),($680|0),21)|0);
 $688 = tempRet0;
 $689 = (_i64Subtract(($673|0),($674|0),($687|0),($688|0))|0);
 $690 = tempRet0;
 $691 = (_bitshift64Ashr(($685|0),($686|0),21)|0);
 $692 = tempRet0;
 $693 = (_i64Add(($649|0),($650|0),($513|0),($514|0))|0);
 $694 = tempRet0;
 $695 = (_i64Subtract(($693|0),($694|0),($553|0),($554|0))|0);
 $696 = tempRet0;
 $697 = (_i64Add(($695|0),($696|0),($599|0),($600|0))|0);
 $698 = tempRet0;
 $699 = (_i64Add(($697|0),($698|0),($691|0),($692|0))|0);
 $700 = tempRet0;
 $701 = (_bitshift64Shl(($691|0),($692|0),21)|0);
 $702 = tempRet0;
 $703 = (_i64Subtract(($685|0),($686|0),($701|0),($702|0))|0);
 $704 = tempRet0;
 $705 = (_bitshift64Ashr(($699|0),($700|0),21)|0);
 $706 = tempRet0;
 $707 = (_i64Add(($551|0),($552|0),($651|0),($652|0))|0);
 $708 = tempRet0;
 $709 = (_i64Subtract(($707|0),($708|0),($609|0),($610|0))|0);
 $710 = tempRet0;
 $711 = (_i64Add(($709|0),($710|0),($705|0),($706|0))|0);
 $712 = tempRet0;
 $713 = (_bitshift64Shl(($705|0),($706|0),21)|0);
 $714 = tempRet0;
 $715 = (_i64Subtract(($699|0),($700|0),($713|0),($714|0))|0);
 $716 = tempRet0;
 $717 = (_bitshift64Ashr(($711|0),($712|0),21)|0);
 $718 = tempRet0;
 $719 = (_i64Add(($607|0),($608|0),($717|0),($718|0))|0);
 $720 = tempRet0;
 $721 = (_bitshift64Shl(($717|0),($718|0),21)|0);
 $722 = tempRet0;
 $723 = (_i64Subtract(($711|0),($712|0),($721|0),($722|0))|0);
 $724 = tempRet0;
 $725 = (_bitshift64Ashr(($719|0),($720|0),21)|0);
 $726 = tempRet0;
 $727 = (_i64Add(($725|0),($726|0),($619|0),($620|0))|0);
 $728 = tempRet0;
 $729 = (_bitshift64Shl(($725|0),($726|0),21)|0);
 $730 = tempRet0;
 $731 = (_i64Subtract(($719|0),($720|0),($729|0),($730|0))|0);
 $732 = tempRet0;
 $733 = (_bitshift64Ashr(($727|0),($728|0),21)|0);
 $734 = tempRet0;
 $735 = (_i64Add(($615|0),($616|0),($733|0),($734|0))|0);
 $736 = tempRet0;
 $737 = (_bitshift64Shl(($733|0),($734|0),21)|0);
 $738 = tempRet0;
 $739 = (_i64Subtract(($727|0),($728|0),($737|0),($738|0))|0);
 $740 = tempRet0;
 $741 = (_bitshift64Ashr(($735|0),($736|0),21)|0);
 $742 = tempRet0;
 $743 = (_i64Add(($741|0),($742|0),($629|0),($630|0))|0);
 $744 = tempRet0;
 $745 = (_bitshift64Shl(($741|0),($742|0),21)|0);
 $746 = tempRet0;
 $747 = (_i64Subtract(($735|0),($736|0),($745|0),($746|0))|0);
 $748 = tempRet0;
 $749 = (_bitshift64Ashr(($743|0),($744|0),21)|0);
 $750 = tempRet0;
 $751 = (_i64Add(($625|0),($626|0),($749|0),($750|0))|0);
 $752 = tempRet0;
 $753 = (_bitshift64Shl(($749|0),($750|0),21)|0);
 $754 = tempRet0;
 $755 = (_i64Subtract(($743|0),($744|0),($753|0),($754|0))|0);
 $756 = tempRet0;
 $757 = (_bitshift64Ashr(($751|0),($752|0),21)|0);
 $758 = tempRet0;
 $759 = (_i64Add(($757|0),($758|0),($637|0),($638|0))|0);
 $760 = tempRet0;
 $761 = (_bitshift64Shl(($757|0),($758|0),21)|0);
 $762 = tempRet0;
 $763 = (_i64Subtract(($751|0),($752|0),($761|0),($762|0))|0);
 $764 = tempRet0;
 $765 = (_bitshift64Ashr(($759|0),($760|0),21)|0);
 $766 = tempRet0;
 $767 = (_bitshift64Shl(($765|0),($766|0),21)|0);
 $768 = tempRet0;
 $769 = (_i64Subtract(($759|0),($760|0),($767|0),($768|0))|0);
 $770 = tempRet0;
 $771 = (___muldi3(($765|0),($766|0),666643,0)|0);
 $772 = tempRet0;
 $773 = (_i64Add(($771|0),($772|0),($663|0),($664|0))|0);
 $774 = tempRet0;
 $775 = (___muldi3(($765|0),($766|0),470296,0)|0);
 $776 = tempRet0;
 $777 = (_i64Add(($677|0),($678|0),($775|0),($776|0))|0);
 $778 = tempRet0;
 $779 = (___muldi3(($765|0),($766|0),654183,0)|0);
 $780 = tempRet0;
 $781 = (_i64Add(($689|0),($690|0),($779|0),($780|0))|0);
 $782 = tempRet0;
 $783 = (___muldi3(($765|0),($766|0),-997805,-1)|0);
 $784 = tempRet0;
 $785 = (_i64Add(($703|0),($704|0),($783|0),($784|0))|0);
 $786 = tempRet0;
 $787 = (___muldi3(($765|0),($766|0),136657,0)|0);
 $788 = tempRet0;
 $789 = (_i64Add(($715|0),($716|0),($787|0),($788|0))|0);
 $790 = tempRet0;
 $791 = (___muldi3(($765|0),($766|0),-683901,-1)|0);
 $792 = tempRet0;
 $793 = (_i64Add(($723|0),($724|0),($791|0),($792|0))|0);
 $794 = tempRet0;
 $795 = (_bitshift64Ashr(($773|0),($774|0),21)|0);
 $796 = tempRet0;
 $797 = (_i64Add(($777|0),($778|0),($795|0),($796|0))|0);
 $798 = tempRet0;
 $799 = (_bitshift64Shl(($795|0),($796|0),21)|0);
 $800 = tempRet0;
 $801 = (_i64Subtract(($773|0),($774|0),($799|0),($800|0))|0);
 $802 = tempRet0;
 $803 = (_bitshift64Ashr(($797|0),($798|0),21)|0);
 $804 = tempRet0;
 $805 = (_i64Add(($781|0),($782|0),($803|0),($804|0))|0);
 $806 = tempRet0;
 $807 = (_bitshift64Shl(($803|0),($804|0),21)|0);
 $808 = tempRet0;
 $809 = (_i64Subtract(($797|0),($798|0),($807|0),($808|0))|0);
 $810 = tempRet0;
 $811 = (_bitshift64Ashr(($805|0),($806|0),21)|0);
 $812 = tempRet0;
 $813 = (_i64Add(($785|0),($786|0),($811|0),($812|0))|0);
 $814 = tempRet0;
 $815 = (_bitshift64Shl(($811|0),($812|0),21)|0);
 $816 = tempRet0;
 $817 = (_i64Subtract(($805|0),($806|0),($815|0),($816|0))|0);
 $818 = tempRet0;
 $819 = (_bitshift64Ashr(($813|0),($814|0),21)|0);
 $820 = tempRet0;
 $821 = (_i64Add(($789|0),($790|0),($819|0),($820|0))|0);
 $822 = tempRet0;
 $823 = (_bitshift64Shl(($819|0),($820|0),21)|0);
 $824 = tempRet0;
 $825 = (_i64Subtract(($813|0),($814|0),($823|0),($824|0))|0);
 $826 = tempRet0;
 $827 = (_bitshift64Ashr(($821|0),($822|0),21)|0);
 $828 = tempRet0;
 $829 = (_i64Add(($793|0),($794|0),($827|0),($828|0))|0);
 $830 = tempRet0;
 $831 = (_bitshift64Shl(($827|0),($828|0),21)|0);
 $832 = tempRet0;
 $833 = (_i64Subtract(($821|0),($822|0),($831|0),($832|0))|0);
 $834 = tempRet0;
 $835 = (_bitshift64Ashr(($829|0),($830|0),21)|0);
 $836 = tempRet0;
 $837 = (_i64Add(($835|0),($836|0),($731|0),($732|0))|0);
 $838 = tempRet0;
 $839 = (_bitshift64Shl(($835|0),($836|0),21)|0);
 $840 = tempRet0;
 $841 = (_i64Subtract(($829|0),($830|0),($839|0),($840|0))|0);
 $842 = tempRet0;
 $843 = (_bitshift64Ashr(($837|0),($838|0),21)|0);
 $844 = tempRet0;
 $845 = (_i64Add(($843|0),($844|0),($739|0),($740|0))|0);
 $846 = tempRet0;
 $847 = (_bitshift64Shl(($843|0),($844|0),21)|0);
 $848 = tempRet0;
 $849 = (_i64Subtract(($837|0),($838|0),($847|0),($848|0))|0);
 $850 = tempRet0;
 $851 = (_bitshift64Ashr(($845|0),($846|0),21)|0);
 $852 = tempRet0;
 $853 = (_i64Add(($851|0),($852|0),($747|0),($748|0))|0);
 $854 = tempRet0;
 $855 = (_bitshift64Shl(($851|0),($852|0),21)|0);
 $856 = tempRet0;
 $857 = (_i64Subtract(($845|0),($846|0),($855|0),($856|0))|0);
 $858 = tempRet0;
 $859 = (_bitshift64Ashr(($853|0),($854|0),21)|0);
 $860 = tempRet0;
 $861 = (_i64Add(($859|0),($860|0),($755|0),($756|0))|0);
 $862 = tempRet0;
 $863 = (_bitshift64Shl(($859|0),($860|0),21)|0);
 $864 = tempRet0;
 $865 = (_i64Subtract(($853|0),($854|0),($863|0),($864|0))|0);
 $866 = tempRet0;
 $867 = (_bitshift64Ashr(($861|0),($862|0),21)|0);
 $868 = tempRet0;
 $869 = (_i64Add(($867|0),($868|0),($763|0),($764|0))|0);
 $870 = tempRet0;
 $871 = (_bitshift64Shl(($867|0),($868|0),21)|0);
 $872 = tempRet0;
 $873 = (_i64Subtract(($861|0),($862|0),($871|0),($872|0))|0);
 $874 = tempRet0;
 $875 = (_bitshift64Ashr(($869|0),($870|0),21)|0);
 $876 = tempRet0;
 $877 = (_i64Add(($875|0),($876|0),($769|0),($770|0))|0);
 $878 = tempRet0;
 $879 = (_bitshift64Shl(($875|0),($876|0),21)|0);
 $880 = tempRet0;
 $881 = (_i64Subtract(($869|0),($870|0),($879|0),($880|0))|0);
 $882 = tempRet0;
 $883 = $801&255;
 HEAP8[$0>>0] = $883;
 $884 = (_bitshift64Lshr(($801|0),($802|0),8)|0);
 $885 = tempRet0;
 $886 = $884&255;
 $887 = ((($0)) + 1|0);
 HEAP8[$887>>0] = $886;
 $888 = (_bitshift64Lshr(($801|0),($802|0),16)|0);
 $889 = tempRet0;
 $890 = (_bitshift64Shl(($809|0),($810|0),5)|0);
 $891 = tempRet0;
 $892 = $890 | $888;
 $891 | $889;
 $893 = $892&255;
 HEAP8[$4>>0] = $893;
 $894 = (_bitshift64Lshr(($809|0),($810|0),3)|0);
 $895 = tempRet0;
 $896 = $894&255;
 $897 = ((($0)) + 3|0);
 HEAP8[$897>>0] = $896;
 $898 = (_bitshift64Lshr(($809|0),($810|0),11)|0);
 $899 = tempRet0;
 $900 = $898&255;
 $901 = ((($0)) + 4|0);
 HEAP8[$901>>0] = $900;
 $902 = (_bitshift64Lshr(($809|0),($810|0),19)|0);
 $903 = tempRet0;
 $904 = (_bitshift64Shl(($817|0),($818|0),2)|0);
 $905 = tempRet0;
 $906 = $904 | $902;
 $905 | $903;
 $907 = $906&255;
 HEAP8[$10>>0] = $907;
 $908 = (_bitshift64Lshr(($817|0),($818|0),6)|0);
 $909 = tempRet0;
 $910 = $908&255;
 $911 = ((($0)) + 6|0);
 HEAP8[$911>>0] = $910;
 $912 = (_bitshift64Lshr(($817|0),($818|0),14)|0);
 $913 = tempRet0;
 $914 = (_bitshift64Shl(($825|0),($826|0),7)|0);
 $915 = tempRet0;
 $916 = $914 | $912;
 $915 | $913;
 $917 = $916&255;
 HEAP8[$16>>0] = $917;
 $918 = (_bitshift64Lshr(($825|0),($826|0),1)|0);
 $919 = tempRet0;
 $920 = $918&255;
 $921 = ((($0)) + 8|0);
 HEAP8[$921>>0] = $920;
 $922 = (_bitshift64Lshr(($825|0),($826|0),9)|0);
 $923 = tempRet0;
 $924 = $922&255;
 $925 = ((($0)) + 9|0);
 HEAP8[$925>>0] = $924;
 $926 = (_bitshift64Lshr(($825|0),($826|0),17)|0);
 $927 = tempRet0;
 $928 = (_bitshift64Shl(($833|0),($834|0),4)|0);
 $929 = tempRet0;
 $930 = $928 | $926;
 $929 | $927;
 $931 = $930&255;
 HEAP8[$22>>0] = $931;
 $932 = (_bitshift64Lshr(($833|0),($834|0),4)|0);
 $933 = tempRet0;
 $934 = $932&255;
 $935 = ((($0)) + 11|0);
 HEAP8[$935>>0] = $934;
 $936 = (_bitshift64Lshr(($833|0),($834|0),12)|0);
 $937 = tempRet0;
 $938 = $936&255;
 $939 = ((($0)) + 12|0);
 HEAP8[$939>>0] = $938;
 $940 = (_bitshift64Lshr(($833|0),($834|0),20)|0);
 $941 = tempRet0;
 $942 = (_bitshift64Shl(($841|0),($842|0),1)|0);
 $943 = tempRet0;
 $944 = $942 | $940;
 $943 | $941;
 $945 = $944&255;
 HEAP8[$28>>0] = $945;
 $946 = (_bitshift64Lshr(($841|0),($842|0),7)|0);
 $947 = tempRet0;
 $948 = $946&255;
 $949 = ((($0)) + 14|0);
 HEAP8[$949>>0] = $948;
 $950 = (_bitshift64Lshr(($841|0),($842|0),15)|0);
 $951 = tempRet0;
 $952 = (_bitshift64Shl(($849|0),($850|0),6)|0);
 $953 = tempRet0;
 $954 = $952 | $950;
 $953 | $951;
 $955 = $954&255;
 HEAP8[$34>>0] = $955;
 $956 = (_bitshift64Lshr(($849|0),($850|0),2)|0);
 $957 = tempRet0;
 $958 = $956&255;
 $959 = ((($0)) + 16|0);
 HEAP8[$959>>0] = $958;
 $960 = (_bitshift64Lshr(($849|0),($850|0),10)|0);
 $961 = tempRet0;
 $962 = $960&255;
 $963 = ((($0)) + 17|0);
 HEAP8[$963>>0] = $962;
 $964 = (_bitshift64Lshr(($849|0),($850|0),18)|0);
 $965 = tempRet0;
 $966 = (_bitshift64Shl(($857|0),($858|0),3)|0);
 $967 = tempRet0;
 $968 = $966 | $964;
 $967 | $965;
 $969 = $968&255;
 HEAP8[$40>>0] = $969;
 $970 = (_bitshift64Lshr(($857|0),($858|0),5)|0);
 $971 = tempRet0;
 $972 = $970&255;
 $973 = ((($0)) + 19|0);
 HEAP8[$973>>0] = $972;
 $974 = (_bitshift64Lshr(($857|0),($858|0),13)|0);
 $975 = tempRet0;
 $976 = $974&255;
 $977 = ((($0)) + 20|0);
 HEAP8[$977>>0] = $976;
 $978 = $865&255;
 HEAP8[$46>>0] = $978;
 $979 = (_bitshift64Lshr(($865|0),($866|0),8)|0);
 $980 = tempRet0;
 $981 = $979&255;
 $982 = ((($0)) + 22|0);
 HEAP8[$982>>0] = $981;
 $983 = (_bitshift64Lshr(($865|0),($866|0),16)|0);
 $984 = tempRet0;
 $985 = (_bitshift64Shl(($873|0),($874|0),5)|0);
 $986 = tempRet0;
 $987 = $985 | $983;
 $986 | $984;
 $988 = $987&255;
 HEAP8[$50>>0] = $988;
 $989 = (_bitshift64Lshr(($873|0),($874|0),3)|0);
 $990 = tempRet0;
 $991 = $989&255;
 $992 = ((($0)) + 24|0);
 HEAP8[$992>>0] = $991;
 $993 = (_bitshift64Lshr(($873|0),($874|0),11)|0);
 $994 = tempRet0;
 $995 = $993&255;
 $996 = ((($0)) + 25|0);
 HEAP8[$996>>0] = $995;
 $997 = (_bitshift64Lshr(($873|0),($874|0),19)|0);
 $998 = tempRet0;
 $999 = (_bitshift64Shl(($881|0),($882|0),2)|0);
 $1000 = tempRet0;
 $1001 = $999 | $997;
 $1000 | $998;
 $1002 = $1001&255;
 HEAP8[$56>>0] = $1002;
 $1003 = (_bitshift64Lshr(($881|0),($882|0),6)|0);
 $1004 = tempRet0;
 $1005 = $1003&255;
 $1006 = ((($0)) + 27|0);
 HEAP8[$1006>>0] = $1005;
 $1007 = (_bitshift64Lshr(($881|0),($882|0),14)|0);
 $1008 = tempRet0;
 $1009 = (_bitshift64Shl(($877|0),($878|0),7)|0);
 $1010 = tempRet0;
 $1011 = $1007 | $1009;
 $1008 | $1010;
 $1012 = $1011&255;
 HEAP8[$62>>0] = $1012;
 $1013 = (_bitshift64Lshr(($877|0),($878|0),1)|0);
 $1014 = tempRet0;
 $1015 = $1013&255;
 $1016 = ((($0)) + 29|0);
 HEAP8[$1016>>0] = $1015;
 $1017 = (_bitshift64Lshr(($877|0),($878|0),9)|0);
 $1018 = tempRet0;
 $1019 = $1017&255;
 $1020 = ((($0)) + 30|0);
 HEAP8[$1020>>0] = $1019;
 $1021 = (_bitshift64Lshr(($877|0),($878|0),17)|0);
 $1022 = tempRet0;
 $1023 = $1021&255;
 HEAP8[$68>>0] = $1023;
 return;
}
function _load_3_47($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 tempRet0 = ($15);
 return ($14|0);
}
function _load_4_48($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 $16 = ((($0)) + 3|0);
 $17 = HEAP8[$16>>0]|0;
 $18 = $17&255;
 $19 = (_bitshift64Shl(($18|0),0,24)|0);
 $20 = tempRet0;
 $21 = $14 | $19;
 $22 = $15 | $20;
 tempRet0 = ($22);
 return ($21|0);
}
function _sc_muladd($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0;
 var $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0;
 var $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0;
 var $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0;
 var $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0;
 var $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0;
 var $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0, $1124 = 0;
 var $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0, $1142 = 0;
 var $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0, $1160 = 0;
 var $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0, $1179 = 0;
 var $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0, $1197 = 0;
 var $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0, $1213 = 0, $1214 = 0;
 var $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0, $1231 = 0, $1232 = 0;
 var $1233 = 0, $1234 = 0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0, $125 = 0, $1250 = 0;
 var $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0, $1268 = 0, $1269 = 0;
 var $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0, $1286 = 0, $1287 = 0;
 var $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0, $1303 = 0, $1304 = 0;
 var $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0, $1321 = 0, $1322 = 0;
 var $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0, $134 = 0, $1340 = 0;
 var $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0, $1358 = 0, $1359 = 0;
 var $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0, $1376 = 0, $1377 = 0;
 var $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0, $1394 = 0, $1395 = 0;
 var $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0, $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0, $1411 = 0, $1412 = 0;
 var $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0, $142 = 0, $1420 = 0, $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0, $143 = 0, $1430 = 0;
 var $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0, $1448 = 0, $1449 = 0;
 var $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0, $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0, $1466 = 0, $1467 = 0;
 var $1468 = 0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0, $1484 = 0, $1485 = 0;
 var $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0, $1501 = 0, $1502 = 0;
 var $1503 = 0, $1504 = 0, $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0, $152 = 0, $1520 = 0;
 var $1521 = 0, $1522 = 0, $1523 = 0, $1524 = 0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0, $1532 = 0, $1533 = 0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0, $1538 = 0, $1539 = 0;
 var $154 = 0, $1540 = 0, $1541 = 0, $1542 = 0, $1543 = 0, $1544 = 0, $1545 = 0, $1546 = 0, $1547 = 0, $1548 = 0, $1549 = 0, $155 = 0, $1550 = 0, $1551 = 0, $1552 = 0, $1553 = 0, $1554 = 0, $1555 = 0, $1556 = 0, $1557 = 0;
 var $1558 = 0, $1559 = 0, $156 = 0, $1560 = 0, $1561 = 0, $1562 = 0, $1563 = 0, $1564 = 0, $1565 = 0, $1566 = 0, $1567 = 0, $1568 = 0, $1569 = 0, $157 = 0, $1570 = 0, $1571 = 0, $1572 = 0, $1573 = 0, $1574 = 0, $1575 = 0;
 var $1576 = 0, $1577 = 0, $1578 = 0, $1579 = 0, $158 = 0, $1580 = 0, $1581 = 0, $1582 = 0, $1583 = 0, $1584 = 0, $1585 = 0, $1586 = 0, $1587 = 0, $1588 = 0, $1589 = 0, $159 = 0, $1590 = 0, $1591 = 0, $1592 = 0, $1593 = 0;
 var $1594 = 0, $1595 = 0, $1596 = 0, $1597 = 0, $1598 = 0, $1599 = 0, $16 = 0, $160 = 0, $1600 = 0, $1601 = 0, $1602 = 0, $1603 = 0, $1604 = 0, $1605 = 0, $1606 = 0, $1607 = 0, $1608 = 0, $1609 = 0, $161 = 0, $1610 = 0;
 var $1611 = 0, $1612 = 0, $1613 = 0, $1614 = 0, $1615 = 0, $1616 = 0, $1617 = 0, $1618 = 0, $1619 = 0, $162 = 0, $1620 = 0, $1621 = 0, $1622 = 0, $1623 = 0, $1624 = 0, $1625 = 0, $1626 = 0, $1627 = 0, $1628 = 0, $1629 = 0;
 var $163 = 0, $1630 = 0, $1631 = 0, $1632 = 0, $1633 = 0, $1634 = 0, $1635 = 0, $1636 = 0, $1637 = 0, $1638 = 0, $1639 = 0, $164 = 0, $1640 = 0, $1641 = 0, $1642 = 0, $1643 = 0, $1644 = 0, $1645 = 0, $1646 = 0, $1647 = 0;
 var $1648 = 0, $1649 = 0, $165 = 0, $1650 = 0, $1651 = 0, $1652 = 0, $1653 = 0, $1654 = 0, $1655 = 0, $1656 = 0, $1657 = 0, $1658 = 0, $1659 = 0, $166 = 0, $1660 = 0, $1661 = 0, $1662 = 0, $1663 = 0, $1664 = 0, $1665 = 0;
 var $1666 = 0, $1667 = 0, $1668 = 0, $1669 = 0, $167 = 0, $1670 = 0, $1671 = 0, $1672 = 0, $1673 = 0, $1674 = 0, $1675 = 0, $1676 = 0, $1677 = 0, $1678 = 0, $1679 = 0, $168 = 0, $1680 = 0, $1681 = 0, $1682 = 0, $1683 = 0;
 var $1684 = 0, $1685 = 0, $1686 = 0, $1687 = 0, $1688 = 0, $1689 = 0, $169 = 0, $1690 = 0, $1691 = 0, $1692 = 0, $1693 = 0, $1694 = 0, $1695 = 0, $1696 = 0, $1697 = 0, $1698 = 0, $1699 = 0, $17 = 0, $170 = 0, $1700 = 0;
 var $1701 = 0, $1702 = 0, $1703 = 0, $1704 = 0, $1705 = 0, $1706 = 0, $1707 = 0, $1708 = 0, $1709 = 0, $171 = 0, $1710 = 0, $1711 = 0, $1712 = 0, $1713 = 0, $1714 = 0, $1715 = 0, $1716 = 0, $1717 = 0, $1718 = 0, $1719 = 0;
 var $172 = 0, $1720 = 0, $1721 = 0, $1722 = 0, $1723 = 0, $1724 = 0, $1725 = 0, $1726 = 0, $1727 = 0, $1728 = 0, $1729 = 0, $173 = 0, $1730 = 0, $1731 = 0, $1732 = 0, $1733 = 0, $1734 = 0, $1735 = 0, $1736 = 0, $1737 = 0;
 var $1738 = 0, $1739 = 0, $174 = 0, $1740 = 0, $1741 = 0, $1742 = 0, $1743 = 0, $1744 = 0, $1745 = 0, $1746 = 0, $1747 = 0, $1748 = 0, $1749 = 0, $175 = 0, $1750 = 0, $1751 = 0, $1752 = 0, $1753 = 0, $1754 = 0, $1755 = 0;
 var $1756 = 0, $1757 = 0, $1758 = 0, $1759 = 0, $176 = 0, $1760 = 0, $1761 = 0, $1762 = 0, $1763 = 0, $1764 = 0, $1765 = 0, $1766 = 0, $1767 = 0, $1768 = 0, $1769 = 0, $177 = 0, $1770 = 0, $1771 = 0, $1772 = 0, $1773 = 0;
 var $1774 = 0, $1775 = 0, $1776 = 0, $1777 = 0, $1778 = 0, $1779 = 0, $178 = 0, $1780 = 0, $1781 = 0, $1782 = 0, $1783 = 0, $1784 = 0, $1785 = 0, $1786 = 0, $1787 = 0, $1788 = 0, $1789 = 0, $179 = 0, $1790 = 0, $1791 = 0;
 var $1792 = 0, $1793 = 0, $1794 = 0, $1795 = 0, $1796 = 0, $1797 = 0, $1798 = 0, $1799 = 0, $18 = 0, $180 = 0, $1800 = 0, $1801 = 0, $1802 = 0, $1803 = 0, $1804 = 0, $1805 = 0, $1806 = 0, $1807 = 0, $1808 = 0, $1809 = 0;
 var $181 = 0, $1810 = 0, $1811 = 0, $1812 = 0, $1813 = 0, $1814 = 0, $1815 = 0, $1816 = 0, $1817 = 0, $1818 = 0, $1819 = 0, $182 = 0, $1820 = 0, $1821 = 0, $1822 = 0, $1823 = 0, $1824 = 0, $1825 = 0, $1826 = 0, $1827 = 0;
 var $1828 = 0, $1829 = 0, $183 = 0, $1830 = 0, $1831 = 0, $1832 = 0, $1833 = 0, $1834 = 0, $1835 = 0, $1836 = 0, $1837 = 0, $1838 = 0, $1839 = 0, $184 = 0, $1840 = 0, $1841 = 0, $1842 = 0, $1843 = 0, $1844 = 0, $1845 = 0;
 var $1846 = 0, $1847 = 0, $1848 = 0, $1849 = 0, $185 = 0, $1850 = 0, $1851 = 0, $1852 = 0, $1853 = 0, $1854 = 0, $1855 = 0, $1856 = 0, $1857 = 0, $1858 = 0, $1859 = 0, $186 = 0, $1860 = 0, $1861 = 0, $1862 = 0, $1863 = 0;
 var $1864 = 0, $1865 = 0, $1866 = 0, $1867 = 0, $1868 = 0, $1869 = 0, $187 = 0, $1870 = 0, $1871 = 0, $1872 = 0, $1873 = 0, $1874 = 0, $1875 = 0, $1876 = 0, $1877 = 0, $1878 = 0, $1879 = 0, $188 = 0, $1880 = 0, $1881 = 0;
 var $1882 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0;
 var $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0;
 var $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0;
 var $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0;
 var $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0;
 var $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0;
 var $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0;
 var $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0;
 var $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0;
 var $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0;
 var $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0;
 var $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0;
 var $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0;
 var $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0;
 var $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0;
 var $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0;
 var $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0;
 var $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0;
 var $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0;
 var $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0;
 var $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0;
 var $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0;
 var $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0;
 var $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0;
 var $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0;
 var $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0;
 var $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0;
 var $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0;
 var $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0;
 var $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0;
 var $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0;
 var $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0;
 var $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0;
 var $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0;
 var $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0;
 var $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0;
 var $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0;
 var $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0;
 var $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $4 = (_load_3_47($1)|0);
 $5 = tempRet0;
 $6 = $4 & 2097151;
 $7 = ((($1)) + 2|0);
 $8 = (_load_4_48($7)|0);
 $9 = tempRet0;
 $10 = (_bitshift64Lshr(($8|0),($9|0),5)|0);
 $11 = tempRet0;
 $12 = $10 & 2097151;
 $13 = ((($1)) + 5|0);
 $14 = (_load_3_47($13)|0);
 $15 = tempRet0;
 $16 = (_bitshift64Lshr(($14|0),($15|0),2)|0);
 $17 = tempRet0;
 $18 = $16 & 2097151;
 $19 = ((($1)) + 7|0);
 $20 = (_load_4_48($19)|0);
 $21 = tempRet0;
 $22 = (_bitshift64Lshr(($20|0),($21|0),7)|0);
 $23 = tempRet0;
 $24 = $22 & 2097151;
 $25 = ((($1)) + 10|0);
 $26 = (_load_4_48($25)|0);
 $27 = tempRet0;
 $28 = (_bitshift64Lshr(($26|0),($27|0),4)|0);
 $29 = tempRet0;
 $30 = $28 & 2097151;
 $31 = ((($1)) + 13|0);
 $32 = (_load_3_47($31)|0);
 $33 = tempRet0;
 $34 = (_bitshift64Lshr(($32|0),($33|0),1)|0);
 $35 = tempRet0;
 $36 = $34 & 2097151;
 $37 = ((($1)) + 15|0);
 $38 = (_load_4_48($37)|0);
 $39 = tempRet0;
 $40 = (_bitshift64Lshr(($38|0),($39|0),6)|0);
 $41 = tempRet0;
 $42 = $40 & 2097151;
 $43 = ((($1)) + 18|0);
 $44 = (_load_3_47($43)|0);
 $45 = tempRet0;
 $46 = (_bitshift64Lshr(($44|0),($45|0),3)|0);
 $47 = tempRet0;
 $48 = $46 & 2097151;
 $49 = ((($1)) + 21|0);
 $50 = (_load_3_47($49)|0);
 $51 = tempRet0;
 $52 = $50 & 2097151;
 $53 = ((($1)) + 23|0);
 $54 = (_load_4_48($53)|0);
 $55 = tempRet0;
 $56 = (_bitshift64Lshr(($54|0),($55|0),5)|0);
 $57 = tempRet0;
 $58 = $56 & 2097151;
 $59 = ((($1)) + 26|0);
 $60 = (_load_3_47($59)|0);
 $61 = tempRet0;
 $62 = (_bitshift64Lshr(($60|0),($61|0),2)|0);
 $63 = tempRet0;
 $64 = $62 & 2097151;
 $65 = ((($1)) + 28|0);
 $66 = (_load_4_48($65)|0);
 $67 = tempRet0;
 $68 = (_bitshift64Lshr(($66|0),($67|0),7)|0);
 $69 = tempRet0;
 $70 = (_load_3_47($2)|0);
 $71 = tempRet0;
 $72 = $70 & 2097151;
 $73 = ((($2)) + 2|0);
 $74 = (_load_4_48($73)|0);
 $75 = tempRet0;
 $76 = (_bitshift64Lshr(($74|0),($75|0),5)|0);
 $77 = tempRet0;
 $78 = $76 & 2097151;
 $79 = ((($2)) + 5|0);
 $80 = (_load_3_47($79)|0);
 $81 = tempRet0;
 $82 = (_bitshift64Lshr(($80|0),($81|0),2)|0);
 $83 = tempRet0;
 $84 = $82 & 2097151;
 $85 = ((($2)) + 7|0);
 $86 = (_load_4_48($85)|0);
 $87 = tempRet0;
 $88 = (_bitshift64Lshr(($86|0),($87|0),7)|0);
 $89 = tempRet0;
 $90 = $88 & 2097151;
 $91 = ((($2)) + 10|0);
 $92 = (_load_4_48($91)|0);
 $93 = tempRet0;
 $94 = (_bitshift64Lshr(($92|0),($93|0),4)|0);
 $95 = tempRet0;
 $96 = $94 & 2097151;
 $97 = ((($2)) + 13|0);
 $98 = (_load_3_47($97)|0);
 $99 = tempRet0;
 $100 = (_bitshift64Lshr(($98|0),($99|0),1)|0);
 $101 = tempRet0;
 $102 = $100 & 2097151;
 $103 = ((($2)) + 15|0);
 $104 = (_load_4_48($103)|0);
 $105 = tempRet0;
 $106 = (_bitshift64Lshr(($104|0),($105|0),6)|0);
 $107 = tempRet0;
 $108 = $106 & 2097151;
 $109 = ((($2)) + 18|0);
 $110 = (_load_3_47($109)|0);
 $111 = tempRet0;
 $112 = (_bitshift64Lshr(($110|0),($111|0),3)|0);
 $113 = tempRet0;
 $114 = $112 & 2097151;
 $115 = ((($2)) + 21|0);
 $116 = (_load_3_47($115)|0);
 $117 = tempRet0;
 $118 = $116 & 2097151;
 $119 = ((($2)) + 23|0);
 $120 = (_load_4_48($119)|0);
 $121 = tempRet0;
 $122 = (_bitshift64Lshr(($120|0),($121|0),5)|0);
 $123 = tempRet0;
 $124 = $122 & 2097151;
 $125 = ((($2)) + 26|0);
 $126 = (_load_3_47($125)|0);
 $127 = tempRet0;
 $128 = (_bitshift64Lshr(($126|0),($127|0),2)|0);
 $129 = tempRet0;
 $130 = $128 & 2097151;
 $131 = ((($2)) + 28|0);
 $132 = (_load_4_48($131)|0);
 $133 = tempRet0;
 $134 = (_bitshift64Lshr(($132|0),($133|0),7)|0);
 $135 = tempRet0;
 $136 = (_load_3_47($3)|0);
 $137 = tempRet0;
 $138 = $136 & 2097151;
 $139 = ((($3)) + 2|0);
 $140 = (_load_4_48($139)|0);
 $141 = tempRet0;
 $142 = (_bitshift64Lshr(($140|0),($141|0),5)|0);
 $143 = tempRet0;
 $144 = $142 & 2097151;
 $145 = ((($3)) + 5|0);
 $146 = (_load_3_47($145)|0);
 $147 = tempRet0;
 $148 = (_bitshift64Lshr(($146|0),($147|0),2)|0);
 $149 = tempRet0;
 $150 = $148 & 2097151;
 $151 = ((($3)) + 7|0);
 $152 = (_load_4_48($151)|0);
 $153 = tempRet0;
 $154 = (_bitshift64Lshr(($152|0),($153|0),7)|0);
 $155 = tempRet0;
 $156 = $154 & 2097151;
 $157 = ((($3)) + 10|0);
 $158 = (_load_4_48($157)|0);
 $159 = tempRet0;
 $160 = (_bitshift64Lshr(($158|0),($159|0),4)|0);
 $161 = tempRet0;
 $162 = $160 & 2097151;
 $163 = ((($3)) + 13|0);
 $164 = (_load_3_47($163)|0);
 $165 = tempRet0;
 $166 = (_bitshift64Lshr(($164|0),($165|0),1)|0);
 $167 = tempRet0;
 $168 = $166 & 2097151;
 $169 = ((($3)) + 15|0);
 $170 = (_load_4_48($169)|0);
 $171 = tempRet0;
 $172 = (_bitshift64Lshr(($170|0),($171|0),6)|0);
 $173 = tempRet0;
 $174 = $172 & 2097151;
 $175 = ((($3)) + 18|0);
 $176 = (_load_3_47($175)|0);
 $177 = tempRet0;
 $178 = (_bitshift64Lshr(($176|0),($177|0),3)|0);
 $179 = tempRet0;
 $180 = $178 & 2097151;
 $181 = ((($3)) + 21|0);
 $182 = (_load_3_47($181)|0);
 $183 = tempRet0;
 $184 = $182 & 2097151;
 $185 = ((($3)) + 23|0);
 $186 = (_load_4_48($185)|0);
 $187 = tempRet0;
 $188 = (_bitshift64Lshr(($186|0),($187|0),5)|0);
 $189 = tempRet0;
 $190 = $188 & 2097151;
 $191 = ((($3)) + 26|0);
 $192 = (_load_3_47($191)|0);
 $193 = tempRet0;
 $194 = (_bitshift64Lshr(($192|0),($193|0),2)|0);
 $195 = tempRet0;
 $196 = $194 & 2097151;
 $197 = ((($3)) + 28|0);
 $198 = (_load_4_48($197)|0);
 $199 = tempRet0;
 $200 = (_bitshift64Lshr(($198|0),($199|0),7)|0);
 $201 = tempRet0;
 $202 = (___muldi3(($72|0),0,($6|0),0)|0);
 $203 = tempRet0;
 $204 = (_i64Add(($138|0),0,($202|0),($203|0))|0);
 $205 = tempRet0;
 $206 = (___muldi3(($78|0),0,($6|0),0)|0);
 $207 = tempRet0;
 $208 = (___muldi3(($72|0),0,($12|0),0)|0);
 $209 = tempRet0;
 $210 = (___muldi3(($84|0),0,($6|0),0)|0);
 $211 = tempRet0;
 $212 = (___muldi3(($78|0),0,($12|0),0)|0);
 $213 = tempRet0;
 $214 = (___muldi3(($72|0),0,($18|0),0)|0);
 $215 = tempRet0;
 $216 = (_i64Add(($212|0),($213|0),($214|0),($215|0))|0);
 $217 = tempRet0;
 $218 = (_i64Add(($216|0),($217|0),($210|0),($211|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($150|0),0)|0);
 $221 = tempRet0;
 $222 = (___muldi3(($90|0),0,($6|0),0)|0);
 $223 = tempRet0;
 $224 = (___muldi3(($84|0),0,($12|0),0)|0);
 $225 = tempRet0;
 $226 = (___muldi3(($78|0),0,($18|0),0)|0);
 $227 = tempRet0;
 $228 = (___muldi3(($72|0),0,($24|0),0)|0);
 $229 = tempRet0;
 $230 = (___muldi3(($96|0),0,($6|0),0)|0);
 $231 = tempRet0;
 $232 = (___muldi3(($90|0),0,($12|0),0)|0);
 $233 = tempRet0;
 $234 = (___muldi3(($84|0),0,($18|0),0)|0);
 $235 = tempRet0;
 $236 = (___muldi3(($78|0),0,($24|0),0)|0);
 $237 = tempRet0;
 $238 = (___muldi3(($72|0),0,($30|0),0)|0);
 $239 = tempRet0;
 $240 = (_i64Add(($236|0),($237|0),($238|0),($239|0))|0);
 $241 = tempRet0;
 $242 = (_i64Add(($240|0),($241|0),($234|0),($235|0))|0);
 $243 = tempRet0;
 $244 = (_i64Add(($242|0),($243|0),($232|0),($233|0))|0);
 $245 = tempRet0;
 $246 = (_i64Add(($244|0),($245|0),($230|0),($231|0))|0);
 $247 = tempRet0;
 $248 = (_i64Add(($246|0),($247|0),($162|0),0)|0);
 $249 = tempRet0;
 $250 = (___muldi3(($102|0),0,($6|0),0)|0);
 $251 = tempRet0;
 $252 = (___muldi3(($96|0),0,($12|0),0)|0);
 $253 = tempRet0;
 $254 = (___muldi3(($90|0),0,($18|0),0)|0);
 $255 = tempRet0;
 $256 = (___muldi3(($84|0),0,($24|0),0)|0);
 $257 = tempRet0;
 $258 = (___muldi3(($78|0),0,($30|0),0)|0);
 $259 = tempRet0;
 $260 = (___muldi3(($72|0),0,($36|0),0)|0);
 $261 = tempRet0;
 $262 = (___muldi3(($108|0),0,($6|0),0)|0);
 $263 = tempRet0;
 $264 = (___muldi3(($102|0),0,($12|0),0)|0);
 $265 = tempRet0;
 $266 = (___muldi3(($96|0),0,($18|0),0)|0);
 $267 = tempRet0;
 $268 = (___muldi3(($90|0),0,($24|0),0)|0);
 $269 = tempRet0;
 $270 = (___muldi3(($84|0),0,($30|0),0)|0);
 $271 = tempRet0;
 $272 = (___muldi3(($78|0),0,($36|0),0)|0);
 $273 = tempRet0;
 $274 = (___muldi3(($72|0),0,($42|0),0)|0);
 $275 = tempRet0;
 $276 = (_i64Add(($272|0),($273|0),($274|0),($275|0))|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($270|0),($271|0))|0);
 $279 = tempRet0;
 $280 = (_i64Add(($278|0),($279|0),($268|0),($269|0))|0);
 $281 = tempRet0;
 $282 = (_i64Add(($280|0),($281|0),($266|0),($267|0))|0);
 $283 = tempRet0;
 $284 = (_i64Add(($282|0),($283|0),($264|0),($265|0))|0);
 $285 = tempRet0;
 $286 = (_i64Add(($284|0),($285|0),($262|0),($263|0))|0);
 $287 = tempRet0;
 $288 = (_i64Add(($286|0),($287|0),($174|0),0)|0);
 $289 = tempRet0;
 $290 = (___muldi3(($114|0),0,($6|0),0)|0);
 $291 = tempRet0;
 $292 = (___muldi3(($108|0),0,($12|0),0)|0);
 $293 = tempRet0;
 $294 = (___muldi3(($102|0),0,($18|0),0)|0);
 $295 = tempRet0;
 $296 = (___muldi3(($96|0),0,($24|0),0)|0);
 $297 = tempRet0;
 $298 = (___muldi3(($90|0),0,($30|0),0)|0);
 $299 = tempRet0;
 $300 = (___muldi3(($84|0),0,($36|0),0)|0);
 $301 = tempRet0;
 $302 = (___muldi3(($78|0),0,($42|0),0)|0);
 $303 = tempRet0;
 $304 = (___muldi3(($72|0),0,($48|0),0)|0);
 $305 = tempRet0;
 $306 = (___muldi3(($118|0),0,($6|0),0)|0);
 $307 = tempRet0;
 $308 = (___muldi3(($114|0),0,($12|0),0)|0);
 $309 = tempRet0;
 $310 = (___muldi3(($108|0),0,($18|0),0)|0);
 $311 = tempRet0;
 $312 = (___muldi3(($102|0),0,($24|0),0)|0);
 $313 = tempRet0;
 $314 = (___muldi3(($96|0),0,($30|0),0)|0);
 $315 = tempRet0;
 $316 = (___muldi3(($90|0),0,($36|0),0)|0);
 $317 = tempRet0;
 $318 = (___muldi3(($84|0),0,($42|0),0)|0);
 $319 = tempRet0;
 $320 = (___muldi3(($78|0),0,($48|0),0)|0);
 $321 = tempRet0;
 $322 = (___muldi3(($72|0),0,($52|0),0)|0);
 $323 = tempRet0;
 $324 = (_i64Add(($320|0),($321|0),($322|0),($323|0))|0);
 $325 = tempRet0;
 $326 = (_i64Add(($324|0),($325|0),($318|0),($319|0))|0);
 $327 = tempRet0;
 $328 = (_i64Add(($326|0),($327|0),($316|0),($317|0))|0);
 $329 = tempRet0;
 $330 = (_i64Add(($328|0),($329|0),($314|0),($315|0))|0);
 $331 = tempRet0;
 $332 = (_i64Add(($330|0),($331|0),($312|0),($313|0))|0);
 $333 = tempRet0;
 $334 = (_i64Add(($332|0),($333|0),($310|0),($311|0))|0);
 $335 = tempRet0;
 $336 = (_i64Add(($334|0),($335|0),($306|0),($307|0))|0);
 $337 = tempRet0;
 $338 = (_i64Add(($336|0),($337|0),($308|0),($309|0))|0);
 $339 = tempRet0;
 $340 = (_i64Add(($338|0),($339|0),($184|0),0)|0);
 $341 = tempRet0;
 $342 = (___muldi3(($124|0),0,($6|0),0)|0);
 $343 = tempRet0;
 $344 = (___muldi3(($118|0),0,($12|0),0)|0);
 $345 = tempRet0;
 $346 = (___muldi3(($114|0),0,($18|0),0)|0);
 $347 = tempRet0;
 $348 = (___muldi3(($108|0),0,($24|0),0)|0);
 $349 = tempRet0;
 $350 = (___muldi3(($102|0),0,($30|0),0)|0);
 $351 = tempRet0;
 $352 = (___muldi3(($96|0),0,($36|0),0)|0);
 $353 = tempRet0;
 $354 = (___muldi3(($90|0),0,($42|0),0)|0);
 $355 = tempRet0;
 $356 = (___muldi3(($84|0),0,($48|0),0)|0);
 $357 = tempRet0;
 $358 = (___muldi3(($78|0),0,($52|0),0)|0);
 $359 = tempRet0;
 $360 = (___muldi3(($72|0),0,($58|0),0)|0);
 $361 = tempRet0;
 $362 = (___muldi3(($130|0),0,($6|0),0)|0);
 $363 = tempRet0;
 $364 = (___muldi3(($124|0),0,($12|0),0)|0);
 $365 = tempRet0;
 $366 = (___muldi3(($118|0),0,($18|0),0)|0);
 $367 = tempRet0;
 $368 = (___muldi3(($114|0),0,($24|0),0)|0);
 $369 = tempRet0;
 $370 = (___muldi3(($108|0),0,($30|0),0)|0);
 $371 = tempRet0;
 $372 = (___muldi3(($102|0),0,($36|0),0)|0);
 $373 = tempRet0;
 $374 = (___muldi3(($96|0),0,($42|0),0)|0);
 $375 = tempRet0;
 $376 = (___muldi3(($90|0),0,($48|0),0)|0);
 $377 = tempRet0;
 $378 = (___muldi3(($84|0),0,($52|0),0)|0);
 $379 = tempRet0;
 $380 = (___muldi3(($78|0),0,($58|0),0)|0);
 $381 = tempRet0;
 $382 = (___muldi3(($72|0),0,($64|0),0)|0);
 $383 = tempRet0;
 $384 = (_i64Add(($380|0),($381|0),($382|0),($383|0))|0);
 $385 = tempRet0;
 $386 = (_i64Add(($384|0),($385|0),($378|0),($379|0))|0);
 $387 = tempRet0;
 $388 = (_i64Add(($386|0),($387|0),($376|0),($377|0))|0);
 $389 = tempRet0;
 $390 = (_i64Add(($388|0),($389|0),($374|0),($375|0))|0);
 $391 = tempRet0;
 $392 = (_i64Add(($390|0),($391|0),($372|0),($373|0))|0);
 $393 = tempRet0;
 $394 = (_i64Add(($392|0),($393|0),($370|0),($371|0))|0);
 $395 = tempRet0;
 $396 = (_i64Add(($394|0),($395|0),($366|0),($367|0))|0);
 $397 = tempRet0;
 $398 = (_i64Add(($396|0),($397|0),($368|0),($369|0))|0);
 $399 = tempRet0;
 $400 = (_i64Add(($398|0),($399|0),($364|0),($365|0))|0);
 $401 = tempRet0;
 $402 = (_i64Add(($400|0),($401|0),($362|0),($363|0))|0);
 $403 = tempRet0;
 $404 = (_i64Add(($402|0),($403|0),($196|0),0)|0);
 $405 = tempRet0;
 $406 = (___muldi3(($134|0),($135|0),($6|0),0)|0);
 $407 = tempRet0;
 $408 = (___muldi3(($130|0),0,($12|0),0)|0);
 $409 = tempRet0;
 $410 = (___muldi3(($124|0),0,($18|0),0)|0);
 $411 = tempRet0;
 $412 = (___muldi3(($118|0),0,($24|0),0)|0);
 $413 = tempRet0;
 $414 = (___muldi3(($114|0),0,($30|0),0)|0);
 $415 = tempRet0;
 $416 = (___muldi3(($108|0),0,($36|0),0)|0);
 $417 = tempRet0;
 $418 = (___muldi3(($102|0),0,($42|0),0)|0);
 $419 = tempRet0;
 $420 = (___muldi3(($96|0),0,($48|0),0)|0);
 $421 = tempRet0;
 $422 = (___muldi3(($90|0),0,($52|0),0)|0);
 $423 = tempRet0;
 $424 = (___muldi3(($84|0),0,($58|0),0)|0);
 $425 = tempRet0;
 $426 = (___muldi3(($78|0),0,($64|0),0)|0);
 $427 = tempRet0;
 $428 = (___muldi3(($72|0),0,($68|0),($69|0))|0);
 $429 = tempRet0;
 $430 = (___muldi3(($134|0),($135|0),($12|0),0)|0);
 $431 = tempRet0;
 $432 = (___muldi3(($130|0),0,($18|0),0)|0);
 $433 = tempRet0;
 $434 = (___muldi3(($124|0),0,($24|0),0)|0);
 $435 = tempRet0;
 $436 = (___muldi3(($118|0),0,($30|0),0)|0);
 $437 = tempRet0;
 $438 = (___muldi3(($114|0),0,($36|0),0)|0);
 $439 = tempRet0;
 $440 = (___muldi3(($108|0),0,($42|0),0)|0);
 $441 = tempRet0;
 $442 = (___muldi3(($102|0),0,($48|0),0)|0);
 $443 = tempRet0;
 $444 = (___muldi3(($96|0),0,($52|0),0)|0);
 $445 = tempRet0;
 $446 = (___muldi3(($90|0),0,($58|0),0)|0);
 $447 = tempRet0;
 $448 = (___muldi3(($84|0),0,($64|0),0)|0);
 $449 = tempRet0;
 $450 = (___muldi3(($78|0),0,($68|0),($69|0))|0);
 $451 = tempRet0;
 $452 = (_i64Add(($448|0),($449|0),($450|0),($451|0))|0);
 $453 = tempRet0;
 $454 = (_i64Add(($452|0),($453|0),($446|0),($447|0))|0);
 $455 = tempRet0;
 $456 = (_i64Add(($454|0),($455|0),($444|0),($445|0))|0);
 $457 = tempRet0;
 $458 = (_i64Add(($456|0),($457|0),($442|0),($443|0))|0);
 $459 = tempRet0;
 $460 = (_i64Add(($458|0),($459|0),($440|0),($441|0))|0);
 $461 = tempRet0;
 $462 = (_i64Add(($460|0),($461|0),($436|0),($437|0))|0);
 $463 = tempRet0;
 $464 = (_i64Add(($462|0),($463|0),($438|0),($439|0))|0);
 $465 = tempRet0;
 $466 = (_i64Add(($464|0),($465|0),($434|0),($435|0))|0);
 $467 = tempRet0;
 $468 = (_i64Add(($466|0),($467|0),($432|0),($433|0))|0);
 $469 = tempRet0;
 $470 = (_i64Add(($468|0),($469|0),($430|0),($431|0))|0);
 $471 = tempRet0;
 $472 = (___muldi3(($134|0),($135|0),($18|0),0)|0);
 $473 = tempRet0;
 $474 = (___muldi3(($130|0),0,($24|0),0)|0);
 $475 = tempRet0;
 $476 = (___muldi3(($124|0),0,($30|0),0)|0);
 $477 = tempRet0;
 $478 = (___muldi3(($118|0),0,($36|0),0)|0);
 $479 = tempRet0;
 $480 = (___muldi3(($114|0),0,($42|0),0)|0);
 $481 = tempRet0;
 $482 = (___muldi3(($108|0),0,($48|0),0)|0);
 $483 = tempRet0;
 $484 = (___muldi3(($102|0),0,($52|0),0)|0);
 $485 = tempRet0;
 $486 = (___muldi3(($96|0),0,($58|0),0)|0);
 $487 = tempRet0;
 $488 = (___muldi3(($90|0),0,($64|0),0)|0);
 $489 = tempRet0;
 $490 = (___muldi3(($84|0),0,($68|0),($69|0))|0);
 $491 = tempRet0;
 $492 = (___muldi3(($134|0),($135|0),($24|0),0)|0);
 $493 = tempRet0;
 $494 = (___muldi3(($130|0),0,($30|0),0)|0);
 $495 = tempRet0;
 $496 = (___muldi3(($124|0),0,($36|0),0)|0);
 $497 = tempRet0;
 $498 = (___muldi3(($118|0),0,($42|0),0)|0);
 $499 = tempRet0;
 $500 = (___muldi3(($114|0),0,($48|0),0)|0);
 $501 = tempRet0;
 $502 = (___muldi3(($108|0),0,($52|0),0)|0);
 $503 = tempRet0;
 $504 = (___muldi3(($102|0),0,($58|0),0)|0);
 $505 = tempRet0;
 $506 = (___muldi3(($96|0),0,($64|0),0)|0);
 $507 = tempRet0;
 $508 = (___muldi3(($90|0),0,($68|0),($69|0))|0);
 $509 = tempRet0;
 $510 = (_i64Add(($506|0),($507|0),($508|0),($509|0))|0);
 $511 = tempRet0;
 $512 = (_i64Add(($510|0),($511|0),($504|0),($505|0))|0);
 $513 = tempRet0;
 $514 = (_i64Add(($512|0),($513|0),($502|0),($503|0))|0);
 $515 = tempRet0;
 $516 = (_i64Add(($514|0),($515|0),($498|0),($499|0))|0);
 $517 = tempRet0;
 $518 = (_i64Add(($516|0),($517|0),($500|0),($501|0))|0);
 $519 = tempRet0;
 $520 = (_i64Add(($518|0),($519|0),($496|0),($497|0))|0);
 $521 = tempRet0;
 $522 = (_i64Add(($520|0),($521|0),($494|0),($495|0))|0);
 $523 = tempRet0;
 $524 = (_i64Add(($522|0),($523|0),($492|0),($493|0))|0);
 $525 = tempRet0;
 $526 = (___muldi3(($134|0),($135|0),($30|0),0)|0);
 $527 = tempRet0;
 $528 = (___muldi3(($130|0),0,($36|0),0)|0);
 $529 = tempRet0;
 $530 = (___muldi3(($124|0),0,($42|0),0)|0);
 $531 = tempRet0;
 $532 = (___muldi3(($118|0),0,($48|0),0)|0);
 $533 = tempRet0;
 $534 = (___muldi3(($114|0),0,($52|0),0)|0);
 $535 = tempRet0;
 $536 = (___muldi3(($108|0),0,($58|0),0)|0);
 $537 = tempRet0;
 $538 = (___muldi3(($102|0),0,($64|0),0)|0);
 $539 = tempRet0;
 $540 = (___muldi3(($96|0),0,($68|0),($69|0))|0);
 $541 = tempRet0;
 $542 = (___muldi3(($134|0),($135|0),($36|0),0)|0);
 $543 = tempRet0;
 $544 = (___muldi3(($130|0),0,($42|0),0)|0);
 $545 = tempRet0;
 $546 = (___muldi3(($124|0),0,($48|0),0)|0);
 $547 = tempRet0;
 $548 = (___muldi3(($118|0),0,($52|0),0)|0);
 $549 = tempRet0;
 $550 = (___muldi3(($114|0),0,($58|0),0)|0);
 $551 = tempRet0;
 $552 = (___muldi3(($108|0),0,($64|0),0)|0);
 $553 = tempRet0;
 $554 = (___muldi3(($102|0),0,($68|0),($69|0))|0);
 $555 = tempRet0;
 $556 = (_i64Add(($552|0),($553|0),($554|0),($555|0))|0);
 $557 = tempRet0;
 $558 = (_i64Add(($556|0),($557|0),($548|0),($549|0))|0);
 $559 = tempRet0;
 $560 = (_i64Add(($558|0),($559|0),($550|0),($551|0))|0);
 $561 = tempRet0;
 $562 = (_i64Add(($560|0),($561|0),($546|0),($547|0))|0);
 $563 = tempRet0;
 $564 = (_i64Add(($562|0),($563|0),($544|0),($545|0))|0);
 $565 = tempRet0;
 $566 = (_i64Add(($564|0),($565|0),($542|0),($543|0))|0);
 $567 = tempRet0;
 $568 = (___muldi3(($134|0),($135|0),($42|0),0)|0);
 $569 = tempRet0;
 $570 = (___muldi3(($130|0),0,($48|0),0)|0);
 $571 = tempRet0;
 $572 = (___muldi3(($124|0),0,($52|0),0)|0);
 $573 = tempRet0;
 $574 = (___muldi3(($118|0),0,($58|0),0)|0);
 $575 = tempRet0;
 $576 = (___muldi3(($114|0),0,($64|0),0)|0);
 $577 = tempRet0;
 $578 = (___muldi3(($108|0),0,($68|0),($69|0))|0);
 $579 = tempRet0;
 $580 = (___muldi3(($134|0),($135|0),($48|0),0)|0);
 $581 = tempRet0;
 $582 = (___muldi3(($130|0),0,($52|0),0)|0);
 $583 = tempRet0;
 $584 = (___muldi3(($124|0),0,($58|0),0)|0);
 $585 = tempRet0;
 $586 = (___muldi3(($118|0),0,($64|0),0)|0);
 $587 = tempRet0;
 $588 = (___muldi3(($114|0),0,($68|0),($69|0))|0);
 $589 = tempRet0;
 $590 = (_i64Add(($588|0),($589|0),($586|0),($587|0))|0);
 $591 = tempRet0;
 $592 = (_i64Add(($590|0),($591|0),($584|0),($585|0))|0);
 $593 = tempRet0;
 $594 = (_i64Add(($592|0),($593|0),($582|0),($583|0))|0);
 $595 = tempRet0;
 $596 = (_i64Add(($594|0),($595|0),($580|0),($581|0))|0);
 $597 = tempRet0;
 $598 = (___muldi3(($134|0),($135|0),($52|0),0)|0);
 $599 = tempRet0;
 $600 = (___muldi3(($130|0),0,($58|0),0)|0);
 $601 = tempRet0;
 $602 = (___muldi3(($124|0),0,($64|0),0)|0);
 $603 = tempRet0;
 $604 = (___muldi3(($118|0),0,($68|0),($69|0))|0);
 $605 = tempRet0;
 $606 = (___muldi3(($134|0),($135|0),($58|0),0)|0);
 $607 = tempRet0;
 $608 = (___muldi3(($130|0),0,($64|0),0)|0);
 $609 = tempRet0;
 $610 = (___muldi3(($124|0),0,($68|0),($69|0))|0);
 $611 = tempRet0;
 $612 = (_i64Add(($608|0),($609|0),($610|0),($611|0))|0);
 $613 = tempRet0;
 $614 = (_i64Add(($612|0),($613|0),($606|0),($607|0))|0);
 $615 = tempRet0;
 $616 = (___muldi3(($134|0),($135|0),($64|0),0)|0);
 $617 = tempRet0;
 $618 = (___muldi3(($130|0),0,($68|0),($69|0))|0);
 $619 = tempRet0;
 $620 = (_i64Add(($616|0),($617|0),($618|0),($619|0))|0);
 $621 = tempRet0;
 $622 = (___muldi3(($134|0),($135|0),($68|0),($69|0))|0);
 $623 = tempRet0;
 $624 = (_i64Add(($204|0),($205|0),1048576,0)|0);
 $625 = tempRet0;
 $626 = (_bitshift64Lshr(($624|0),($625|0),21)|0);
 $627 = tempRet0;
 $628 = (_i64Add(($206|0),($207|0),($208|0),($209|0))|0);
 $629 = tempRet0;
 $630 = (_i64Add(($628|0),($629|0),($144|0),0)|0);
 $631 = tempRet0;
 $632 = (_i64Add(($630|0),($631|0),($626|0),($627|0))|0);
 $633 = tempRet0;
 $634 = (_bitshift64Shl(($626|0),($627|0),21)|0);
 $635 = tempRet0;
 $636 = (_i64Subtract(($204|0),($205|0),($634|0),($635|0))|0);
 $637 = tempRet0;
 $638 = (_i64Add(($220|0),($221|0),1048576,0)|0);
 $639 = tempRet0;
 $640 = (_bitshift64Lshr(($638|0),($639|0),21)|0);
 $641 = tempRet0;
 $642 = (_i64Add(($226|0),($227|0),($228|0),($229|0))|0);
 $643 = tempRet0;
 $644 = (_i64Add(($642|0),($643|0),($224|0),($225|0))|0);
 $645 = tempRet0;
 $646 = (_i64Add(($644|0),($645|0),($222|0),($223|0))|0);
 $647 = tempRet0;
 $648 = (_i64Add(($646|0),($647|0),($156|0),0)|0);
 $649 = tempRet0;
 $650 = (_i64Add(($648|0),($649|0),($640|0),($641|0))|0);
 $651 = tempRet0;
 $652 = (_bitshift64Shl(($640|0),($641|0),21)|0);
 $653 = tempRet0;
 $654 = (_i64Add(($248|0),($249|0),1048576,0)|0);
 $655 = tempRet0;
 $656 = (_bitshift64Ashr(($654|0),($655|0),21)|0);
 $657 = tempRet0;
 $658 = (_i64Add(($258|0),($259|0),($260|0),($261|0))|0);
 $659 = tempRet0;
 $660 = (_i64Add(($658|0),($659|0),($256|0),($257|0))|0);
 $661 = tempRet0;
 $662 = (_i64Add(($660|0),($661|0),($254|0),($255|0))|0);
 $663 = tempRet0;
 $664 = (_i64Add(($662|0),($663|0),($252|0),($253|0))|0);
 $665 = tempRet0;
 $666 = (_i64Add(($664|0),($665|0),($250|0),($251|0))|0);
 $667 = tempRet0;
 $668 = (_i64Add(($666|0),($667|0),($168|0),0)|0);
 $669 = tempRet0;
 $670 = (_i64Add(($668|0),($669|0),($656|0),($657|0))|0);
 $671 = tempRet0;
 $672 = (_bitshift64Shl(($656|0),($657|0),21)|0);
 $673 = tempRet0;
 $674 = (_i64Add(($288|0),($289|0),1048576,0)|0);
 $675 = tempRet0;
 $676 = (_bitshift64Ashr(($674|0),($675|0),21)|0);
 $677 = tempRet0;
 $678 = (_i64Add(($302|0),($303|0),($304|0),($305|0))|0);
 $679 = tempRet0;
 $680 = (_i64Add(($678|0),($679|0),($300|0),($301|0))|0);
 $681 = tempRet0;
 $682 = (_i64Add(($680|0),($681|0),($298|0),($299|0))|0);
 $683 = tempRet0;
 $684 = (_i64Add(($682|0),($683|0),($296|0),($297|0))|0);
 $685 = tempRet0;
 $686 = (_i64Add(($684|0),($685|0),($294|0),($295|0))|0);
 $687 = tempRet0;
 $688 = (_i64Add(($686|0),($687|0),($292|0),($293|0))|0);
 $689 = tempRet0;
 $690 = (_i64Add(($688|0),($689|0),($290|0),($291|0))|0);
 $691 = tempRet0;
 $692 = (_i64Add(($690|0),($691|0),($180|0),0)|0);
 $693 = tempRet0;
 $694 = (_i64Add(($692|0),($693|0),($676|0),($677|0))|0);
 $695 = tempRet0;
 $696 = (_bitshift64Shl(($676|0),($677|0),21)|0);
 $697 = tempRet0;
 $698 = (_i64Add(($340|0),($341|0),1048576,0)|0);
 $699 = tempRet0;
 $700 = (_bitshift64Ashr(($698|0),($699|0),21)|0);
 $701 = tempRet0;
 $702 = (_i64Add(($358|0),($359|0),($360|0),($361|0))|0);
 $703 = tempRet0;
 $704 = (_i64Add(($702|0),($703|0),($356|0),($357|0))|0);
 $705 = tempRet0;
 $706 = (_i64Add(($704|0),($705|0),($354|0),($355|0))|0);
 $707 = tempRet0;
 $708 = (_i64Add(($706|0),($707|0),($352|0),($353|0))|0);
 $709 = tempRet0;
 $710 = (_i64Add(($708|0),($709|0),($350|0),($351|0))|0);
 $711 = tempRet0;
 $712 = (_i64Add(($710|0),($711|0),($348|0),($349|0))|0);
 $713 = tempRet0;
 $714 = (_i64Add(($712|0),($713|0),($344|0),($345|0))|0);
 $715 = tempRet0;
 $716 = (_i64Add(($714|0),($715|0),($346|0),($347|0))|0);
 $717 = tempRet0;
 $718 = (_i64Add(($716|0),($717|0),($342|0),($343|0))|0);
 $719 = tempRet0;
 $720 = (_i64Add(($718|0),($719|0),($190|0),0)|0);
 $721 = tempRet0;
 $722 = (_i64Add(($720|0),($721|0),($700|0),($701|0))|0);
 $723 = tempRet0;
 $724 = (_bitshift64Shl(($700|0),($701|0),21)|0);
 $725 = tempRet0;
 $726 = (_i64Add(($404|0),($405|0),1048576,0)|0);
 $727 = tempRet0;
 $728 = (_bitshift64Ashr(($726|0),($727|0),21)|0);
 $729 = tempRet0;
 $730 = (_i64Add(($426|0),($427|0),($428|0),($429|0))|0);
 $731 = tempRet0;
 $732 = (_i64Add(($730|0),($731|0),($424|0),($425|0))|0);
 $733 = tempRet0;
 $734 = (_i64Add(($732|0),($733|0),($422|0),($423|0))|0);
 $735 = tempRet0;
 $736 = (_i64Add(($734|0),($735|0),($420|0),($421|0))|0);
 $737 = tempRet0;
 $738 = (_i64Add(($736|0),($737|0),($418|0),($419|0))|0);
 $739 = tempRet0;
 $740 = (_i64Add(($738|0),($739|0),($416|0),($417|0))|0);
 $741 = tempRet0;
 $742 = (_i64Add(($740|0),($741|0),($412|0),($413|0))|0);
 $743 = tempRet0;
 $744 = (_i64Add(($742|0),($743|0),($414|0),($415|0))|0);
 $745 = tempRet0;
 $746 = (_i64Add(($744|0),($745|0),($410|0),($411|0))|0);
 $747 = tempRet0;
 $748 = (_i64Add(($746|0),($747|0),($406|0),($407|0))|0);
 $749 = tempRet0;
 $750 = (_i64Add(($748|0),($749|0),($408|0),($409|0))|0);
 $751 = tempRet0;
 $752 = (_i64Add(($750|0),($751|0),($200|0),($201|0))|0);
 $753 = tempRet0;
 $754 = (_i64Add(($752|0),($753|0),($728|0),($729|0))|0);
 $755 = tempRet0;
 $756 = (_bitshift64Shl(($728|0),($729|0),21)|0);
 $757 = tempRet0;
 $758 = (_i64Add(($470|0),($471|0),1048576,0)|0);
 $759 = tempRet0;
 $760 = (_bitshift64Ashr(($758|0),($759|0),21)|0);
 $761 = tempRet0;
 $762 = (_i64Add(($488|0),($489|0),($490|0),($491|0))|0);
 $763 = tempRet0;
 $764 = (_i64Add(($762|0),($763|0),($486|0),($487|0))|0);
 $765 = tempRet0;
 $766 = (_i64Add(($764|0),($765|0),($484|0),($485|0))|0);
 $767 = tempRet0;
 $768 = (_i64Add(($766|0),($767|0),($482|0),($483|0))|0);
 $769 = tempRet0;
 $770 = (_i64Add(($768|0),($769|0),($478|0),($479|0))|0);
 $771 = tempRet0;
 $772 = (_i64Add(($770|0),($771|0),($480|0),($481|0))|0);
 $773 = tempRet0;
 $774 = (_i64Add(($772|0),($773|0),($476|0),($477|0))|0);
 $775 = tempRet0;
 $776 = (_i64Add(($774|0),($775|0),($474|0),($475|0))|0);
 $777 = tempRet0;
 $778 = (_i64Add(($776|0),($777|0),($472|0),($473|0))|0);
 $779 = tempRet0;
 $780 = (_i64Add(($778|0),($779|0),($760|0),($761|0))|0);
 $781 = tempRet0;
 $782 = (_bitshift64Shl(($760|0),($761|0),21)|0);
 $783 = tempRet0;
 $784 = (_i64Add(($524|0),($525|0),1048576,0)|0);
 $785 = tempRet0;
 $786 = (_bitshift64Ashr(($784|0),($785|0),21)|0);
 $787 = tempRet0;
 $788 = (_i64Add(($538|0),($539|0),($540|0),($541|0))|0);
 $789 = tempRet0;
 $790 = (_i64Add(($788|0),($789|0),($536|0),($537|0))|0);
 $791 = tempRet0;
 $792 = (_i64Add(($790|0),($791|0),($532|0),($533|0))|0);
 $793 = tempRet0;
 $794 = (_i64Add(($792|0),($793|0),($534|0),($535|0))|0);
 $795 = tempRet0;
 $796 = (_i64Add(($794|0),($795|0),($530|0),($531|0))|0);
 $797 = tempRet0;
 $798 = (_i64Add(($796|0),($797|0),($528|0),($529|0))|0);
 $799 = tempRet0;
 $800 = (_i64Add(($798|0),($799|0),($526|0),($527|0))|0);
 $801 = tempRet0;
 $802 = (_i64Add(($800|0),($801|0),($786|0),($787|0))|0);
 $803 = tempRet0;
 $804 = (_bitshift64Shl(($786|0),($787|0),21)|0);
 $805 = tempRet0;
 $806 = (_i64Add(($566|0),($567|0),1048576,0)|0);
 $807 = tempRet0;
 $808 = (_bitshift64Ashr(($806|0),($807|0),21)|0);
 $809 = tempRet0;
 $810 = (_i64Add(($574|0),($575|0),($578|0),($579|0))|0);
 $811 = tempRet0;
 $812 = (_i64Add(($810|0),($811|0),($576|0),($577|0))|0);
 $813 = tempRet0;
 $814 = (_i64Add(($812|0),($813|0),($572|0),($573|0))|0);
 $815 = tempRet0;
 $816 = (_i64Add(($814|0),($815|0),($570|0),($571|0))|0);
 $817 = tempRet0;
 $818 = (_i64Add(($816|0),($817|0),($568|0),($569|0))|0);
 $819 = tempRet0;
 $820 = (_i64Add(($818|0),($819|0),($808|0),($809|0))|0);
 $821 = tempRet0;
 $822 = (_bitshift64Shl(($808|0),($809|0),21)|0);
 $823 = tempRet0;
 $824 = (_i64Add(($596|0),($597|0),1048576,0)|0);
 $825 = tempRet0;
 $826 = (_bitshift64Ashr(($824|0),($825|0),21)|0);
 $827 = tempRet0;
 $828 = (_i64Add(($602|0),($603|0),($604|0),($605|0))|0);
 $829 = tempRet0;
 $830 = (_i64Add(($828|0),($829|0),($600|0),($601|0))|0);
 $831 = tempRet0;
 $832 = (_i64Add(($830|0),($831|0),($598|0),($599|0))|0);
 $833 = tempRet0;
 $834 = (_i64Add(($832|0),($833|0),($826|0),($827|0))|0);
 $835 = tempRet0;
 $836 = (_bitshift64Shl(($826|0),($827|0),21)|0);
 $837 = tempRet0;
 $838 = (_i64Subtract(($596|0),($597|0),($836|0),($837|0))|0);
 $839 = tempRet0;
 $840 = (_i64Add(($614|0),($615|0),1048576,0)|0);
 $841 = tempRet0;
 $842 = (_bitshift64Lshr(($840|0),($841|0),21)|0);
 $843 = tempRet0;
 $844 = (_i64Add(($620|0),($621|0),($842|0),($843|0))|0);
 $845 = tempRet0;
 $846 = (_bitshift64Shl(($842|0),($843|0),21)|0);
 $847 = tempRet0;
 $848 = (_i64Subtract(($614|0),($615|0),($846|0),($847|0))|0);
 $849 = tempRet0;
 $850 = (_i64Add(($622|0),($623|0),1048576,0)|0);
 $851 = tempRet0;
 $852 = (_bitshift64Lshr(($850|0),($851|0),21)|0);
 $853 = tempRet0;
 $854 = (_bitshift64Shl(($852|0),($853|0),21)|0);
 $855 = tempRet0;
 $856 = (_i64Subtract(($622|0),($623|0),($854|0),($855|0))|0);
 $857 = tempRet0;
 $858 = (_i64Add(($632|0),($633|0),1048576,0)|0);
 $859 = tempRet0;
 $860 = (_bitshift64Lshr(($858|0),($859|0),21)|0);
 $861 = tempRet0;
 $862 = (_bitshift64Shl(($860|0),($861|0),21)|0);
 $863 = tempRet0;
 $864 = (_i64Subtract(($632|0),($633|0),($862|0),($863|0))|0);
 $865 = tempRet0;
 $866 = (_i64Add(($650|0),($651|0),1048576,0)|0);
 $867 = tempRet0;
 $868 = (_bitshift64Ashr(($866|0),($867|0),21)|0);
 $869 = tempRet0;
 $870 = (_bitshift64Shl(($868|0),($869|0),21)|0);
 $871 = tempRet0;
 $872 = (_i64Subtract(($650|0),($651|0),($870|0),($871|0))|0);
 $873 = tempRet0;
 $874 = (_i64Add(($670|0),($671|0),1048576,0)|0);
 $875 = tempRet0;
 $876 = (_bitshift64Ashr(($874|0),($875|0),21)|0);
 $877 = tempRet0;
 $878 = (_bitshift64Shl(($876|0),($877|0),21)|0);
 $879 = tempRet0;
 $880 = (_i64Subtract(($670|0),($671|0),($878|0),($879|0))|0);
 $881 = tempRet0;
 $882 = (_i64Add(($694|0),($695|0),1048576,0)|0);
 $883 = tempRet0;
 $884 = (_bitshift64Ashr(($882|0),($883|0),21)|0);
 $885 = tempRet0;
 $886 = (_bitshift64Shl(($884|0),($885|0),21)|0);
 $887 = tempRet0;
 $888 = (_i64Add(($722|0),($723|0),1048576,0)|0);
 $889 = tempRet0;
 $890 = (_bitshift64Ashr(($888|0),($889|0),21)|0);
 $891 = tempRet0;
 $892 = (_bitshift64Shl(($890|0),($891|0),21)|0);
 $893 = tempRet0;
 $894 = (_i64Add(($754|0),($755|0),1048576,0)|0);
 $895 = tempRet0;
 $896 = (_bitshift64Ashr(($894|0),($895|0),21)|0);
 $897 = tempRet0;
 $898 = (_bitshift64Shl(($896|0),($897|0),21)|0);
 $899 = tempRet0;
 $900 = (_i64Add(($780|0),($781|0),1048576,0)|0);
 $901 = tempRet0;
 $902 = (_bitshift64Ashr(($900|0),($901|0),21)|0);
 $903 = tempRet0;
 $904 = (_bitshift64Shl(($902|0),($903|0),21)|0);
 $905 = tempRet0;
 $906 = (_i64Add(($802|0),($803|0),1048576,0)|0);
 $907 = tempRet0;
 $908 = (_bitshift64Ashr(($906|0),($907|0),21)|0);
 $909 = tempRet0;
 $910 = (_bitshift64Shl(($908|0),($909|0),21)|0);
 $911 = tempRet0;
 $912 = (_i64Add(($820|0),($821|0),1048576,0)|0);
 $913 = tempRet0;
 $914 = (_bitshift64Ashr(($912|0),($913|0),21)|0);
 $915 = tempRet0;
 $916 = (_i64Add(($914|0),($915|0),($838|0),($839|0))|0);
 $917 = tempRet0;
 $918 = (_bitshift64Shl(($914|0),($915|0),21)|0);
 $919 = tempRet0;
 $920 = (_i64Subtract(($820|0),($821|0),($918|0),($919|0))|0);
 $921 = tempRet0;
 $922 = (_i64Add(($834|0),($835|0),1048576,0)|0);
 $923 = tempRet0;
 $924 = (_bitshift64Ashr(($922|0),($923|0),21)|0);
 $925 = tempRet0;
 $926 = (_i64Add(($924|0),($925|0),($848|0),($849|0))|0);
 $927 = tempRet0;
 $928 = (_bitshift64Shl(($924|0),($925|0),21)|0);
 $929 = tempRet0;
 $930 = (_i64Subtract(($834|0),($835|0),($928|0),($929|0))|0);
 $931 = tempRet0;
 $932 = (_i64Add(($844|0),($845|0),1048576,0)|0);
 $933 = tempRet0;
 $934 = (_bitshift64Lshr(($932|0),($933|0),21)|0);
 $935 = tempRet0;
 $936 = (_i64Add(($934|0),($935|0),($856|0),($857|0))|0);
 $937 = tempRet0;
 $938 = (_bitshift64Shl(($934|0),($935|0),21)|0);
 $939 = tempRet0;
 $940 = (_i64Subtract(($844|0),($845|0),($938|0),($939|0))|0);
 $941 = tempRet0;
 $942 = (___muldi3(($852|0),($853|0),666643,0)|0);
 $943 = tempRet0;
 $944 = (___muldi3(($852|0),($853|0),470296,0)|0);
 $945 = tempRet0;
 $946 = (___muldi3(($852|0),($853|0),654183,0)|0);
 $947 = tempRet0;
 $948 = (___muldi3(($852|0),($853|0),-997805,-1)|0);
 $949 = tempRet0;
 $950 = (___muldi3(($852|0),($853|0),136657,0)|0);
 $951 = tempRet0;
 $952 = (___muldi3(($852|0),($853|0),-683901,-1)|0);
 $953 = tempRet0;
 $954 = (_i64Add(($566|0),($567|0),($952|0),($953|0))|0);
 $955 = tempRet0;
 $956 = (_i64Subtract(($954|0),($955|0),($822|0),($823|0))|0);
 $957 = tempRet0;
 $958 = (_i64Add(($956|0),($957|0),($908|0),($909|0))|0);
 $959 = tempRet0;
 $960 = (___muldi3(($936|0),($937|0),666643,0)|0);
 $961 = tempRet0;
 $962 = (___muldi3(($936|0),($937|0),470296,0)|0);
 $963 = tempRet0;
 $964 = (___muldi3(($936|0),($937|0),654183,0)|0);
 $965 = tempRet0;
 $966 = (___muldi3(($936|0),($937|0),-997805,-1)|0);
 $967 = tempRet0;
 $968 = (___muldi3(($936|0),($937|0),136657,0)|0);
 $969 = tempRet0;
 $970 = (___muldi3(($936|0),($937|0),-683901,-1)|0);
 $971 = tempRet0;
 $972 = (___muldi3(($940|0),($941|0),666643,0)|0);
 $973 = tempRet0;
 $974 = (___muldi3(($940|0),($941|0),470296,0)|0);
 $975 = tempRet0;
 $976 = (___muldi3(($940|0),($941|0),654183,0)|0);
 $977 = tempRet0;
 $978 = (___muldi3(($940|0),($941|0),-997805,-1)|0);
 $979 = tempRet0;
 $980 = (___muldi3(($940|0),($941|0),136657,0)|0);
 $981 = tempRet0;
 $982 = (___muldi3(($940|0),($941|0),-683901,-1)|0);
 $983 = tempRet0;
 $984 = (_i64Add(($524|0),($525|0),($948|0),($949|0))|0);
 $985 = tempRet0;
 $986 = (_i64Add(($984|0),($985|0),($968|0),($969|0))|0);
 $987 = tempRet0;
 $988 = (_i64Add(($986|0),($987|0),($982|0),($983|0))|0);
 $989 = tempRet0;
 $990 = (_i64Subtract(($988|0),($989|0),($804|0),($805|0))|0);
 $991 = tempRet0;
 $992 = (_i64Add(($990|0),($991|0),($902|0),($903|0))|0);
 $993 = tempRet0;
 $994 = (___muldi3(($926|0),($927|0),666643,0)|0);
 $995 = tempRet0;
 $996 = (___muldi3(($926|0),($927|0),470296,0)|0);
 $997 = tempRet0;
 $998 = (___muldi3(($926|0),($927|0),654183,0)|0);
 $999 = tempRet0;
 $1000 = (___muldi3(($926|0),($927|0),-997805,-1)|0);
 $1001 = tempRet0;
 $1002 = (___muldi3(($926|0),($927|0),136657,0)|0);
 $1003 = tempRet0;
 $1004 = (___muldi3(($926|0),($927|0),-683901,-1)|0);
 $1005 = tempRet0;
 $1006 = (___muldi3(($930|0),($931|0),666643,0)|0);
 $1007 = tempRet0;
 $1008 = (___muldi3(($930|0),($931|0),470296,0)|0);
 $1009 = tempRet0;
 $1010 = (___muldi3(($930|0),($931|0),654183,0)|0);
 $1011 = tempRet0;
 $1012 = (___muldi3(($930|0),($931|0),-997805,-1)|0);
 $1013 = tempRet0;
 $1014 = (___muldi3(($930|0),($931|0),136657,0)|0);
 $1015 = tempRet0;
 $1016 = (___muldi3(($930|0),($931|0),-683901,-1)|0);
 $1017 = tempRet0;
 $1018 = (_i64Add(($964|0),($965|0),($944|0),($945|0))|0);
 $1019 = tempRet0;
 $1020 = (_i64Add(($1018|0),($1019|0),($470|0),($471|0))|0);
 $1021 = tempRet0;
 $1022 = (_i64Add(($1020|0),($1021|0),($978|0),($979|0))|0);
 $1023 = tempRet0;
 $1024 = (_i64Add(($1022|0),($1023|0),($1002|0),($1003|0))|0);
 $1025 = tempRet0;
 $1026 = (_i64Add(($1024|0),($1025|0),($1016|0),($1017|0))|0);
 $1027 = tempRet0;
 $1028 = (_i64Subtract(($1026|0),($1027|0),($782|0),($783|0))|0);
 $1029 = tempRet0;
 $1030 = (_i64Add(($1028|0),($1029|0),($896|0),($897|0))|0);
 $1031 = tempRet0;
 $1032 = (___muldi3(($916|0),($917|0),666643,0)|0);
 $1033 = tempRet0;
 $1034 = (_i64Add(($288|0),($289|0),($1032|0),($1033|0))|0);
 $1035 = tempRet0;
 $1036 = (_i64Add(($1034|0),($1035|0),($876|0),($877|0))|0);
 $1037 = tempRet0;
 $1038 = (_i64Subtract(($1036|0),($1037|0),($696|0),($697|0))|0);
 $1039 = tempRet0;
 $1040 = (___muldi3(($916|0),($917|0),470296,0)|0);
 $1041 = tempRet0;
 $1042 = (___muldi3(($916|0),($917|0),654183,0)|0);
 $1043 = tempRet0;
 $1044 = (_i64Add(($1008|0),($1009|0),($994|0),($995|0))|0);
 $1045 = tempRet0;
 $1046 = (_i64Add(($1044|0),($1045|0),($1042|0),($1043|0))|0);
 $1047 = tempRet0;
 $1048 = (_i64Add(($1046|0),($1047|0),($340|0),($341|0))|0);
 $1049 = tempRet0;
 $1050 = (_i64Add(($1048|0),($1049|0),($884|0),($885|0))|0);
 $1051 = tempRet0;
 $1052 = (_i64Subtract(($1050|0),($1051|0),($724|0),($725|0))|0);
 $1053 = tempRet0;
 $1054 = (___muldi3(($916|0),($917|0),-997805,-1)|0);
 $1055 = tempRet0;
 $1056 = (___muldi3(($916|0),($917|0),136657,0)|0);
 $1057 = tempRet0;
 $1058 = (_i64Add(($974|0),($975|0),($960|0),($961|0))|0);
 $1059 = tempRet0;
 $1060 = (_i64Add(($1058|0),($1059|0),($998|0),($999|0))|0);
 $1061 = tempRet0;
 $1062 = (_i64Add(($1060|0),($1061|0),($1012|0),($1013|0))|0);
 $1063 = tempRet0;
 $1064 = (_i64Add(($1062|0),($1063|0),($1056|0),($1057|0))|0);
 $1065 = tempRet0;
 $1066 = (_i64Add(($1064|0),($1065|0),($404|0),($405|0))|0);
 $1067 = tempRet0;
 $1068 = (_i64Add(($1066|0),($1067|0),($890|0),($891|0))|0);
 $1069 = tempRet0;
 $1070 = (_i64Subtract(($1068|0),($1069|0),($756|0),($757|0))|0);
 $1071 = tempRet0;
 $1072 = (___muldi3(($916|0),($917|0),-683901,-1)|0);
 $1073 = tempRet0;
 $1074 = (_i64Add(($1038|0),($1039|0),1048576,0)|0);
 $1075 = tempRet0;
 $1076 = (_bitshift64Ashr(($1074|0),($1075|0),21)|0);
 $1077 = tempRet0;
 $1078 = (_i64Add(($1040|0),($1041|0),($1006|0),($1007|0))|0);
 $1079 = tempRet0;
 $1080 = (_i64Add(($1078|0),($1079|0),($694|0),($695|0))|0);
 $1081 = tempRet0;
 $1082 = (_i64Subtract(($1080|0),($1081|0),($886|0),($887|0))|0);
 $1083 = tempRet0;
 $1084 = (_i64Add(($1082|0),($1083|0),($1076|0),($1077|0))|0);
 $1085 = tempRet0;
 $1086 = (_bitshift64Shl(($1076|0),($1077|0),21)|0);
 $1087 = tempRet0;
 $1088 = (_i64Add(($1052|0),($1053|0),1048576,0)|0);
 $1089 = tempRet0;
 $1090 = (_bitshift64Ashr(($1088|0),($1089|0),21)|0);
 $1091 = tempRet0;
 $1092 = (_i64Add(($996|0),($997|0),($972|0),($973|0))|0);
 $1093 = tempRet0;
 $1094 = (_i64Add(($1092|0),($1093|0),($1010|0),($1011|0))|0);
 $1095 = tempRet0;
 $1096 = (_i64Add(($1094|0),($1095|0),($1054|0),($1055|0))|0);
 $1097 = tempRet0;
 $1098 = (_i64Add(($1096|0),($1097|0),($722|0),($723|0))|0);
 $1099 = tempRet0;
 $1100 = (_i64Subtract(($1098|0),($1099|0),($892|0),($893|0))|0);
 $1101 = tempRet0;
 $1102 = (_i64Add(($1100|0),($1101|0),($1090|0),($1091|0))|0);
 $1103 = tempRet0;
 $1104 = (_bitshift64Shl(($1090|0),($1091|0),21)|0);
 $1105 = tempRet0;
 $1106 = (_i64Add(($1070|0),($1071|0),1048576,0)|0);
 $1107 = tempRet0;
 $1108 = (_bitshift64Ashr(($1106|0),($1107|0),21)|0);
 $1109 = tempRet0;
 $1110 = (_i64Add(($962|0),($963|0),($942|0),($943|0))|0);
 $1111 = tempRet0;
 $1112 = (_i64Add(($1110|0),($1111|0),($976|0),($977|0))|0);
 $1113 = tempRet0;
 $1114 = (_i64Add(($1112|0),($1113|0),($1000|0),($1001|0))|0);
 $1115 = tempRet0;
 $1116 = (_i64Add(($1114|0),($1115|0),($1014|0),($1015|0))|0);
 $1117 = tempRet0;
 $1118 = (_i64Add(($1116|0),($1117|0),($1072|0),($1073|0))|0);
 $1119 = tempRet0;
 $1120 = (_i64Add(($1118|0),($1119|0),($754|0),($755|0))|0);
 $1121 = tempRet0;
 $1122 = (_i64Subtract(($1120|0),($1121|0),($898|0),($899|0))|0);
 $1123 = tempRet0;
 $1124 = (_i64Add(($1122|0),($1123|0),($1108|0),($1109|0))|0);
 $1125 = tempRet0;
 $1126 = (_bitshift64Shl(($1108|0),($1109|0),21)|0);
 $1127 = tempRet0;
 $1128 = (_i64Add(($1030|0),($1031|0),1048576,0)|0);
 $1129 = tempRet0;
 $1130 = (_bitshift64Ashr(($1128|0),($1129|0),21)|0);
 $1131 = tempRet0;
 $1132 = (_i64Add(($966|0),($967|0),($946|0),($947|0))|0);
 $1133 = tempRet0;
 $1134 = (_i64Add(($1132|0),($1133|0),($980|0),($981|0))|0);
 $1135 = tempRet0;
 $1136 = (_i64Add(($1134|0),($1135|0),($1004|0),($1005|0))|0);
 $1137 = tempRet0;
 $1138 = (_i64Add(($1136|0),($1137|0),($780|0),($781|0))|0);
 $1139 = tempRet0;
 $1140 = (_i64Subtract(($1138|0),($1139|0),($904|0),($905|0))|0);
 $1141 = tempRet0;
 $1142 = (_i64Add(($1140|0),($1141|0),($1130|0),($1131|0))|0);
 $1143 = tempRet0;
 $1144 = (_bitshift64Shl(($1130|0),($1131|0),21)|0);
 $1145 = tempRet0;
 $1146 = (_i64Subtract(($1030|0),($1031|0),($1144|0),($1145|0))|0);
 $1147 = tempRet0;
 $1148 = (_i64Add(($992|0),($993|0),1048576,0)|0);
 $1149 = tempRet0;
 $1150 = (_bitshift64Ashr(($1148|0),($1149|0),21)|0);
 $1151 = tempRet0;
 $1152 = (_i64Add(($970|0),($971|0),($950|0),($951|0))|0);
 $1153 = tempRet0;
 $1154 = (_i64Add(($1152|0),($1153|0),($802|0),($803|0))|0);
 $1155 = tempRet0;
 $1156 = (_i64Subtract(($1154|0),($1155|0),($910|0),($911|0))|0);
 $1157 = tempRet0;
 $1158 = (_i64Add(($1156|0),($1157|0),($1150|0),($1151|0))|0);
 $1159 = tempRet0;
 $1160 = (_bitshift64Shl(($1150|0),($1151|0),21)|0);
 $1161 = tempRet0;
 $1162 = (_i64Subtract(($992|0),($993|0),($1160|0),($1161|0))|0);
 $1163 = tempRet0;
 $1164 = (_i64Add(($958|0),($959|0),1048576,0)|0);
 $1165 = tempRet0;
 $1166 = (_bitshift64Ashr(($1164|0),($1165|0),21)|0);
 $1167 = tempRet0;
 $1168 = (_i64Add(($1166|0),($1167|0),($920|0),($921|0))|0);
 $1169 = tempRet0;
 $1170 = (_bitshift64Shl(($1166|0),($1167|0),21)|0);
 $1171 = tempRet0;
 $1172 = (_i64Subtract(($958|0),($959|0),($1170|0),($1171|0))|0);
 $1173 = tempRet0;
 $1174 = (_i64Add(($1084|0),($1085|0),1048576,0)|0);
 $1175 = tempRet0;
 $1176 = (_bitshift64Ashr(($1174|0),($1175|0),21)|0);
 $1177 = tempRet0;
 $1178 = (_bitshift64Shl(($1176|0),($1177|0),21)|0);
 $1179 = tempRet0;
 $1180 = (_i64Add(($1102|0),($1103|0),1048576,0)|0);
 $1181 = tempRet0;
 $1182 = (_bitshift64Ashr(($1180|0),($1181|0),21)|0);
 $1183 = tempRet0;
 $1184 = (_bitshift64Shl(($1182|0),($1183|0),21)|0);
 $1185 = tempRet0;
 $1186 = (_i64Add(($1124|0),($1125|0),1048576,0)|0);
 $1187 = tempRet0;
 $1188 = (_bitshift64Ashr(($1186|0),($1187|0),21)|0);
 $1189 = tempRet0;
 $1190 = (_i64Add(($1188|0),($1189|0),($1146|0),($1147|0))|0);
 $1191 = tempRet0;
 $1192 = (_bitshift64Shl(($1188|0),($1189|0),21)|0);
 $1193 = tempRet0;
 $1194 = (_i64Subtract(($1124|0),($1125|0),($1192|0),($1193|0))|0);
 $1195 = tempRet0;
 $1196 = (_i64Add(($1142|0),($1143|0),1048576,0)|0);
 $1197 = tempRet0;
 $1198 = (_bitshift64Ashr(($1196|0),($1197|0),21)|0);
 $1199 = tempRet0;
 $1200 = (_i64Add(($1198|0),($1199|0),($1162|0),($1163|0))|0);
 $1201 = tempRet0;
 $1202 = (_bitshift64Shl(($1198|0),($1199|0),21)|0);
 $1203 = tempRet0;
 $1204 = (_i64Subtract(($1142|0),($1143|0),($1202|0),($1203|0))|0);
 $1205 = tempRet0;
 $1206 = (_i64Add(($1158|0),($1159|0),1048576,0)|0);
 $1207 = tempRet0;
 $1208 = (_bitshift64Ashr(($1206|0),($1207|0),21)|0);
 $1209 = tempRet0;
 $1210 = (_i64Add(($1208|0),($1209|0),($1172|0),($1173|0))|0);
 $1211 = tempRet0;
 $1212 = (_bitshift64Shl(($1208|0),($1209|0),21)|0);
 $1213 = tempRet0;
 $1214 = (_i64Subtract(($1158|0),($1159|0),($1212|0),($1213|0))|0);
 $1215 = tempRet0;
 $1216 = (___muldi3(($1168|0),($1169|0),666643,0)|0);
 $1217 = tempRet0;
 $1218 = (_i64Add(($880|0),($881|0),($1216|0),($1217|0))|0);
 $1219 = tempRet0;
 $1220 = (___muldi3(($1168|0),($1169|0),470296,0)|0);
 $1221 = tempRet0;
 $1222 = (___muldi3(($1168|0),($1169|0),654183,0)|0);
 $1223 = tempRet0;
 $1224 = (___muldi3(($1168|0),($1169|0),-997805,-1)|0);
 $1225 = tempRet0;
 $1226 = (___muldi3(($1168|0),($1169|0),136657,0)|0);
 $1227 = tempRet0;
 $1228 = (___muldi3(($1168|0),($1169|0),-683901,-1)|0);
 $1229 = tempRet0;
 $1230 = (_i64Add(($1070|0),($1071|0),($1228|0),($1229|0))|0);
 $1231 = tempRet0;
 $1232 = (_i64Add(($1230|0),($1231|0),($1182|0),($1183|0))|0);
 $1233 = tempRet0;
 $1234 = (_i64Subtract(($1232|0),($1233|0),($1126|0),($1127|0))|0);
 $1235 = tempRet0;
 $1236 = (___muldi3(($1210|0),($1211|0),666643,0)|0);
 $1237 = tempRet0;
 $1238 = (___muldi3(($1210|0),($1211|0),470296,0)|0);
 $1239 = tempRet0;
 $1240 = (_i64Add(($1218|0),($1219|0),($1238|0),($1239|0))|0);
 $1241 = tempRet0;
 $1242 = (___muldi3(($1210|0),($1211|0),654183,0)|0);
 $1243 = tempRet0;
 $1244 = (___muldi3(($1210|0),($1211|0),-997805,-1)|0);
 $1245 = tempRet0;
 $1246 = (___muldi3(($1210|0),($1211|0),136657,0)|0);
 $1247 = tempRet0;
 $1248 = (___muldi3(($1210|0),($1211|0),-683901,-1)|0);
 $1249 = tempRet0;
 $1250 = (___muldi3(($1214|0),($1215|0),666643,0)|0);
 $1251 = tempRet0;
 $1252 = (_i64Add(($872|0),($873|0),($1250|0),($1251|0))|0);
 $1253 = tempRet0;
 $1254 = (___muldi3(($1214|0),($1215|0),470296,0)|0);
 $1255 = tempRet0;
 $1256 = (___muldi3(($1214|0),($1215|0),654183,0)|0);
 $1257 = tempRet0;
 $1258 = (_i64Add(($1240|0),($1241|0),($1256|0),($1257|0))|0);
 $1259 = tempRet0;
 $1260 = (___muldi3(($1214|0),($1215|0),-997805,-1)|0);
 $1261 = tempRet0;
 $1262 = (___muldi3(($1214|0),($1215|0),136657,0)|0);
 $1263 = tempRet0;
 $1264 = (___muldi3(($1214|0),($1215|0),-683901,-1)|0);
 $1265 = tempRet0;
 $1266 = (_i64Add(($1052|0),($1053|0),($1224|0),($1225|0))|0);
 $1267 = tempRet0;
 $1268 = (_i64Add(($1266|0),($1267|0),($1176|0),($1177|0))|0);
 $1269 = tempRet0;
 $1270 = (_i64Add(($1268|0),($1269|0),($1246|0),($1247|0))|0);
 $1271 = tempRet0;
 $1272 = (_i64Add(($1270|0),($1271|0),($1264|0),($1265|0))|0);
 $1273 = tempRet0;
 $1274 = (_i64Subtract(($1272|0),($1273|0),($1104|0),($1105|0))|0);
 $1275 = tempRet0;
 $1276 = (___muldi3(($1200|0),($1201|0),666643,0)|0);
 $1277 = tempRet0;
 $1278 = (___muldi3(($1200|0),($1201|0),470296,0)|0);
 $1279 = tempRet0;
 $1280 = (_i64Add(($1252|0),($1253|0),($1278|0),($1279|0))|0);
 $1281 = tempRet0;
 $1282 = (___muldi3(($1200|0),($1201|0),654183,0)|0);
 $1283 = tempRet0;
 $1284 = (___muldi3(($1200|0),($1201|0),-997805,-1)|0);
 $1285 = tempRet0;
 $1286 = (_i64Add(($1258|0),($1259|0),($1284|0),($1285|0))|0);
 $1287 = tempRet0;
 $1288 = (___muldi3(($1200|0),($1201|0),136657,0)|0);
 $1289 = tempRet0;
 $1290 = (___muldi3(($1200|0),($1201|0),-683901,-1)|0);
 $1291 = tempRet0;
 $1292 = (___muldi3(($1204|0),($1205|0),666643,0)|0);
 $1293 = tempRet0;
 $1294 = (___muldi3(($1204|0),($1205|0),470296,0)|0);
 $1295 = tempRet0;
 $1296 = (___muldi3(($1204|0),($1205|0),654183,0)|0);
 $1297 = tempRet0;
 $1298 = (___muldi3(($1204|0),($1205|0),-997805,-1)|0);
 $1299 = tempRet0;
 $1300 = (___muldi3(($1204|0),($1205|0),136657,0)|0);
 $1301 = tempRet0;
 $1302 = (___muldi3(($1204|0),($1205|0),-683901,-1)|0);
 $1303 = tempRet0;
 $1304 = (_i64Add(($1038|0),($1039|0),($1220|0),($1221|0))|0);
 $1305 = tempRet0;
 $1306 = (_i64Subtract(($1304|0),($1305|0),($1086|0),($1087|0))|0);
 $1307 = tempRet0;
 $1308 = (_i64Add(($1306|0),($1307|0),($1242|0),($1243|0))|0);
 $1309 = tempRet0;
 $1310 = (_i64Add(($1308|0),($1309|0),($1260|0),($1261|0))|0);
 $1311 = tempRet0;
 $1312 = (_i64Add(($1310|0),($1311|0),($1288|0),($1289|0))|0);
 $1313 = tempRet0;
 $1314 = (_i64Add(($1312|0),($1313|0),($1302|0),($1303|0))|0);
 $1315 = tempRet0;
 $1316 = (___muldi3(($1190|0),($1191|0),666643,0)|0);
 $1317 = tempRet0;
 $1318 = (_i64Add(($1316|0),($1317|0),($636|0),($637|0))|0);
 $1319 = tempRet0;
 $1320 = (___muldi3(($1190|0),($1191|0),470296,0)|0);
 $1321 = tempRet0;
 $1322 = (___muldi3(($1190|0),($1191|0),654183,0)|0);
 $1323 = tempRet0;
 $1324 = (_i64Add(($860|0),($861|0),($220|0),($221|0))|0);
 $1325 = tempRet0;
 $1326 = (_i64Subtract(($1324|0),($1325|0),($652|0),($653|0))|0);
 $1327 = tempRet0;
 $1328 = (_i64Add(($1326|0),($1327|0),($1276|0),($1277|0))|0);
 $1329 = tempRet0;
 $1330 = (_i64Add(($1328|0),($1329|0),($1322|0),($1323|0))|0);
 $1331 = tempRet0;
 $1332 = (_i64Add(($1330|0),($1331|0),($1294|0),($1295|0))|0);
 $1333 = tempRet0;
 $1334 = (___muldi3(($1190|0),($1191|0),-997805,-1)|0);
 $1335 = tempRet0;
 $1336 = (___muldi3(($1190|0),($1191|0),136657,0)|0);
 $1337 = tempRet0;
 $1338 = (_i64Add(($868|0),($869|0),($248|0),($249|0))|0);
 $1339 = tempRet0;
 $1340 = (_i64Subtract(($1338|0),($1339|0),($672|0),($673|0))|0);
 $1341 = tempRet0;
 $1342 = (_i64Add(($1340|0),($1341|0),($1236|0),($1237|0))|0);
 $1343 = tempRet0;
 $1344 = (_i64Add(($1342|0),($1343|0),($1254|0),($1255|0))|0);
 $1345 = tempRet0;
 $1346 = (_i64Add(($1344|0),($1345|0),($1282|0),($1283|0))|0);
 $1347 = tempRet0;
 $1348 = (_i64Add(($1346|0),($1347|0),($1336|0),($1337|0))|0);
 $1349 = tempRet0;
 $1350 = (_i64Add(($1348|0),($1349|0),($1298|0),($1299|0))|0);
 $1351 = tempRet0;
 $1352 = (___muldi3(($1190|0),($1191|0),-683901,-1)|0);
 $1353 = tempRet0;
 $1354 = (_i64Add(($1318|0),($1319|0),1048576,0)|0);
 $1355 = tempRet0;
 $1356 = (_bitshift64Ashr(($1354|0),($1355|0),21)|0);
 $1357 = tempRet0;
 $1358 = (_i64Add(($864|0),($865|0),($1320|0),($1321|0))|0);
 $1359 = tempRet0;
 $1360 = (_i64Add(($1358|0),($1359|0),($1292|0),($1293|0))|0);
 $1361 = tempRet0;
 $1362 = (_i64Add(($1360|0),($1361|0),($1356|0),($1357|0))|0);
 $1363 = tempRet0;
 $1364 = (_bitshift64Shl(($1356|0),($1357|0),21)|0);
 $1365 = tempRet0;
 $1366 = (_i64Subtract(($1318|0),($1319|0),($1364|0),($1365|0))|0);
 $1367 = tempRet0;
 $1368 = (_i64Add(($1332|0),($1333|0),1048576,0)|0);
 $1369 = tempRet0;
 $1370 = (_bitshift64Ashr(($1368|0),($1369|0),21)|0);
 $1371 = tempRet0;
 $1372 = (_i64Add(($1280|0),($1281|0),($1334|0),($1335|0))|0);
 $1373 = tempRet0;
 $1374 = (_i64Add(($1372|0),($1373|0),($1296|0),($1297|0))|0);
 $1375 = tempRet0;
 $1376 = (_i64Add(($1374|0),($1375|0),($1370|0),($1371|0))|0);
 $1377 = tempRet0;
 $1378 = (_bitshift64Shl(($1370|0),($1371|0),21)|0);
 $1379 = tempRet0;
 $1380 = (_i64Add(($1350|0),($1351|0),1048576,0)|0);
 $1381 = tempRet0;
 $1382 = (_bitshift64Ashr(($1380|0),($1381|0),21)|0);
 $1383 = tempRet0;
 $1384 = (_i64Add(($1286|0),($1287|0),($1352|0),($1353|0))|0);
 $1385 = tempRet0;
 $1386 = (_i64Add(($1384|0),($1385|0),($1300|0),($1301|0))|0);
 $1387 = tempRet0;
 $1388 = (_i64Add(($1386|0),($1387|0),($1382|0),($1383|0))|0);
 $1389 = tempRet0;
 $1390 = (_bitshift64Shl(($1382|0),($1383|0),21)|0);
 $1391 = tempRet0;
 $1392 = (_i64Add(($1314|0),($1315|0),1048576,0)|0);
 $1393 = tempRet0;
 $1394 = (_bitshift64Ashr(($1392|0),($1393|0),21)|0);
 $1395 = tempRet0;
 $1396 = (_i64Add(($1084|0),($1085|0),($1222|0),($1223|0))|0);
 $1397 = tempRet0;
 $1398 = (_i64Add(($1396|0),($1397|0),($1244|0),($1245|0))|0);
 $1399 = tempRet0;
 $1400 = (_i64Subtract(($1398|0),($1399|0),($1178|0),($1179|0))|0);
 $1401 = tempRet0;
 $1402 = (_i64Add(($1400|0),($1401|0),($1262|0),($1263|0))|0);
 $1403 = tempRet0;
 $1404 = (_i64Add(($1402|0),($1403|0),($1290|0),($1291|0))|0);
 $1405 = tempRet0;
 $1406 = (_i64Add(($1404|0),($1405|0),($1394|0),($1395|0))|0);
 $1407 = tempRet0;
 $1408 = (_bitshift64Shl(($1394|0),($1395|0),21)|0);
 $1409 = tempRet0;
 $1410 = (_i64Subtract(($1314|0),($1315|0),($1408|0),($1409|0))|0);
 $1411 = tempRet0;
 $1412 = (_i64Add(($1274|0),($1275|0),1048576,0)|0);
 $1413 = tempRet0;
 $1414 = (_bitshift64Ashr(($1412|0),($1413|0),21)|0);
 $1415 = tempRet0;
 $1416 = (_i64Add(($1248|0),($1249|0),($1226|0),($1227|0))|0);
 $1417 = tempRet0;
 $1418 = (_i64Add(($1416|0),($1417|0),($1102|0),($1103|0))|0);
 $1419 = tempRet0;
 $1420 = (_i64Subtract(($1418|0),($1419|0),($1184|0),($1185|0))|0);
 $1421 = tempRet0;
 $1422 = (_i64Add(($1420|0),($1421|0),($1414|0),($1415|0))|0);
 $1423 = tempRet0;
 $1424 = (_bitshift64Shl(($1414|0),($1415|0),21)|0);
 $1425 = tempRet0;
 $1426 = (_i64Subtract(($1274|0),($1275|0),($1424|0),($1425|0))|0);
 $1427 = tempRet0;
 $1428 = (_i64Add(($1234|0),($1235|0),1048576,0)|0);
 $1429 = tempRet0;
 $1430 = (_bitshift64Ashr(($1428|0),($1429|0),21)|0);
 $1431 = tempRet0;
 $1432 = (_i64Add(($1194|0),($1195|0),($1430|0),($1431|0))|0);
 $1433 = tempRet0;
 $1434 = (_bitshift64Shl(($1430|0),($1431|0),21)|0);
 $1435 = tempRet0;
 $1436 = (_i64Add(($1362|0),($1363|0),1048576,0)|0);
 $1437 = tempRet0;
 $1438 = (_bitshift64Ashr(($1436|0),($1437|0),21)|0);
 $1439 = tempRet0;
 $1440 = (_bitshift64Shl(($1438|0),($1439|0),21)|0);
 $1441 = tempRet0;
 $1442 = (_i64Add(($1376|0),($1377|0),1048576,0)|0);
 $1443 = tempRet0;
 $1444 = (_bitshift64Ashr(($1442|0),($1443|0),21)|0);
 $1445 = tempRet0;
 $1446 = (_bitshift64Shl(($1444|0),($1445|0),21)|0);
 $1447 = tempRet0;
 $1448 = (_i64Add(($1388|0),($1389|0),1048576,0)|0);
 $1449 = tempRet0;
 $1450 = (_bitshift64Ashr(($1448|0),($1449|0),21)|0);
 $1451 = tempRet0;
 $1452 = (_i64Add(($1410|0),($1411|0),($1450|0),($1451|0))|0);
 $1453 = tempRet0;
 $1454 = (_bitshift64Shl(($1450|0),($1451|0),21)|0);
 $1455 = tempRet0;
 $1456 = (_i64Add(($1406|0),($1407|0),1048576,0)|0);
 $1457 = tempRet0;
 $1458 = (_bitshift64Ashr(($1456|0),($1457|0),21)|0);
 $1459 = tempRet0;
 $1460 = (_i64Add(($1426|0),($1427|0),($1458|0),($1459|0))|0);
 $1461 = tempRet0;
 $1462 = (_bitshift64Shl(($1458|0),($1459|0),21)|0);
 $1463 = tempRet0;
 $1464 = (_i64Subtract(($1406|0),($1407|0),($1462|0),($1463|0))|0);
 $1465 = tempRet0;
 $1466 = (_i64Add(($1422|0),($1423|0),1048576,0)|0);
 $1467 = tempRet0;
 $1468 = (_bitshift64Ashr(($1466|0),($1467|0),21)|0);
 $1469 = tempRet0;
 $1470 = (_bitshift64Shl(($1468|0),($1469|0),21)|0);
 $1471 = tempRet0;
 $1472 = (_i64Subtract(($1422|0),($1423|0),($1470|0),($1471|0))|0);
 $1473 = tempRet0;
 $1474 = (_i64Add(($1432|0),($1433|0),1048576,0)|0);
 $1475 = tempRet0;
 $1476 = (_bitshift64Ashr(($1474|0),($1475|0),21)|0);
 $1477 = tempRet0;
 $1478 = (_bitshift64Shl(($1476|0),($1477|0),21)|0);
 $1479 = tempRet0;
 $1480 = (_i64Subtract(($1432|0),($1433|0),($1478|0),($1479|0))|0);
 $1481 = tempRet0;
 $1482 = (___muldi3(($1476|0),($1477|0),666643,0)|0);
 $1483 = tempRet0;
 $1484 = (_i64Add(($1366|0),($1367|0),($1482|0),($1483|0))|0);
 $1485 = tempRet0;
 $1486 = (___muldi3(($1476|0),($1477|0),470296,0)|0);
 $1487 = tempRet0;
 $1488 = (___muldi3(($1476|0),($1477|0),654183,0)|0);
 $1489 = tempRet0;
 $1490 = (___muldi3(($1476|0),($1477|0),-997805,-1)|0);
 $1491 = tempRet0;
 $1492 = (___muldi3(($1476|0),($1477|0),136657,0)|0);
 $1493 = tempRet0;
 $1494 = (___muldi3(($1476|0),($1477|0),-683901,-1)|0);
 $1495 = tempRet0;
 $1496 = (_bitshift64Ashr(($1484|0),($1485|0),21)|0);
 $1497 = tempRet0;
 $1498 = (_i64Add(($1486|0),($1487|0),($1362|0),($1363|0))|0);
 $1499 = tempRet0;
 $1500 = (_i64Subtract(($1498|0),($1499|0),($1440|0),($1441|0))|0);
 $1501 = tempRet0;
 $1502 = (_i64Add(($1500|0),($1501|0),($1496|0),($1497|0))|0);
 $1503 = tempRet0;
 $1504 = (_bitshift64Shl(($1496|0),($1497|0),21)|0);
 $1505 = tempRet0;
 $1506 = (_i64Subtract(($1484|0),($1485|0),($1504|0),($1505|0))|0);
 $1507 = tempRet0;
 $1508 = (_bitshift64Ashr(($1502|0),($1503|0),21)|0);
 $1509 = tempRet0;
 $1510 = (_i64Add(($1488|0),($1489|0),($1332|0),($1333|0))|0);
 $1511 = tempRet0;
 $1512 = (_i64Subtract(($1510|0),($1511|0),($1378|0),($1379|0))|0);
 $1513 = tempRet0;
 $1514 = (_i64Add(($1512|0),($1513|0),($1438|0),($1439|0))|0);
 $1515 = tempRet0;
 $1516 = (_i64Add(($1514|0),($1515|0),($1508|0),($1509|0))|0);
 $1517 = tempRet0;
 $1518 = (_bitshift64Shl(($1508|0),($1509|0),21)|0);
 $1519 = tempRet0;
 $1520 = (_i64Subtract(($1502|0),($1503|0),($1518|0),($1519|0))|0);
 $1521 = tempRet0;
 $1522 = (_bitshift64Ashr(($1516|0),($1517|0),21)|0);
 $1523 = tempRet0;
 $1524 = (_i64Add(($1376|0),($1377|0),($1490|0),($1491|0))|0);
 $1525 = tempRet0;
 $1526 = (_i64Subtract(($1524|0),($1525|0),($1446|0),($1447|0))|0);
 $1527 = tempRet0;
 $1528 = (_i64Add(($1526|0),($1527|0),($1522|0),($1523|0))|0);
 $1529 = tempRet0;
 $1530 = (_bitshift64Shl(($1522|0),($1523|0),21)|0);
 $1531 = tempRet0;
 $1532 = (_i64Subtract(($1516|0),($1517|0),($1530|0),($1531|0))|0);
 $1533 = tempRet0;
 $1534 = (_bitshift64Ashr(($1528|0),($1529|0),21)|0);
 $1535 = tempRet0;
 $1536 = (_i64Add(($1492|0),($1493|0),($1350|0),($1351|0))|0);
 $1537 = tempRet0;
 $1538 = (_i64Subtract(($1536|0),($1537|0),($1390|0),($1391|0))|0);
 $1539 = tempRet0;
 $1540 = (_i64Add(($1538|0),($1539|0),($1444|0),($1445|0))|0);
 $1541 = tempRet0;
 $1542 = (_i64Add(($1540|0),($1541|0),($1534|0),($1535|0))|0);
 $1543 = tempRet0;
 $1544 = (_bitshift64Shl(($1534|0),($1535|0),21)|0);
 $1545 = tempRet0;
 $1546 = (_i64Subtract(($1528|0),($1529|0),($1544|0),($1545|0))|0);
 $1547 = tempRet0;
 $1548 = (_bitshift64Ashr(($1542|0),($1543|0),21)|0);
 $1549 = tempRet0;
 $1550 = (_i64Add(($1388|0),($1389|0),($1494|0),($1495|0))|0);
 $1551 = tempRet0;
 $1552 = (_i64Subtract(($1550|0),($1551|0),($1454|0),($1455|0))|0);
 $1553 = tempRet0;
 $1554 = (_i64Add(($1552|0),($1553|0),($1548|0),($1549|0))|0);
 $1555 = tempRet0;
 $1556 = (_bitshift64Shl(($1548|0),($1549|0),21)|0);
 $1557 = tempRet0;
 $1558 = (_i64Subtract(($1542|0),($1543|0),($1556|0),($1557|0))|0);
 $1559 = tempRet0;
 $1560 = (_bitshift64Ashr(($1554|0),($1555|0),21)|0);
 $1561 = tempRet0;
 $1562 = (_i64Add(($1452|0),($1453|0),($1560|0),($1561|0))|0);
 $1563 = tempRet0;
 $1564 = (_bitshift64Shl(($1560|0),($1561|0),21)|0);
 $1565 = tempRet0;
 $1566 = (_i64Subtract(($1554|0),($1555|0),($1564|0),($1565|0))|0);
 $1567 = tempRet0;
 $1568 = (_bitshift64Ashr(($1562|0),($1563|0),21)|0);
 $1569 = tempRet0;
 $1570 = (_i64Add(($1568|0),($1569|0),($1464|0),($1465|0))|0);
 $1571 = tempRet0;
 $1572 = (_bitshift64Shl(($1568|0),($1569|0),21)|0);
 $1573 = tempRet0;
 $1574 = (_i64Subtract(($1562|0),($1563|0),($1572|0),($1573|0))|0);
 $1575 = tempRet0;
 $1576 = (_bitshift64Ashr(($1570|0),($1571|0),21)|0);
 $1577 = tempRet0;
 $1578 = (_i64Add(($1460|0),($1461|0),($1576|0),($1577|0))|0);
 $1579 = tempRet0;
 $1580 = (_bitshift64Shl(($1576|0),($1577|0),21)|0);
 $1581 = tempRet0;
 $1582 = (_i64Subtract(($1570|0),($1571|0),($1580|0),($1581|0))|0);
 $1583 = tempRet0;
 $1584 = (_bitshift64Ashr(($1578|0),($1579|0),21)|0);
 $1585 = tempRet0;
 $1586 = (_i64Add(($1584|0),($1585|0),($1472|0),($1473|0))|0);
 $1587 = tempRet0;
 $1588 = (_bitshift64Shl(($1584|0),($1585|0),21)|0);
 $1589 = tempRet0;
 $1590 = (_i64Subtract(($1578|0),($1579|0),($1588|0),($1589|0))|0);
 $1591 = tempRet0;
 $1592 = (_bitshift64Ashr(($1586|0),($1587|0),21)|0);
 $1593 = tempRet0;
 $1594 = (_i64Add(($1468|0),($1469|0),($1234|0),($1235|0))|0);
 $1595 = tempRet0;
 $1596 = (_i64Subtract(($1594|0),($1595|0),($1434|0),($1435|0))|0);
 $1597 = tempRet0;
 $1598 = (_i64Add(($1596|0),($1597|0),($1592|0),($1593|0))|0);
 $1599 = tempRet0;
 $1600 = (_bitshift64Shl(($1592|0),($1593|0),21)|0);
 $1601 = tempRet0;
 $1602 = (_i64Subtract(($1586|0),($1587|0),($1600|0),($1601|0))|0);
 $1603 = tempRet0;
 $1604 = (_bitshift64Ashr(($1598|0),($1599|0),21)|0);
 $1605 = tempRet0;
 $1606 = (_i64Add(($1604|0),($1605|0),($1480|0),($1481|0))|0);
 $1607 = tempRet0;
 $1608 = (_bitshift64Shl(($1604|0),($1605|0),21)|0);
 $1609 = tempRet0;
 $1610 = (_i64Subtract(($1598|0),($1599|0),($1608|0),($1609|0))|0);
 $1611 = tempRet0;
 $1612 = (_bitshift64Ashr(($1606|0),($1607|0),21)|0);
 $1613 = tempRet0;
 $1614 = (_bitshift64Shl(($1612|0),($1613|0),21)|0);
 $1615 = tempRet0;
 $1616 = (_i64Subtract(($1606|0),($1607|0),($1614|0),($1615|0))|0);
 $1617 = tempRet0;
 $1618 = (___muldi3(($1612|0),($1613|0),666643,0)|0);
 $1619 = tempRet0;
 $1620 = (_i64Add(($1618|0),($1619|0),($1506|0),($1507|0))|0);
 $1621 = tempRet0;
 $1622 = (___muldi3(($1612|0),($1613|0),470296,0)|0);
 $1623 = tempRet0;
 $1624 = (_i64Add(($1520|0),($1521|0),($1622|0),($1623|0))|0);
 $1625 = tempRet0;
 $1626 = (___muldi3(($1612|0),($1613|0),654183,0)|0);
 $1627 = tempRet0;
 $1628 = (_i64Add(($1532|0),($1533|0),($1626|0),($1627|0))|0);
 $1629 = tempRet0;
 $1630 = (___muldi3(($1612|0),($1613|0),-997805,-1)|0);
 $1631 = tempRet0;
 $1632 = (_i64Add(($1546|0),($1547|0),($1630|0),($1631|0))|0);
 $1633 = tempRet0;
 $1634 = (___muldi3(($1612|0),($1613|0),136657,0)|0);
 $1635 = tempRet0;
 $1636 = (_i64Add(($1558|0),($1559|0),($1634|0),($1635|0))|0);
 $1637 = tempRet0;
 $1638 = (___muldi3(($1612|0),($1613|0),-683901,-1)|0);
 $1639 = tempRet0;
 $1640 = (_i64Add(($1566|0),($1567|0),($1638|0),($1639|0))|0);
 $1641 = tempRet0;
 $1642 = (_bitshift64Ashr(($1620|0),($1621|0),21)|0);
 $1643 = tempRet0;
 $1644 = (_i64Add(($1624|0),($1625|0),($1642|0),($1643|0))|0);
 $1645 = tempRet0;
 $1646 = (_bitshift64Shl(($1642|0),($1643|0),21)|0);
 $1647 = tempRet0;
 $1648 = (_i64Subtract(($1620|0),($1621|0),($1646|0),($1647|0))|0);
 $1649 = tempRet0;
 $1650 = (_bitshift64Ashr(($1644|0),($1645|0),21)|0);
 $1651 = tempRet0;
 $1652 = (_i64Add(($1628|0),($1629|0),($1650|0),($1651|0))|0);
 $1653 = tempRet0;
 $1654 = (_bitshift64Shl(($1650|0),($1651|0),21)|0);
 $1655 = tempRet0;
 $1656 = (_i64Subtract(($1644|0),($1645|0),($1654|0),($1655|0))|0);
 $1657 = tempRet0;
 $1658 = (_bitshift64Ashr(($1652|0),($1653|0),21)|0);
 $1659 = tempRet0;
 $1660 = (_i64Add(($1632|0),($1633|0),($1658|0),($1659|0))|0);
 $1661 = tempRet0;
 $1662 = (_bitshift64Shl(($1658|0),($1659|0),21)|0);
 $1663 = tempRet0;
 $1664 = (_i64Subtract(($1652|0),($1653|0),($1662|0),($1663|0))|0);
 $1665 = tempRet0;
 $1666 = (_bitshift64Ashr(($1660|0),($1661|0),21)|0);
 $1667 = tempRet0;
 $1668 = (_i64Add(($1636|0),($1637|0),($1666|0),($1667|0))|0);
 $1669 = tempRet0;
 $1670 = (_bitshift64Shl(($1666|0),($1667|0),21)|0);
 $1671 = tempRet0;
 $1672 = (_i64Subtract(($1660|0),($1661|0),($1670|0),($1671|0))|0);
 $1673 = tempRet0;
 $1674 = (_bitshift64Ashr(($1668|0),($1669|0),21)|0);
 $1675 = tempRet0;
 $1676 = (_i64Add(($1640|0),($1641|0),($1674|0),($1675|0))|0);
 $1677 = tempRet0;
 $1678 = (_bitshift64Shl(($1674|0),($1675|0),21)|0);
 $1679 = tempRet0;
 $1680 = (_i64Subtract(($1668|0),($1669|0),($1678|0),($1679|0))|0);
 $1681 = tempRet0;
 $1682 = (_bitshift64Ashr(($1676|0),($1677|0),21)|0);
 $1683 = tempRet0;
 $1684 = (_i64Add(($1682|0),($1683|0),($1574|0),($1575|0))|0);
 $1685 = tempRet0;
 $1686 = (_bitshift64Shl(($1682|0),($1683|0),21)|0);
 $1687 = tempRet0;
 $1688 = (_i64Subtract(($1676|0),($1677|0),($1686|0),($1687|0))|0);
 $1689 = tempRet0;
 $1690 = (_bitshift64Ashr(($1684|0),($1685|0),21)|0);
 $1691 = tempRet0;
 $1692 = (_i64Add(($1690|0),($1691|0),($1582|0),($1583|0))|0);
 $1693 = tempRet0;
 $1694 = (_bitshift64Shl(($1690|0),($1691|0),21)|0);
 $1695 = tempRet0;
 $1696 = (_i64Subtract(($1684|0),($1685|0),($1694|0),($1695|0))|0);
 $1697 = tempRet0;
 $1698 = (_bitshift64Ashr(($1692|0),($1693|0),21)|0);
 $1699 = tempRet0;
 $1700 = (_i64Add(($1698|0),($1699|0),($1590|0),($1591|0))|0);
 $1701 = tempRet0;
 $1702 = (_bitshift64Shl(($1698|0),($1699|0),21)|0);
 $1703 = tempRet0;
 $1704 = (_i64Subtract(($1692|0),($1693|0),($1702|0),($1703|0))|0);
 $1705 = tempRet0;
 $1706 = (_bitshift64Ashr(($1700|0),($1701|0),21)|0);
 $1707 = tempRet0;
 $1708 = (_i64Add(($1706|0),($1707|0),($1602|0),($1603|0))|0);
 $1709 = tempRet0;
 $1710 = (_bitshift64Shl(($1706|0),($1707|0),21)|0);
 $1711 = tempRet0;
 $1712 = (_i64Subtract(($1700|0),($1701|0),($1710|0),($1711|0))|0);
 $1713 = tempRet0;
 $1714 = (_bitshift64Ashr(($1708|0),($1709|0),21)|0);
 $1715 = tempRet0;
 $1716 = (_i64Add(($1714|0),($1715|0),($1610|0),($1611|0))|0);
 $1717 = tempRet0;
 $1718 = (_bitshift64Shl(($1714|0),($1715|0),21)|0);
 $1719 = tempRet0;
 $1720 = (_i64Subtract(($1708|0),($1709|0),($1718|0),($1719|0))|0);
 $1721 = tempRet0;
 $1722 = (_bitshift64Ashr(($1716|0),($1717|0),21)|0);
 $1723 = tempRet0;
 $1724 = (_i64Add(($1722|0),($1723|0),($1616|0),($1617|0))|0);
 $1725 = tempRet0;
 $1726 = (_bitshift64Shl(($1722|0),($1723|0),21)|0);
 $1727 = tempRet0;
 $1728 = (_i64Subtract(($1716|0),($1717|0),($1726|0),($1727|0))|0);
 $1729 = tempRet0;
 $1730 = $1648&255;
 HEAP8[$0>>0] = $1730;
 $1731 = (_bitshift64Lshr(($1648|0),($1649|0),8)|0);
 $1732 = tempRet0;
 $1733 = $1731&255;
 $1734 = ((($0)) + 1|0);
 HEAP8[$1734>>0] = $1733;
 $1735 = (_bitshift64Lshr(($1648|0),($1649|0),16)|0);
 $1736 = tempRet0;
 $1737 = (_bitshift64Shl(($1656|0),($1657|0),5)|0);
 $1738 = tempRet0;
 $1739 = $1737 | $1735;
 $1738 | $1736;
 $1740 = $1739&255;
 $1741 = ((($0)) + 2|0);
 HEAP8[$1741>>0] = $1740;
 $1742 = (_bitshift64Lshr(($1656|0),($1657|0),3)|0);
 $1743 = tempRet0;
 $1744 = $1742&255;
 $1745 = ((($0)) + 3|0);
 HEAP8[$1745>>0] = $1744;
 $1746 = (_bitshift64Lshr(($1656|0),($1657|0),11)|0);
 $1747 = tempRet0;
 $1748 = $1746&255;
 $1749 = ((($0)) + 4|0);
 HEAP8[$1749>>0] = $1748;
 $1750 = (_bitshift64Lshr(($1656|0),($1657|0),19)|0);
 $1751 = tempRet0;
 $1752 = (_bitshift64Shl(($1664|0),($1665|0),2)|0);
 $1753 = tempRet0;
 $1754 = $1752 | $1750;
 $1753 | $1751;
 $1755 = $1754&255;
 $1756 = ((($0)) + 5|0);
 HEAP8[$1756>>0] = $1755;
 $1757 = (_bitshift64Lshr(($1664|0),($1665|0),6)|0);
 $1758 = tempRet0;
 $1759 = $1757&255;
 $1760 = ((($0)) + 6|0);
 HEAP8[$1760>>0] = $1759;
 $1761 = (_bitshift64Lshr(($1664|0),($1665|0),14)|0);
 $1762 = tempRet0;
 $1763 = (_bitshift64Shl(($1672|0),($1673|0),7)|0);
 $1764 = tempRet0;
 $1765 = $1763 | $1761;
 $1764 | $1762;
 $1766 = $1765&255;
 $1767 = ((($0)) + 7|0);
 HEAP8[$1767>>0] = $1766;
 $1768 = (_bitshift64Lshr(($1672|0),($1673|0),1)|0);
 $1769 = tempRet0;
 $1770 = $1768&255;
 $1771 = ((($0)) + 8|0);
 HEAP8[$1771>>0] = $1770;
 $1772 = (_bitshift64Lshr(($1672|0),($1673|0),9)|0);
 $1773 = tempRet0;
 $1774 = $1772&255;
 $1775 = ((($0)) + 9|0);
 HEAP8[$1775>>0] = $1774;
 $1776 = (_bitshift64Lshr(($1672|0),($1673|0),17)|0);
 $1777 = tempRet0;
 $1778 = (_bitshift64Shl(($1680|0),($1681|0),4)|0);
 $1779 = tempRet0;
 $1780 = $1778 | $1776;
 $1779 | $1777;
 $1781 = $1780&255;
 $1782 = ((($0)) + 10|0);
 HEAP8[$1782>>0] = $1781;
 $1783 = (_bitshift64Lshr(($1680|0),($1681|0),4)|0);
 $1784 = tempRet0;
 $1785 = $1783&255;
 $1786 = ((($0)) + 11|0);
 HEAP8[$1786>>0] = $1785;
 $1787 = (_bitshift64Lshr(($1680|0),($1681|0),12)|0);
 $1788 = tempRet0;
 $1789 = $1787&255;
 $1790 = ((($0)) + 12|0);
 HEAP8[$1790>>0] = $1789;
 $1791 = (_bitshift64Lshr(($1680|0),($1681|0),20)|0);
 $1792 = tempRet0;
 $1793 = (_bitshift64Shl(($1688|0),($1689|0),1)|0);
 $1794 = tempRet0;
 $1795 = $1793 | $1791;
 $1794 | $1792;
 $1796 = $1795&255;
 $1797 = ((($0)) + 13|0);
 HEAP8[$1797>>0] = $1796;
 $1798 = (_bitshift64Lshr(($1688|0),($1689|0),7)|0);
 $1799 = tempRet0;
 $1800 = $1798&255;
 $1801 = ((($0)) + 14|0);
 HEAP8[$1801>>0] = $1800;
 $1802 = (_bitshift64Lshr(($1688|0),($1689|0),15)|0);
 $1803 = tempRet0;
 $1804 = (_bitshift64Shl(($1696|0),($1697|0),6)|0);
 $1805 = tempRet0;
 $1806 = $1804 | $1802;
 $1805 | $1803;
 $1807 = $1806&255;
 $1808 = ((($0)) + 15|0);
 HEAP8[$1808>>0] = $1807;
 $1809 = (_bitshift64Lshr(($1696|0),($1697|0),2)|0);
 $1810 = tempRet0;
 $1811 = $1809&255;
 $1812 = ((($0)) + 16|0);
 HEAP8[$1812>>0] = $1811;
 $1813 = (_bitshift64Lshr(($1696|0),($1697|0),10)|0);
 $1814 = tempRet0;
 $1815 = $1813&255;
 $1816 = ((($0)) + 17|0);
 HEAP8[$1816>>0] = $1815;
 $1817 = (_bitshift64Lshr(($1696|0),($1697|0),18)|0);
 $1818 = tempRet0;
 $1819 = (_bitshift64Shl(($1704|0),($1705|0),3)|0);
 $1820 = tempRet0;
 $1821 = $1819 | $1817;
 $1820 | $1818;
 $1822 = $1821&255;
 $1823 = ((($0)) + 18|0);
 HEAP8[$1823>>0] = $1822;
 $1824 = (_bitshift64Lshr(($1704|0),($1705|0),5)|0);
 $1825 = tempRet0;
 $1826 = $1824&255;
 $1827 = ((($0)) + 19|0);
 HEAP8[$1827>>0] = $1826;
 $1828 = (_bitshift64Lshr(($1704|0),($1705|0),13)|0);
 $1829 = tempRet0;
 $1830 = $1828&255;
 $1831 = ((($0)) + 20|0);
 HEAP8[$1831>>0] = $1830;
 $1832 = $1712&255;
 $1833 = ((($0)) + 21|0);
 HEAP8[$1833>>0] = $1832;
 $1834 = (_bitshift64Lshr(($1712|0),($1713|0),8)|0);
 $1835 = tempRet0;
 $1836 = $1834&255;
 $1837 = ((($0)) + 22|0);
 HEAP8[$1837>>0] = $1836;
 $1838 = (_bitshift64Lshr(($1712|0),($1713|0),16)|0);
 $1839 = tempRet0;
 $1840 = (_bitshift64Shl(($1720|0),($1721|0),5)|0);
 $1841 = tempRet0;
 $1842 = $1840 | $1838;
 $1841 | $1839;
 $1843 = $1842&255;
 $1844 = ((($0)) + 23|0);
 HEAP8[$1844>>0] = $1843;
 $1845 = (_bitshift64Lshr(($1720|0),($1721|0),3)|0);
 $1846 = tempRet0;
 $1847 = $1845&255;
 $1848 = ((($0)) + 24|0);
 HEAP8[$1848>>0] = $1847;
 $1849 = (_bitshift64Lshr(($1720|0),($1721|0),11)|0);
 $1850 = tempRet0;
 $1851 = $1849&255;
 $1852 = ((($0)) + 25|0);
 HEAP8[$1852>>0] = $1851;
 $1853 = (_bitshift64Lshr(($1720|0),($1721|0),19)|0);
 $1854 = tempRet0;
 $1855 = (_bitshift64Shl(($1728|0),($1729|0),2)|0);
 $1856 = tempRet0;
 $1857 = $1855 | $1853;
 $1856 | $1854;
 $1858 = $1857&255;
 $1859 = ((($0)) + 26|0);
 HEAP8[$1859>>0] = $1858;
 $1860 = (_bitshift64Lshr(($1728|0),($1729|0),6)|0);
 $1861 = tempRet0;
 $1862 = $1860&255;
 $1863 = ((($0)) + 27|0);
 HEAP8[$1863>>0] = $1862;
 $1864 = (_bitshift64Lshr(($1728|0),($1729|0),14)|0);
 $1865 = tempRet0;
 $1866 = (_bitshift64Shl(($1724|0),($1725|0),7)|0);
 $1867 = tempRet0;
 $1868 = $1864 | $1866;
 $1865 | $1867;
 $1869 = $1868&255;
 $1870 = ((($0)) + 28|0);
 HEAP8[$1870>>0] = $1869;
 $1871 = (_bitshift64Lshr(($1724|0),($1725|0),1)|0);
 $1872 = tempRet0;
 $1873 = $1871&255;
 $1874 = ((($0)) + 29|0);
 HEAP8[$1874>>0] = $1873;
 $1875 = (_bitshift64Lshr(($1724|0),($1725|0),9)|0);
 $1876 = tempRet0;
 $1877 = $1875&255;
 $1878 = ((($0)) + 30|0);
 HEAP8[$1878>>0] = $1877;
 $1879 = (_bitshift64Lshr(($1724|0),($1725|0),17)|0);
 $1880 = tempRet0;
 $1881 = $1879&255;
 $1882 = ((($0)) + 31|0);
 HEAP8[$1882>>0] = $1881;
 return;
}
function _sha512_init($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 1;
  return ($$0|0);
 }
 $2 = ((($0)) + 72|0);
 HEAP32[$2>>2] = 0;
 $3 = $0;
 $4 = $3;
 HEAP32[$4>>2] = 0;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP32[$6>>2] = 0;
 $7 = ((($0)) + 8|0);
 $8 = $7;
 $9 = $8;
 HEAP32[$9>>2] = -205731576;
 $10 = (($8) + 4)|0;
 $11 = $10;
 HEAP32[$11>>2] = 1779033703;
 $12 = ((($0)) + 16|0);
 $13 = $12;
 $14 = $13;
 HEAP32[$14>>2] = -2067093701;
 $15 = (($13) + 4)|0;
 $16 = $15;
 HEAP32[$16>>2] = -1150833019;
 $17 = ((($0)) + 24|0);
 $18 = $17;
 $19 = $18;
 HEAP32[$19>>2] = -23791573;
 $20 = (($18) + 4)|0;
 $21 = $20;
 HEAP32[$21>>2] = 1013904242;
 $22 = ((($0)) + 32|0);
 $23 = $22;
 $24 = $23;
 HEAP32[$24>>2] = 1595750129;
 $25 = (($23) + 4)|0;
 $26 = $25;
 HEAP32[$26>>2] = -1521486534;
 $27 = ((($0)) + 40|0);
 $28 = $27;
 $29 = $28;
 HEAP32[$29>>2] = -1377402159;
 $30 = (($28) + 4)|0;
 $31 = $30;
 HEAP32[$31>>2] = 1359893119;
 $32 = ((($0)) + 48|0);
 $33 = $32;
 $34 = $33;
 HEAP32[$34>>2] = 725511199;
 $35 = (($33) + 4)|0;
 $36 = $35;
 HEAP32[$36>>2] = -1694144372;
 $37 = ((($0)) + 56|0);
 $38 = $37;
 $39 = $38;
 HEAP32[$39>>2] = -79577749;
 $40 = (($38) + 4)|0;
 $41 = $40;
 HEAP32[$41>>2] = 528734635;
 $42 = ((($0)) + 64|0);
 $43 = $42;
 $44 = $43;
 HEAP32[$44>>2] = 327033209;
 $45 = (($43) + 4)|0;
 $46 = $45;
 HEAP32[$46>>2] = 1541459225;
 $$0 = 0;
 return ($$0|0);
}
function _sha512_update($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$042 = 0, $$043$ = 0, $$043$be = 0, $$04348 = 0, $$044$be = 0, $$04447 = 0, $$046 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $or$cond = 0, $or$cond45 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0|0);
 $4 = ($1|0)==(0|0);
 $or$cond45 = $3 | $4;
 if ($or$cond45) {
  $$042 = 1;
  return ($$042|0);
 }
 $5 = ((($0)) + 72|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6>>>0)>(128);
 if ($7) {
  $$042 = 1;
  return ($$042|0);
 }
 $8 = ($2|0)==(0);
 if ($8) {
  $$042 = 0;
  return ($$042|0);
 }
 $9 = ((($0)) + 76|0);
 $$04348 = $2;$$04447 = $1;
 while(1) {
  $10 = HEAP32[$5>>2]|0;
  $11 = ($10|0)==(0);
  $12 = ($$04348>>>0)>(127);
  $or$cond = $12 & $11;
  if ($or$cond) {
   _sha512_compress($0,$$04447);
   $13 = $0;
   $14 = $13;
   $15 = HEAP32[$14>>2]|0;
   $16 = (($13) + 4)|0;
   $17 = $16;
   $18 = HEAP32[$17>>2]|0;
   $19 = (_i64Add(($15|0),($18|0),1024,0)|0);
   $20 = tempRet0;
   $21 = $0;
   $22 = $21;
   HEAP32[$22>>2] = $19;
   $23 = (($21) + 4)|0;
   $24 = $23;
   HEAP32[$24>>2] = $20;
   $25 = ((($$04447)) + 128|0);
   $26 = (($$04348) + -128)|0;
   $$043$be = $26;$$044$be = $25;
  } else {
   $27 = (128 - ($10))|0;
   $28 = ($$04348>>>0)<($27>>>0);
   $$043$ = $28 ? $$04348 : $27;
   $29 = ($$043$|0)==(0);
   $30 = HEAP32[$5>>2]|0;
   if ($29) {
    $$lcssa = $30;
   } else {
    $$046 = 0;$34 = $30;
    while(1) {
     $31 = (($$04447) + ($$046)|0);
     $32 = HEAP8[$31>>0]|0;
     $33 = (($34) + ($$046))|0;
     $35 = (((($0)) + 76|0) + ($33)|0);
     HEAP8[$35>>0] = $32;
     $36 = (($$046) + 1)|0;
     $37 = ($36>>>0)<($$043$>>>0);
     $38 = HEAP32[$5>>2]|0;
     if ($37) {
      $$046 = $36;$34 = $38;
     } else {
      $$lcssa = $38;
      break;
     }
    }
   }
   $39 = (($$lcssa) + ($$043$))|0;
   HEAP32[$5>>2] = $39;
   $40 = (($$04447) + ($$043$)|0);
   $41 = (($$04348) - ($$043$))|0;
   $42 = ($39|0)==(128);
   if ($42) {
    _sha512_compress($0,$9);
    $44 = $0;
    $45 = $44;
    $46 = HEAP32[$45>>2]|0;
    $47 = (($44) + 4)|0;
    $48 = $47;
    $49 = HEAP32[$48>>2]|0;
    $50 = (_i64Add(($46|0),($49|0),1024,0)|0);
    $51 = tempRet0;
    $52 = $0;
    $53 = $52;
    HEAP32[$53>>2] = $50;
    $54 = (($52) + 4)|0;
    $55 = $54;
    HEAP32[$55>>2] = $51;
    HEAP32[$5>>2] = 0;
    $$043$be = $41;$$044$be = $40;
   } else {
    $$043$be = $41;$$044$be = $40;
   }
  }
  $43 = ($$043$be|0)==(0);
  if ($43) {
   $$042 = 0;
   break;
  } else {
   $$04348 = $$043$be;$$04447 = $$044$be;
  }
 }
 return ($$042|0);
}
function _sha512_compress($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$121 = 0, $$220 = 0, $$35 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0;
 var $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0;
 var $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0;
 var $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0;
 var $1069 = 0, $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0;
 var $1087 = 0, $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0;
 var $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0;
 var $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0;
 var $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0;
 var $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0;
 var $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0;
 var $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0;
 var $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0;
 var $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0;
 var $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0;
 var $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0;
 var $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0;
 var $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0;
 var $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0;
 var $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0;
 var $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0;
 var $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0;
 var $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0;
 var $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0;
 var $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0;
 var $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0;
 var $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0;
 var $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0;
 var $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0;
 var $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0;
 var $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0;
 var $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0;
 var $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0;
 var $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0;
 var $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0;
 var $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0;
 var $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0;
 var $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0;
 var $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0;
 var $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0;
 var $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0;
 var $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0;
 var $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0;
 var $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0;
 var $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0;
 var $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0;
 var $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0;
 var $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0;
 var $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $exitcond = 0;
 var $exitcond30 = 0, $scevgep = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 704|0;
 $2 = sp + 640|0;
 $3 = sp;
 $scevgep = ((($0)) + 8|0);
 dest=$2; src=$scevgep; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $$121 = 0;
 while(1) {
  $4 = $$121 << 3;
  $5 = (($1) + ($4)|0);
  $6 = HEAP8[$5>>0]|0;
  $7 = $6&255;
  $8 = (_bitshift64Shl(($7|0),0,56)|0);
  $9 = tempRet0;
  $10 = ((($5)) + 1|0);
  $11 = HEAP8[$10>>0]|0;
  $12 = $11&255;
  $13 = (_bitshift64Shl(($12|0),0,48)|0);
  $14 = tempRet0;
  $15 = $13 | $8;
  $16 = $14 | $9;
  $17 = ((($5)) + 2|0);
  $18 = HEAP8[$17>>0]|0;
  $19 = $18&255;
  $20 = (_bitshift64Shl(($19|0),0,40)|0);
  $21 = tempRet0;
  $22 = $15 | $20;
  $23 = $16 | $21;
  $24 = ((($5)) + 3|0);
  $25 = HEAP8[$24>>0]|0;
  $26 = $25&255;
  $27 = $23 | $26;
  $28 = ((($5)) + 4|0);
  $29 = HEAP8[$28>>0]|0;
  $30 = $29&255;
  $31 = (_bitshift64Shl(($30|0),0,24)|0);
  $32 = tempRet0;
  $33 = $22 | $31;
  $34 = $27 | $32;
  $35 = ((($5)) + 5|0);
  $36 = HEAP8[$35>>0]|0;
  $37 = $36&255;
  $38 = (_bitshift64Shl(($37|0),0,16)|0);
  $39 = tempRet0;
  $40 = $33 | $38;
  $41 = $34 | $39;
  $42 = ((($5)) + 6|0);
  $43 = HEAP8[$42>>0]|0;
  $44 = $43&255;
  $45 = (_bitshift64Shl(($44|0),0,8)|0);
  $46 = tempRet0;
  $47 = $40 | $45;
  $48 = $41 | $46;
  $49 = ((($5)) + 7|0);
  $50 = HEAP8[$49>>0]|0;
  $51 = $50&255;
  $52 = $47 | $51;
  $53 = (($3) + ($$121<<3)|0);
  $54 = $53;
  $55 = $54;
  HEAP32[$55>>2] = $52;
  $56 = (($54) + 4)|0;
  $57 = $56;
  HEAP32[$57>>2] = $48;
  $58 = (($$121) + 1)|0;
  $exitcond30 = ($58|0)==(16);
  if ($exitcond30) {
   $$220 = 16;
   break;
  } else {
   $$121 = $58;
  }
 }
 while(1) {
  $114 = (($$220) + -2)|0;
  $115 = (($3) + ($114<<3)|0);
  $116 = $115;
  $117 = $116;
  $118 = HEAP32[$117>>2]|0;
  $119 = (($116) + 4)|0;
  $120 = $119;
  $121 = HEAP32[$120>>2]|0;
  $122 = (_bitshift64Lshr(($118|0),($121|0),19)|0);
  $123 = tempRet0;
  $124 = (_bitshift64Shl(($118|0),($121|0),45)|0);
  $125 = tempRet0;
  $126 = $122 | $124;
  $127 = $123 | $125;
  $128 = (_bitshift64Lshr(($118|0),($121|0),61)|0);
  $129 = tempRet0;
  $130 = (_bitshift64Shl(($118|0),($121|0),3)|0);
  $131 = tempRet0;
  $132 = $128 | $130;
  $133 = $129 | $131;
  $134 = (_bitshift64Lshr(($118|0),($121|0),6)|0);
  $135 = tempRet0;
  $136 = $132 ^ $134;
  $137 = $133 ^ $135;
  $138 = $136 ^ $126;
  $139 = $137 ^ $127;
  $140 = (($$220) + -7)|0;
  $141 = (($3) + ($140<<3)|0);
  $142 = $141;
  $143 = $142;
  $144 = HEAP32[$143>>2]|0;
  $145 = (($142) + 4)|0;
  $146 = $145;
  $147 = HEAP32[$146>>2]|0;
  $148 = (($$220) + -15)|0;
  $149 = (($3) + ($148<<3)|0);
  $150 = $149;
  $151 = $150;
  $152 = HEAP32[$151>>2]|0;
  $153 = (($150) + 4)|0;
  $154 = $153;
  $155 = HEAP32[$154>>2]|0;
  $156 = (_bitshift64Lshr(($152|0),($155|0),1)|0);
  $157 = tempRet0;
  $158 = (_bitshift64Shl(($152|0),($155|0),63)|0);
  $159 = tempRet0;
  $160 = $156 | $158;
  $161 = $157 | $159;
  $162 = (_bitshift64Lshr(($152|0),($155|0),8)|0);
  $163 = tempRet0;
  $164 = (_bitshift64Shl(($152|0),($155|0),56)|0);
  $165 = tempRet0;
  $166 = $162 | $164;
  $167 = $163 | $165;
  $168 = (_bitshift64Lshr(($152|0),($155|0),7)|0);
  $169 = tempRet0;
  $170 = $166 ^ $168;
  $171 = $167 ^ $169;
  $172 = $170 ^ $160;
  $173 = $171 ^ $161;
  $174 = (($$220) + -16)|0;
  $175 = (($3) + ($174<<3)|0);
  $176 = $175;
  $177 = $176;
  $178 = HEAP32[$177>>2]|0;
  $179 = (($176) + 4)|0;
  $180 = $179;
  $181 = HEAP32[$180>>2]|0;
  $182 = (_i64Add(($178|0),($181|0),($144|0),($147|0))|0);
  $183 = tempRet0;
  $184 = (_i64Add(($182|0),($183|0),($138|0),($139|0))|0);
  $185 = tempRet0;
  $186 = (_i64Add(($184|0),($185|0),($172|0),($173|0))|0);
  $187 = tempRet0;
  $188 = (($3) + ($$220<<3)|0);
  $189 = $188;
  $190 = $189;
  HEAP32[$190>>2] = $186;
  $191 = (($189) + 4)|0;
  $192 = $191;
  HEAP32[$192>>2] = $187;
  $193 = (($$220) + 1)|0;
  $exitcond = ($193|0)==(80);
  if ($exitcond) {
   break;
  } else {
   $$220 = $193;
  }
 }
 $59 = ((($2)) + 56|0);
 $60 = ((($2)) + 32|0);
 $61 = ((($2)) + 48|0);
 $62 = ((($2)) + 40|0);
 $63 = ((($2)) + 8|0);
 $64 = ((($2)) + 16|0);
 $65 = ((($2)) + 24|0);
 $66 = $59;
 $67 = $66;
 $68 = HEAP32[$67>>2]|0;
 $69 = (($66) + 4)|0;
 $70 = $69;
 $71 = HEAP32[$70>>2]|0;
 $72 = $60;
 $73 = $72;
 $74 = HEAP32[$73>>2]|0;
 $75 = (($72) + 4)|0;
 $76 = $75;
 $77 = HEAP32[$76>>2]|0;
 $78 = $61;
 $79 = $78;
 $80 = HEAP32[$79>>2]|0;
 $81 = (($78) + 4)|0;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = $62;
 $85 = $84;
 $86 = HEAP32[$85>>2]|0;
 $87 = (($84) + 4)|0;
 $88 = $87;
 $89 = HEAP32[$88>>2]|0;
 $90 = $2;
 $91 = $90;
 $92 = HEAP32[$91>>2]|0;
 $93 = (($90) + 4)|0;
 $94 = $93;
 $95 = HEAP32[$94>>2]|0;
 $96 = $63;
 $97 = $96;
 $98 = HEAP32[$97>>2]|0;
 $99 = (($96) + 4)|0;
 $100 = $99;
 $101 = HEAP32[$100>>2]|0;
 $102 = $64;
 $103 = $102;
 $104 = HEAP32[$103>>2]|0;
 $105 = (($102) + 4)|0;
 $106 = $105;
 $107 = HEAP32[$106>>2]|0;
 $108 = $65;
 $109 = $108;
 $110 = HEAP32[$109>>2]|0;
 $111 = (($108) + 4)|0;
 $112 = $111;
 $113 = HEAP32[$112>>2]|0;
 $$35 = 0;$194 = $74;$195 = $77;$219 = $80;$220 = $86;$222 = $83;$223 = $89;$242 = $68;$243 = $71;$252 = $92;$253 = $95;$277 = $98;$279 = $101;$281 = $104;$283 = $107;$288 = $110;$289 = $113;
 while(1) {
  $196 = (_bitshift64Lshr(($194|0),($195|0),14)|0);
  $197 = tempRet0;
  $198 = (_bitshift64Shl(($194|0),($195|0),50)|0);
  $199 = tempRet0;
  $200 = $196 | $198;
  $201 = $197 | $199;
  $202 = (_bitshift64Lshr(($194|0),($195|0),18)|0);
  $203 = tempRet0;
  $204 = (_bitshift64Shl(($194|0),($195|0),46)|0);
  $205 = tempRet0;
  $206 = $202 | $204;
  $207 = $203 | $205;
  $208 = $200 ^ $206;
  $209 = $201 ^ $207;
  $210 = (_bitshift64Lshr(($194|0),($195|0),41)|0);
  $211 = tempRet0;
  $212 = (_bitshift64Shl(($194|0),($195|0),23)|0);
  $213 = tempRet0;
  $214 = $210 | $212;
  $215 = $211 | $213;
  $216 = $208 ^ $214;
  $217 = $209 ^ $215;
  $218 = $220 ^ $219;
  $221 = $223 ^ $222;
  $224 = $218 & $194;
  $225 = $221 & $195;
  $226 = $224 ^ $219;
  $227 = $225 ^ $222;
  $228 = (80 + ($$35<<3)|0);
  $229 = $228;
  $230 = $229;
  $231 = HEAP32[$230>>2]|0;
  $232 = (($229) + 4)|0;
  $233 = $232;
  $234 = HEAP32[$233>>2]|0;
  $235 = (($3) + ($$35<<3)|0);
  $236 = $235;
  $237 = $236;
  $238 = HEAP32[$237>>2]|0;
  $239 = (($236) + 4)|0;
  $240 = $239;
  $241 = HEAP32[$240>>2]|0;
  $244 = (_i64Add(($231|0),($234|0),($242|0),($243|0))|0);
  $245 = tempRet0;
  $246 = (_i64Add(($244|0),($245|0),($216|0),($217|0))|0);
  $247 = tempRet0;
  $248 = (_i64Add(($246|0),($247|0),($238|0),($241|0))|0);
  $249 = tempRet0;
  $250 = (_i64Add(($248|0),($249|0),($226|0),($227|0))|0);
  $251 = tempRet0;
  $254 = (_bitshift64Lshr(($252|0),($253|0),28)|0);
  $255 = tempRet0;
  $256 = (_bitshift64Shl(($252|0),($253|0),36)|0);
  $257 = tempRet0;
  $258 = $254 | $256;
  $259 = $255 | $257;
  $260 = (_bitshift64Lshr(($252|0),($253|0),34)|0);
  $261 = tempRet0;
  $262 = (_bitshift64Shl(($252|0),($253|0),30)|0);
  $263 = tempRet0;
  $264 = $260 | $262;
  $265 = $261 | $263;
  $266 = $258 ^ $264;
  $267 = $259 ^ $265;
  $268 = (_bitshift64Lshr(($252|0),($253|0),39)|0);
  $269 = tempRet0;
  $270 = (_bitshift64Shl(($252|0),($253|0),25)|0);
  $271 = tempRet0;
  $272 = $268 | $270;
  $273 = $269 | $271;
  $274 = $266 ^ $272;
  $275 = $267 ^ $273;
  $276 = $277 | $252;
  $278 = $279 | $253;
  $280 = $276 & $281;
  $282 = $278 & $283;
  $284 = $277 & $252;
  $285 = $279 & $253;
  $286 = $280 | $284;
  $287 = $282 | $285;
  $290 = (_i64Add(($288|0),($289|0),($250|0),($251|0))|0);
  $291 = tempRet0;
  $292 = (_i64Add(($286|0),($287|0),($250|0),($251|0))|0);
  $293 = tempRet0;
  $294 = (_i64Add(($292|0),($293|0),($274|0),($275|0))|0);
  $295 = tempRet0;
  $296 = (_bitshift64Lshr(($290|0),($291|0),14)|0);
  $297 = tempRet0;
  $298 = (_bitshift64Shl(($290|0),($291|0),50)|0);
  $299 = tempRet0;
  $300 = $296 | $298;
  $301 = $297 | $299;
  $302 = (_bitshift64Lshr(($290|0),($291|0),18)|0);
  $303 = tempRet0;
  $304 = (_bitshift64Shl(($290|0),($291|0),46)|0);
  $305 = tempRet0;
  $306 = $302 | $304;
  $307 = $303 | $305;
  $308 = $300 ^ $306;
  $309 = $301 ^ $307;
  $310 = (_bitshift64Lshr(($290|0),($291|0),41)|0);
  $311 = tempRet0;
  $312 = (_bitshift64Shl(($290|0),($291|0),23)|0);
  $313 = tempRet0;
  $314 = $310 | $312;
  $315 = $311 | $313;
  $316 = $308 ^ $314;
  $317 = $309 ^ $315;
  $318 = $220 ^ $194;
  $319 = $223 ^ $195;
  $320 = $290 & $318;
  $321 = $291 & $319;
  $322 = $320 ^ $220;
  $323 = $321 ^ $223;
  $324 = $$35 | 1;
  $325 = (80 + ($324<<3)|0);
  $326 = $325;
  $327 = $326;
  $328 = HEAP32[$327>>2]|0;
  $329 = (($326) + 4)|0;
  $330 = $329;
  $331 = HEAP32[$330>>2]|0;
  $332 = (($3) + ($324<<3)|0);
  $333 = $332;
  $334 = $333;
  $335 = HEAP32[$334>>2]|0;
  $336 = (($333) + 4)|0;
  $337 = $336;
  $338 = HEAP32[$337>>2]|0;
  $339 = (_i64Add(($322|0),($323|0),($219|0),($222|0))|0);
  $340 = tempRet0;
  $341 = (_i64Add(($339|0),($340|0),($328|0),($331|0))|0);
  $342 = tempRet0;
  $343 = (_i64Add(($341|0),($342|0),($335|0),($338|0))|0);
  $344 = tempRet0;
  $345 = (_i64Add(($343|0),($344|0),($316|0),($317|0))|0);
  $346 = tempRet0;
  $347 = (_bitshift64Lshr(($294|0),($295|0),28)|0);
  $348 = tempRet0;
  $349 = (_bitshift64Shl(($294|0),($295|0),36)|0);
  $350 = tempRet0;
  $351 = $347 | $349;
  $352 = $348 | $350;
  $353 = (_bitshift64Lshr(($294|0),($295|0),34)|0);
  $354 = tempRet0;
  $355 = (_bitshift64Shl(($294|0),($295|0),30)|0);
  $356 = tempRet0;
  $357 = $353 | $355;
  $358 = $354 | $356;
  $359 = $351 ^ $357;
  $360 = $352 ^ $358;
  $361 = (_bitshift64Lshr(($294|0),($295|0),39)|0);
  $362 = tempRet0;
  $363 = (_bitshift64Shl(($294|0),($295|0),25)|0);
  $364 = tempRet0;
  $365 = $361 | $363;
  $366 = $362 | $364;
  $367 = $359 ^ $365;
  $368 = $360 ^ $366;
  $369 = $294 | $252;
  $370 = $295 | $253;
  $371 = $369 & $277;
  $372 = $370 & $279;
  $373 = $294 & $252;
  $374 = $295 & $253;
  $375 = $371 | $373;
  $376 = $372 | $374;
  $377 = (_i64Add(($367|0),($368|0),($375|0),($376|0))|0);
  $378 = tempRet0;
  $379 = (_i64Add(($345|0),($346|0),($281|0),($283|0))|0);
  $380 = tempRet0;
  $381 = (_i64Add(($377|0),($378|0),($345|0),($346|0))|0);
  $382 = tempRet0;
  $383 = (_bitshift64Lshr(($379|0),($380|0),14)|0);
  $384 = tempRet0;
  $385 = (_bitshift64Shl(($379|0),($380|0),50)|0);
  $386 = tempRet0;
  $387 = $383 | $385;
  $388 = $384 | $386;
  $389 = (_bitshift64Lshr(($379|0),($380|0),18)|0);
  $390 = tempRet0;
  $391 = (_bitshift64Shl(($379|0),($380|0),46)|0);
  $392 = tempRet0;
  $393 = $389 | $391;
  $394 = $390 | $392;
  $395 = $387 ^ $393;
  $396 = $388 ^ $394;
  $397 = (_bitshift64Lshr(($379|0),($380|0),41)|0);
  $398 = tempRet0;
  $399 = (_bitshift64Shl(($379|0),($380|0),23)|0);
  $400 = tempRet0;
  $401 = $397 | $399;
  $402 = $398 | $400;
  $403 = $395 ^ $401;
  $404 = $396 ^ $402;
  $405 = $290 ^ $194;
  $406 = $291 ^ $195;
  $407 = $379 & $405;
  $408 = $380 & $406;
  $409 = $407 ^ $194;
  $410 = $408 ^ $195;
  $411 = $$35 | 2;
  $412 = (80 + ($411<<3)|0);
  $413 = $412;
  $414 = $413;
  $415 = HEAP32[$414>>2]|0;
  $416 = (($413) + 4)|0;
  $417 = $416;
  $418 = HEAP32[$417>>2]|0;
  $419 = (($3) + ($411<<3)|0);
  $420 = $419;
  $421 = $420;
  $422 = HEAP32[$421>>2]|0;
  $423 = (($420) + 4)|0;
  $424 = $423;
  $425 = HEAP32[$424>>2]|0;
  $426 = (_i64Add(($415|0),($418|0),($220|0),($223|0))|0);
  $427 = tempRet0;
  $428 = (_i64Add(($426|0),($427|0),($422|0),($425|0))|0);
  $429 = tempRet0;
  $430 = (_i64Add(($428|0),($429|0),($409|0),($410|0))|0);
  $431 = tempRet0;
  $432 = (_i64Add(($430|0),($431|0),($403|0),($404|0))|0);
  $433 = tempRet0;
  $434 = (_bitshift64Lshr(($381|0),($382|0),28)|0);
  $435 = tempRet0;
  $436 = (_bitshift64Shl(($381|0),($382|0),36)|0);
  $437 = tempRet0;
  $438 = $434 | $436;
  $439 = $435 | $437;
  $440 = (_bitshift64Lshr(($381|0),($382|0),34)|0);
  $441 = tempRet0;
  $442 = (_bitshift64Shl(($381|0),($382|0),30)|0);
  $443 = tempRet0;
  $444 = $440 | $442;
  $445 = $441 | $443;
  $446 = $438 ^ $444;
  $447 = $439 ^ $445;
  $448 = (_bitshift64Lshr(($381|0),($382|0),39)|0);
  $449 = tempRet0;
  $450 = (_bitshift64Shl(($381|0),($382|0),25)|0);
  $451 = tempRet0;
  $452 = $448 | $450;
  $453 = $449 | $451;
  $454 = $446 ^ $452;
  $455 = $447 ^ $453;
  $456 = $294 | $381;
  $457 = $295 | $382;
  $458 = $456 & $252;
  $459 = $457 & $253;
  $460 = $294 & $381;
  $461 = $295 & $382;
  $462 = $458 | $460;
  $463 = $459 | $461;
  $464 = (_i64Add(($462|0),($463|0),($454|0),($455|0))|0);
  $465 = tempRet0;
  $466 = (_i64Add(($432|0),($433|0),($277|0),($279|0))|0);
  $467 = tempRet0;
  $468 = (_i64Add(($464|0),($465|0),($432|0),($433|0))|0);
  $469 = tempRet0;
  $470 = (_bitshift64Lshr(($466|0),($467|0),14)|0);
  $471 = tempRet0;
  $472 = (_bitshift64Shl(($466|0),($467|0),50)|0);
  $473 = tempRet0;
  $474 = $470 | $472;
  $475 = $471 | $473;
  $476 = (_bitshift64Lshr(($466|0),($467|0),18)|0);
  $477 = tempRet0;
  $478 = (_bitshift64Shl(($466|0),($467|0),46)|0);
  $479 = tempRet0;
  $480 = $476 | $478;
  $481 = $477 | $479;
  $482 = $474 ^ $480;
  $483 = $475 ^ $481;
  $484 = (_bitshift64Lshr(($466|0),($467|0),41)|0);
  $485 = tempRet0;
  $486 = (_bitshift64Shl(($466|0),($467|0),23)|0);
  $487 = tempRet0;
  $488 = $484 | $486;
  $489 = $485 | $487;
  $490 = $482 ^ $488;
  $491 = $483 ^ $489;
  $492 = $379 ^ $290;
  $493 = $380 ^ $291;
  $494 = $492 & $466;
  $495 = $493 & $467;
  $496 = $494 ^ $290;
  $497 = $495 ^ $291;
  $498 = $$35 | 3;
  $499 = (80 + ($498<<3)|0);
  $500 = $499;
  $501 = $500;
  $502 = HEAP32[$501>>2]|0;
  $503 = (($500) + 4)|0;
  $504 = $503;
  $505 = HEAP32[$504>>2]|0;
  $506 = (($3) + ($498<<3)|0);
  $507 = $506;
  $508 = $507;
  $509 = HEAP32[$508>>2]|0;
  $510 = (($507) + 4)|0;
  $511 = $510;
  $512 = HEAP32[$511>>2]|0;
  $513 = (_i64Add(($502|0),($505|0),($194|0),($195|0))|0);
  $514 = tempRet0;
  $515 = (_i64Add(($513|0),($514|0),($509|0),($512|0))|0);
  $516 = tempRet0;
  $517 = (_i64Add(($515|0),($516|0),($496|0),($497|0))|0);
  $518 = tempRet0;
  $519 = (_i64Add(($517|0),($518|0),($490|0),($491|0))|0);
  $520 = tempRet0;
  $521 = (_bitshift64Lshr(($468|0),($469|0),28)|0);
  $522 = tempRet0;
  $523 = (_bitshift64Shl(($468|0),($469|0),36)|0);
  $524 = tempRet0;
  $525 = $521 | $523;
  $526 = $522 | $524;
  $527 = (_bitshift64Lshr(($468|0),($469|0),34)|0);
  $528 = tempRet0;
  $529 = (_bitshift64Shl(($468|0),($469|0),30)|0);
  $530 = tempRet0;
  $531 = $527 | $529;
  $532 = $528 | $530;
  $533 = $525 ^ $531;
  $534 = $526 ^ $532;
  $535 = (_bitshift64Lshr(($468|0),($469|0),39)|0);
  $536 = tempRet0;
  $537 = (_bitshift64Shl(($468|0),($469|0),25)|0);
  $538 = tempRet0;
  $539 = $535 | $537;
  $540 = $536 | $538;
  $541 = $533 ^ $539;
  $542 = $534 ^ $540;
  $543 = $381 | $468;
  $544 = $382 | $469;
  $545 = $543 & $294;
  $546 = $544 & $295;
  $547 = $381 & $468;
  $548 = $382 & $469;
  $549 = $545 | $547;
  $550 = $546 | $548;
  $551 = (_i64Add(($549|0),($550|0),($541|0),($542|0))|0);
  $552 = tempRet0;
  $553 = (_i64Add(($519|0),($520|0),($252|0),($253|0))|0);
  $554 = tempRet0;
  $555 = (_i64Add(($551|0),($552|0),($519|0),($520|0))|0);
  $556 = tempRet0;
  $557 = (_bitshift64Lshr(($553|0),($554|0),14)|0);
  $558 = tempRet0;
  $559 = (_bitshift64Shl(($553|0),($554|0),50)|0);
  $560 = tempRet0;
  $561 = $557 | $559;
  $562 = $558 | $560;
  $563 = (_bitshift64Lshr(($553|0),($554|0),18)|0);
  $564 = tempRet0;
  $565 = (_bitshift64Shl(($553|0),($554|0),46)|0);
  $566 = tempRet0;
  $567 = $563 | $565;
  $568 = $564 | $566;
  $569 = $561 ^ $567;
  $570 = $562 ^ $568;
  $571 = (_bitshift64Lshr(($553|0),($554|0),41)|0);
  $572 = tempRet0;
  $573 = (_bitshift64Shl(($553|0),($554|0),23)|0);
  $574 = tempRet0;
  $575 = $571 | $573;
  $576 = $572 | $574;
  $577 = $569 ^ $575;
  $578 = $570 ^ $576;
  $579 = $466 ^ $379;
  $580 = $467 ^ $380;
  $581 = $579 & $553;
  $582 = $580 & $554;
  $583 = $581 ^ $379;
  $584 = $582 ^ $380;
  $585 = $$35 | 4;
  $586 = (80 + ($585<<3)|0);
  $587 = $586;
  $588 = $587;
  $589 = HEAP32[$588>>2]|0;
  $590 = (($587) + 4)|0;
  $591 = $590;
  $592 = HEAP32[$591>>2]|0;
  $593 = (($3) + ($585<<3)|0);
  $594 = $593;
  $595 = $594;
  $596 = HEAP32[$595>>2]|0;
  $597 = (($594) + 4)|0;
  $598 = $597;
  $599 = HEAP32[$598>>2]|0;
  $600 = (_i64Add(($589|0),($592|0),($290|0),($291|0))|0);
  $601 = tempRet0;
  $602 = (_i64Add(($600|0),($601|0),($596|0),($599|0))|0);
  $603 = tempRet0;
  $604 = (_i64Add(($602|0),($603|0),($577|0),($578|0))|0);
  $605 = tempRet0;
  $606 = (_i64Add(($604|0),($605|0),($583|0),($584|0))|0);
  $607 = tempRet0;
  $608 = (_bitshift64Lshr(($555|0),($556|0),28)|0);
  $609 = tempRet0;
  $610 = (_bitshift64Shl(($555|0),($556|0),36)|0);
  $611 = tempRet0;
  $612 = $608 | $610;
  $613 = $609 | $611;
  $614 = (_bitshift64Lshr(($555|0),($556|0),34)|0);
  $615 = tempRet0;
  $616 = (_bitshift64Shl(($555|0),($556|0),30)|0);
  $617 = tempRet0;
  $618 = $614 | $616;
  $619 = $615 | $617;
  $620 = $612 ^ $618;
  $621 = $613 ^ $619;
  $622 = (_bitshift64Lshr(($555|0),($556|0),39)|0);
  $623 = tempRet0;
  $624 = (_bitshift64Shl(($555|0),($556|0),25)|0);
  $625 = tempRet0;
  $626 = $622 | $624;
  $627 = $623 | $625;
  $628 = $620 ^ $626;
  $629 = $621 ^ $627;
  $630 = $468 | $555;
  $631 = $469 | $556;
  $632 = $630 & $381;
  $633 = $631 & $382;
  $634 = $468 & $555;
  $635 = $469 & $556;
  $636 = $632 | $634;
  $637 = $633 | $635;
  $638 = (_i64Add(($636|0),($637|0),($628|0),($629|0))|0);
  $639 = tempRet0;
  $640 = (_i64Add(($606|0),($607|0),($294|0),($295|0))|0);
  $641 = tempRet0;
  $642 = (_i64Add(($638|0),($639|0),($606|0),($607|0))|0);
  $643 = tempRet0;
  $644 = (_bitshift64Lshr(($640|0),($641|0),14)|0);
  $645 = tempRet0;
  $646 = (_bitshift64Shl(($640|0),($641|0),50)|0);
  $647 = tempRet0;
  $648 = $644 | $646;
  $649 = $645 | $647;
  $650 = (_bitshift64Lshr(($640|0),($641|0),18)|0);
  $651 = tempRet0;
  $652 = (_bitshift64Shl(($640|0),($641|0),46)|0);
  $653 = tempRet0;
  $654 = $650 | $652;
  $655 = $651 | $653;
  $656 = $648 ^ $654;
  $657 = $649 ^ $655;
  $658 = (_bitshift64Lshr(($640|0),($641|0),41)|0);
  $659 = tempRet0;
  $660 = (_bitshift64Shl(($640|0),($641|0),23)|0);
  $661 = tempRet0;
  $662 = $658 | $660;
  $663 = $659 | $661;
  $664 = $656 ^ $662;
  $665 = $657 ^ $663;
  $666 = $553 ^ $466;
  $667 = $554 ^ $467;
  $668 = $666 & $640;
  $669 = $667 & $641;
  $670 = $668 ^ $466;
  $671 = $669 ^ $467;
  $672 = $$35 | 5;
  $673 = (80 + ($672<<3)|0);
  $674 = $673;
  $675 = $674;
  $676 = HEAP32[$675>>2]|0;
  $677 = (($674) + 4)|0;
  $678 = $677;
  $679 = HEAP32[$678>>2]|0;
  $680 = (($3) + ($672<<3)|0);
  $681 = $680;
  $682 = $681;
  $683 = HEAP32[$682>>2]|0;
  $684 = (($681) + 4)|0;
  $685 = $684;
  $686 = HEAP32[$685>>2]|0;
  $687 = (_i64Add(($676|0),($679|0),($379|0),($380|0))|0);
  $688 = tempRet0;
  $689 = (_i64Add(($687|0),($688|0),($664|0),($665|0))|0);
  $690 = tempRet0;
  $691 = (_i64Add(($689|0),($690|0),($683|0),($686|0))|0);
  $692 = tempRet0;
  $693 = (_i64Add(($691|0),($692|0),($670|0),($671|0))|0);
  $694 = tempRet0;
  $695 = (_bitshift64Lshr(($642|0),($643|0),28)|0);
  $696 = tempRet0;
  $697 = (_bitshift64Shl(($642|0),($643|0),36)|0);
  $698 = tempRet0;
  $699 = $695 | $697;
  $700 = $696 | $698;
  $701 = (_bitshift64Lshr(($642|0),($643|0),34)|0);
  $702 = tempRet0;
  $703 = (_bitshift64Shl(($642|0),($643|0),30)|0);
  $704 = tempRet0;
  $705 = $701 | $703;
  $706 = $702 | $704;
  $707 = $699 ^ $705;
  $708 = $700 ^ $706;
  $709 = (_bitshift64Lshr(($642|0),($643|0),39)|0);
  $710 = tempRet0;
  $711 = (_bitshift64Shl(($642|0),($643|0),25)|0);
  $712 = tempRet0;
  $713 = $709 | $711;
  $714 = $710 | $712;
  $715 = $707 ^ $713;
  $716 = $708 ^ $714;
  $717 = $555 | $642;
  $718 = $556 | $643;
  $719 = $717 & $468;
  $720 = $718 & $469;
  $721 = $555 & $642;
  $722 = $556 & $643;
  $723 = $719 | $721;
  $724 = $720 | $722;
  $725 = (_i64Add(($723|0),($724|0),($715|0),($716|0))|0);
  $726 = tempRet0;
  $727 = (_i64Add(($693|0),($694|0),($381|0),($382|0))|0);
  $728 = tempRet0;
  $729 = (_i64Add(($725|0),($726|0),($693|0),($694|0))|0);
  $730 = tempRet0;
  $731 = (_bitshift64Lshr(($727|0),($728|0),14)|0);
  $732 = tempRet0;
  $733 = (_bitshift64Shl(($727|0),($728|0),50)|0);
  $734 = tempRet0;
  $735 = $731 | $733;
  $736 = $732 | $734;
  $737 = (_bitshift64Lshr(($727|0),($728|0),18)|0);
  $738 = tempRet0;
  $739 = (_bitshift64Shl(($727|0),($728|0),46)|0);
  $740 = tempRet0;
  $741 = $737 | $739;
  $742 = $738 | $740;
  $743 = $735 ^ $741;
  $744 = $736 ^ $742;
  $745 = (_bitshift64Lshr(($727|0),($728|0),41)|0);
  $746 = tempRet0;
  $747 = (_bitshift64Shl(($727|0),($728|0),23)|0);
  $748 = tempRet0;
  $749 = $745 | $747;
  $750 = $746 | $748;
  $751 = $743 ^ $749;
  $752 = $744 ^ $750;
  $753 = (_i64Add(($751|0),($752|0),($466|0),($467|0))|0);
  $754 = tempRet0;
  $755 = $640 ^ $553;
  $756 = $641 ^ $554;
  $757 = $755 & $727;
  $758 = $756 & $728;
  $759 = $757 ^ $553;
  $760 = $758 ^ $554;
  $761 = $$35 | 6;
  $762 = (80 + ($761<<3)|0);
  $763 = $762;
  $764 = $763;
  $765 = HEAP32[$764>>2]|0;
  $766 = (($763) + 4)|0;
  $767 = $766;
  $768 = HEAP32[$767>>2]|0;
  $769 = (($3) + ($761<<3)|0);
  $770 = $769;
  $771 = $770;
  $772 = HEAP32[$771>>2]|0;
  $773 = (($770) + 4)|0;
  $774 = $773;
  $775 = HEAP32[$774>>2]|0;
  $776 = (_i64Add(($753|0),($754|0),($765|0),($768|0))|0);
  $777 = tempRet0;
  $778 = (_i64Add(($776|0),($777|0),($772|0),($775|0))|0);
  $779 = tempRet0;
  $780 = (_i64Add(($778|0),($779|0),($759|0),($760|0))|0);
  $781 = tempRet0;
  $782 = (_bitshift64Lshr(($729|0),($730|0),28)|0);
  $783 = tempRet0;
  $784 = (_bitshift64Shl(($729|0),($730|0),36)|0);
  $785 = tempRet0;
  $786 = $782 | $784;
  $787 = $783 | $785;
  $788 = (_bitshift64Lshr(($729|0),($730|0),34)|0);
  $789 = tempRet0;
  $790 = (_bitshift64Shl(($729|0),($730|0),30)|0);
  $791 = tempRet0;
  $792 = $788 | $790;
  $793 = $789 | $791;
  $794 = $786 ^ $792;
  $795 = $787 ^ $793;
  $796 = (_bitshift64Lshr(($729|0),($730|0),39)|0);
  $797 = tempRet0;
  $798 = (_bitshift64Shl(($729|0),($730|0),25)|0);
  $799 = tempRet0;
  $800 = $796 | $798;
  $801 = $797 | $799;
  $802 = $794 ^ $800;
  $803 = $795 ^ $801;
  $804 = $642 | $729;
  $805 = $643 | $730;
  $806 = $804 & $555;
  $807 = $805 & $556;
  $808 = $642 & $729;
  $809 = $643 & $730;
  $810 = $806 | $808;
  $811 = $807 | $809;
  $812 = (_i64Add(($810|0),($811|0),($802|0),($803|0))|0);
  $813 = tempRet0;
  $814 = (_i64Add(($780|0),($781|0),($468|0),($469|0))|0);
  $815 = tempRet0;
  $816 = (_i64Add(($812|0),($813|0),($780|0),($781|0))|0);
  $817 = tempRet0;
  $818 = (_bitshift64Lshr(($814|0),($815|0),14)|0);
  $819 = tempRet0;
  $820 = (_bitshift64Shl(($814|0),($815|0),50)|0);
  $821 = tempRet0;
  $822 = $818 | $820;
  $823 = $819 | $821;
  $824 = (_bitshift64Lshr(($814|0),($815|0),18)|0);
  $825 = tempRet0;
  $826 = (_bitshift64Shl(($814|0),($815|0),46)|0);
  $827 = tempRet0;
  $828 = $824 | $826;
  $829 = $825 | $827;
  $830 = $822 ^ $828;
  $831 = $823 ^ $829;
  $832 = (_bitshift64Lshr(($814|0),($815|0),41)|0);
  $833 = tempRet0;
  $834 = (_bitshift64Shl(($814|0),($815|0),23)|0);
  $835 = tempRet0;
  $836 = $832 | $834;
  $837 = $833 | $835;
  $838 = $830 ^ $836;
  $839 = $831 ^ $837;
  $840 = (_i64Add(($838|0),($839|0),($553|0),($554|0))|0);
  $841 = tempRet0;
  $842 = $727 ^ $640;
  $843 = $728 ^ $641;
  $844 = $842 & $814;
  $845 = $843 & $815;
  $846 = $844 ^ $640;
  $847 = $845 ^ $641;
  $848 = $$35 | 7;
  $849 = (80 + ($848<<3)|0);
  $850 = $849;
  $851 = $850;
  $852 = HEAP32[$851>>2]|0;
  $853 = (($850) + 4)|0;
  $854 = $853;
  $855 = HEAP32[$854>>2]|0;
  $856 = (($3) + ($848<<3)|0);
  $857 = $856;
  $858 = $857;
  $859 = HEAP32[$858>>2]|0;
  $860 = (($857) + 4)|0;
  $861 = $860;
  $862 = HEAP32[$861>>2]|0;
  $863 = (_i64Add(($840|0),($841|0),($852|0),($855|0))|0);
  $864 = tempRet0;
  $865 = (_i64Add(($863|0),($864|0),($859|0),($862|0))|0);
  $866 = tempRet0;
  $867 = (_i64Add(($865|0),($866|0),($846|0),($847|0))|0);
  $868 = tempRet0;
  $869 = (_bitshift64Lshr(($816|0),($817|0),28)|0);
  $870 = tempRet0;
  $871 = (_bitshift64Shl(($816|0),($817|0),36)|0);
  $872 = tempRet0;
  $873 = $869 | $871;
  $874 = $870 | $872;
  $875 = (_bitshift64Lshr(($816|0),($817|0),34)|0);
  $876 = tempRet0;
  $877 = (_bitshift64Shl(($816|0),($817|0),30)|0);
  $878 = tempRet0;
  $879 = $875 | $877;
  $880 = $876 | $878;
  $881 = $873 ^ $879;
  $882 = $874 ^ $880;
  $883 = (_bitshift64Lshr(($816|0),($817|0),39)|0);
  $884 = tempRet0;
  $885 = (_bitshift64Shl(($816|0),($817|0),25)|0);
  $886 = tempRet0;
  $887 = $883 | $885;
  $888 = $884 | $886;
  $889 = $881 ^ $887;
  $890 = $882 ^ $888;
  $891 = $729 | $816;
  $892 = $730 | $817;
  $893 = $891 & $642;
  $894 = $892 & $643;
  $895 = $729 & $816;
  $896 = $730 & $817;
  $897 = $893 | $895;
  $898 = $894 | $896;
  $899 = (_i64Add(($897|0),($898|0),($889|0),($890|0))|0);
  $900 = tempRet0;
  $901 = (_i64Add(($867|0),($868|0),($555|0),($556|0))|0);
  $902 = tempRet0;
  $903 = (_i64Add(($899|0),($900|0),($867|0),($868|0))|0);
  $904 = tempRet0;
  $905 = (($$35) + 8)|0;
  $906 = ($905|0)<(80);
  if ($906) {
   $$35 = $905;$194 = $901;$195 = $902;$219 = $727;$220 = $814;$222 = $728;$223 = $815;$242 = $640;$243 = $641;$252 = $903;$253 = $904;$277 = $816;$279 = $817;$281 = $729;$283 = $730;$288 = $642;$289 = $643;
  } else {
   break;
  }
 }
 $907 = $59;
 $908 = $907;
 HEAP32[$908>>2] = $640;
 $909 = (($907) + 4)|0;
 $910 = $909;
 HEAP32[$910>>2] = $641;
 $911 = $60;
 $912 = $911;
 HEAP32[$912>>2] = $901;
 $913 = (($911) + 4)|0;
 $914 = $913;
 HEAP32[$914>>2] = $902;
 $915 = $61;
 $916 = $915;
 HEAP32[$916>>2] = $727;
 $917 = (($915) + 4)|0;
 $918 = $917;
 HEAP32[$918>>2] = $728;
 $919 = $62;
 $920 = $919;
 HEAP32[$920>>2] = $814;
 $921 = (($919) + 4)|0;
 $922 = $921;
 HEAP32[$922>>2] = $815;
 $923 = $2;
 $924 = $923;
 HEAP32[$924>>2] = $903;
 $925 = (($923) + 4)|0;
 $926 = $925;
 HEAP32[$926>>2] = $904;
 $927 = $63;
 $928 = $927;
 HEAP32[$928>>2] = $816;
 $929 = (($927) + 4)|0;
 $930 = $929;
 HEAP32[$930>>2] = $817;
 $931 = $64;
 $932 = $931;
 HEAP32[$932>>2] = $729;
 $933 = (($931) + 4)|0;
 $934 = $933;
 HEAP32[$934>>2] = $730;
 $935 = $65;
 $936 = $935;
 HEAP32[$936>>2] = $642;
 $937 = (($935) + 4)|0;
 $938 = $937;
 HEAP32[$938>>2] = $643;
 $939 = ((($0)) + 8|0);
 $940 = $939;
 $941 = $940;
 $942 = HEAP32[$941>>2]|0;
 $943 = (($940) + 4)|0;
 $944 = $943;
 $945 = HEAP32[$944>>2]|0;
 $946 = $2;
 $947 = $946;
 $948 = HEAP32[$947>>2]|0;
 $949 = (($946) + 4)|0;
 $950 = $949;
 $951 = HEAP32[$950>>2]|0;
 $952 = (_i64Add(($948|0),($951|0),($942|0),($945|0))|0);
 $953 = tempRet0;
 $954 = $939;
 $955 = $954;
 HEAP32[$955>>2] = $952;
 $956 = (($954) + 4)|0;
 $957 = $956;
 HEAP32[$957>>2] = $953;
 $958 = ((($0)) + 16|0);
 $959 = $958;
 $960 = $959;
 $961 = HEAP32[$960>>2]|0;
 $962 = (($959) + 4)|0;
 $963 = $962;
 $964 = HEAP32[$963>>2]|0;
 $965 = ((($2)) + 8|0);
 $966 = $965;
 $967 = $966;
 $968 = HEAP32[$967>>2]|0;
 $969 = (($966) + 4)|0;
 $970 = $969;
 $971 = HEAP32[$970>>2]|0;
 $972 = (_i64Add(($968|0),($971|0),($961|0),($964|0))|0);
 $973 = tempRet0;
 $974 = $958;
 $975 = $974;
 HEAP32[$975>>2] = $972;
 $976 = (($974) + 4)|0;
 $977 = $976;
 HEAP32[$977>>2] = $973;
 $978 = ((($0)) + 24|0);
 $979 = $978;
 $980 = $979;
 $981 = HEAP32[$980>>2]|0;
 $982 = (($979) + 4)|0;
 $983 = $982;
 $984 = HEAP32[$983>>2]|0;
 $985 = ((($2)) + 16|0);
 $986 = $985;
 $987 = $986;
 $988 = HEAP32[$987>>2]|0;
 $989 = (($986) + 4)|0;
 $990 = $989;
 $991 = HEAP32[$990>>2]|0;
 $992 = (_i64Add(($988|0),($991|0),($981|0),($984|0))|0);
 $993 = tempRet0;
 $994 = $978;
 $995 = $994;
 HEAP32[$995>>2] = $992;
 $996 = (($994) + 4)|0;
 $997 = $996;
 HEAP32[$997>>2] = $993;
 $998 = ((($0)) + 32|0);
 $999 = $998;
 $1000 = $999;
 $1001 = HEAP32[$1000>>2]|0;
 $1002 = (($999) + 4)|0;
 $1003 = $1002;
 $1004 = HEAP32[$1003>>2]|0;
 $1005 = ((($2)) + 24|0);
 $1006 = $1005;
 $1007 = $1006;
 $1008 = HEAP32[$1007>>2]|0;
 $1009 = (($1006) + 4)|0;
 $1010 = $1009;
 $1011 = HEAP32[$1010>>2]|0;
 $1012 = (_i64Add(($1008|0),($1011|0),($1001|0),($1004|0))|0);
 $1013 = tempRet0;
 $1014 = $998;
 $1015 = $1014;
 HEAP32[$1015>>2] = $1012;
 $1016 = (($1014) + 4)|0;
 $1017 = $1016;
 HEAP32[$1017>>2] = $1013;
 $1018 = ((($0)) + 40|0);
 $1019 = $1018;
 $1020 = $1019;
 $1021 = HEAP32[$1020>>2]|0;
 $1022 = (($1019) + 4)|0;
 $1023 = $1022;
 $1024 = HEAP32[$1023>>2]|0;
 $1025 = ((($2)) + 32|0);
 $1026 = $1025;
 $1027 = $1026;
 $1028 = HEAP32[$1027>>2]|0;
 $1029 = (($1026) + 4)|0;
 $1030 = $1029;
 $1031 = HEAP32[$1030>>2]|0;
 $1032 = (_i64Add(($1028|0),($1031|0),($1021|0),($1024|0))|0);
 $1033 = tempRet0;
 $1034 = $1018;
 $1035 = $1034;
 HEAP32[$1035>>2] = $1032;
 $1036 = (($1034) + 4)|0;
 $1037 = $1036;
 HEAP32[$1037>>2] = $1033;
 $1038 = ((($0)) + 48|0);
 $1039 = $1038;
 $1040 = $1039;
 $1041 = HEAP32[$1040>>2]|0;
 $1042 = (($1039) + 4)|0;
 $1043 = $1042;
 $1044 = HEAP32[$1043>>2]|0;
 $1045 = ((($2)) + 40|0);
 $1046 = $1045;
 $1047 = $1046;
 $1048 = HEAP32[$1047>>2]|0;
 $1049 = (($1046) + 4)|0;
 $1050 = $1049;
 $1051 = HEAP32[$1050>>2]|0;
 $1052 = (_i64Add(($1048|0),($1051|0),($1041|0),($1044|0))|0);
 $1053 = tempRet0;
 $1054 = $1038;
 $1055 = $1054;
 HEAP32[$1055>>2] = $1052;
 $1056 = (($1054) + 4)|0;
 $1057 = $1056;
 HEAP32[$1057>>2] = $1053;
 $1058 = ((($0)) + 56|0);
 $1059 = $1058;
 $1060 = $1059;
 $1061 = HEAP32[$1060>>2]|0;
 $1062 = (($1059) + 4)|0;
 $1063 = $1062;
 $1064 = HEAP32[$1063>>2]|0;
 $1065 = ((($2)) + 48|0);
 $1066 = $1065;
 $1067 = $1066;
 $1068 = HEAP32[$1067>>2]|0;
 $1069 = (($1066) + 4)|0;
 $1070 = $1069;
 $1071 = HEAP32[$1070>>2]|0;
 $1072 = (_i64Add(($1068|0),($1071|0),($1061|0),($1064|0))|0);
 $1073 = tempRet0;
 $1074 = $1058;
 $1075 = $1074;
 HEAP32[$1075>>2] = $1072;
 $1076 = (($1074) + 4)|0;
 $1077 = $1076;
 HEAP32[$1077>>2] = $1073;
 $1078 = ((($0)) + 64|0);
 $1079 = $1078;
 $1080 = $1079;
 $1081 = HEAP32[$1080>>2]|0;
 $1082 = (($1079) + 4)|0;
 $1083 = $1082;
 $1084 = HEAP32[$1083>>2]|0;
 $1085 = ((($2)) + 56|0);
 $1086 = $1085;
 $1087 = $1086;
 $1088 = HEAP32[$1087>>2]|0;
 $1089 = (($1086) + 4)|0;
 $1090 = $1089;
 $1091 = HEAP32[$1090>>2]|0;
 $1092 = (_i64Add(($1088|0),($1091|0),($1081|0),($1084|0))|0);
 $1093 = tempRet0;
 $1094 = $1078;
 $1095 = $1094;
 HEAP32[$1095>>2] = $1092;
 $1096 = (($1094) + 4)|0;
 $1097 = $1096;
 HEAP32[$1097>>2] = $1093;
 STACKTOP = sp;return;
}
function _sha512_final($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$068 = 0, $$071 = 0, $$pr = 0, $$pr69 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0;
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0;
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 $3 = ($1|0)==(0|0);
 $or$cond = $2 | $3;
 if ($or$cond) {
  $$068 = 1;
  return ($$068|0);
 }
 $4 = ((($0)) + 72|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5>>>0)>(127);
 if ($6) {
  $$068 = 1;
  return ($$068|0);
 }
 $7 = (_bitshift64Shl(($5|0),0,3)|0);
 $8 = tempRet0;
 $9 = $0;
 $10 = $9;
 $11 = HEAP32[$10>>2]|0;
 $12 = (($9) + 4)|0;
 $13 = $12;
 $14 = HEAP32[$13>>2]|0;
 $15 = (_i64Add(($11|0),($14|0),($7|0),($8|0))|0);
 $16 = tempRet0;
 $17 = $0;
 $18 = $17;
 HEAP32[$18>>2] = $15;
 $19 = (($17) + 4)|0;
 $20 = $19;
 HEAP32[$20>>2] = $16;
 $21 = ((($0)) + 76|0);
 $22 = (($5) + 1)|0;
 HEAP32[$4>>2] = $22;
 $23 = (((($0)) + 76|0) + ($5)|0);
 HEAP8[$23>>0] = -128;
 $24 = HEAP32[$4>>2]|0;
 $25 = ($24>>>0)>(112);
 if ($25) {
  $26 = ($24>>>0)<(128);
  if ($26) {
   $28 = $24;
   while(1) {
    $27 = (($28) + 1)|0;
    HEAP32[$4>>2] = $27;
    $29 = (((($0)) + 76|0) + ($28)|0);
    HEAP8[$29>>0] = 0;
    $$pr = HEAP32[$4>>2]|0;
    $30 = ($$pr>>>0)<(128);
    if ($30) {
     $28 = $$pr;
    } else {
     break;
    }
   }
  }
  _sha512_compress($0,$21);
  HEAP32[$4>>2] = 0;
  $32 = 0;
 } else {
  $32 = $24;
 }
 while(1) {
  $31 = (($32) + 1)|0;
  HEAP32[$4>>2] = $31;
  $33 = (((($0)) + 76|0) + ($32)|0);
  HEAP8[$33>>0] = 0;
  $$pr69 = HEAP32[$4>>2]|0;
  $34 = ($$pr69>>>0)<(120);
  if ($34) {
   $32 = $$pr69;
  } else {
   break;
  }
 }
 $35 = $0;
 $36 = $35;
 $37 = HEAP32[$36>>2]|0;
 $38 = (($35) + 4)|0;
 $39 = $38;
 $40 = HEAP32[$39>>2]|0;
 $41 = (_bitshift64Lshr(($37|0),($40|0),56)|0);
 $42 = tempRet0;
 $43 = $41&255;
 $44 = ((($0)) + 196|0);
 HEAP8[$44>>0] = $43;
 $45 = (_bitshift64Lshr(($37|0),($40|0),48)|0);
 $46 = tempRet0;
 $47 = $45&255;
 $48 = ((($0)) + 197|0);
 HEAP8[$48>>0] = $47;
 $49 = (_bitshift64Lshr(($37|0),($40|0),40)|0);
 $50 = tempRet0;
 $51 = $49&255;
 $52 = ((($0)) + 198|0);
 HEAP8[$52>>0] = $51;
 $53 = $40&255;
 $54 = ((($0)) + 199|0);
 HEAP8[$54>>0] = $53;
 $55 = (_bitshift64Lshr(($37|0),($40|0),24)|0);
 $56 = tempRet0;
 $57 = $55&255;
 $58 = ((($0)) + 200|0);
 HEAP8[$58>>0] = $57;
 $59 = (_bitshift64Lshr(($37|0),($40|0),16)|0);
 $60 = tempRet0;
 $61 = $59&255;
 $62 = ((($0)) + 201|0);
 HEAP8[$62>>0] = $61;
 $63 = (_bitshift64Lshr(($37|0),($40|0),8)|0);
 $64 = tempRet0;
 $65 = $63&255;
 $66 = ((($0)) + 202|0);
 HEAP8[$66>>0] = $65;
 $67 = $37&255;
 $68 = ((($0)) + 203|0);
 HEAP8[$68>>0] = $67;
 _sha512_compress($0,$21);
 $$071 = 0;
 while(1) {
  $69 = (((($0)) + 8|0) + ($$071<<3)|0);
  $70 = $69;
  $71 = $70;
  $72 = HEAP32[$71>>2]|0;
  $73 = (($70) + 4)|0;
  $74 = $73;
  $75 = HEAP32[$74>>2]|0;
  $76 = (_bitshift64Lshr(($72|0),($75|0),56)|0);
  $77 = tempRet0;
  $78 = $76&255;
  $79 = $$071 << 3;
  $80 = (($1) + ($79)|0);
  HEAP8[$80>>0] = $78;
  $81 = $69;
  $82 = $81;
  $83 = HEAP32[$82>>2]|0;
  $84 = (($81) + 4)|0;
  $85 = $84;
  $86 = HEAP32[$85>>2]|0;
  $87 = (_bitshift64Lshr(($83|0),($86|0),48)|0);
  $88 = tempRet0;
  $89 = $87&255;
  $90 = ((($80)) + 1|0);
  HEAP8[$90>>0] = $89;
  $91 = $69;
  $92 = $91;
  $93 = HEAP32[$92>>2]|0;
  $94 = (($91) + 4)|0;
  $95 = $94;
  $96 = HEAP32[$95>>2]|0;
  $97 = (_bitshift64Lshr(($93|0),($96|0),40)|0);
  $98 = tempRet0;
  $99 = $97&255;
  $100 = ((($80)) + 2|0);
  HEAP8[$100>>0] = $99;
  $101 = $69;
  $102 = $101;
  $103 = HEAP32[$102>>2]|0;
  $104 = (($101) + 4)|0;
  $105 = $104;
  $106 = HEAP32[$105>>2]|0;
  $107 = $106&255;
  $108 = ((($80)) + 3|0);
  HEAP8[$108>>0] = $107;
  $109 = $69;
  $110 = $109;
  $111 = HEAP32[$110>>2]|0;
  $112 = (($109) + 4)|0;
  $113 = $112;
  $114 = HEAP32[$113>>2]|0;
  $115 = (_bitshift64Lshr(($111|0),($114|0),24)|0);
  $116 = tempRet0;
  $117 = $115&255;
  $118 = ((($80)) + 4|0);
  HEAP8[$118>>0] = $117;
  $119 = $69;
  $120 = $119;
  $121 = HEAP32[$120>>2]|0;
  $122 = (($119) + 4)|0;
  $123 = $122;
  $124 = HEAP32[$123>>2]|0;
  $125 = (_bitshift64Lshr(($121|0),($124|0),16)|0);
  $126 = tempRet0;
  $127 = $125&255;
  $128 = ((($80)) + 5|0);
  HEAP8[$128>>0] = $127;
  $129 = $69;
  $130 = $129;
  $131 = HEAP32[$130>>2]|0;
  $132 = (($129) + 4)|0;
  $133 = $132;
  $134 = HEAP32[$133>>2]|0;
  $135 = (_bitshift64Lshr(($131|0),($134|0),8)|0);
  $136 = tempRet0;
  $137 = $135&255;
  $138 = ((($80)) + 6|0);
  HEAP8[$138>>0] = $137;
  $139 = $69;
  $140 = $139;
  $141 = HEAP32[$140>>2]|0;
  $142 = (($139) + 4)|0;
  $143 = $142;
  $144 = HEAP32[$143>>2]|0;
  $145 = $141&255;
  $146 = ((($80)) + 7|0);
  HEAP8[$146>>0] = $145;
  $147 = (($$071) + 1)|0;
  $exitcond = ($147|0)==(8);
  if ($exitcond) {
   $$068 = 0;
   break;
  } else {
   $$071 = $147;
  }
 }
 return ($$068|0);
}
function _sha512($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0;
 $3 = sp;
 $4 = (_sha512_init($3)|0);
 $5 = ($4|0)==(0);
 if ($5) {
  $6 = (_sha512_update($3,$0,$1)|0);
  $7 = ($6|0)==(0);
  if ($7) {
   $8 = (_sha512_final($3,$2)|0);
   $$0 = $8;
  } else {
   $$0 = $6;
  }
 } else {
  $$0 = $4;
 }
 STACKTOP = sp;return ($$0|0);
}
function _ed25519_sign($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 560|0;
 $5 = sp;
 $6 = sp + 496|0;
 $7 = sp + 432|0;
 $8 = sp + 368|0;
 $9 = sp + 208|0;
 (_sha512($4,32,$6)|0);
 $10 = HEAP8[$6>>0]|0;
 $11 = $10 & -8;
 HEAP8[$6>>0] = $11;
 $12 = ((($6)) + 31|0);
 $13 = HEAP8[$12>>0]|0;
 $14 = $13 & 63;
 $15 = $14 | 64;
 HEAP8[$12>>0] = $15;
 (_sha512_init($5)|0);
 $16 = ((($6)) + 32|0);
 (_sha512_update($5,$16,32)|0);
 (_sha512_update($5,$1,$2)|0);
 (_sha512_final($5,$8)|0);
 _sc_reduce($8);
 _ge_scalarmult_base($9,$8);
 _ge_p3_tobytes($0,$9);
 (_sha512_init($5)|0);
 (_sha512_update($5,$0,32)|0);
 (_sha512_update($5,$3,32)|0);
 (_sha512_update($5,$1,$2)|0);
 (_sha512_final($5,$7)|0);
 _sc_reduce($7);
 $17 = ((($0)) + 32|0);
 _sc_muladd($17,$7,$6,$8);
 STACKTOP = sp;return;
}
function _ed25519_verify($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$ = 0, $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 592|0;
 $4 = sp + 520|0;
 $5 = sp + 488|0;
 $6 = sp;
 $7 = sp + 328|0;
 $8 = sp + 208|0;
 $9 = ((($0)) + 63|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = ($10&255)>(31);
 if ($11) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $12 = (_ge_frombytes_negate_vartime($7,$3)|0);
 $13 = ($12|0)==(0);
 if (!($13)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 (_sha512_init($6)|0);
 (_sha512_update($6,$0,32)|0);
 (_sha512_update($6,$3,32)|0);
 (_sha512_update($6,$1,$2)|0);
 (_sha512_final($6,$4)|0);
 _sc_reduce($4);
 $14 = ((($0)) + 32|0);
 _ge_double_scalarmult_vartime($8,$4,$7,$14);
 _ge_tobytes($5,$8);
 $15 = (_consttime_equal($5,$0)|0);
 $not$ = ($15|0)!=(0);
 $$ = $not$&1;
 $$0 = $$;
 STACKTOP = sp;return ($$0|0);
}
function _consttime_equal($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = $3 ^ $2;
 $5 = ((($0)) + 1|0);
 $6 = HEAP8[$5>>0]|0;
 $7 = ((($1)) + 1|0);
 $8 = HEAP8[$7>>0]|0;
 $9 = $8 ^ $6;
 $10 = $9 | $4;
 $11 = ((($0)) + 2|0);
 $12 = HEAP8[$11>>0]|0;
 $13 = ((($1)) + 2|0);
 $14 = HEAP8[$13>>0]|0;
 $15 = $14 ^ $12;
 $16 = $10 | $15;
 $17 = ((($0)) + 3|0);
 $18 = HEAP8[$17>>0]|0;
 $19 = ((($1)) + 3|0);
 $20 = HEAP8[$19>>0]|0;
 $21 = $20 ^ $18;
 $22 = $16 | $21;
 $23 = ((($0)) + 4|0);
 $24 = HEAP8[$23>>0]|0;
 $25 = ((($1)) + 4|0);
 $26 = HEAP8[$25>>0]|0;
 $27 = $26 ^ $24;
 $28 = $22 | $27;
 $29 = ((($0)) + 5|0);
 $30 = HEAP8[$29>>0]|0;
 $31 = ((($1)) + 5|0);
 $32 = HEAP8[$31>>0]|0;
 $33 = $32 ^ $30;
 $34 = $28 | $33;
 $35 = ((($0)) + 6|0);
 $36 = HEAP8[$35>>0]|0;
 $37 = ((($1)) + 6|0);
 $38 = HEAP8[$37>>0]|0;
 $39 = $38 ^ $36;
 $40 = $34 | $39;
 $41 = ((($0)) + 7|0);
 $42 = HEAP8[$41>>0]|0;
 $43 = ((($1)) + 7|0);
 $44 = HEAP8[$43>>0]|0;
 $45 = $44 ^ $42;
 $46 = $40 | $45;
 $47 = ((($0)) + 8|0);
 $48 = HEAP8[$47>>0]|0;
 $49 = ((($1)) + 8|0);
 $50 = HEAP8[$49>>0]|0;
 $51 = $50 ^ $48;
 $52 = $46 | $51;
 $53 = ((($0)) + 9|0);
 $54 = HEAP8[$53>>0]|0;
 $55 = ((($1)) + 9|0);
 $56 = HEAP8[$55>>0]|0;
 $57 = $56 ^ $54;
 $58 = $52 | $57;
 $59 = ((($0)) + 10|0);
 $60 = HEAP8[$59>>0]|0;
 $61 = ((($1)) + 10|0);
 $62 = HEAP8[$61>>0]|0;
 $63 = $62 ^ $60;
 $64 = $58 | $63;
 $65 = ((($0)) + 11|0);
 $66 = HEAP8[$65>>0]|0;
 $67 = ((($1)) + 11|0);
 $68 = HEAP8[$67>>0]|0;
 $69 = $68 ^ $66;
 $70 = $64 | $69;
 $71 = ((($0)) + 12|0);
 $72 = HEAP8[$71>>0]|0;
 $73 = ((($1)) + 12|0);
 $74 = HEAP8[$73>>0]|0;
 $75 = $74 ^ $72;
 $76 = $70 | $75;
 $77 = ((($0)) + 13|0);
 $78 = HEAP8[$77>>0]|0;
 $79 = ((($1)) + 13|0);
 $80 = HEAP8[$79>>0]|0;
 $81 = $80 ^ $78;
 $82 = $76 | $81;
 $83 = ((($0)) + 14|0);
 $84 = HEAP8[$83>>0]|0;
 $85 = ((($1)) + 14|0);
 $86 = HEAP8[$85>>0]|0;
 $87 = $86 ^ $84;
 $88 = $82 | $87;
 $89 = ((($0)) + 15|0);
 $90 = HEAP8[$89>>0]|0;
 $91 = ((($1)) + 15|0);
 $92 = HEAP8[$91>>0]|0;
 $93 = $92 ^ $90;
 $94 = $88 | $93;
 $95 = ((($0)) + 16|0);
 $96 = HEAP8[$95>>0]|0;
 $97 = ((($1)) + 16|0);
 $98 = HEAP8[$97>>0]|0;
 $99 = $98 ^ $96;
 $100 = $94 | $99;
 $101 = ((($0)) + 17|0);
 $102 = HEAP8[$101>>0]|0;
 $103 = ((($1)) + 17|0);
 $104 = HEAP8[$103>>0]|0;
 $105 = $104 ^ $102;
 $106 = $100 | $105;
 $107 = ((($0)) + 18|0);
 $108 = HEAP8[$107>>0]|0;
 $109 = ((($1)) + 18|0);
 $110 = HEAP8[$109>>0]|0;
 $111 = $110 ^ $108;
 $112 = $106 | $111;
 $113 = ((($0)) + 19|0);
 $114 = HEAP8[$113>>0]|0;
 $115 = ((($1)) + 19|0);
 $116 = HEAP8[$115>>0]|0;
 $117 = $116 ^ $114;
 $118 = $112 | $117;
 $119 = ((($0)) + 20|0);
 $120 = HEAP8[$119>>0]|0;
 $121 = ((($1)) + 20|0);
 $122 = HEAP8[$121>>0]|0;
 $123 = $122 ^ $120;
 $124 = $118 | $123;
 $125 = ((($0)) + 21|0);
 $126 = HEAP8[$125>>0]|0;
 $127 = ((($1)) + 21|0);
 $128 = HEAP8[$127>>0]|0;
 $129 = $128 ^ $126;
 $130 = $124 | $129;
 $131 = ((($0)) + 22|0);
 $132 = HEAP8[$131>>0]|0;
 $133 = ((($1)) + 22|0);
 $134 = HEAP8[$133>>0]|0;
 $135 = $134 ^ $132;
 $136 = $130 | $135;
 $137 = ((($0)) + 23|0);
 $138 = HEAP8[$137>>0]|0;
 $139 = ((($1)) + 23|0);
 $140 = HEAP8[$139>>0]|0;
 $141 = $140 ^ $138;
 $142 = $136 | $141;
 $143 = ((($0)) + 24|0);
 $144 = HEAP8[$143>>0]|0;
 $145 = ((($1)) + 24|0);
 $146 = HEAP8[$145>>0]|0;
 $147 = $146 ^ $144;
 $148 = $142 | $147;
 $149 = ((($0)) + 25|0);
 $150 = HEAP8[$149>>0]|0;
 $151 = ((($1)) + 25|0);
 $152 = HEAP8[$151>>0]|0;
 $153 = $152 ^ $150;
 $154 = $148 | $153;
 $155 = ((($0)) + 26|0);
 $156 = HEAP8[$155>>0]|0;
 $157 = ((($1)) + 26|0);
 $158 = HEAP8[$157>>0]|0;
 $159 = $158 ^ $156;
 $160 = $154 | $159;
 $161 = ((($0)) + 27|0);
 $162 = HEAP8[$161>>0]|0;
 $163 = ((($1)) + 27|0);
 $164 = HEAP8[$163>>0]|0;
 $165 = $164 ^ $162;
 $166 = $160 | $165;
 $167 = ((($0)) + 28|0);
 $168 = HEAP8[$167>>0]|0;
 $169 = ((($1)) + 28|0);
 $170 = HEAP8[$169>>0]|0;
 $171 = $170 ^ $168;
 $172 = $166 | $171;
 $173 = ((($0)) + 29|0);
 $174 = HEAP8[$173>>0]|0;
 $175 = ((($1)) + 29|0);
 $176 = HEAP8[$175>>0]|0;
 $177 = $176 ^ $174;
 $178 = $172 | $177;
 $179 = ((($0)) + 30|0);
 $180 = HEAP8[$179>>0]|0;
 $181 = ((($1)) + 30|0);
 $182 = HEAP8[$181>>0]|0;
 $183 = $182 ^ $180;
 $184 = $178 | $183;
 $185 = ((($0)) + 31|0);
 $186 = HEAP8[$185>>0]|0;
 $187 = ((($1)) + 31|0);
 $188 = HEAP8[$187>>0]|0;
 $189 = $188 ^ $186;
 $190 = $184 | $189;
 $191 = ($190<<24>>24)==(0);
 $192 = $191&1;
 return ($192|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0172$i = 0, $$$0173$i = 0, $$$4236$i = 0, $$$4329$i = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$01$i$i = 0, $$0172$lcssa$i = 0, $$01726$i = 0, $$0173$lcssa$i = 0, $$01735$i = 0, $$0192 = 0, $$0194 = 0, $$0201$i$i = 0, $$0202$i$i = 0, $$0206$i$i = 0;
 var $$0207$i$i = 0, $$024370$i = 0, $$0260$i$i = 0, $$0261$i$i = 0, $$0262$i$i = 0, $$0268$i$i = 0, $$0269$i$i = 0, $$0320$i = 0, $$0322$i = 0, $$0323$i = 0, $$0325$i = 0, $$0331$i = 0, $$0336$i = 0, $$0337$$i = 0, $$0337$i = 0, $$0339$i = 0, $$0340$i = 0, $$0345$i = 0, $$1176$i = 0, $$1178$i = 0;
 var $$124469$i = 0, $$1264$i$i = 0, $$1266$i$i = 0, $$1321$i = 0, $$1326$i = 0, $$1341$i = 0, $$1347$i = 0, $$1351$i = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2333$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i200 = 0, $$3328$i = 0, $$3349$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$411$i = 0;
 var $$4236$i = 0, $$4329$lcssa$i = 0, $$432910$i = 0, $$4335$$4$i = 0, $$4335$ph$i = 0, $$43359$i = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i17$i = 0, $$pre$i195 = 0, $$pre$i210 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i18$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink1$i = 0;
 var $$sink1$i$i = 0, $$sink14$i = 0, $$sink2$i = 0, $$sink2$i204 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0;
 var $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0;
 var $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0;
 var $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0;
 var $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0;
 var $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0;
 var $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0;
 var $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0;
 var $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0;
 var $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0;
 var $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0;
 var $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0;
 var $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0;
 var $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0;
 var $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0;
 var $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0;
 var $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0;
 var $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0;
 var $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0;
 var $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0;
 var $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0;
 var $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0;
 var $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0;
 var $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0;
 var $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0;
 var $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0;
 var $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0;
 var $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0;
 var $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0;
 var $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0;
 var $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0;
 var $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0;
 var $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0;
 var $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0;
 var $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0;
 var $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0;
 var $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0;
 var $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0;
 var $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0;
 var $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0;
 var $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0;
 var $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0;
 var $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0;
 var $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0;
 var $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0;
 var $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0;
 var $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0;
 var $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0;
 var $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i208 = 0, $exitcond$i$i = 0, $not$$i = 0;
 var $not$$i$i = 0, $not$$i197 = 0, $not$$i209 = 0, $not$1$i = 0, $not$1$i203 = 0, $not$3$i = 0, $not$5$i = 0, $or$cond$i = 0, $or$cond$i201 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond2$i199 = 0, $or$cond49$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[9038]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (36192 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    if ($21) {
     $22 = 1 << $14;
     $23 = $22 ^ -1;
     $24 = $8 & $23;
     HEAP32[9038] = $24;
    } else {
     $25 = ((($20)) + 12|0);
     HEAP32[$25>>2] = $16;
     HEAP32[$17>>2] = $20;
    }
    $26 = $14 << 3;
    $27 = $26 | 3;
    $28 = ((($18)) + 4|0);
    HEAP32[$28>>2] = $27;
    $29 = (($18) + ($26)|0);
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $31 | 1;
    HEAP32[$30>>2] = $32;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $33 = HEAP32[(36160)>>2]|0;
   $34 = ($6>>>0)>($33>>>0);
   if ($34) {
    $35 = ($9|0)==(0);
    if (!($35)) {
     $36 = $9 << $7;
     $37 = 2 << $7;
     $38 = (0 - ($37))|0;
     $39 = $37 | $38;
     $40 = $36 & $39;
     $41 = (0 - ($40))|0;
     $42 = $40 & $41;
     $43 = (($42) + -1)|0;
     $44 = $43 >>> 12;
     $45 = $44 & 16;
     $46 = $43 >>> $45;
     $47 = $46 >>> 5;
     $48 = $47 & 8;
     $49 = $48 | $45;
     $50 = $46 >>> $48;
     $51 = $50 >>> 2;
     $52 = $51 & 4;
     $53 = $49 | $52;
     $54 = $50 >>> $52;
     $55 = $54 >>> 1;
     $56 = $55 & 2;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 1;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = (($61) + ($62))|0;
     $64 = $63 << 1;
     $65 = (36192 + ($64<<2)|0);
     $66 = ((($65)) + 8|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ($65|0)==($69|0);
     if ($70) {
      $71 = 1 << $63;
      $72 = $71 ^ -1;
      $73 = $8 & $72;
      HEAP32[9038] = $73;
      $90 = $73;
     } else {
      $74 = ((($69)) + 12|0);
      HEAP32[$74>>2] = $65;
      HEAP32[$66>>2] = $69;
      $90 = $8;
     }
     $75 = $63 << 3;
     $76 = (($75) - ($6))|0;
     $77 = $6 | 3;
     $78 = ((($67)) + 4|0);
     HEAP32[$78>>2] = $77;
     $79 = (($67) + ($6)|0);
     $80 = $76 | 1;
     $81 = ((($79)) + 4|0);
     HEAP32[$81>>2] = $80;
     $82 = (($79) + ($76)|0);
     HEAP32[$82>>2] = $76;
     $83 = ($33|0)==(0);
     if (!($83)) {
      $84 = HEAP32[(36172)>>2]|0;
      $85 = $33 >>> 3;
      $86 = $85 << 1;
      $87 = (36192 + ($86<<2)|0);
      $88 = 1 << $85;
      $89 = $90 & $88;
      $91 = ($89|0)==(0);
      if ($91) {
       $92 = $90 | $88;
       HEAP32[9038] = $92;
       $$pre = ((($87)) + 8|0);
       $$0194 = $87;$$pre$phiZ2D = $$pre;
      } else {
       $93 = ((($87)) + 8|0);
       $94 = HEAP32[$93>>2]|0;
       $$0194 = $94;$$pre$phiZ2D = $93;
      }
      HEAP32[$$pre$phiZ2D>>2] = $84;
      $95 = ((($$0194)) + 12|0);
      HEAP32[$95>>2] = $84;
      $96 = ((($84)) + 8|0);
      HEAP32[$96>>2] = $$0194;
      $97 = ((($84)) + 12|0);
      HEAP32[$97>>2] = $87;
     }
     HEAP32[(36160)>>2] = $76;
     HEAP32[(36172)>>2] = $79;
     $$0 = $68;
     STACKTOP = sp;return ($$0|0);
    }
    $98 = HEAP32[(36156)>>2]|0;
    $99 = ($98|0)==(0);
    if ($99) {
     $$0192 = $6;
    } else {
     $100 = (0 - ($98))|0;
     $101 = $98 & $100;
     $102 = (($101) + -1)|0;
     $103 = $102 >>> 12;
     $104 = $103 & 16;
     $105 = $102 >>> $104;
     $106 = $105 >>> 5;
     $107 = $106 & 8;
     $108 = $107 | $104;
     $109 = $105 >>> $107;
     $110 = $109 >>> 2;
     $111 = $110 & 4;
     $112 = $108 | $111;
     $113 = $109 >>> $111;
     $114 = $113 >>> 1;
     $115 = $114 & 2;
     $116 = $112 | $115;
     $117 = $113 >>> $115;
     $118 = $117 >>> 1;
     $119 = $118 & 1;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = (($120) + ($121))|0;
     $123 = (36456 + ($122<<2)|0);
     $124 = HEAP32[$123>>2]|0;
     $125 = ((($124)) + 4|0);
     $126 = HEAP32[$125>>2]|0;
     $127 = $126 & -8;
     $128 = (($127) - ($6))|0;
     $129 = ((($124)) + 16|0);
     $130 = HEAP32[$129>>2]|0;
     $not$3$i = ($130|0)==(0|0);
     $$sink14$i = $not$3$i&1;
     $131 = (((($124)) + 16|0) + ($$sink14$i<<2)|0);
     $132 = HEAP32[$131>>2]|0;
     $133 = ($132|0)==(0|0);
     if ($133) {
      $$0172$lcssa$i = $124;$$0173$lcssa$i = $128;
     } else {
      $$01726$i = $124;$$01735$i = $128;$135 = $132;
      while(1) {
       $134 = ((($135)) + 4|0);
       $136 = HEAP32[$134>>2]|0;
       $137 = $136 & -8;
       $138 = (($137) - ($6))|0;
       $139 = ($138>>>0)<($$01735$i>>>0);
       $$$0173$i = $139 ? $138 : $$01735$i;
       $$$0172$i = $139 ? $135 : $$01726$i;
       $140 = ((($135)) + 16|0);
       $141 = HEAP32[$140>>2]|0;
       $not$$i = ($141|0)==(0|0);
       $$sink1$i = $not$$i&1;
       $142 = (((($135)) + 16|0) + ($$sink1$i<<2)|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        $$0172$lcssa$i = $$$0172$i;$$0173$lcssa$i = $$$0173$i;
        break;
       } else {
        $$01726$i = $$$0172$i;$$01735$i = $$$0173$i;$135 = $143;
       }
      }
     }
     $145 = (($$0172$lcssa$i) + ($6)|0);
     $146 = ($$0172$lcssa$i>>>0)<($145>>>0);
     if ($146) {
      $147 = ((($$0172$lcssa$i)) + 24|0);
      $148 = HEAP32[$147>>2]|0;
      $149 = ((($$0172$lcssa$i)) + 12|0);
      $150 = HEAP32[$149>>2]|0;
      $151 = ($150|0)==($$0172$lcssa$i|0);
      do {
       if ($151) {
        $156 = ((($$0172$lcssa$i)) + 20|0);
        $157 = HEAP32[$156>>2]|0;
        $158 = ($157|0)==(0|0);
        if ($158) {
         $159 = ((($$0172$lcssa$i)) + 16|0);
         $160 = HEAP32[$159>>2]|0;
         $161 = ($160|0)==(0|0);
         if ($161) {
          $$3$i = 0;
          break;
         } else {
          $$1176$i = $160;$$1178$i = $159;
         }
        } else {
         $$1176$i = $157;$$1178$i = $156;
        }
        while(1) {
         $162 = ((($$1176$i)) + 20|0);
         $163 = HEAP32[$162>>2]|0;
         $164 = ($163|0)==(0|0);
         if (!($164)) {
          $$1176$i = $163;$$1178$i = $162;
          continue;
         }
         $165 = ((($$1176$i)) + 16|0);
         $166 = HEAP32[$165>>2]|0;
         $167 = ($166|0)==(0|0);
         if ($167) {
          break;
         } else {
          $$1176$i = $166;$$1178$i = $165;
         }
        }
        HEAP32[$$1178$i>>2] = 0;
        $$3$i = $$1176$i;
       } else {
        $152 = ((($$0172$lcssa$i)) + 8|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ((($153)) + 12|0);
        HEAP32[$154>>2] = $150;
        $155 = ((($150)) + 8|0);
        HEAP32[$155>>2] = $153;
        $$3$i = $150;
       }
      } while(0);
      $168 = ($148|0)==(0|0);
      do {
       if (!($168)) {
        $169 = ((($$0172$lcssa$i)) + 28|0);
        $170 = HEAP32[$169>>2]|0;
        $171 = (36456 + ($170<<2)|0);
        $172 = HEAP32[$171>>2]|0;
        $173 = ($$0172$lcssa$i|0)==($172|0);
        if ($173) {
         HEAP32[$171>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $174 = 1 << $170;
          $175 = $174 ^ -1;
          $176 = $98 & $175;
          HEAP32[(36156)>>2] = $176;
          break;
         }
        } else {
         $177 = ((($148)) + 16|0);
         $178 = HEAP32[$177>>2]|0;
         $not$1$i = ($178|0)!=($$0172$lcssa$i|0);
         $$sink2$i = $not$1$i&1;
         $179 = (((($148)) + 16|0) + ($$sink2$i<<2)|0);
         HEAP32[$179>>2] = $$3$i;
         $180 = ($$3$i|0)==(0|0);
         if ($180) {
          break;
         }
        }
        $181 = ((($$3$i)) + 24|0);
        HEAP32[$181>>2] = $148;
        $182 = ((($$0172$lcssa$i)) + 16|0);
        $183 = HEAP32[$182>>2]|0;
        $184 = ($183|0)==(0|0);
        if (!($184)) {
         $185 = ((($$3$i)) + 16|0);
         HEAP32[$185>>2] = $183;
         $186 = ((($183)) + 24|0);
         HEAP32[$186>>2] = $$3$i;
        }
        $187 = ((($$0172$lcssa$i)) + 20|0);
        $188 = HEAP32[$187>>2]|0;
        $189 = ($188|0)==(0|0);
        if (!($189)) {
         $190 = ((($$3$i)) + 20|0);
         HEAP32[$190>>2] = $188;
         $191 = ((($188)) + 24|0);
         HEAP32[$191>>2] = $$3$i;
        }
       }
      } while(0);
      $192 = ($$0173$lcssa$i>>>0)<(16);
      if ($192) {
       $193 = (($$0173$lcssa$i) + ($6))|0;
       $194 = $193 | 3;
       $195 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$195>>2] = $194;
       $196 = (($$0172$lcssa$i) + ($193)|0);
       $197 = ((($196)) + 4|0);
       $198 = HEAP32[$197>>2]|0;
       $199 = $198 | 1;
       HEAP32[$197>>2] = $199;
      } else {
       $200 = $6 | 3;
       $201 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$201>>2] = $200;
       $202 = $$0173$lcssa$i | 1;
       $203 = ((($145)) + 4|0);
       HEAP32[$203>>2] = $202;
       $204 = (($145) + ($$0173$lcssa$i)|0);
       HEAP32[$204>>2] = $$0173$lcssa$i;
       $205 = ($33|0)==(0);
       if (!($205)) {
        $206 = HEAP32[(36172)>>2]|0;
        $207 = $33 >>> 3;
        $208 = $207 << 1;
        $209 = (36192 + ($208<<2)|0);
        $210 = 1 << $207;
        $211 = $8 & $210;
        $212 = ($211|0)==(0);
        if ($212) {
         $213 = $8 | $210;
         HEAP32[9038] = $213;
         $$pre$i = ((($209)) + 8|0);
         $$0$i = $209;$$pre$phi$iZ2D = $$pre$i;
        } else {
         $214 = ((($209)) + 8|0);
         $215 = HEAP32[$214>>2]|0;
         $$0$i = $215;$$pre$phi$iZ2D = $214;
        }
        HEAP32[$$pre$phi$iZ2D>>2] = $206;
        $216 = ((($$0$i)) + 12|0);
        HEAP32[$216>>2] = $206;
        $217 = ((($206)) + 8|0);
        HEAP32[$217>>2] = $$0$i;
        $218 = ((($206)) + 12|0);
        HEAP32[$218>>2] = $209;
       }
       HEAP32[(36160)>>2] = $$0173$lcssa$i;
       HEAP32[(36172)>>2] = $145;
      }
      $219 = ((($$0172$lcssa$i)) + 8|0);
      $$0 = $219;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0192 = $6;
     }
    }
   } else {
    $$0192 = $6;
   }
  } else {
   $220 = ($0>>>0)>(4294967231);
   if ($220) {
    $$0192 = -1;
   } else {
    $221 = (($0) + 11)|0;
    $222 = $221 & -8;
    $223 = HEAP32[(36156)>>2]|0;
    $224 = ($223|0)==(0);
    if ($224) {
     $$0192 = $222;
    } else {
     $225 = (0 - ($222))|0;
     $226 = $221 >>> 8;
     $227 = ($226|0)==(0);
     if ($227) {
      $$0336$i = 0;
     } else {
      $228 = ($222>>>0)>(16777215);
      if ($228) {
       $$0336$i = 31;
      } else {
       $229 = (($226) + 1048320)|0;
       $230 = $229 >>> 16;
       $231 = $230 & 8;
       $232 = $226 << $231;
       $233 = (($232) + 520192)|0;
       $234 = $233 >>> 16;
       $235 = $234 & 4;
       $236 = $235 | $231;
       $237 = $232 << $235;
       $238 = (($237) + 245760)|0;
       $239 = $238 >>> 16;
       $240 = $239 & 2;
       $241 = $236 | $240;
       $242 = (14 - ($241))|0;
       $243 = $237 << $240;
       $244 = $243 >>> 15;
       $245 = (($242) + ($244))|0;
       $246 = $245 << 1;
       $247 = (($245) + 7)|0;
       $248 = $222 >>> $247;
       $249 = $248 & 1;
       $250 = $249 | $246;
       $$0336$i = $250;
      }
     }
     $251 = (36456 + ($$0336$i<<2)|0);
     $252 = HEAP32[$251>>2]|0;
     $253 = ($252|0)==(0|0);
     L74: do {
      if ($253) {
       $$2333$i = 0;$$3$i200 = 0;$$3328$i = $225;
       label = 57;
      } else {
       $254 = ($$0336$i|0)==(31);
       $255 = $$0336$i >>> 1;
       $256 = (25 - ($255))|0;
       $257 = $254 ? 0 : $256;
       $258 = $222 << $257;
       $$0320$i = 0;$$0325$i = $225;$$0331$i = $252;$$0337$i = $258;$$0340$i = 0;
       while(1) {
        $259 = ((($$0331$i)) + 4|0);
        $260 = HEAP32[$259>>2]|0;
        $261 = $260 & -8;
        $262 = (($261) - ($222))|0;
        $263 = ($262>>>0)<($$0325$i>>>0);
        if ($263) {
         $264 = ($262|0)==(0);
         if ($264) {
          $$411$i = $$0331$i;$$432910$i = 0;$$43359$i = $$0331$i;
          label = 61;
          break L74;
         } else {
          $$1321$i = $$0331$i;$$1326$i = $262;
         }
        } else {
         $$1321$i = $$0320$i;$$1326$i = $$0325$i;
        }
        $265 = ((($$0331$i)) + 20|0);
        $266 = HEAP32[$265>>2]|0;
        $267 = $$0337$i >>> 31;
        $268 = (((($$0331$i)) + 16|0) + ($267<<2)|0);
        $269 = HEAP32[$268>>2]|0;
        $270 = ($266|0)==(0|0);
        $271 = ($266|0)==($269|0);
        $or$cond2$i199 = $270 | $271;
        $$1341$i = $or$cond2$i199 ? $$0340$i : $266;
        $272 = ($269|0)==(0|0);
        $not$5$i = $272 ^ 1;
        $273 = $not$5$i&1;
        $$0337$$i = $$0337$i << $273;
        if ($272) {
         $$2333$i = $$1341$i;$$3$i200 = $$1321$i;$$3328$i = $$1326$i;
         label = 57;
         break;
        } else {
         $$0320$i = $$1321$i;$$0325$i = $$1326$i;$$0331$i = $269;$$0337$i = $$0337$$i;$$0340$i = $$1341$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 57) {
      $274 = ($$2333$i|0)==(0|0);
      $275 = ($$3$i200|0)==(0|0);
      $or$cond$i201 = $274 & $275;
      if ($or$cond$i201) {
       $276 = 2 << $$0336$i;
       $277 = (0 - ($276))|0;
       $278 = $276 | $277;
       $279 = $223 & $278;
       $280 = ($279|0)==(0);
       if ($280) {
        $$0192 = $222;
        break;
       }
       $281 = (0 - ($279))|0;
       $282 = $279 & $281;
       $283 = (($282) + -1)|0;
       $284 = $283 >>> 12;
       $285 = $284 & 16;
       $286 = $283 >>> $285;
       $287 = $286 >>> 5;
       $288 = $287 & 8;
       $289 = $288 | $285;
       $290 = $286 >>> $288;
       $291 = $290 >>> 2;
       $292 = $291 & 4;
       $293 = $289 | $292;
       $294 = $290 >>> $292;
       $295 = $294 >>> 1;
       $296 = $295 & 2;
       $297 = $293 | $296;
       $298 = $294 >>> $296;
       $299 = $298 >>> 1;
       $300 = $299 & 1;
       $301 = $297 | $300;
       $302 = $298 >>> $300;
       $303 = (($301) + ($302))|0;
       $304 = (36456 + ($303<<2)|0);
       $305 = HEAP32[$304>>2]|0;
       $$4$ph$i = 0;$$4335$ph$i = $305;
      } else {
       $$4$ph$i = $$3$i200;$$4335$ph$i = $$2333$i;
      }
      $306 = ($$4335$ph$i|0)==(0|0);
      if ($306) {
       $$4$lcssa$i = $$4$ph$i;$$4329$lcssa$i = $$3328$i;
      } else {
       $$411$i = $$4$ph$i;$$432910$i = $$3328$i;$$43359$i = $$4335$ph$i;
       label = 61;
      }
     }
     if ((label|0) == 61) {
      while(1) {
       label = 0;
       $307 = ((($$43359$i)) + 4|0);
       $308 = HEAP32[$307>>2]|0;
       $309 = $308 & -8;
       $310 = (($309) - ($222))|0;
       $311 = ($310>>>0)<($$432910$i>>>0);
       $$$4329$i = $311 ? $310 : $$432910$i;
       $$4335$$4$i = $311 ? $$43359$i : $$411$i;
       $312 = ((($$43359$i)) + 16|0);
       $313 = HEAP32[$312>>2]|0;
       $not$1$i203 = ($313|0)==(0|0);
       $$sink2$i204 = $not$1$i203&1;
       $314 = (((($$43359$i)) + 16|0) + ($$sink2$i204<<2)|0);
       $315 = HEAP32[$314>>2]|0;
       $316 = ($315|0)==(0|0);
       if ($316) {
        $$4$lcssa$i = $$4335$$4$i;$$4329$lcssa$i = $$$4329$i;
        break;
       } else {
        $$411$i = $$4335$$4$i;$$432910$i = $$$4329$i;$$43359$i = $315;
        label = 61;
       }
      }
     }
     $317 = ($$4$lcssa$i|0)==(0|0);
     if ($317) {
      $$0192 = $222;
     } else {
      $318 = HEAP32[(36160)>>2]|0;
      $319 = (($318) - ($222))|0;
      $320 = ($$4329$lcssa$i>>>0)<($319>>>0);
      if ($320) {
       $321 = (($$4$lcssa$i) + ($222)|0);
       $322 = ($$4$lcssa$i>>>0)<($321>>>0);
       if (!($322)) {
        $$0 = 0;
        STACKTOP = sp;return ($$0|0);
       }
       $323 = ((($$4$lcssa$i)) + 24|0);
       $324 = HEAP32[$323>>2]|0;
       $325 = ((($$4$lcssa$i)) + 12|0);
       $326 = HEAP32[$325>>2]|0;
       $327 = ($326|0)==($$4$lcssa$i|0);
       do {
        if ($327) {
         $332 = ((($$4$lcssa$i)) + 20|0);
         $333 = HEAP32[$332>>2]|0;
         $334 = ($333|0)==(0|0);
         if ($334) {
          $335 = ((($$4$lcssa$i)) + 16|0);
          $336 = HEAP32[$335>>2]|0;
          $337 = ($336|0)==(0|0);
          if ($337) {
           $$3349$i = 0;
           break;
          } else {
           $$1347$i = $336;$$1351$i = $335;
          }
         } else {
          $$1347$i = $333;$$1351$i = $332;
         }
         while(1) {
          $338 = ((($$1347$i)) + 20|0);
          $339 = HEAP32[$338>>2]|0;
          $340 = ($339|0)==(0|0);
          if (!($340)) {
           $$1347$i = $339;$$1351$i = $338;
           continue;
          }
          $341 = ((($$1347$i)) + 16|0);
          $342 = HEAP32[$341>>2]|0;
          $343 = ($342|0)==(0|0);
          if ($343) {
           break;
          } else {
           $$1347$i = $342;$$1351$i = $341;
          }
         }
         HEAP32[$$1351$i>>2] = 0;
         $$3349$i = $$1347$i;
        } else {
         $328 = ((($$4$lcssa$i)) + 8|0);
         $329 = HEAP32[$328>>2]|0;
         $330 = ((($329)) + 12|0);
         HEAP32[$330>>2] = $326;
         $331 = ((($326)) + 8|0);
         HEAP32[$331>>2] = $329;
         $$3349$i = $326;
        }
       } while(0);
       $344 = ($324|0)==(0|0);
       do {
        if ($344) {
         $426 = $223;
        } else {
         $345 = ((($$4$lcssa$i)) + 28|0);
         $346 = HEAP32[$345>>2]|0;
         $347 = (36456 + ($346<<2)|0);
         $348 = HEAP32[$347>>2]|0;
         $349 = ($$4$lcssa$i|0)==($348|0);
         if ($349) {
          HEAP32[$347>>2] = $$3349$i;
          $cond$i208 = ($$3349$i|0)==(0|0);
          if ($cond$i208) {
           $350 = 1 << $346;
           $351 = $350 ^ -1;
           $352 = $223 & $351;
           HEAP32[(36156)>>2] = $352;
           $426 = $352;
           break;
          }
         } else {
          $353 = ((($324)) + 16|0);
          $354 = HEAP32[$353>>2]|0;
          $not$$i209 = ($354|0)!=($$4$lcssa$i|0);
          $$sink3$i = $not$$i209&1;
          $355 = (((($324)) + 16|0) + ($$sink3$i<<2)|0);
          HEAP32[$355>>2] = $$3349$i;
          $356 = ($$3349$i|0)==(0|0);
          if ($356) {
           $426 = $223;
           break;
          }
         }
         $357 = ((($$3349$i)) + 24|0);
         HEAP32[$357>>2] = $324;
         $358 = ((($$4$lcssa$i)) + 16|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==(0|0);
         if (!($360)) {
          $361 = ((($$3349$i)) + 16|0);
          HEAP32[$361>>2] = $359;
          $362 = ((($359)) + 24|0);
          HEAP32[$362>>2] = $$3349$i;
         }
         $363 = ((($$4$lcssa$i)) + 20|0);
         $364 = HEAP32[$363>>2]|0;
         $365 = ($364|0)==(0|0);
         if ($365) {
          $426 = $223;
         } else {
          $366 = ((($$3349$i)) + 20|0);
          HEAP32[$366>>2] = $364;
          $367 = ((($364)) + 24|0);
          HEAP32[$367>>2] = $$3349$i;
          $426 = $223;
         }
        }
       } while(0);
       $368 = ($$4329$lcssa$i>>>0)<(16);
       do {
        if ($368) {
         $369 = (($$4329$lcssa$i) + ($222))|0;
         $370 = $369 | 3;
         $371 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$371>>2] = $370;
         $372 = (($$4$lcssa$i) + ($369)|0);
         $373 = ((($372)) + 4|0);
         $374 = HEAP32[$373>>2]|0;
         $375 = $374 | 1;
         HEAP32[$373>>2] = $375;
        } else {
         $376 = $222 | 3;
         $377 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$377>>2] = $376;
         $378 = $$4329$lcssa$i | 1;
         $379 = ((($321)) + 4|0);
         HEAP32[$379>>2] = $378;
         $380 = (($321) + ($$4329$lcssa$i)|0);
         HEAP32[$380>>2] = $$4329$lcssa$i;
         $381 = $$4329$lcssa$i >>> 3;
         $382 = ($$4329$lcssa$i>>>0)<(256);
         if ($382) {
          $383 = $381 << 1;
          $384 = (36192 + ($383<<2)|0);
          $385 = HEAP32[9038]|0;
          $386 = 1 << $381;
          $387 = $385 & $386;
          $388 = ($387|0)==(0);
          if ($388) {
           $389 = $385 | $386;
           HEAP32[9038] = $389;
           $$pre$i210 = ((($384)) + 8|0);
           $$0345$i = $384;$$pre$phi$i211Z2D = $$pre$i210;
          } else {
           $390 = ((($384)) + 8|0);
           $391 = HEAP32[$390>>2]|0;
           $$0345$i = $391;$$pre$phi$i211Z2D = $390;
          }
          HEAP32[$$pre$phi$i211Z2D>>2] = $321;
          $392 = ((($$0345$i)) + 12|0);
          HEAP32[$392>>2] = $321;
          $393 = ((($321)) + 8|0);
          HEAP32[$393>>2] = $$0345$i;
          $394 = ((($321)) + 12|0);
          HEAP32[$394>>2] = $384;
          break;
         }
         $395 = $$4329$lcssa$i >>> 8;
         $396 = ($395|0)==(0);
         if ($396) {
          $$0339$i = 0;
         } else {
          $397 = ($$4329$lcssa$i>>>0)>(16777215);
          if ($397) {
           $$0339$i = 31;
          } else {
           $398 = (($395) + 1048320)|0;
           $399 = $398 >>> 16;
           $400 = $399 & 8;
           $401 = $395 << $400;
           $402 = (($401) + 520192)|0;
           $403 = $402 >>> 16;
           $404 = $403 & 4;
           $405 = $404 | $400;
           $406 = $401 << $404;
           $407 = (($406) + 245760)|0;
           $408 = $407 >>> 16;
           $409 = $408 & 2;
           $410 = $405 | $409;
           $411 = (14 - ($410))|0;
           $412 = $406 << $409;
           $413 = $412 >>> 15;
           $414 = (($411) + ($413))|0;
           $415 = $414 << 1;
           $416 = (($414) + 7)|0;
           $417 = $$4329$lcssa$i >>> $416;
           $418 = $417 & 1;
           $419 = $418 | $415;
           $$0339$i = $419;
          }
         }
         $420 = (36456 + ($$0339$i<<2)|0);
         $421 = ((($321)) + 28|0);
         HEAP32[$421>>2] = $$0339$i;
         $422 = ((($321)) + 16|0);
         $423 = ((($422)) + 4|0);
         HEAP32[$423>>2] = 0;
         HEAP32[$422>>2] = 0;
         $424 = 1 << $$0339$i;
         $425 = $426 & $424;
         $427 = ($425|0)==(0);
         if ($427) {
          $428 = $426 | $424;
          HEAP32[(36156)>>2] = $428;
          HEAP32[$420>>2] = $321;
          $429 = ((($321)) + 24|0);
          HEAP32[$429>>2] = $420;
          $430 = ((($321)) + 12|0);
          HEAP32[$430>>2] = $321;
          $431 = ((($321)) + 8|0);
          HEAP32[$431>>2] = $321;
          break;
         }
         $432 = HEAP32[$420>>2]|0;
         $433 = ($$0339$i|0)==(31);
         $434 = $$0339$i >>> 1;
         $435 = (25 - ($434))|0;
         $436 = $433 ? 0 : $435;
         $437 = $$4329$lcssa$i << $436;
         $$0322$i = $437;$$0323$i = $432;
         while(1) {
          $438 = ((($$0323$i)) + 4|0);
          $439 = HEAP32[$438>>2]|0;
          $440 = $439 & -8;
          $441 = ($440|0)==($$4329$lcssa$i|0);
          if ($441) {
           label = 97;
           break;
          }
          $442 = $$0322$i >>> 31;
          $443 = (((($$0323$i)) + 16|0) + ($442<<2)|0);
          $444 = $$0322$i << 1;
          $445 = HEAP32[$443>>2]|0;
          $446 = ($445|0)==(0|0);
          if ($446) {
           label = 96;
           break;
          } else {
           $$0322$i = $444;$$0323$i = $445;
          }
         }
         if ((label|0) == 96) {
          HEAP32[$443>>2] = $321;
          $447 = ((($321)) + 24|0);
          HEAP32[$447>>2] = $$0323$i;
          $448 = ((($321)) + 12|0);
          HEAP32[$448>>2] = $321;
          $449 = ((($321)) + 8|0);
          HEAP32[$449>>2] = $321;
          break;
         }
         else if ((label|0) == 97) {
          $450 = ((($$0323$i)) + 8|0);
          $451 = HEAP32[$450>>2]|0;
          $452 = ((($451)) + 12|0);
          HEAP32[$452>>2] = $321;
          HEAP32[$450>>2] = $321;
          $453 = ((($321)) + 8|0);
          HEAP32[$453>>2] = $451;
          $454 = ((($321)) + 12|0);
          HEAP32[$454>>2] = $$0323$i;
          $455 = ((($321)) + 24|0);
          HEAP32[$455>>2] = 0;
          break;
         }
        }
       } while(0);
       $456 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $456;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0192 = $222;
      }
     }
    }
   }
  }
 } while(0);
 $457 = HEAP32[(36160)>>2]|0;
 $458 = ($457>>>0)<($$0192>>>0);
 if (!($458)) {
  $459 = (($457) - ($$0192))|0;
  $460 = HEAP32[(36172)>>2]|0;
  $461 = ($459>>>0)>(15);
  if ($461) {
   $462 = (($460) + ($$0192)|0);
   HEAP32[(36172)>>2] = $462;
   HEAP32[(36160)>>2] = $459;
   $463 = $459 | 1;
   $464 = ((($462)) + 4|0);
   HEAP32[$464>>2] = $463;
   $465 = (($462) + ($459)|0);
   HEAP32[$465>>2] = $459;
   $466 = $$0192 | 3;
   $467 = ((($460)) + 4|0);
   HEAP32[$467>>2] = $466;
  } else {
   HEAP32[(36160)>>2] = 0;
   HEAP32[(36172)>>2] = 0;
   $468 = $457 | 3;
   $469 = ((($460)) + 4|0);
   HEAP32[$469>>2] = $468;
   $470 = (($460) + ($457)|0);
   $471 = ((($470)) + 4|0);
   $472 = HEAP32[$471>>2]|0;
   $473 = $472 | 1;
   HEAP32[$471>>2] = $473;
  }
  $474 = ((($460)) + 8|0);
  $$0 = $474;
  STACKTOP = sp;return ($$0|0);
 }
 $475 = HEAP32[(36164)>>2]|0;
 $476 = ($475>>>0)>($$0192>>>0);
 if ($476) {
  $477 = (($475) - ($$0192))|0;
  HEAP32[(36164)>>2] = $477;
  $478 = HEAP32[(36176)>>2]|0;
  $479 = (($478) + ($$0192)|0);
  HEAP32[(36176)>>2] = $479;
  $480 = $477 | 1;
  $481 = ((($479)) + 4|0);
  HEAP32[$481>>2] = $480;
  $482 = $$0192 | 3;
  $483 = ((($478)) + 4|0);
  HEAP32[$483>>2] = $482;
  $484 = ((($478)) + 8|0);
  $$0 = $484;
  STACKTOP = sp;return ($$0|0);
 }
 $485 = HEAP32[9156]|0;
 $486 = ($485|0)==(0);
 if ($486) {
  HEAP32[(36632)>>2] = 4096;
  HEAP32[(36628)>>2] = 4096;
  HEAP32[(36636)>>2] = -1;
  HEAP32[(36640)>>2] = -1;
  HEAP32[(36644)>>2] = 0;
  HEAP32[(36596)>>2] = 0;
  $487 = $1;
  $488 = $487 & -16;
  $489 = $488 ^ 1431655768;
  HEAP32[$1>>2] = $489;
  HEAP32[9156] = $489;
  $493 = 4096;
 } else {
  $$pre$i195 = HEAP32[(36632)>>2]|0;
  $493 = $$pre$i195;
 }
 $490 = (($$0192) + 48)|0;
 $491 = (($$0192) + 47)|0;
 $492 = (($493) + ($491))|0;
 $494 = (0 - ($493))|0;
 $495 = $492 & $494;
 $496 = ($495>>>0)>($$0192>>>0);
 if (!($496)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $497 = HEAP32[(36592)>>2]|0;
 $498 = ($497|0)==(0);
 if (!($498)) {
  $499 = HEAP32[(36584)>>2]|0;
  $500 = (($499) + ($495))|0;
  $501 = ($500>>>0)<=($499>>>0);
  $502 = ($500>>>0)>($497>>>0);
  $or$cond1$i = $501 | $502;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $503 = HEAP32[(36596)>>2]|0;
 $504 = $503 & 4;
 $505 = ($504|0)==(0);
 L167: do {
  if ($505) {
   $506 = HEAP32[(36176)>>2]|0;
   $507 = ($506|0)==(0|0);
   L169: do {
    if ($507) {
     label = 118;
    } else {
     $$0$i20$i = (36600);
     while(1) {
      $508 = HEAP32[$$0$i20$i>>2]|0;
      $509 = ($508>>>0)>($506>>>0);
      if (!($509)) {
       $510 = ((($$0$i20$i)) + 4|0);
       $511 = HEAP32[$510>>2]|0;
       $512 = (($508) + ($511)|0);
       $513 = ($512>>>0)>($506>>>0);
       if ($513) {
        break;
       }
      }
      $514 = ((($$0$i20$i)) + 8|0);
      $515 = HEAP32[$514>>2]|0;
      $516 = ($515|0)==(0|0);
      if ($516) {
       label = 118;
       break L169;
      } else {
       $$0$i20$i = $515;
      }
     }
     $539 = (($492) - ($475))|0;
     $540 = $539 & $494;
     $541 = ($540>>>0)<(2147483647);
     if ($541) {
      $542 = (_sbrk(($540|0))|0);
      $543 = HEAP32[$$0$i20$i>>2]|0;
      $544 = HEAP32[$510>>2]|0;
      $545 = (($543) + ($544)|0);
      $546 = ($542|0)==($545|0);
      if ($546) {
       $547 = ($542|0)==((-1)|0);
       if ($547) {
        $$2234243136$i = $540;
       } else {
        $$723947$i = $540;$$748$i = $542;
        label = 135;
        break L167;
       }
      } else {
       $$2247$ph$i = $542;$$2253$ph$i = $540;
       label = 126;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 118) {
     $517 = (_sbrk(0)|0);
     $518 = ($517|0)==((-1)|0);
     if ($518) {
      $$2234243136$i = 0;
     } else {
      $519 = $517;
      $520 = HEAP32[(36628)>>2]|0;
      $521 = (($520) + -1)|0;
      $522 = $521 & $519;
      $523 = ($522|0)==(0);
      $524 = (($521) + ($519))|0;
      $525 = (0 - ($520))|0;
      $526 = $524 & $525;
      $527 = (($526) - ($519))|0;
      $528 = $523 ? 0 : $527;
      $$$i = (($528) + ($495))|0;
      $529 = HEAP32[(36584)>>2]|0;
      $530 = (($$$i) + ($529))|0;
      $531 = ($$$i>>>0)>($$0192>>>0);
      $532 = ($$$i>>>0)<(2147483647);
      $or$cond$i = $531 & $532;
      if ($or$cond$i) {
       $533 = HEAP32[(36592)>>2]|0;
       $534 = ($533|0)==(0);
       if (!($534)) {
        $535 = ($530>>>0)<=($529>>>0);
        $536 = ($530>>>0)>($533>>>0);
        $or$cond2$i = $535 | $536;
        if ($or$cond2$i) {
         $$2234243136$i = 0;
         break;
        }
       }
       $537 = (_sbrk(($$$i|0))|0);
       $538 = ($537|0)==($517|0);
       if ($538) {
        $$723947$i = $$$i;$$748$i = $517;
        label = 135;
        break L167;
       } else {
        $$2247$ph$i = $537;$$2253$ph$i = $$$i;
        label = 126;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 126) {
     $548 = (0 - ($$2253$ph$i))|0;
     $549 = ($$2247$ph$i|0)!=((-1)|0);
     $550 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $550 & $549;
     $551 = ($490>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $551 & $or$cond7$i;
     if (!($or$cond10$i)) {
      $561 = ($$2247$ph$i|0)==((-1)|0);
      if ($561) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 135;
       break L167;
      }
     }
     $552 = HEAP32[(36632)>>2]|0;
     $553 = (($491) - ($$2253$ph$i))|0;
     $554 = (($553) + ($552))|0;
     $555 = (0 - ($552))|0;
     $556 = $554 & $555;
     $557 = ($556>>>0)<(2147483647);
     if (!($557)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
     $558 = (_sbrk(($556|0))|0);
     $559 = ($558|0)==((-1)|0);
     if ($559) {
      (_sbrk(($548|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $560 = (($556) + ($$2253$ph$i))|0;
      $$723947$i = $560;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
    }
   } while(0);
   $562 = HEAP32[(36596)>>2]|0;
   $563 = $562 | 4;
   HEAP32[(36596)>>2] = $563;
   $$4236$i = $$2234243136$i;
   label = 133;
  } else {
   $$4236$i = 0;
   label = 133;
  }
 } while(0);
 if ((label|0) == 133) {
  $564 = ($495>>>0)<(2147483647);
  if ($564) {
   $565 = (_sbrk(($495|0))|0);
   $566 = (_sbrk(0)|0);
   $567 = ($565|0)!=((-1)|0);
   $568 = ($566|0)!=((-1)|0);
   $or$cond5$i = $567 & $568;
   $569 = ($565>>>0)<($566>>>0);
   $or$cond11$i = $569 & $or$cond5$i;
   $570 = $566;
   $571 = $565;
   $572 = (($570) - ($571))|0;
   $573 = (($$0192) + 40)|0;
   $574 = ($572>>>0)>($573>>>0);
   $$$4236$i = $574 ? $572 : $$4236$i;
   $or$cond11$not$i = $or$cond11$i ^ 1;
   $575 = ($565|0)==((-1)|0);
   $not$$i197 = $574 ^ 1;
   $576 = $575 | $not$$i197;
   $or$cond49$i = $576 | $or$cond11$not$i;
   if (!($or$cond49$i)) {
    $$723947$i = $$$4236$i;$$748$i = $565;
    label = 135;
   }
  }
 }
 if ((label|0) == 135) {
  $577 = HEAP32[(36584)>>2]|0;
  $578 = (($577) + ($$723947$i))|0;
  HEAP32[(36584)>>2] = $578;
  $579 = HEAP32[(36588)>>2]|0;
  $580 = ($578>>>0)>($579>>>0);
  if ($580) {
   HEAP32[(36588)>>2] = $578;
  }
  $581 = HEAP32[(36176)>>2]|0;
  $582 = ($581|0)==(0|0);
  do {
   if ($582) {
    $583 = HEAP32[(36168)>>2]|0;
    $584 = ($583|0)==(0|0);
    $585 = ($$748$i>>>0)<($583>>>0);
    $or$cond12$i = $584 | $585;
    if ($or$cond12$i) {
     HEAP32[(36168)>>2] = $$748$i;
    }
    HEAP32[(36600)>>2] = $$748$i;
    HEAP32[(36604)>>2] = $$723947$i;
    HEAP32[(36612)>>2] = 0;
    $586 = HEAP32[9156]|0;
    HEAP32[(36188)>>2] = $586;
    HEAP32[(36184)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $587 = $$01$i$i << 1;
     $588 = (36192 + ($587<<2)|0);
     $589 = ((($588)) + 12|0);
     HEAP32[$589>>2] = $588;
     $590 = ((($588)) + 8|0);
     HEAP32[$590>>2] = $588;
     $591 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($591|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $591;
     }
    }
    $592 = (($$723947$i) + -40)|0;
    $593 = ((($$748$i)) + 8|0);
    $594 = $593;
    $595 = $594 & 7;
    $596 = ($595|0)==(0);
    $597 = (0 - ($594))|0;
    $598 = $597 & 7;
    $599 = $596 ? 0 : $598;
    $600 = (($$748$i) + ($599)|0);
    $601 = (($592) - ($599))|0;
    HEAP32[(36176)>>2] = $600;
    HEAP32[(36164)>>2] = $601;
    $602 = $601 | 1;
    $603 = ((($600)) + 4|0);
    HEAP32[$603>>2] = $602;
    $604 = (($600) + ($601)|0);
    $605 = ((($604)) + 4|0);
    HEAP32[$605>>2] = 40;
    $606 = HEAP32[(36640)>>2]|0;
    HEAP32[(36180)>>2] = $606;
   } else {
    $$024370$i = (36600);
    while(1) {
     $607 = HEAP32[$$024370$i>>2]|0;
     $608 = ((($$024370$i)) + 4|0);
     $609 = HEAP32[$608>>2]|0;
     $610 = (($607) + ($609)|0);
     $611 = ($$748$i|0)==($610|0);
     if ($611) {
      label = 145;
      break;
     }
     $612 = ((($$024370$i)) + 8|0);
     $613 = HEAP32[$612>>2]|0;
     $614 = ($613|0)==(0|0);
     if ($614) {
      break;
     } else {
      $$024370$i = $613;
     }
    }
    if ((label|0) == 145) {
     $615 = ((($$024370$i)) + 12|0);
     $616 = HEAP32[$615>>2]|0;
     $617 = $616 & 8;
     $618 = ($617|0)==(0);
     if ($618) {
      $619 = ($581>>>0)>=($607>>>0);
      $620 = ($581>>>0)<($$748$i>>>0);
      $or$cond50$i = $620 & $619;
      if ($or$cond50$i) {
       $621 = (($609) + ($$723947$i))|0;
       HEAP32[$608>>2] = $621;
       $622 = HEAP32[(36164)>>2]|0;
       $623 = ((($581)) + 8|0);
       $624 = $623;
       $625 = $624 & 7;
       $626 = ($625|0)==(0);
       $627 = (0 - ($624))|0;
       $628 = $627 & 7;
       $629 = $626 ? 0 : $628;
       $630 = (($581) + ($629)|0);
       $631 = (($$723947$i) - ($629))|0;
       $632 = (($622) + ($631))|0;
       HEAP32[(36176)>>2] = $630;
       HEAP32[(36164)>>2] = $632;
       $633 = $632 | 1;
       $634 = ((($630)) + 4|0);
       HEAP32[$634>>2] = $633;
       $635 = (($630) + ($632)|0);
       $636 = ((($635)) + 4|0);
       HEAP32[$636>>2] = 40;
       $637 = HEAP32[(36640)>>2]|0;
       HEAP32[(36180)>>2] = $637;
       break;
      }
     }
    }
    $638 = HEAP32[(36168)>>2]|0;
    $639 = ($$748$i>>>0)<($638>>>0);
    if ($639) {
     HEAP32[(36168)>>2] = $$748$i;
    }
    $640 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (36600);
    while(1) {
     $641 = HEAP32[$$124469$i>>2]|0;
     $642 = ($641|0)==($640|0);
     if ($642) {
      label = 153;
      break;
     }
     $643 = ((($$124469$i)) + 8|0);
     $644 = HEAP32[$643>>2]|0;
     $645 = ($644|0)==(0|0);
     if ($645) {
      break;
     } else {
      $$124469$i = $644;
     }
    }
    if ((label|0) == 153) {
     $646 = ((($$124469$i)) + 12|0);
     $647 = HEAP32[$646>>2]|0;
     $648 = $647 & 8;
     $649 = ($648|0)==(0);
     if ($649) {
      HEAP32[$$124469$i>>2] = $$748$i;
      $650 = ((($$124469$i)) + 4|0);
      $651 = HEAP32[$650>>2]|0;
      $652 = (($651) + ($$723947$i))|0;
      HEAP32[$650>>2] = $652;
      $653 = ((($$748$i)) + 8|0);
      $654 = $653;
      $655 = $654 & 7;
      $656 = ($655|0)==(0);
      $657 = (0 - ($654))|0;
      $658 = $657 & 7;
      $659 = $656 ? 0 : $658;
      $660 = (($$748$i) + ($659)|0);
      $661 = ((($640)) + 8|0);
      $662 = $661;
      $663 = $662 & 7;
      $664 = ($663|0)==(0);
      $665 = (0 - ($662))|0;
      $666 = $665 & 7;
      $667 = $664 ? 0 : $666;
      $668 = (($640) + ($667)|0);
      $669 = $668;
      $670 = $660;
      $671 = (($669) - ($670))|0;
      $672 = (($660) + ($$0192)|0);
      $673 = (($671) - ($$0192))|0;
      $674 = $$0192 | 3;
      $675 = ((($660)) + 4|0);
      HEAP32[$675>>2] = $674;
      $676 = ($668|0)==($581|0);
      do {
       if ($676) {
        $677 = HEAP32[(36164)>>2]|0;
        $678 = (($677) + ($673))|0;
        HEAP32[(36164)>>2] = $678;
        HEAP32[(36176)>>2] = $672;
        $679 = $678 | 1;
        $680 = ((($672)) + 4|0);
        HEAP32[$680>>2] = $679;
       } else {
        $681 = HEAP32[(36172)>>2]|0;
        $682 = ($668|0)==($681|0);
        if ($682) {
         $683 = HEAP32[(36160)>>2]|0;
         $684 = (($683) + ($673))|0;
         HEAP32[(36160)>>2] = $684;
         HEAP32[(36172)>>2] = $672;
         $685 = $684 | 1;
         $686 = ((($672)) + 4|0);
         HEAP32[$686>>2] = $685;
         $687 = (($672) + ($684)|0);
         HEAP32[$687>>2] = $684;
         break;
        }
        $688 = ((($668)) + 4|0);
        $689 = HEAP32[$688>>2]|0;
        $690 = $689 & 3;
        $691 = ($690|0)==(1);
        if ($691) {
         $692 = $689 & -8;
         $693 = $689 >>> 3;
         $694 = ($689>>>0)<(256);
         L237: do {
          if ($694) {
           $695 = ((($668)) + 8|0);
           $696 = HEAP32[$695>>2]|0;
           $697 = ((($668)) + 12|0);
           $698 = HEAP32[$697>>2]|0;
           $699 = ($698|0)==($696|0);
           if ($699) {
            $700 = 1 << $693;
            $701 = $700 ^ -1;
            $702 = HEAP32[9038]|0;
            $703 = $702 & $701;
            HEAP32[9038] = $703;
            break;
           } else {
            $704 = ((($696)) + 12|0);
            HEAP32[$704>>2] = $698;
            $705 = ((($698)) + 8|0);
            HEAP32[$705>>2] = $696;
            break;
           }
          } else {
           $706 = ((($668)) + 24|0);
           $707 = HEAP32[$706>>2]|0;
           $708 = ((($668)) + 12|0);
           $709 = HEAP32[$708>>2]|0;
           $710 = ($709|0)==($668|0);
           do {
            if ($710) {
             $715 = ((($668)) + 16|0);
             $716 = ((($715)) + 4|0);
             $717 = HEAP32[$716>>2]|0;
             $718 = ($717|0)==(0|0);
             if ($718) {
              $719 = HEAP32[$715>>2]|0;
              $720 = ($719|0)==(0|0);
              if ($720) {
               $$3$i$i = 0;
               break;
              } else {
               $$1264$i$i = $719;$$1266$i$i = $715;
              }
             } else {
              $$1264$i$i = $717;$$1266$i$i = $716;
             }
             while(1) {
              $721 = ((($$1264$i$i)) + 20|0);
              $722 = HEAP32[$721>>2]|0;
              $723 = ($722|0)==(0|0);
              if (!($723)) {
               $$1264$i$i = $722;$$1266$i$i = $721;
               continue;
              }
              $724 = ((($$1264$i$i)) + 16|0);
              $725 = HEAP32[$724>>2]|0;
              $726 = ($725|0)==(0|0);
              if ($726) {
               break;
              } else {
               $$1264$i$i = $725;$$1266$i$i = $724;
              }
             }
             HEAP32[$$1266$i$i>>2] = 0;
             $$3$i$i = $$1264$i$i;
            } else {
             $711 = ((($668)) + 8|0);
             $712 = HEAP32[$711>>2]|0;
             $713 = ((($712)) + 12|0);
             HEAP32[$713>>2] = $709;
             $714 = ((($709)) + 8|0);
             HEAP32[$714>>2] = $712;
             $$3$i$i = $709;
            }
           } while(0);
           $727 = ($707|0)==(0|0);
           if ($727) {
            break;
           }
           $728 = ((($668)) + 28|0);
           $729 = HEAP32[$728>>2]|0;
           $730 = (36456 + ($729<<2)|0);
           $731 = HEAP32[$730>>2]|0;
           $732 = ($668|0)==($731|0);
           do {
            if ($732) {
             HEAP32[$730>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $733 = 1 << $729;
             $734 = $733 ^ -1;
             $735 = HEAP32[(36156)>>2]|0;
             $736 = $735 & $734;
             HEAP32[(36156)>>2] = $736;
             break L237;
            } else {
             $737 = ((($707)) + 16|0);
             $738 = HEAP32[$737>>2]|0;
             $not$$i$i = ($738|0)!=($668|0);
             $$sink1$i$i = $not$$i$i&1;
             $739 = (((($707)) + 16|0) + ($$sink1$i$i<<2)|0);
             HEAP32[$739>>2] = $$3$i$i;
             $740 = ($$3$i$i|0)==(0|0);
             if ($740) {
              break L237;
             }
            }
           } while(0);
           $741 = ((($$3$i$i)) + 24|0);
           HEAP32[$741>>2] = $707;
           $742 = ((($668)) + 16|0);
           $743 = HEAP32[$742>>2]|0;
           $744 = ($743|0)==(0|0);
           if (!($744)) {
            $745 = ((($$3$i$i)) + 16|0);
            HEAP32[$745>>2] = $743;
            $746 = ((($743)) + 24|0);
            HEAP32[$746>>2] = $$3$i$i;
           }
           $747 = ((($742)) + 4|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = ($748|0)==(0|0);
           if ($749) {
            break;
           }
           $750 = ((($$3$i$i)) + 20|0);
           HEAP32[$750>>2] = $748;
           $751 = ((($748)) + 24|0);
           HEAP32[$751>>2] = $$3$i$i;
          }
         } while(0);
         $752 = (($668) + ($692)|0);
         $753 = (($692) + ($673))|0;
         $$0$i$i = $752;$$0260$i$i = $753;
        } else {
         $$0$i$i = $668;$$0260$i$i = $673;
        }
        $754 = ((($$0$i$i)) + 4|0);
        $755 = HEAP32[$754>>2]|0;
        $756 = $755 & -2;
        HEAP32[$754>>2] = $756;
        $757 = $$0260$i$i | 1;
        $758 = ((($672)) + 4|0);
        HEAP32[$758>>2] = $757;
        $759 = (($672) + ($$0260$i$i)|0);
        HEAP32[$759>>2] = $$0260$i$i;
        $760 = $$0260$i$i >>> 3;
        $761 = ($$0260$i$i>>>0)<(256);
        if ($761) {
         $762 = $760 << 1;
         $763 = (36192 + ($762<<2)|0);
         $764 = HEAP32[9038]|0;
         $765 = 1 << $760;
         $766 = $764 & $765;
         $767 = ($766|0)==(0);
         if ($767) {
          $768 = $764 | $765;
          HEAP32[9038] = $768;
          $$pre$i17$i = ((($763)) + 8|0);
          $$0268$i$i = $763;$$pre$phi$i18$iZ2D = $$pre$i17$i;
         } else {
          $769 = ((($763)) + 8|0);
          $770 = HEAP32[$769>>2]|0;
          $$0268$i$i = $770;$$pre$phi$i18$iZ2D = $769;
         }
         HEAP32[$$pre$phi$i18$iZ2D>>2] = $672;
         $771 = ((($$0268$i$i)) + 12|0);
         HEAP32[$771>>2] = $672;
         $772 = ((($672)) + 8|0);
         HEAP32[$772>>2] = $$0268$i$i;
         $773 = ((($672)) + 12|0);
         HEAP32[$773>>2] = $763;
         break;
        }
        $774 = $$0260$i$i >>> 8;
        $775 = ($774|0)==(0);
        do {
         if ($775) {
          $$0269$i$i = 0;
         } else {
          $776 = ($$0260$i$i>>>0)>(16777215);
          if ($776) {
           $$0269$i$i = 31;
           break;
          }
          $777 = (($774) + 1048320)|0;
          $778 = $777 >>> 16;
          $779 = $778 & 8;
          $780 = $774 << $779;
          $781 = (($780) + 520192)|0;
          $782 = $781 >>> 16;
          $783 = $782 & 4;
          $784 = $783 | $779;
          $785 = $780 << $783;
          $786 = (($785) + 245760)|0;
          $787 = $786 >>> 16;
          $788 = $787 & 2;
          $789 = $784 | $788;
          $790 = (14 - ($789))|0;
          $791 = $785 << $788;
          $792 = $791 >>> 15;
          $793 = (($790) + ($792))|0;
          $794 = $793 << 1;
          $795 = (($793) + 7)|0;
          $796 = $$0260$i$i >>> $795;
          $797 = $796 & 1;
          $798 = $797 | $794;
          $$0269$i$i = $798;
         }
        } while(0);
        $799 = (36456 + ($$0269$i$i<<2)|0);
        $800 = ((($672)) + 28|0);
        HEAP32[$800>>2] = $$0269$i$i;
        $801 = ((($672)) + 16|0);
        $802 = ((($801)) + 4|0);
        HEAP32[$802>>2] = 0;
        HEAP32[$801>>2] = 0;
        $803 = HEAP32[(36156)>>2]|0;
        $804 = 1 << $$0269$i$i;
        $805 = $803 & $804;
        $806 = ($805|0)==(0);
        if ($806) {
         $807 = $803 | $804;
         HEAP32[(36156)>>2] = $807;
         HEAP32[$799>>2] = $672;
         $808 = ((($672)) + 24|0);
         HEAP32[$808>>2] = $799;
         $809 = ((($672)) + 12|0);
         HEAP32[$809>>2] = $672;
         $810 = ((($672)) + 8|0);
         HEAP32[$810>>2] = $672;
         break;
        }
        $811 = HEAP32[$799>>2]|0;
        $812 = ($$0269$i$i|0)==(31);
        $813 = $$0269$i$i >>> 1;
        $814 = (25 - ($813))|0;
        $815 = $812 ? 0 : $814;
        $816 = $$0260$i$i << $815;
        $$0261$i$i = $816;$$0262$i$i = $811;
        while(1) {
         $817 = ((($$0262$i$i)) + 4|0);
         $818 = HEAP32[$817>>2]|0;
         $819 = $818 & -8;
         $820 = ($819|0)==($$0260$i$i|0);
         if ($820) {
          label = 194;
          break;
         }
         $821 = $$0261$i$i >>> 31;
         $822 = (((($$0262$i$i)) + 16|0) + ($821<<2)|0);
         $823 = $$0261$i$i << 1;
         $824 = HEAP32[$822>>2]|0;
         $825 = ($824|0)==(0|0);
         if ($825) {
          label = 193;
          break;
         } else {
          $$0261$i$i = $823;$$0262$i$i = $824;
         }
        }
        if ((label|0) == 193) {
         HEAP32[$822>>2] = $672;
         $826 = ((($672)) + 24|0);
         HEAP32[$826>>2] = $$0262$i$i;
         $827 = ((($672)) + 12|0);
         HEAP32[$827>>2] = $672;
         $828 = ((($672)) + 8|0);
         HEAP32[$828>>2] = $672;
         break;
        }
        else if ((label|0) == 194) {
         $829 = ((($$0262$i$i)) + 8|0);
         $830 = HEAP32[$829>>2]|0;
         $831 = ((($830)) + 12|0);
         HEAP32[$831>>2] = $672;
         HEAP32[$829>>2] = $672;
         $832 = ((($672)) + 8|0);
         HEAP32[$832>>2] = $830;
         $833 = ((($672)) + 12|0);
         HEAP32[$833>>2] = $$0262$i$i;
         $834 = ((($672)) + 24|0);
         HEAP32[$834>>2] = 0;
         break;
        }
       }
      } while(0);
      $959 = ((($660)) + 8|0);
      $$0 = $959;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (36600);
    while(1) {
     $835 = HEAP32[$$0$i$i$i>>2]|0;
     $836 = ($835>>>0)>($581>>>0);
     if (!($836)) {
      $837 = ((($$0$i$i$i)) + 4|0);
      $838 = HEAP32[$837>>2]|0;
      $839 = (($835) + ($838)|0);
      $840 = ($839>>>0)>($581>>>0);
      if ($840) {
       break;
      }
     }
     $841 = ((($$0$i$i$i)) + 8|0);
     $842 = HEAP32[$841>>2]|0;
     $$0$i$i$i = $842;
    }
    $843 = ((($839)) + -47|0);
    $844 = ((($843)) + 8|0);
    $845 = $844;
    $846 = $845 & 7;
    $847 = ($846|0)==(0);
    $848 = (0 - ($845))|0;
    $849 = $848 & 7;
    $850 = $847 ? 0 : $849;
    $851 = (($843) + ($850)|0);
    $852 = ((($581)) + 16|0);
    $853 = ($851>>>0)<($852>>>0);
    $854 = $853 ? $581 : $851;
    $855 = ((($854)) + 8|0);
    $856 = ((($854)) + 24|0);
    $857 = (($$723947$i) + -40)|0;
    $858 = ((($$748$i)) + 8|0);
    $859 = $858;
    $860 = $859 & 7;
    $861 = ($860|0)==(0);
    $862 = (0 - ($859))|0;
    $863 = $862 & 7;
    $864 = $861 ? 0 : $863;
    $865 = (($$748$i) + ($864)|0);
    $866 = (($857) - ($864))|0;
    HEAP32[(36176)>>2] = $865;
    HEAP32[(36164)>>2] = $866;
    $867 = $866 | 1;
    $868 = ((($865)) + 4|0);
    HEAP32[$868>>2] = $867;
    $869 = (($865) + ($866)|0);
    $870 = ((($869)) + 4|0);
    HEAP32[$870>>2] = 40;
    $871 = HEAP32[(36640)>>2]|0;
    HEAP32[(36180)>>2] = $871;
    $872 = ((($854)) + 4|0);
    HEAP32[$872>>2] = 27;
    ;HEAP32[$855>>2]=HEAP32[(36600)>>2]|0;HEAP32[$855+4>>2]=HEAP32[(36600)+4>>2]|0;HEAP32[$855+8>>2]=HEAP32[(36600)+8>>2]|0;HEAP32[$855+12>>2]=HEAP32[(36600)+12>>2]|0;
    HEAP32[(36600)>>2] = $$748$i;
    HEAP32[(36604)>>2] = $$723947$i;
    HEAP32[(36612)>>2] = 0;
    HEAP32[(36608)>>2] = $855;
    $874 = $856;
    while(1) {
     $873 = ((($874)) + 4|0);
     HEAP32[$873>>2] = 7;
     $875 = ((($874)) + 8|0);
     $876 = ($875>>>0)<($839>>>0);
     if ($876) {
      $874 = $873;
     } else {
      break;
     }
    }
    $877 = ($854|0)==($581|0);
    if (!($877)) {
     $878 = $854;
     $879 = $581;
     $880 = (($878) - ($879))|0;
     $881 = HEAP32[$872>>2]|0;
     $882 = $881 & -2;
     HEAP32[$872>>2] = $882;
     $883 = $880 | 1;
     $884 = ((($581)) + 4|0);
     HEAP32[$884>>2] = $883;
     HEAP32[$854>>2] = $880;
     $885 = $880 >>> 3;
     $886 = ($880>>>0)<(256);
     if ($886) {
      $887 = $885 << 1;
      $888 = (36192 + ($887<<2)|0);
      $889 = HEAP32[9038]|0;
      $890 = 1 << $885;
      $891 = $889 & $890;
      $892 = ($891|0)==(0);
      if ($892) {
       $893 = $889 | $890;
       HEAP32[9038] = $893;
       $$pre$i$i = ((($888)) + 8|0);
       $$0206$i$i = $888;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $894 = ((($888)) + 8|0);
       $895 = HEAP32[$894>>2]|0;
       $$0206$i$i = $895;$$pre$phi$i$iZ2D = $894;
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $581;
      $896 = ((($$0206$i$i)) + 12|0);
      HEAP32[$896>>2] = $581;
      $897 = ((($581)) + 8|0);
      HEAP32[$897>>2] = $$0206$i$i;
      $898 = ((($581)) + 12|0);
      HEAP32[$898>>2] = $888;
      break;
     }
     $899 = $880 >>> 8;
     $900 = ($899|0)==(0);
     if ($900) {
      $$0207$i$i = 0;
     } else {
      $901 = ($880>>>0)>(16777215);
      if ($901) {
       $$0207$i$i = 31;
      } else {
       $902 = (($899) + 1048320)|0;
       $903 = $902 >>> 16;
       $904 = $903 & 8;
       $905 = $899 << $904;
       $906 = (($905) + 520192)|0;
       $907 = $906 >>> 16;
       $908 = $907 & 4;
       $909 = $908 | $904;
       $910 = $905 << $908;
       $911 = (($910) + 245760)|0;
       $912 = $911 >>> 16;
       $913 = $912 & 2;
       $914 = $909 | $913;
       $915 = (14 - ($914))|0;
       $916 = $910 << $913;
       $917 = $916 >>> 15;
       $918 = (($915) + ($917))|0;
       $919 = $918 << 1;
       $920 = (($918) + 7)|0;
       $921 = $880 >>> $920;
       $922 = $921 & 1;
       $923 = $922 | $919;
       $$0207$i$i = $923;
      }
     }
     $924 = (36456 + ($$0207$i$i<<2)|0);
     $925 = ((($581)) + 28|0);
     HEAP32[$925>>2] = $$0207$i$i;
     $926 = ((($581)) + 20|0);
     HEAP32[$926>>2] = 0;
     HEAP32[$852>>2] = 0;
     $927 = HEAP32[(36156)>>2]|0;
     $928 = 1 << $$0207$i$i;
     $929 = $927 & $928;
     $930 = ($929|0)==(0);
     if ($930) {
      $931 = $927 | $928;
      HEAP32[(36156)>>2] = $931;
      HEAP32[$924>>2] = $581;
      $932 = ((($581)) + 24|0);
      HEAP32[$932>>2] = $924;
      $933 = ((($581)) + 12|0);
      HEAP32[$933>>2] = $581;
      $934 = ((($581)) + 8|0);
      HEAP32[$934>>2] = $581;
      break;
     }
     $935 = HEAP32[$924>>2]|0;
     $936 = ($$0207$i$i|0)==(31);
     $937 = $$0207$i$i >>> 1;
     $938 = (25 - ($937))|0;
     $939 = $936 ? 0 : $938;
     $940 = $880 << $939;
     $$0201$i$i = $940;$$0202$i$i = $935;
     while(1) {
      $941 = ((($$0202$i$i)) + 4|0);
      $942 = HEAP32[$941>>2]|0;
      $943 = $942 & -8;
      $944 = ($943|0)==($880|0);
      if ($944) {
       label = 216;
       break;
      }
      $945 = $$0201$i$i >>> 31;
      $946 = (((($$0202$i$i)) + 16|0) + ($945<<2)|0);
      $947 = $$0201$i$i << 1;
      $948 = HEAP32[$946>>2]|0;
      $949 = ($948|0)==(0|0);
      if ($949) {
       label = 215;
       break;
      } else {
       $$0201$i$i = $947;$$0202$i$i = $948;
      }
     }
     if ((label|0) == 215) {
      HEAP32[$946>>2] = $581;
      $950 = ((($581)) + 24|0);
      HEAP32[$950>>2] = $$0202$i$i;
      $951 = ((($581)) + 12|0);
      HEAP32[$951>>2] = $581;
      $952 = ((($581)) + 8|0);
      HEAP32[$952>>2] = $581;
      break;
     }
     else if ((label|0) == 216) {
      $953 = ((($$0202$i$i)) + 8|0);
      $954 = HEAP32[$953>>2]|0;
      $955 = ((($954)) + 12|0);
      HEAP32[$955>>2] = $581;
      HEAP32[$953>>2] = $581;
      $956 = ((($581)) + 8|0);
      HEAP32[$956>>2] = $954;
      $957 = ((($581)) + 12|0);
      HEAP32[$957>>2] = $$0202$i$i;
      $958 = ((($581)) + 24|0);
      HEAP32[$958>>2] = 0;
      break;
     }
    }
   }
  } while(0);
  $960 = HEAP32[(36164)>>2]|0;
  $961 = ($960>>>0)>($$0192>>>0);
  if ($961) {
   $962 = (($960) - ($$0192))|0;
   HEAP32[(36164)>>2] = $962;
   $963 = HEAP32[(36176)>>2]|0;
   $964 = (($963) + ($$0192)|0);
   HEAP32[(36176)>>2] = $964;
   $965 = $962 | 1;
   $966 = ((($964)) + 4|0);
   HEAP32[$966>>2] = $965;
   $967 = $$0192 | 3;
   $968 = ((($963)) + 4|0);
   HEAP32[$968>>2] = $967;
   $969 = ((($963)) + 8|0);
   $$0 = $969;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $970 = (___errno_location()|0);
 HEAP32[$970>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0195$i = 0, $$0195$in$i = 0, $$0348 = 0, $$0349 = 0, $$0361 = 0, $$0368 = 0, $$1 = 0, $$1347 = 0, $$1352 = 0, $$1355 = 0, $$1363 = 0, $$1367 = 0, $$2 = 0, $$3 = 0, $$3365 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond374 = 0, $cond375 = 0, $not$ = 0, $not$370 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(36168)>>2]|0;
 $4 = ((($0)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & -8;
 $7 = (($2) + ($6)|0);
 $8 = $5 & 1;
 $9 = ($8|0)==(0);
 do {
  if ($9) {
   $10 = HEAP32[$2>>2]|0;
   $11 = $5 & 3;
   $12 = ($11|0)==(0);
   if ($12) {
    return;
   }
   $13 = (0 - ($10))|0;
   $14 = (($2) + ($13)|0);
   $15 = (($10) + ($6))|0;
   $16 = ($14>>>0)<($3>>>0);
   if ($16) {
    return;
   }
   $17 = HEAP32[(36172)>>2]|0;
   $18 = ($14|0)==($17|0);
   if ($18) {
    $78 = ((($7)) + 4|0);
    $79 = HEAP32[$78>>2]|0;
    $80 = $79 & 3;
    $81 = ($80|0)==(3);
    if (!($81)) {
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    }
    $82 = (($14) + ($15)|0);
    $83 = ((($14)) + 4|0);
    $84 = $15 | 1;
    $85 = $79 & -2;
    HEAP32[(36160)>>2] = $15;
    HEAP32[$78>>2] = $85;
    HEAP32[$83>>2] = $84;
    HEAP32[$82>>2] = $15;
    return;
   }
   $19 = $10 >>> 3;
   $20 = ($10>>>0)<(256);
   if ($20) {
    $21 = ((($14)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ((($14)) + 12|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ($24|0)==($22|0);
    if ($25) {
     $26 = 1 << $19;
     $27 = $26 ^ -1;
     $28 = HEAP32[9038]|0;
     $29 = $28 & $27;
     HEAP32[9038] = $29;
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    } else {
     $30 = ((($22)) + 12|0);
     HEAP32[$30>>2] = $24;
     $31 = ((($24)) + 8|0);
     HEAP32[$31>>2] = $22;
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    }
   }
   $32 = ((($14)) + 24|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = ((($14)) + 12|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==($14|0);
   do {
    if ($36) {
     $41 = ((($14)) + 16|0);
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ($43|0)==(0|0);
     if ($44) {
      $45 = HEAP32[$41>>2]|0;
      $46 = ($45|0)==(0|0);
      if ($46) {
       $$3 = 0;
       break;
      } else {
       $$1352 = $45;$$1355 = $41;
      }
     } else {
      $$1352 = $43;$$1355 = $42;
     }
     while(1) {
      $47 = ((($$1352)) + 20|0);
      $48 = HEAP32[$47>>2]|0;
      $49 = ($48|0)==(0|0);
      if (!($49)) {
       $$1352 = $48;$$1355 = $47;
       continue;
      }
      $50 = ((($$1352)) + 16|0);
      $51 = HEAP32[$50>>2]|0;
      $52 = ($51|0)==(0|0);
      if ($52) {
       break;
      } else {
       $$1352 = $51;$$1355 = $50;
      }
     }
     HEAP32[$$1355>>2] = 0;
     $$3 = $$1352;
    } else {
     $37 = ((($14)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ((($38)) + 12|0);
     HEAP32[$39>>2] = $35;
     $40 = ((($35)) + 8|0);
     HEAP32[$40>>2] = $38;
     $$3 = $35;
    }
   } while(0);
   $53 = ($33|0)==(0|0);
   if ($53) {
    $$1 = $14;$$1347 = $15;$86 = $14;
   } else {
    $54 = ((($14)) + 28|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = (36456 + ($55<<2)|0);
    $57 = HEAP32[$56>>2]|0;
    $58 = ($14|0)==($57|0);
    if ($58) {
     HEAP32[$56>>2] = $$3;
     $cond374 = ($$3|0)==(0|0);
     if ($cond374) {
      $59 = 1 << $55;
      $60 = $59 ^ -1;
      $61 = HEAP32[(36156)>>2]|0;
      $62 = $61 & $60;
      HEAP32[(36156)>>2] = $62;
      $$1 = $14;$$1347 = $15;$86 = $14;
      break;
     }
    } else {
     $63 = ((($33)) + 16|0);
     $64 = HEAP32[$63>>2]|0;
     $not$370 = ($64|0)!=($14|0);
     $$sink3 = $not$370&1;
     $65 = (((($33)) + 16|0) + ($$sink3<<2)|0);
     HEAP32[$65>>2] = $$3;
     $66 = ($$3|0)==(0|0);
     if ($66) {
      $$1 = $14;$$1347 = $15;$86 = $14;
      break;
     }
    }
    $67 = ((($$3)) + 24|0);
    HEAP32[$67>>2] = $33;
    $68 = ((($14)) + 16|0);
    $69 = HEAP32[$68>>2]|0;
    $70 = ($69|0)==(0|0);
    if (!($70)) {
     $71 = ((($$3)) + 16|0);
     HEAP32[$71>>2] = $69;
     $72 = ((($69)) + 24|0);
     HEAP32[$72>>2] = $$3;
    }
    $73 = ((($68)) + 4|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = ($74|0)==(0|0);
    if ($75) {
     $$1 = $14;$$1347 = $15;$86 = $14;
    } else {
     $76 = ((($$3)) + 20|0);
     HEAP32[$76>>2] = $74;
     $77 = ((($74)) + 24|0);
     HEAP32[$77>>2] = $$3;
     $$1 = $14;$$1347 = $15;$86 = $14;
    }
   }
  } else {
   $$1 = $2;$$1347 = $6;$86 = $2;
  }
 } while(0);
 $87 = ($86>>>0)<($7>>>0);
 if (!($87)) {
  return;
 }
 $88 = ((($7)) + 4|0);
 $89 = HEAP32[$88>>2]|0;
 $90 = $89 & 1;
 $91 = ($90|0)==(0);
 if ($91) {
  return;
 }
 $92 = $89 & 2;
 $93 = ($92|0)==(0);
 if ($93) {
  $94 = HEAP32[(36176)>>2]|0;
  $95 = ($7|0)==($94|0);
  $96 = HEAP32[(36172)>>2]|0;
  if ($95) {
   $97 = HEAP32[(36164)>>2]|0;
   $98 = (($97) + ($$1347))|0;
   HEAP32[(36164)>>2] = $98;
   HEAP32[(36176)>>2] = $$1;
   $99 = $98 | 1;
   $100 = ((($$1)) + 4|0);
   HEAP32[$100>>2] = $99;
   $101 = ($$1|0)==($96|0);
   if (!($101)) {
    return;
   }
   HEAP32[(36172)>>2] = 0;
   HEAP32[(36160)>>2] = 0;
   return;
  }
  $102 = ($7|0)==($96|0);
  if ($102) {
   $103 = HEAP32[(36160)>>2]|0;
   $104 = (($103) + ($$1347))|0;
   HEAP32[(36160)>>2] = $104;
   HEAP32[(36172)>>2] = $86;
   $105 = $104 | 1;
   $106 = ((($$1)) + 4|0);
   HEAP32[$106>>2] = $105;
   $107 = (($86) + ($104)|0);
   HEAP32[$107>>2] = $104;
   return;
  }
  $108 = $89 & -8;
  $109 = (($108) + ($$1347))|0;
  $110 = $89 >>> 3;
  $111 = ($89>>>0)<(256);
  do {
   if ($111) {
    $112 = ((($7)) + 8|0);
    $113 = HEAP32[$112>>2]|0;
    $114 = ((($7)) + 12|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = ($115|0)==($113|0);
    if ($116) {
     $117 = 1 << $110;
     $118 = $117 ^ -1;
     $119 = HEAP32[9038]|0;
     $120 = $119 & $118;
     HEAP32[9038] = $120;
     break;
    } else {
     $121 = ((($113)) + 12|0);
     HEAP32[$121>>2] = $115;
     $122 = ((($115)) + 8|0);
     HEAP32[$122>>2] = $113;
     break;
    }
   } else {
    $123 = ((($7)) + 24|0);
    $124 = HEAP32[$123>>2]|0;
    $125 = ((($7)) + 12|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ($126|0)==($7|0);
    do {
     if ($127) {
      $132 = ((($7)) + 16|0);
      $133 = ((($132)) + 4|0);
      $134 = HEAP32[$133>>2]|0;
      $135 = ($134|0)==(0|0);
      if ($135) {
       $136 = HEAP32[$132>>2]|0;
       $137 = ($136|0)==(0|0);
       if ($137) {
        $$3365 = 0;
        break;
       } else {
        $$1363 = $136;$$1367 = $132;
       }
      } else {
       $$1363 = $134;$$1367 = $133;
      }
      while(1) {
       $138 = ((($$1363)) + 20|0);
       $139 = HEAP32[$138>>2]|0;
       $140 = ($139|0)==(0|0);
       if (!($140)) {
        $$1363 = $139;$$1367 = $138;
        continue;
       }
       $141 = ((($$1363)) + 16|0);
       $142 = HEAP32[$141>>2]|0;
       $143 = ($142|0)==(0|0);
       if ($143) {
        break;
       } else {
        $$1363 = $142;$$1367 = $141;
       }
      }
      HEAP32[$$1367>>2] = 0;
      $$3365 = $$1363;
     } else {
      $128 = ((($7)) + 8|0);
      $129 = HEAP32[$128>>2]|0;
      $130 = ((($129)) + 12|0);
      HEAP32[$130>>2] = $126;
      $131 = ((($126)) + 8|0);
      HEAP32[$131>>2] = $129;
      $$3365 = $126;
     }
    } while(0);
    $144 = ($124|0)==(0|0);
    if (!($144)) {
     $145 = ((($7)) + 28|0);
     $146 = HEAP32[$145>>2]|0;
     $147 = (36456 + ($146<<2)|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($7|0)==($148|0);
     if ($149) {
      HEAP32[$147>>2] = $$3365;
      $cond375 = ($$3365|0)==(0|0);
      if ($cond375) {
       $150 = 1 << $146;
       $151 = $150 ^ -1;
       $152 = HEAP32[(36156)>>2]|0;
       $153 = $152 & $151;
       HEAP32[(36156)>>2] = $153;
       break;
      }
     } else {
      $154 = ((($124)) + 16|0);
      $155 = HEAP32[$154>>2]|0;
      $not$ = ($155|0)!=($7|0);
      $$sink5 = $not$&1;
      $156 = (((($124)) + 16|0) + ($$sink5<<2)|0);
      HEAP32[$156>>2] = $$3365;
      $157 = ($$3365|0)==(0|0);
      if ($157) {
       break;
      }
     }
     $158 = ((($$3365)) + 24|0);
     HEAP32[$158>>2] = $124;
     $159 = ((($7)) + 16|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ($160|0)==(0|0);
     if (!($161)) {
      $162 = ((($$3365)) + 16|0);
      HEAP32[$162>>2] = $160;
      $163 = ((($160)) + 24|0);
      HEAP32[$163>>2] = $$3365;
     }
     $164 = ((($159)) + 4|0);
     $165 = HEAP32[$164>>2]|0;
     $166 = ($165|0)==(0|0);
     if (!($166)) {
      $167 = ((($$3365)) + 20|0);
      HEAP32[$167>>2] = $165;
      $168 = ((($165)) + 24|0);
      HEAP32[$168>>2] = $$3365;
     }
    }
   }
  } while(0);
  $169 = $109 | 1;
  $170 = ((($$1)) + 4|0);
  HEAP32[$170>>2] = $169;
  $171 = (($86) + ($109)|0);
  HEAP32[$171>>2] = $109;
  $172 = HEAP32[(36172)>>2]|0;
  $173 = ($$1|0)==($172|0);
  if ($173) {
   HEAP32[(36160)>>2] = $109;
   return;
  } else {
   $$2 = $109;
  }
 } else {
  $174 = $89 & -2;
  HEAP32[$88>>2] = $174;
  $175 = $$1347 | 1;
  $176 = ((($$1)) + 4|0);
  HEAP32[$176>>2] = $175;
  $177 = (($86) + ($$1347)|0);
  HEAP32[$177>>2] = $$1347;
  $$2 = $$1347;
 }
 $178 = $$2 >>> 3;
 $179 = ($$2>>>0)<(256);
 if ($179) {
  $180 = $178 << 1;
  $181 = (36192 + ($180<<2)|0);
  $182 = HEAP32[9038]|0;
  $183 = 1 << $178;
  $184 = $182 & $183;
  $185 = ($184|0)==(0);
  if ($185) {
   $186 = $182 | $183;
   HEAP32[9038] = $186;
   $$pre = ((($181)) + 8|0);
   $$0368 = $181;$$pre$phiZ2D = $$pre;
  } else {
   $187 = ((($181)) + 8|0);
   $188 = HEAP32[$187>>2]|0;
   $$0368 = $188;$$pre$phiZ2D = $187;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $189 = ((($$0368)) + 12|0);
  HEAP32[$189>>2] = $$1;
  $190 = ((($$1)) + 8|0);
  HEAP32[$190>>2] = $$0368;
  $191 = ((($$1)) + 12|0);
  HEAP32[$191>>2] = $181;
  return;
 }
 $192 = $$2 >>> 8;
 $193 = ($192|0)==(0);
 if ($193) {
  $$0361 = 0;
 } else {
  $194 = ($$2>>>0)>(16777215);
  if ($194) {
   $$0361 = 31;
  } else {
   $195 = (($192) + 1048320)|0;
   $196 = $195 >>> 16;
   $197 = $196 & 8;
   $198 = $192 << $197;
   $199 = (($198) + 520192)|0;
   $200 = $199 >>> 16;
   $201 = $200 & 4;
   $202 = $201 | $197;
   $203 = $198 << $201;
   $204 = (($203) + 245760)|0;
   $205 = $204 >>> 16;
   $206 = $205 & 2;
   $207 = $202 | $206;
   $208 = (14 - ($207))|0;
   $209 = $203 << $206;
   $210 = $209 >>> 15;
   $211 = (($208) + ($210))|0;
   $212 = $211 << 1;
   $213 = (($211) + 7)|0;
   $214 = $$2 >>> $213;
   $215 = $214 & 1;
   $216 = $215 | $212;
   $$0361 = $216;
  }
 }
 $217 = (36456 + ($$0361<<2)|0);
 $218 = ((($$1)) + 28|0);
 HEAP32[$218>>2] = $$0361;
 $219 = ((($$1)) + 16|0);
 $220 = ((($$1)) + 20|0);
 HEAP32[$220>>2] = 0;
 HEAP32[$219>>2] = 0;
 $221 = HEAP32[(36156)>>2]|0;
 $222 = 1 << $$0361;
 $223 = $221 & $222;
 $224 = ($223|0)==(0);
 do {
  if ($224) {
   $225 = $221 | $222;
   HEAP32[(36156)>>2] = $225;
   HEAP32[$217>>2] = $$1;
   $226 = ((($$1)) + 24|0);
   HEAP32[$226>>2] = $217;
   $227 = ((($$1)) + 12|0);
   HEAP32[$227>>2] = $$1;
   $228 = ((($$1)) + 8|0);
   HEAP32[$228>>2] = $$1;
  } else {
   $229 = HEAP32[$217>>2]|0;
   $230 = ($$0361|0)==(31);
   $231 = $$0361 >>> 1;
   $232 = (25 - ($231))|0;
   $233 = $230 ? 0 : $232;
   $234 = $$2 << $233;
   $$0348 = $234;$$0349 = $229;
   while(1) {
    $235 = ((($$0349)) + 4|0);
    $236 = HEAP32[$235>>2]|0;
    $237 = $236 & -8;
    $238 = ($237|0)==($$2|0);
    if ($238) {
     label = 73;
     break;
    }
    $239 = $$0348 >>> 31;
    $240 = (((($$0349)) + 16|0) + ($239<<2)|0);
    $241 = $$0348 << 1;
    $242 = HEAP32[$240>>2]|0;
    $243 = ($242|0)==(0|0);
    if ($243) {
     label = 72;
     break;
    } else {
     $$0348 = $241;$$0349 = $242;
    }
   }
   if ((label|0) == 72) {
    HEAP32[$240>>2] = $$1;
    $244 = ((($$1)) + 24|0);
    HEAP32[$244>>2] = $$0349;
    $245 = ((($$1)) + 12|0);
    HEAP32[$245>>2] = $$1;
    $246 = ((($$1)) + 8|0);
    HEAP32[$246>>2] = $$1;
    break;
   }
   else if ((label|0) == 73) {
    $247 = ((($$0349)) + 8|0);
    $248 = HEAP32[$247>>2]|0;
    $249 = ((($248)) + 12|0);
    HEAP32[$249>>2] = $$1;
    HEAP32[$247>>2] = $$1;
    $250 = ((($$1)) + 8|0);
    HEAP32[$250>>2] = $248;
    $251 = ((($$1)) + 12|0);
    HEAP32[$251>>2] = $$0349;
    $252 = ((($$1)) + 24|0);
    HEAP32[$252>>2] = 0;
    break;
   }
  }
 } while(0);
 $253 = HEAP32[(36184)>>2]|0;
 $254 = (($253) + -1)|0;
 HEAP32[(36184)>>2] = $254;
 $255 = ($254|0)==(0);
 if ($255) {
  $$0195$in$i = (36608);
 } else {
  return;
 }
 while(1) {
  $$0195$i = HEAP32[$$0195$in$i>>2]|0;
  $256 = ($$0195$i|0)==(0|0);
  $257 = ((($$0195$i)) + 8|0);
  if ($256) {
   break;
  } else {
   $$0195$in$i = $257;
  }
 }
 HEAP32[(36184)>>2] = -1;
 return;
}
function _emscripten_get_global_libc() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (36648|0);
}
function ___errno_location() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___pthread_self_269()|0);
 $1 = ((($0)) + 64|0);
 return ($1|0);
}
function ___pthread_self_269() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function _pthread_self() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (33288|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _memchr($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$13745 = 0, $$140 = 0, $$2 = 0, $$23839 = 0, $$3 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond53 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1 & 255;
 $4 = $0;
 $5 = $4 & 3;
 $6 = ($5|0)!=(0);
 $7 = ($2|0)!=(0);
 $or$cond53 = $7 & $6;
 L1: do {
  if ($or$cond53) {
   $8 = $1&255;
   $$03555 = $0;$$03654 = $2;
   while(1) {
    $9 = HEAP8[$$03555>>0]|0;
    $10 = ($9<<24>>24)==($8<<24>>24);
    if ($10) {
     $$035$lcssa65 = $$03555;$$036$lcssa64 = $$03654;
     label = 6;
     break L1;
    }
    $11 = ((($$03555)) + 1|0);
    $12 = (($$03654) + -1)|0;
    $13 = $11;
    $14 = $13 & 3;
    $15 = ($14|0)!=(0);
    $16 = ($12|0)!=(0);
    $or$cond = $16 & $15;
    if ($or$cond) {
     $$03555 = $11;$$03654 = $12;
    } else {
     $$035$lcssa = $11;$$036$lcssa = $12;$$lcssa = $16;
     label = 5;
     break;
    }
   }
  } else {
   $$035$lcssa = $0;$$036$lcssa = $2;$$lcssa = $7;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$035$lcssa65 = $$035$lcssa;$$036$lcssa64 = $$036$lcssa;
   label = 6;
  } else {
   $$2 = $$035$lcssa;$$3 = 0;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $17 = HEAP8[$$035$lcssa65>>0]|0;
   $18 = $1&255;
   $19 = ($17<<24>>24)==($18<<24>>24);
   if ($19) {
    $$2 = $$035$lcssa65;$$3 = $$036$lcssa64;
   } else {
    $20 = Math_imul($3, 16843009)|0;
    $21 = ($$036$lcssa64>>>0)>(3);
    L11: do {
     if ($21) {
      $$046 = $$035$lcssa65;$$13745 = $$036$lcssa64;
      while(1) {
       $22 = HEAP32[$$046>>2]|0;
       $23 = $22 ^ $20;
       $24 = (($23) + -16843009)|0;
       $25 = $23 & -2139062144;
       $26 = $25 ^ -2139062144;
       $27 = $26 & $24;
       $28 = ($27|0)==(0);
       if (!($28)) {
        break;
       }
       $29 = ((($$046)) + 4|0);
       $30 = (($$13745) + -4)|0;
       $31 = ($30>>>0)>(3);
       if ($31) {
        $$046 = $29;$$13745 = $30;
       } else {
        $$0$lcssa = $29;$$137$lcssa = $30;
        label = 11;
        break L11;
       }
      }
      $$140 = $$046;$$23839 = $$13745;
     } else {
      $$0$lcssa = $$035$lcssa65;$$137$lcssa = $$036$lcssa64;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $32 = ($$137$lcssa|0)==(0);
     if ($32) {
      $$2 = $$0$lcssa;$$3 = 0;
      break;
     } else {
      $$140 = $$0$lcssa;$$23839 = $$137$lcssa;
     }
    }
    while(1) {
     $33 = HEAP8[$$140>>0]|0;
     $34 = ($33<<24>>24)==($18<<24>>24);
     if ($34) {
      $$2 = $$140;$$3 = $$23839;
      break L8;
     }
     $35 = ((($$140)) + 1|0);
     $36 = (($$23839) + -1)|0;
     $37 = ($36|0)==(0);
     if ($37) {
      $$2 = $35;$$3 = 0;
      break;
     } else {
      $$140 = $35;$$23839 = $36;
     }
    }
   }
  }
 } while(0);
 $38 = ($$3|0)!=(0);
 $39 = $38 ? $$2 : 0;
 return ($39|0);
}
function _strlen($0) {
 $0 = $0|0;
 var $$0 = 0, $$015$lcssa = 0, $$01519 = 0, $$1$lcssa = 0, $$pn = 0, $$pre = 0, $$sink = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1 & 3;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$015$lcssa = $0;
   label = 4;
  } else {
   $$01519 = $0;$23 = $1;
   while(1) {
    $4 = HEAP8[$$01519>>0]|0;
    $5 = ($4<<24>>24)==(0);
    if ($5) {
     $$sink = $23;
     break L1;
    }
    $6 = ((($$01519)) + 1|0);
    $7 = $6;
    $8 = $7 & 3;
    $9 = ($8|0)==(0);
    if ($9) {
     $$015$lcssa = $6;
     label = 4;
     break;
    } else {
     $$01519 = $6;$23 = $7;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $$0 = $$015$lcssa;
  while(1) {
   $10 = HEAP32[$$0>>2]|0;
   $11 = (($10) + -16843009)|0;
   $12 = $10 & -2139062144;
   $13 = $12 ^ -2139062144;
   $14 = $13 & $11;
   $15 = ($14|0)==(0);
   $16 = ((($$0)) + 4|0);
   if ($15) {
    $$0 = $16;
   } else {
    break;
   }
  }
  $17 = $10&255;
  $18 = ($17<<24>>24)==(0);
  if ($18) {
   $$1$lcssa = $$0;
  } else {
   $$pn = $$0;
   while(1) {
    $19 = ((($$pn)) + 1|0);
    $$pre = HEAP8[$19>>0]|0;
    $20 = ($$pre<<24>>24)==(0);
    if ($20) {
     $$1$lcssa = $19;
     break;
    } else {
     $$pn = $19;
    }
   }
  }
  $21 = $$1$lcssa;
  $$sink = $21;
 }
 $22 = (($$sink) - ($1))|0;
 return ($22|0);
}
function _vfprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0 = 0, $$1 = 0, $$1$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0;
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp;
 $6 = sp + 136|0;
 dest=$4; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $vacopy_currentptr;
 $7 = (_printf_core(0,$1,$3,$5,$4)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  $$0 = -1;
 } else {
  $9 = ((($0)) + 76|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)>(-1);
  if ($11) {
   $12 = (___lockfile($0)|0);
   $39 = $12;
  } else {
   $39 = 0;
  }
  $13 = HEAP32[$0>>2]|0;
  $14 = $13 & 32;
  $15 = ((($0)) + 74|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = ($16<<24>>24)<(1);
  if ($17) {
   $18 = $13 & -33;
   HEAP32[$0>>2] = $18;
  }
  $19 = ((($0)) + 48|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(0);
  if ($21) {
   $23 = ((($0)) + 44|0);
   $24 = HEAP32[$23>>2]|0;
   HEAP32[$23>>2] = $6;
   $25 = ((($0)) + 28|0);
   HEAP32[$25>>2] = $6;
   $26 = ((($0)) + 20|0);
   HEAP32[$26>>2] = $6;
   HEAP32[$19>>2] = 80;
   $27 = ((($6)) + 80|0);
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = $27;
   $29 = (_printf_core($0,$1,$3,$5,$4)|0);
   $30 = ($24|0)==(0|0);
   if ($30) {
    $$1 = $29;
   } else {
    $31 = ((($0)) + 36|0);
    $32 = HEAP32[$31>>2]|0;
    (FUNCTION_TABLE_iiii[$32 & 1]($0,0,0)|0);
    $33 = HEAP32[$26>>2]|0;
    $34 = ($33|0)==(0|0);
    $$ = $34 ? -1 : $29;
    HEAP32[$23>>2] = $24;
    HEAP32[$19>>2] = 0;
    HEAP32[$28>>2] = 0;
    HEAP32[$25>>2] = 0;
    HEAP32[$26>>2] = 0;
    $$1 = $$;
   }
  } else {
   $22 = (_printf_core($0,$1,$3,$5,$4)|0);
   $$1 = $22;
  }
  $35 = HEAP32[$0>>2]|0;
  $36 = $35 & 32;
  $37 = ($36|0)==(0);
  $$1$ = $37 ? $$1 : -1;
  $38 = $35 | $14;
  HEAP32[$0>>2] = $38;
  $40 = ($39|0)==(0);
  if (!($40)) {
   ___unlockfile($0);
  }
  $$0 = $$1$;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$$ = 0, $$$0259 = 0, $$$0262 = 0, $$$0269 = 0, $$$4266 = 0, $$$5 = 0, $$0 = 0, $$0228 = 0, $$0228$ = 0, $$0229322 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0, $$0240$lcssa = 0, $$0240$lcssa357 = 0, $$0240321 = 0, $$0243 = 0, $$0247 = 0, $$0249$lcssa = 0;
 var $$0249306 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0, $$0254$$0254$ = 0, $$0259 = 0, $$0262$lcssa = 0, $$0262311 = 0, $$0269 = 0, $$0269$phi = 0, $$1 = 0, $$1230333 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241332 = 0, $$1244320 = 0, $$1248 = 0, $$1250 = 0, $$1255 = 0;
 var $$1260 = 0, $$1263 = 0, $$1263$ = 0, $$1270 = 0, $$2 = 0, $$2234 = 0, $$2239 = 0, $$2242305 = 0, $$2245 = 0, $$2251 = 0, $$2256 = 0, $$2256$ = 0, $$2256$$$2256 = 0, $$2261 = 0, $$2271 = 0, $$284$ = 0, $$289 = 0, $$290 = 0, $$3257 = 0, $$3265 = 0;
 var $$3272 = 0, $$3303 = 0, $$377 = 0, $$4258355 = 0, $$4266 = 0, $$5 = 0, $$6268 = 0, $$lcssa295 = 0, $$pre = 0, $$pre346 = 0, $$pre347 = 0, $$pre347$pre = 0, $$pre349 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0;
 var $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0;
 var $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0;
 var $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0;
 var $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0;
 var $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0;
 var $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0;
 var $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0;
 var $306 = 0.0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0;
 var $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $isdigit = 0, $isdigit275 = 0, $isdigit277 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp274 = 0;
 var $isdigittmp276 = 0, $narrow = 0, $or$cond = 0, $or$cond281 = 0, $or$cond283 = 0, $or$cond286 = 0, $storemerge = 0, $storemerge273310 = 0, $storemerge278 = 0, $trunc = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $5 = sp + 16|0;
 $6 = sp;
 $7 = sp + 24|0;
 $8 = sp + 8|0;
 $9 = sp + 20|0;
 HEAP32[$5>>2] = $1;
 $10 = ($0|0)!=(0|0);
 $11 = ((($7)) + 40|0);
 $12 = $11;
 $13 = ((($7)) + 39|0);
 $14 = ((($8)) + 4|0);
 $$0243 = 0;$$0247 = 0;$$0269 = 0;$21 = $1;
 L1: while(1) {
  $15 = ($$0247|0)>(-1);
  do {
   if ($15) {
    $16 = (2147483647 - ($$0247))|0;
    $17 = ($$0243|0)>($16|0);
    if ($17) {
     $18 = (___errno_location()|0);
     HEAP32[$18>>2] = 75;
     $$1248 = -1;
     break;
    } else {
     $19 = (($$0243) + ($$0247))|0;
     $$1248 = $19;
     break;
    }
   } else {
    $$1248 = $$0247;
   }
  } while(0);
  $20 = HEAP8[$21>>0]|0;
  $22 = ($20<<24>>24)==(0);
  if ($22) {
   label = 87;
   break;
  } else {
   $23 = $20;$25 = $21;
  }
  L9: while(1) {
   switch ($23<<24>>24) {
   case 37:  {
    $$0249306 = $25;$27 = $25;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $$0249$lcssa = $25;$39 = $25;
    break L9;
    break;
   }
   default: {
   }
   }
   $24 = ((($25)) + 1|0);
   HEAP32[$5>>2] = $24;
   $$pre = HEAP8[$24>>0]|0;
   $23 = $$pre;$25 = $24;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $26 = ((($27)) + 1|0);
     $28 = HEAP8[$26>>0]|0;
     $29 = ($28<<24>>24)==(37);
     if (!($29)) {
      $$0249$lcssa = $$0249306;$39 = $27;
      break L12;
     }
     $30 = ((($$0249306)) + 1|0);
     $31 = ((($27)) + 2|0);
     HEAP32[$5>>2] = $31;
     $32 = HEAP8[$31>>0]|0;
     $33 = ($32<<24>>24)==(37);
     if ($33) {
      $$0249306 = $30;$27 = $31;
      label = 9;
     } else {
      $$0249$lcssa = $30;$39 = $31;
      break;
     }
    }
   }
  } while(0);
  $34 = $$0249$lcssa;
  $35 = $21;
  $36 = (($34) - ($35))|0;
  if ($10) {
   _out_590($0,$21,$36);
  }
  $37 = ($36|0)==(0);
  if (!($37)) {
   $$0269$phi = $$0269;$$0243 = $36;$$0247 = $$1248;$21 = $39;$$0269 = $$0269$phi;
   continue;
  }
  $38 = ((($39)) + 1|0);
  $40 = HEAP8[$38>>0]|0;
  $41 = $40 << 24 >> 24;
  $isdigittmp = (($41) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $42 = ((($39)) + 2|0);
   $43 = HEAP8[$42>>0]|0;
   $44 = ($43<<24>>24)==(36);
   $45 = ((($39)) + 3|0);
   $$377 = $44 ? $45 : $38;
   $$$0269 = $44 ? 1 : $$0269;
   $isdigittmp$ = $44 ? $isdigittmp : -1;
   $$0253 = $isdigittmp$;$$1270 = $$$0269;$storemerge = $$377;
  } else {
   $$0253 = -1;$$1270 = $$0269;$storemerge = $38;
  }
  HEAP32[$5>>2] = $storemerge;
  $46 = HEAP8[$storemerge>>0]|0;
  $47 = $46 << 24 >> 24;
  $48 = (($47) + -32)|0;
  $49 = ($48>>>0)<(32);
  L24: do {
   if ($49) {
    $$0262311 = 0;$329 = $46;$51 = $48;$storemerge273310 = $storemerge;
    while(1) {
     $50 = 1 << $51;
     $52 = $50 & 75913;
     $53 = ($52|0)==(0);
     if ($53) {
      $$0262$lcssa = $$0262311;$$lcssa295 = $329;$62 = $storemerge273310;
      break L24;
     }
     $54 = $50 | $$0262311;
     $55 = ((($storemerge273310)) + 1|0);
     HEAP32[$5>>2] = $55;
     $56 = HEAP8[$55>>0]|0;
     $57 = $56 << 24 >> 24;
     $58 = (($57) + -32)|0;
     $59 = ($58>>>0)<(32);
     if ($59) {
      $$0262311 = $54;$329 = $56;$51 = $58;$storemerge273310 = $55;
     } else {
      $$0262$lcssa = $54;$$lcssa295 = $56;$62 = $55;
      break;
     }
    }
   } else {
    $$0262$lcssa = 0;$$lcssa295 = $46;$62 = $storemerge;
   }
  } while(0);
  $60 = ($$lcssa295<<24>>24)==(42);
  if ($60) {
   $61 = ((($62)) + 1|0);
   $63 = HEAP8[$61>>0]|0;
   $64 = $63 << 24 >> 24;
   $isdigittmp276 = (($64) + -48)|0;
   $isdigit277 = ($isdigittmp276>>>0)<(10);
   if ($isdigit277) {
    $65 = ((($62)) + 2|0);
    $66 = HEAP8[$65>>0]|0;
    $67 = ($66<<24>>24)==(36);
    if ($67) {
     $68 = (($4) + ($isdigittmp276<<2)|0);
     HEAP32[$68>>2] = 10;
     $69 = HEAP8[$61>>0]|0;
     $70 = $69 << 24 >> 24;
     $71 = (($70) + -48)|0;
     $72 = (($3) + ($71<<3)|0);
     $73 = $72;
     $74 = $73;
     $75 = HEAP32[$74>>2]|0;
     $76 = (($73) + 4)|0;
     $77 = $76;
     $78 = HEAP32[$77>>2]|0;
     $79 = ((($62)) + 3|0);
     $$0259 = $75;$$2271 = 1;$storemerge278 = $79;
    } else {
     label = 23;
    }
   } else {
    label = 23;
   }
   if ((label|0) == 23) {
    label = 0;
    $80 = ($$1270|0)==(0);
    if (!($80)) {
     $$0 = -1;
     break;
    }
    if ($10) {
     $arglist_current = HEAP32[$2>>2]|0;
     $81 = $arglist_current;
     $82 = ((0) + 4|0);
     $expanded4 = $82;
     $expanded = (($expanded4) - 1)|0;
     $83 = (($81) + ($expanded))|0;
     $84 = ((0) + 4|0);
     $expanded8 = $84;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $85 = $83 & $expanded6;
     $86 = $85;
     $87 = HEAP32[$86>>2]|0;
     $arglist_next = ((($86)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     $$0259 = $87;$$2271 = 0;$storemerge278 = $61;
    } else {
     $$0259 = 0;$$2271 = 0;$storemerge278 = $61;
    }
   }
   HEAP32[$5>>2] = $storemerge278;
   $88 = ($$0259|0)<(0);
   $89 = $$0262$lcssa | 8192;
   $90 = (0 - ($$0259))|0;
   $$$0262 = $88 ? $89 : $$0262$lcssa;
   $$$0259 = $88 ? $90 : $$0259;
   $$1260 = $$$0259;$$1263 = $$$0262;$$3272 = $$2271;$94 = $storemerge278;
  } else {
   $91 = (_getint_591($5)|0);
   $92 = ($91|0)<(0);
   if ($92) {
    $$0 = -1;
    break;
   }
   $$pre346 = HEAP32[$5>>2]|0;
   $$1260 = $91;$$1263 = $$0262$lcssa;$$3272 = $$1270;$94 = $$pre346;
  }
  $93 = HEAP8[$94>>0]|0;
  $95 = ($93<<24>>24)==(46);
  do {
   if ($95) {
    $96 = ((($94)) + 1|0);
    $97 = HEAP8[$96>>0]|0;
    $98 = ($97<<24>>24)==(42);
    if (!($98)) {
     $125 = ((($94)) + 1|0);
     HEAP32[$5>>2] = $125;
     $126 = (_getint_591($5)|0);
     $$pre347$pre = HEAP32[$5>>2]|0;
     $$0254 = $126;$$pre347 = $$pre347$pre;
     break;
    }
    $99 = ((($94)) + 2|0);
    $100 = HEAP8[$99>>0]|0;
    $101 = $100 << 24 >> 24;
    $isdigittmp274 = (($101) + -48)|0;
    $isdigit275 = ($isdigittmp274>>>0)<(10);
    if ($isdigit275) {
     $102 = ((($94)) + 3|0);
     $103 = HEAP8[$102>>0]|0;
     $104 = ($103<<24>>24)==(36);
     if ($104) {
      $105 = (($4) + ($isdigittmp274<<2)|0);
      HEAP32[$105>>2] = 10;
      $106 = HEAP8[$99>>0]|0;
      $107 = $106 << 24 >> 24;
      $108 = (($107) + -48)|0;
      $109 = (($3) + ($108<<3)|0);
      $110 = $109;
      $111 = $110;
      $112 = HEAP32[$111>>2]|0;
      $113 = (($110) + 4)|0;
      $114 = $113;
      $115 = HEAP32[$114>>2]|0;
      $116 = ((($94)) + 4|0);
      HEAP32[$5>>2] = $116;
      $$0254 = $112;$$pre347 = $116;
      break;
     }
    }
    $117 = ($$3272|0)==(0);
    if (!($117)) {
     $$0 = -1;
     break L1;
    }
    if ($10) {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $118 = $arglist_current2;
     $119 = ((0) + 4|0);
     $expanded11 = $119;
     $expanded10 = (($expanded11) - 1)|0;
     $120 = (($118) + ($expanded10))|0;
     $121 = ((0) + 4|0);
     $expanded15 = $121;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $122 = $120 & $expanded13;
     $123 = $122;
     $124 = HEAP32[$123>>2]|0;
     $arglist_next3 = ((($123)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $330 = $124;
    } else {
     $330 = 0;
    }
    HEAP32[$5>>2] = $99;
    $$0254 = $330;$$pre347 = $99;
   } else {
    $$0254 = -1;$$pre347 = $94;
   }
  } while(0);
  $$0252 = 0;$128 = $$pre347;
  while(1) {
   $127 = HEAP8[$128>>0]|0;
   $129 = $127 << 24 >> 24;
   $130 = (($129) + -65)|0;
   $131 = ($130>>>0)>(57);
   if ($131) {
    $$0 = -1;
    break L1;
   }
   $132 = ((($128)) + 1|0);
   HEAP32[$5>>2] = $132;
   $133 = HEAP8[$128>>0]|0;
   $134 = $133 << 24 >> 24;
   $135 = (($134) + -65)|0;
   $136 = ((33722 + (($$0252*58)|0)|0) + ($135)|0);
   $137 = HEAP8[$136>>0]|0;
   $138 = $137&255;
   $139 = (($138) + -1)|0;
   $140 = ($139>>>0)<(8);
   if ($140) {
    $$0252 = $138;$128 = $132;
   } else {
    break;
   }
  }
  $141 = ($137<<24>>24)==(0);
  if ($141) {
   $$0 = -1;
   break;
  }
  $142 = ($137<<24>>24)==(19);
  $143 = ($$0253|0)>(-1);
  do {
   if ($142) {
    if ($143) {
     $$0 = -1;
     break L1;
    } else {
     label = 49;
    }
   } else {
    if ($143) {
     $144 = (($4) + ($$0253<<2)|0);
     HEAP32[$144>>2] = $138;
     $145 = (($3) + ($$0253<<3)|0);
     $146 = $145;
     $147 = $146;
     $148 = HEAP32[$147>>2]|0;
     $149 = (($146) + 4)|0;
     $150 = $149;
     $151 = HEAP32[$150>>2]|0;
     $152 = $6;
     $153 = $152;
     HEAP32[$153>>2] = $148;
     $154 = (($152) + 4)|0;
     $155 = $154;
     HEAP32[$155>>2] = $151;
     label = 49;
     break;
    }
    if (!($10)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg_593($6,$138,$2);
   }
  } while(0);
  if ((label|0) == 49) {
   label = 0;
   if (!($10)) {
    $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
    continue;
   }
  }
  $156 = HEAP8[$128>>0]|0;
  $157 = $156 << 24 >> 24;
  $158 = ($$0252|0)!=(0);
  $159 = $157 & 15;
  $160 = ($159|0)==(3);
  $or$cond281 = $158 & $160;
  $161 = $157 & -33;
  $$0235 = $or$cond281 ? $161 : $157;
  $162 = $$1263 & 8192;
  $163 = ($162|0)==(0);
  $164 = $$1263 & -65537;
  $$1263$ = $163 ? $$1263 : $164;
  L71: do {
   switch ($$0235|0) {
   case 110:  {
    $trunc = $$0252&255;
    switch ($trunc<<24>>24) {
    case 0:  {
     $171 = HEAP32[$6>>2]|0;
     HEAP32[$171>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 1:  {
     $172 = HEAP32[$6>>2]|0;
     HEAP32[$172>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 2:  {
     $173 = ($$1248|0)<(0);
     $174 = $173 << 31 >> 31;
     $175 = HEAP32[$6>>2]|0;
     $176 = $175;
     $177 = $176;
     HEAP32[$177>>2] = $$1248;
     $178 = (($176) + 4)|0;
     $179 = $178;
     HEAP32[$179>>2] = $174;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 3:  {
     $180 = $$1248&65535;
     $181 = HEAP32[$6>>2]|0;
     HEAP16[$181>>1] = $180;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 4:  {
     $182 = $$1248&255;
     $183 = HEAP32[$6>>2]|0;
     HEAP8[$183>>0] = $182;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 6:  {
     $184 = HEAP32[$6>>2]|0;
     HEAP32[$184>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 7:  {
     $185 = ($$1248|0)<(0);
     $186 = $185 << 31 >> 31;
     $187 = HEAP32[$6>>2]|0;
     $188 = $187;
     $189 = $188;
     HEAP32[$189>>2] = $$1248;
     $190 = (($188) + 4)|0;
     $191 = $190;
     HEAP32[$191>>2] = $186;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    default: {
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $192 = ($$0254>>>0)>(8);
    $193 = $192 ? $$0254 : 8;
    $194 = $$1263$ | 8;
    $$1236 = 120;$$1255 = $193;$$3265 = $194;
    label = 61;
    break;
   }
   case 88: case 120:  {
    $$1236 = $$0235;$$1255 = $$0254;$$3265 = $$1263$;
    label = 61;
    break;
   }
   case 111:  {
    $210 = $6;
    $211 = $210;
    $212 = HEAP32[$211>>2]|0;
    $213 = (($210) + 4)|0;
    $214 = $213;
    $215 = HEAP32[$214>>2]|0;
    $216 = (_fmt_o($212,$215,$11)|0);
    $217 = $$1263$ & 8;
    $218 = ($217|0)==(0);
    $219 = $216;
    $220 = (($12) - ($219))|0;
    $221 = ($$0254|0)>($220|0);
    $222 = (($220) + 1)|0;
    $223 = $218 | $221;
    $$0254$$0254$ = $223 ? $$0254 : $222;
    $$0228 = $216;$$1233 = 0;$$1238 = 34186;$$2256 = $$0254$$0254$;$$4266 = $$1263$;$247 = $212;$249 = $215;
    label = 67;
    break;
   }
   case 105: case 100:  {
    $224 = $6;
    $225 = $224;
    $226 = HEAP32[$225>>2]|0;
    $227 = (($224) + 4)|0;
    $228 = $227;
    $229 = HEAP32[$228>>2]|0;
    $230 = ($229|0)<(0);
    if ($230) {
     $231 = (_i64Subtract(0,0,($226|0),($229|0))|0);
     $232 = tempRet0;
     $233 = $6;
     $234 = $233;
     HEAP32[$234>>2] = $231;
     $235 = (($233) + 4)|0;
     $236 = $235;
     HEAP32[$236>>2] = $232;
     $$0232 = 1;$$0237 = 34186;$242 = $231;$243 = $232;
     label = 66;
     break L71;
    } else {
     $237 = $$1263$ & 2048;
     $238 = ($237|0)==(0);
     $239 = $$1263$ & 1;
     $240 = ($239|0)==(0);
     $$ = $240 ? 34186 : (34188);
     $$$ = $238 ? $$ : (34187);
     $241 = $$1263$ & 2049;
     $narrow = ($241|0)!=(0);
     $$284$ = $narrow&1;
     $$0232 = $$284$;$$0237 = $$$;$242 = $226;$243 = $229;
     label = 66;
     break L71;
    }
    break;
   }
   case 117:  {
    $165 = $6;
    $166 = $165;
    $167 = HEAP32[$166>>2]|0;
    $168 = (($165) + 4)|0;
    $169 = $168;
    $170 = HEAP32[$169>>2]|0;
    $$0232 = 0;$$0237 = 34186;$242 = $167;$243 = $170;
    label = 66;
    break;
   }
   case 99:  {
    $259 = $6;
    $260 = $259;
    $261 = HEAP32[$260>>2]|0;
    $262 = (($259) + 4)|0;
    $263 = $262;
    $264 = HEAP32[$263>>2]|0;
    $265 = $261&255;
    HEAP8[$13>>0] = $265;
    $$2 = $13;$$2234 = 0;$$2239 = 34186;$$2251 = $11;$$5 = 1;$$6268 = $164;
    break;
   }
   case 109:  {
    $266 = (___errno_location()|0);
    $267 = HEAP32[$266>>2]|0;
    $268 = (_strerror($267)|0);
    $$1 = $268;
    label = 71;
    break;
   }
   case 115:  {
    $269 = HEAP32[$6>>2]|0;
    $270 = ($269|0)!=(0|0);
    $271 = $270 ? $269 : 34196;
    $$1 = $271;
    label = 71;
    break;
   }
   case 67:  {
    $278 = $6;
    $279 = $278;
    $280 = HEAP32[$279>>2]|0;
    $281 = (($278) + 4)|0;
    $282 = $281;
    $283 = HEAP32[$282>>2]|0;
    HEAP32[$8>>2] = $280;
    HEAP32[$14>>2] = 0;
    HEAP32[$6>>2] = $8;
    $$4258355 = -1;$331 = $8;
    label = 75;
    break;
   }
   case 83:  {
    $$pre349 = HEAP32[$6>>2]|0;
    $284 = ($$0254|0)==(0);
    if ($284) {
     _pad_596($0,32,$$1260,0,$$1263$);
     $$0240$lcssa357 = 0;
     label = 84;
    } else {
     $$4258355 = $$0254;$331 = $$pre349;
     label = 75;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $306 = +HEAPF64[$6>>3];
    $307 = (_fmt_fp($0,$306,$$1260,$$0254,$$1263$,$$0235)|0);
    $$0243 = $307;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
    continue L1;
    break;
   }
   default: {
    $$2 = $21;$$2234 = 0;$$2239 = 34186;$$2251 = $11;$$5 = $$0254;$$6268 = $$1263$;
   }
   }
  } while(0);
  L95: do {
   if ((label|0) == 61) {
    label = 0;
    $195 = $6;
    $196 = $195;
    $197 = HEAP32[$196>>2]|0;
    $198 = (($195) + 4)|0;
    $199 = $198;
    $200 = HEAP32[$199>>2]|0;
    $201 = $$1236 & 32;
    $202 = (_fmt_x($197,$200,$11,$201)|0);
    $203 = ($197|0)==(0);
    $204 = ($200|0)==(0);
    $205 = $203 & $204;
    $206 = $$3265 & 8;
    $207 = ($206|0)==(0);
    $or$cond283 = $207 | $205;
    $208 = $$1236 >> 4;
    $209 = (34186 + ($208)|0);
    $$289 = $or$cond283 ? 34186 : $209;
    $$290 = $or$cond283 ? 0 : 2;
    $$0228 = $202;$$1233 = $$290;$$1238 = $$289;$$2256 = $$1255;$$4266 = $$3265;$247 = $197;$249 = $200;
    label = 67;
   }
   else if ((label|0) == 66) {
    label = 0;
    $244 = (_fmt_u($242,$243,$11)|0);
    $$0228 = $244;$$1233 = $$0232;$$1238 = $$0237;$$2256 = $$0254;$$4266 = $$1263$;$247 = $242;$249 = $243;
    label = 67;
   }
   else if ((label|0) == 71) {
    label = 0;
    $272 = (_memchr($$1,0,$$0254)|0);
    $273 = ($272|0)==(0|0);
    $274 = $272;
    $275 = $$1;
    $276 = (($274) - ($275))|0;
    $277 = (($$1) + ($$0254)|0);
    $$3257 = $273 ? $$0254 : $276;
    $$1250 = $273 ? $277 : $272;
    $$2 = $$1;$$2234 = 0;$$2239 = 34186;$$2251 = $$1250;$$5 = $$3257;$$6268 = $164;
   }
   else if ((label|0) == 75) {
    label = 0;
    $$0229322 = $331;$$0240321 = 0;$$1244320 = 0;
    while(1) {
     $285 = HEAP32[$$0229322>>2]|0;
     $286 = ($285|0)==(0);
     if ($286) {
      $$0240$lcssa = $$0240321;$$2245 = $$1244320;
      break;
     }
     $287 = (_wctomb($9,$285)|0);
     $288 = ($287|0)<(0);
     $289 = (($$4258355) - ($$0240321))|0;
     $290 = ($287>>>0)>($289>>>0);
     $or$cond286 = $288 | $290;
     if ($or$cond286) {
      $$0240$lcssa = $$0240321;$$2245 = $287;
      break;
     }
     $291 = ((($$0229322)) + 4|0);
     $292 = (($287) + ($$0240321))|0;
     $293 = ($$4258355>>>0)>($292>>>0);
     if ($293) {
      $$0229322 = $291;$$0240321 = $292;$$1244320 = $287;
     } else {
      $$0240$lcssa = $292;$$2245 = $287;
      break;
     }
    }
    $294 = ($$2245|0)<(0);
    if ($294) {
     $$0 = -1;
     break L1;
    }
    _pad_596($0,32,$$1260,$$0240$lcssa,$$1263$);
    $295 = ($$0240$lcssa|0)==(0);
    if ($295) {
     $$0240$lcssa357 = 0;
     label = 84;
    } else {
     $$1230333 = $331;$$1241332 = 0;
     while(1) {
      $296 = HEAP32[$$1230333>>2]|0;
      $297 = ($296|0)==(0);
      if ($297) {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break L95;
      }
      $298 = (_wctomb($9,$296)|0);
      $299 = (($298) + ($$1241332))|0;
      $300 = ($299|0)>($$0240$lcssa|0);
      if ($300) {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break L95;
      }
      $301 = ((($$1230333)) + 4|0);
      _out_590($0,$9,$298);
      $302 = ($299>>>0)<($$0240$lcssa>>>0);
      if ($302) {
       $$1230333 = $301;$$1241332 = $299;
      } else {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 67) {
   label = 0;
   $245 = ($$2256|0)>(-1);
   $246 = $$4266 & -65537;
   $$$4266 = $245 ? $246 : $$4266;
   $248 = ($247|0)!=(0);
   $250 = ($249|0)!=(0);
   $251 = $248 | $250;
   $252 = ($$2256|0)!=(0);
   $or$cond = $252 | $251;
   $253 = $$0228;
   $254 = (($12) - ($253))|0;
   $255 = $251 ^ 1;
   $256 = $255&1;
   $257 = (($256) + ($254))|0;
   $258 = ($$2256|0)>($257|0);
   $$2256$ = $258 ? $$2256 : $257;
   $$2256$$$2256 = $or$cond ? $$2256$ : $$2256;
   $$0228$ = $or$cond ? $$0228 : $11;
   $$2 = $$0228$;$$2234 = $$1233;$$2239 = $$1238;$$2251 = $11;$$5 = $$2256$$$2256;$$6268 = $$$4266;
  }
  else if ((label|0) == 84) {
   label = 0;
   $303 = $$1263$ ^ 8192;
   _pad_596($0,32,$$1260,$$0240$lcssa357,$303);
   $304 = ($$1260|0)>($$0240$lcssa357|0);
   $305 = $304 ? $$1260 : $$0240$lcssa357;
   $$0243 = $305;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
   continue;
  }
  $308 = $$2251;
  $309 = $$2;
  $310 = (($308) - ($309))|0;
  $311 = ($$5|0)<($310|0);
  $$$5 = $311 ? $310 : $$5;
  $312 = (($$$5) + ($$2234))|0;
  $313 = ($$1260|0)<($312|0);
  $$2261 = $313 ? $312 : $$1260;
  _pad_596($0,32,$$2261,$312,$$6268);
  _out_590($0,$$2239,$$2234);
  $314 = $$6268 ^ 65536;
  _pad_596($0,48,$$2261,$312,$314);
  _pad_596($0,48,$$$5,$310,0);
  _out_590($0,$$2,$310);
  $315 = $$6268 ^ 8192;
  _pad_596($0,32,$$2261,$312,$315);
  $$0243 = $$2261;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
 }
 L114: do {
  if ((label|0) == 87) {
   $316 = ($0|0)==(0|0);
   if ($316) {
    $317 = ($$0269|0)==(0);
    if ($317) {
     $$0 = 0;
    } else {
     $$2242305 = 1;
     while(1) {
      $318 = (($4) + ($$2242305<<2)|0);
      $319 = HEAP32[$318>>2]|0;
      $320 = ($319|0)==(0);
      if ($320) {
       $$3303 = $$2242305;
       break;
      }
      $321 = (($3) + ($$2242305<<3)|0);
      _pop_arg_593($321,$319,$2);
      $322 = (($$2242305) + 1)|0;
      $323 = ($322|0)<(10);
      if ($323) {
       $$2242305 = $322;
      } else {
       $$0 = 1;
       break L114;
      }
     }
     while(1) {
      $326 = (($4) + ($$3303<<2)|0);
      $327 = HEAP32[$326>>2]|0;
      $328 = ($327|0)==(0);
      $324 = (($$3303) + 1)|0;
      if (!($328)) {
       $$0 = -1;
       break L114;
      }
      $325 = ($324|0)<(10);
      if ($325) {
       $$3303 = $324;
      } else {
       $$0 = 1;
       break;
      }
     }
    }
   } else {
    $$0 = $$1248;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function _out_590($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 32;
 $5 = ($4|0)==(0);
 if ($5) {
  (___fwritex($1,$2,$0)|0);
 }
 return;
}
function _getint_591($0) {
 $0 = $0|0;
 var $$0$lcssa = 0, $$06 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $isdigit = 0, $isdigit5 = 0, $isdigittmp = 0, $isdigittmp4 = 0, $isdigittmp7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $isdigittmp4 = (($3) + -48)|0;
 $isdigit5 = ($isdigittmp4>>>0)<(10);
 if ($isdigit5) {
  $$06 = 0;$7 = $1;$isdigittmp7 = $isdigittmp4;
  while(1) {
   $4 = ($$06*10)|0;
   $5 = (($isdigittmp7) + ($4))|0;
   $6 = ((($7)) + 1|0);
   HEAP32[$0>>2] = $6;
   $8 = HEAP8[$6>>0]|0;
   $9 = $8 << 24 >> 24;
   $isdigittmp = (($9) + -48)|0;
   $isdigit = ($isdigittmp>>>0)<(10);
   if ($isdigit) {
    $$06 = $5;$7 = $6;$isdigittmp7 = $isdigittmp;
   } else {
    $$0$lcssa = $5;
    break;
   }
  }
 } else {
  $$0$lcssa = 0;
 }
 return ($$0$lcssa|0);
}
function _pop_arg_593($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$mask = 0, $$mask31 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(20);
 L1: do {
  if (!($3)) {
   do {
    switch ($1|0) {
    case 9:  {
     $arglist_current = HEAP32[$2>>2]|0;
     $4 = $arglist_current;
     $5 = ((0) + 4|0);
     $expanded28 = $5;
     $expanded = (($expanded28) - 1)|0;
     $6 = (($4) + ($expanded))|0;
     $7 = ((0) + 4|0);
     $expanded32 = $7;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $8 = $6 & $expanded30;
     $9 = $8;
     $10 = HEAP32[$9>>2]|0;
     $arglist_next = ((($9)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     HEAP32[$0>>2] = $10;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $11 = $arglist_current2;
     $12 = ((0) + 4|0);
     $expanded35 = $12;
     $expanded34 = (($expanded35) - 1)|0;
     $13 = (($11) + ($expanded34))|0;
     $14 = ((0) + 4|0);
     $expanded39 = $14;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $15 = $13 & $expanded37;
     $16 = $15;
     $17 = HEAP32[$16>>2]|0;
     $arglist_next3 = ((($16)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $18 = ($17|0)<(0);
     $19 = $18 << 31 >> 31;
     $20 = $0;
     $21 = $20;
     HEAP32[$21>>2] = $17;
     $22 = (($20) + 4)|0;
     $23 = $22;
     HEAP32[$23>>2] = $19;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$2>>2]|0;
     $24 = $arglist_current5;
     $25 = ((0) + 4|0);
     $expanded42 = $25;
     $expanded41 = (($expanded42) - 1)|0;
     $26 = (($24) + ($expanded41))|0;
     $27 = ((0) + 4|0);
     $expanded46 = $27;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $28 = $26 & $expanded44;
     $29 = $28;
     $30 = HEAP32[$29>>2]|0;
     $arglist_next6 = ((($29)) + 4|0);
     HEAP32[$2>>2] = $arglist_next6;
     $31 = $0;
     $32 = $31;
     HEAP32[$32>>2] = $30;
     $33 = (($31) + 4)|0;
     $34 = $33;
     HEAP32[$34>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$2>>2]|0;
     $35 = $arglist_current8;
     $36 = ((0) + 8|0);
     $expanded49 = $36;
     $expanded48 = (($expanded49) - 1)|0;
     $37 = (($35) + ($expanded48))|0;
     $38 = ((0) + 8|0);
     $expanded53 = $38;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $39 = $37 & $expanded51;
     $40 = $39;
     $41 = $40;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $44 = (($41) + 4)|0;
     $45 = $44;
     $46 = HEAP32[$45>>2]|0;
     $arglist_next9 = ((($40)) + 8|0);
     HEAP32[$2>>2] = $arglist_next9;
     $47 = $0;
     $48 = $47;
     HEAP32[$48>>2] = $43;
     $49 = (($47) + 4)|0;
     $50 = $49;
     HEAP32[$50>>2] = $46;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$2>>2]|0;
     $51 = $arglist_current11;
     $52 = ((0) + 4|0);
     $expanded56 = $52;
     $expanded55 = (($expanded56) - 1)|0;
     $53 = (($51) + ($expanded55))|0;
     $54 = ((0) + 4|0);
     $expanded60 = $54;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $55 = $53 & $expanded58;
     $56 = $55;
     $57 = HEAP32[$56>>2]|0;
     $arglist_next12 = ((($56)) + 4|0);
     HEAP32[$2>>2] = $arglist_next12;
     $58 = $57&65535;
     $59 = $58 << 16 >> 16;
     $60 = ($59|0)<(0);
     $61 = $60 << 31 >> 31;
     $62 = $0;
     $63 = $62;
     HEAP32[$63>>2] = $59;
     $64 = (($62) + 4)|0;
     $65 = $64;
     HEAP32[$65>>2] = $61;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$2>>2]|0;
     $66 = $arglist_current14;
     $67 = ((0) + 4|0);
     $expanded63 = $67;
     $expanded62 = (($expanded63) - 1)|0;
     $68 = (($66) + ($expanded62))|0;
     $69 = ((0) + 4|0);
     $expanded67 = $69;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $70 = $68 & $expanded65;
     $71 = $70;
     $72 = HEAP32[$71>>2]|0;
     $arglist_next15 = ((($71)) + 4|0);
     HEAP32[$2>>2] = $arglist_next15;
     $$mask31 = $72 & 65535;
     $73 = $0;
     $74 = $73;
     HEAP32[$74>>2] = $$mask31;
     $75 = (($73) + 4)|0;
     $76 = $75;
     HEAP32[$76>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$2>>2]|0;
     $77 = $arglist_current17;
     $78 = ((0) + 4|0);
     $expanded70 = $78;
     $expanded69 = (($expanded70) - 1)|0;
     $79 = (($77) + ($expanded69))|0;
     $80 = ((0) + 4|0);
     $expanded74 = $80;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $81 = $79 & $expanded72;
     $82 = $81;
     $83 = HEAP32[$82>>2]|0;
     $arglist_next18 = ((($82)) + 4|0);
     HEAP32[$2>>2] = $arglist_next18;
     $84 = $83&255;
     $85 = $84 << 24 >> 24;
     $86 = ($85|0)<(0);
     $87 = $86 << 31 >> 31;
     $88 = $0;
     $89 = $88;
     HEAP32[$89>>2] = $85;
     $90 = (($88) + 4)|0;
     $91 = $90;
     HEAP32[$91>>2] = $87;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$2>>2]|0;
     $92 = $arglist_current20;
     $93 = ((0) + 4|0);
     $expanded77 = $93;
     $expanded76 = (($expanded77) - 1)|0;
     $94 = (($92) + ($expanded76))|0;
     $95 = ((0) + 4|0);
     $expanded81 = $95;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $96 = $94 & $expanded79;
     $97 = $96;
     $98 = HEAP32[$97>>2]|0;
     $arglist_next21 = ((($97)) + 4|0);
     HEAP32[$2>>2] = $arglist_next21;
     $$mask = $98 & 255;
     $99 = $0;
     $100 = $99;
     HEAP32[$100>>2] = $$mask;
     $101 = (($99) + 4)|0;
     $102 = $101;
     HEAP32[$102>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$2>>2]|0;
     $103 = $arglist_current23;
     $104 = ((0) + 8|0);
     $expanded84 = $104;
     $expanded83 = (($expanded84) - 1)|0;
     $105 = (($103) + ($expanded83))|0;
     $106 = ((0) + 8|0);
     $expanded88 = $106;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $107 = $105 & $expanded86;
     $108 = $107;
     $109 = +HEAPF64[$108>>3];
     $arglist_next24 = ((($108)) + 8|0);
     HEAP32[$2>>2] = $arglist_next24;
     HEAPF64[$0>>3] = $109;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$2>>2]|0;
     $110 = $arglist_current26;
     $111 = ((0) + 8|0);
     $expanded91 = $111;
     $expanded90 = (($expanded91) - 1)|0;
     $112 = (($110) + ($expanded90))|0;
     $113 = ((0) + 8|0);
     $expanded95 = $113;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $114 = $112 & $expanded93;
     $115 = $114;
     $116 = +HEAPF64[$115>>3];
     $arglist_next27 = ((($115)) + 8|0);
     HEAP32[$2>>2] = $arglist_next27;
     HEAPF64[$0>>3] = $116;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_x($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$05$lcssa = 0, $$056 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $4 = ($0|0)==(0);
 $5 = ($1|0)==(0);
 $6 = $4 & $5;
 if ($6) {
  $$05$lcssa = $2;
 } else {
  $$056 = $2;$15 = $1;$8 = $0;
  while(1) {
   $7 = $8 & 15;
   $9 = (34238 + ($7)|0);
   $10 = HEAP8[$9>>0]|0;
   $11 = $10&255;
   $12 = $11 | $3;
   $13 = $12&255;
   $14 = ((($$056)) + -1|0);
   HEAP8[$14>>0] = $13;
   $16 = (_bitshift64Lshr(($8|0),($15|0),4)|0);
   $17 = tempRet0;
   $18 = ($16|0)==(0);
   $19 = ($17|0)==(0);
   $20 = $18 & $19;
   if ($20) {
    $$05$lcssa = $14;
    break;
   } else {
    $$056 = $14;$15 = $17;$8 = $16;
   }
  }
 }
 return ($$05$lcssa|0);
}
function _fmt_o($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$06 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0);
 $4 = ($1|0)==(0);
 $5 = $3 & $4;
 if ($5) {
  $$0$lcssa = $2;
 } else {
  $$06 = $2;$11 = $1;$7 = $0;
  while(1) {
   $6 = $7&255;
   $8 = $6 & 7;
   $9 = $8 | 48;
   $10 = ((($$06)) + -1|0);
   HEAP8[$10>>0] = $9;
   $12 = (_bitshift64Lshr(($7|0),($11|0),3)|0);
   $13 = tempRet0;
   $14 = ($12|0)==(0);
   $15 = ($13|0)==(0);
   $16 = $14 & $15;
   if ($16) {
    $$0$lcssa = $10;
    break;
   } else {
    $$06 = $10;$11 = $13;$7 = $12;
   }
  }
 }
 return ($$0$lcssa|0);
}
function _fmt_u($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(0);
 $4 = ($0>>>0)>(4294967295);
 $5 = ($1|0)==(0);
 $6 = $5 & $4;
 $7 = $3 | $6;
 if ($7) {
  $$0914 = $2;$8 = $0;$9 = $1;
  while(1) {
   $10 = (___uremdi3(($8|0),($9|0),10,0)|0);
   $11 = tempRet0;
   $12 = $10&255;
   $13 = $12 | 48;
   $14 = ((($$0914)) + -1|0);
   HEAP8[$14>>0] = $13;
   $15 = (___udivdi3(($8|0),($9|0),10,0)|0);
   $16 = tempRet0;
   $17 = ($9>>>0)>(9);
   $18 = ($8>>>0)>(4294967295);
   $19 = ($9|0)==(9);
   $20 = $19 & $18;
   $21 = $17 | $20;
   if ($21) {
    $$0914 = $14;$8 = $15;$9 = $16;
   } else {
    break;
   }
  }
  $$010$lcssa$off0 = $15;$$09$lcssa = $14;
 } else {
  $$010$lcssa$off0 = $0;$$09$lcssa = $2;
 }
 $22 = ($$010$lcssa$off0|0)==(0);
 if ($22) {
  $$1$lcssa = $$09$lcssa;
 } else {
  $$012 = $$010$lcssa$off0;$$111 = $$09$lcssa;
  while(1) {
   $23 = (($$012>>>0) % 10)&-1;
   $24 = $23 | 48;
   $25 = $24&255;
   $26 = ((($$111)) + -1|0);
   HEAP8[$26>>0] = $25;
   $27 = (($$012>>>0) / 10)&-1;
   $28 = ($$012>>>0)<(10);
   if ($28) {
    $$1$lcssa = $26;
    break;
   } else {
    $$012 = $27;$$111 = $26;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _strerror($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___pthread_self_266()|0);
 $2 = ((($1)) + 188|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (___strerror_l($0,$3)|0);
 return ($4|0);
}
function _pad_596($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$011 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $5 = sp;
 $6 = $4 & 73728;
 $7 = ($6|0)==(0);
 $8 = ($2|0)>($3|0);
 $or$cond = $8 & $7;
 if ($or$cond) {
  $9 = (($2) - ($3))|0;
  $10 = ($9>>>0)<(256);
  $11 = $10 ? $9 : 256;
  _memset(($5|0),($1|0),($11|0))|0;
  $12 = ($9>>>0)>(255);
  if ($12) {
   $13 = (($2) - ($3))|0;
   $$011 = $9;
   while(1) {
    _out_590($0,$5,256);
    $14 = (($$011) + -256)|0;
    $15 = ($14>>>0)>(255);
    if ($15) {
     $$011 = $14;
    } else {
     break;
    }
   }
   $16 = $13 & 255;
   $$0$lcssa = $16;
  } else {
   $$0$lcssa = $9;
  }
  _out_590($0,$5,$$0$lcssa);
 }
 STACKTOP = sp;return;
}
function _wctomb($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = (_wcrtomb($0,$1,0)|0);
  $$0 = $3;
 }
 return ($$0|0);
}
function _fmt_fp($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$ = 0, $$$ = 0, $$$$559 = 0.0, $$$3484 = 0, $$$3484691 = 0, $$$3484692 = 0, $$$3501 = 0, $$$4502 = 0, $$$542 = 0.0, $$$559 = 0.0, $$0 = 0, $$0463$lcssa = 0, $$0463584 = 0, $$0464594 = 0, $$0471 = 0.0, $$0479 = 0, $$0487642 = 0, $$0488 = 0, $$0488653 = 0, $$0488655 = 0;
 var $$0496$$9 = 0, $$0497654 = 0, $$0498 = 0, $$0509582 = 0.0, $$0510 = 0, $$0511 = 0, $$0514637 = 0, $$0520 = 0, $$0521 = 0, $$0521$ = 0, $$0523 = 0, $$0525 = 0, $$0527 = 0, $$0527629 = 0, $$0527631 = 0, $$0530636 = 0, $$1465 = 0, $$1467 = 0.0, $$1469 = 0.0, $$1472 = 0.0;
 var $$1480 = 0, $$1482$lcssa = 0, $$1482661 = 0, $$1489641 = 0, $$1499$lcssa = 0, $$1499660 = 0, $$1508583 = 0, $$1512$lcssa = 0, $$1512607 = 0, $$1515 = 0, $$1524 = 0, $$1526 = 0, $$1528614 = 0, $$1531$lcssa = 0, $$1531630 = 0, $$1598 = 0, $$2 = 0, $$2473 = 0.0, $$2476 = 0, $$2476$$547 = 0;
 var $$2476$$549 = 0, $$2483$ph = 0, $$2500 = 0, $$2513 = 0, $$2516618 = 0, $$2529 = 0, $$2532617 = 0, $$3 = 0.0, $$3477 = 0, $$3484$lcssa = 0, $$3484648 = 0, $$3501$lcssa = 0, $$3501647 = 0, $$3533613 = 0, $$4 = 0.0, $$4478$lcssa = 0, $$4478590 = 0, $$4492 = 0, $$4502 = 0, $$4518 = 0;
 var $$5$lcssa = 0, $$534$ = 0, $$539 = 0, $$539$ = 0, $$542 = 0.0, $$546 = 0, $$548 = 0, $$5486$lcssa = 0, $$5486623 = 0, $$5493597 = 0, $$5519$ph = 0, $$555 = 0, $$556 = 0, $$559 = 0.0, $$5602 = 0, $$6 = 0, $$6494589 = 0, $$7495601 = 0, $$7505 = 0, $$7505$ = 0;
 var $$7505$ph = 0, $$8 = 0, $$9$ph = 0, $$lcssa673 = 0, $$neg = 0, $$neg567 = 0, $$pn = 0, $$pn566 = 0, $$pr = 0, $$pr564 = 0, $$pre = 0, $$pre$phi690Z2D = 0, $$pre689 = 0, $$sink545$lcssa = 0, $$sink545622 = 0, $$sink562 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0;
 var $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0.0, $117 = 0.0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0.0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0;
 var $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0.0, $229 = 0.0, $23 = 0;
 var $230 = 0, $231 = 0.0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0;
 var $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0;
 var $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0;
 var $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0.0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0.0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0;
 var $narrow = 0, $not$ = 0, $notlhs = 0, $notrhs = 0, $or$cond = 0, $or$cond3$not = 0, $or$cond537 = 0, $or$cond541 = 0, $or$cond544 = 0, $or$cond554 = 0, $or$cond6 = 0, $scevgep684 = 0, $scevgep684685 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 560|0;
 $6 = sp + 8|0;
 $7 = sp;
 $8 = sp + 524|0;
 $9 = $8;
 $10 = sp + 512|0;
 HEAP32[$7>>2] = 0;
 $11 = ((($10)) + 12|0);
 (___DOUBLE_BITS_597($1)|0);
 $12 = tempRet0;
 $13 = ($12|0)<(0);
 if ($13) {
  $14 = -$1;
  $$0471 = $14;$$0520 = 1;$$0521 = 34203;
 } else {
  $15 = $4 & 2048;
  $16 = ($15|0)==(0);
  $17 = $4 & 1;
  $18 = ($17|0)==(0);
  $$ = $18 ? (34204) : (34209);
  $$$ = $16 ? $$ : (34206);
  $19 = $4 & 2049;
  $narrow = ($19|0)!=(0);
  $$534$ = $narrow&1;
  $$0471 = $1;$$0520 = $$534$;$$0521 = $$$;
 }
 (___DOUBLE_BITS_597($$0471)|0);
 $20 = tempRet0;
 $21 = $20 & 2146435072;
 $22 = ($21>>>0)<(2146435072);
 $23 = (0)<(0);
 $24 = ($21|0)==(2146435072);
 $25 = $24 & $23;
 $26 = $22 | $25;
 do {
  if ($26) {
   $35 = (+_frexpl($$0471,$7));
   $36 = $35 * 2.0;
   $37 = $36 != 0.0;
   if ($37) {
    $38 = HEAP32[$7>>2]|0;
    $39 = (($38) + -1)|0;
    HEAP32[$7>>2] = $39;
   }
   $40 = $5 | 32;
   $41 = ($40|0)==(97);
   if ($41) {
    $42 = $5 & 32;
    $43 = ($42|0)==(0);
    $44 = ((($$0521)) + 9|0);
    $$0521$ = $43 ? $$0521 : $44;
    $45 = $$0520 | 2;
    $46 = ($3>>>0)>(11);
    $47 = (12 - ($3))|0;
    $48 = ($47|0)==(0);
    $49 = $46 | $48;
    do {
     if ($49) {
      $$1472 = $36;
     } else {
      $$0509582 = 8.0;$$1508583 = $47;
      while(1) {
       $50 = (($$1508583) + -1)|0;
       $51 = $$0509582 * 16.0;
       $52 = ($50|0)==(0);
       if ($52) {
        break;
       } else {
        $$0509582 = $51;$$1508583 = $50;
       }
      }
      $53 = HEAP8[$$0521$>>0]|0;
      $54 = ($53<<24>>24)==(45);
      if ($54) {
       $55 = -$36;
       $56 = $55 - $51;
       $57 = $51 + $56;
       $58 = -$57;
       $$1472 = $58;
       break;
      } else {
       $59 = $36 + $51;
       $60 = $59 - $51;
       $$1472 = $60;
       break;
      }
     }
    } while(0);
    $61 = HEAP32[$7>>2]|0;
    $62 = ($61|0)<(0);
    $63 = (0 - ($61))|0;
    $64 = $62 ? $63 : $61;
    $65 = ($64|0)<(0);
    $66 = $65 << 31 >> 31;
    $67 = (_fmt_u($64,$66,$11)|0);
    $68 = ($67|0)==($11|0);
    if ($68) {
     $69 = ((($10)) + 11|0);
     HEAP8[$69>>0] = 48;
     $$0511 = $69;
    } else {
     $$0511 = $67;
    }
    $70 = $61 >> 31;
    $71 = $70 & 2;
    $72 = (($71) + 43)|0;
    $73 = $72&255;
    $74 = ((($$0511)) + -1|0);
    HEAP8[$74>>0] = $73;
    $75 = (($5) + 15)|0;
    $76 = $75&255;
    $77 = ((($$0511)) + -2|0);
    HEAP8[$77>>0] = $76;
    $notrhs = ($3|0)<(1);
    $78 = $4 & 8;
    $79 = ($78|0)==(0);
    $$0523 = $8;$$2473 = $$1472;
    while(1) {
     $80 = (~~(($$2473)));
     $81 = (34238 + ($80)|0);
     $82 = HEAP8[$81>>0]|0;
     $83 = $82&255;
     $84 = $83 | $42;
     $85 = $84&255;
     $86 = ((($$0523)) + 1|0);
     HEAP8[$$0523>>0] = $85;
     $87 = (+($80|0));
     $88 = $$2473 - $87;
     $89 = $88 * 16.0;
     $90 = $86;
     $91 = (($90) - ($9))|0;
     $92 = ($91|0)==(1);
     if ($92) {
      $notlhs = $89 == 0.0;
      $or$cond3$not = $notrhs & $notlhs;
      $or$cond = $79 & $or$cond3$not;
      if ($or$cond) {
       $$1524 = $86;
      } else {
       $93 = ((($$0523)) + 2|0);
       HEAP8[$86>>0] = 46;
       $$1524 = $93;
      }
     } else {
      $$1524 = $86;
     }
     $94 = $89 != 0.0;
     if ($94) {
      $$0523 = $$1524;$$2473 = $89;
     } else {
      break;
     }
    }
    $95 = ($3|0)!=(0);
    $96 = $77;
    $97 = $11;
    $98 = $$1524;
    $99 = (($98) - ($9))|0;
    $100 = (($97) - ($96))|0;
    $101 = (($99) + -2)|0;
    $102 = ($101|0)<($3|0);
    $or$cond537 = $95 & $102;
    $103 = (($3) + 2)|0;
    $$pn = $or$cond537 ? $103 : $99;
    $$0525 = (($100) + ($45))|0;
    $104 = (($$0525) + ($$pn))|0;
    _pad_596($0,32,$2,$104,$4);
    _out_590($0,$$0521$,$45);
    $105 = $4 ^ 65536;
    _pad_596($0,48,$2,$104,$105);
    _out_590($0,$8,$99);
    $106 = (($$pn) - ($99))|0;
    _pad_596($0,48,$106,0,0);
    _out_590($0,$77,$100);
    $107 = $4 ^ 8192;
    _pad_596($0,32,$2,$104,$107);
    $$sink562 = $104;
    break;
   }
   $108 = ($3|0)<(0);
   $$539 = $108 ? 6 : $3;
   if ($37) {
    $109 = $36 * 268435456.0;
    $110 = HEAP32[$7>>2]|0;
    $111 = (($110) + -28)|0;
    HEAP32[$7>>2] = $111;
    $$3 = $109;$$pr = $111;
   } else {
    $$pre = HEAP32[$7>>2]|0;
    $$3 = $36;$$pr = $$pre;
   }
   $112 = ($$pr|0)<(0);
   $113 = ((($6)) + 288|0);
   $$556 = $112 ? $6 : $113;
   $$0498 = $$556;$$4 = $$3;
   while(1) {
    $114 = (~~(($$4))>>>0);
    HEAP32[$$0498>>2] = $114;
    $115 = ((($$0498)) + 4|0);
    $116 = (+($114>>>0));
    $117 = $$4 - $116;
    $118 = $117 * 1.0E+9;
    $119 = $118 != 0.0;
    if ($119) {
     $$0498 = $115;$$4 = $118;
    } else {
     break;
    }
   }
   $120 = ($$pr|0)>(0);
   if ($120) {
    $$1482661 = $$556;$$1499660 = $115;$121 = $$pr;
    while(1) {
     $122 = ($121|0)<(29);
     $123 = $122 ? $121 : 29;
     $$0488653 = ((($$1499660)) + -4|0);
     $124 = ($$0488653>>>0)<($$1482661>>>0);
     if ($124) {
      $$2483$ph = $$1482661;
     } else {
      $$0488655 = $$0488653;$$0497654 = 0;
      while(1) {
       $125 = HEAP32[$$0488655>>2]|0;
       $126 = (_bitshift64Shl(($125|0),0,($123|0))|0);
       $127 = tempRet0;
       $128 = (_i64Add(($126|0),($127|0),($$0497654|0),0)|0);
       $129 = tempRet0;
       $130 = (___uremdi3(($128|0),($129|0),1000000000,0)|0);
       $131 = tempRet0;
       HEAP32[$$0488655>>2] = $130;
       $132 = (___udivdi3(($128|0),($129|0),1000000000,0)|0);
       $133 = tempRet0;
       $$0488 = ((($$0488655)) + -4|0);
       $134 = ($$0488>>>0)<($$1482661>>>0);
       if ($134) {
        break;
       } else {
        $$0488655 = $$0488;$$0497654 = $132;
       }
      }
      $135 = ($132|0)==(0);
      if ($135) {
       $$2483$ph = $$1482661;
      } else {
       $136 = ((($$1482661)) + -4|0);
       HEAP32[$136>>2] = $132;
       $$2483$ph = $136;
      }
     }
     $$2500 = $$1499660;
     while(1) {
      $137 = ($$2500>>>0)>($$2483$ph>>>0);
      if (!($137)) {
       break;
      }
      $138 = ((($$2500)) + -4|0);
      $139 = HEAP32[$138>>2]|0;
      $140 = ($139|0)==(0);
      if ($140) {
       $$2500 = $138;
      } else {
       break;
      }
     }
     $141 = HEAP32[$7>>2]|0;
     $142 = (($141) - ($123))|0;
     HEAP32[$7>>2] = $142;
     $143 = ($142|0)>(0);
     if ($143) {
      $$1482661 = $$2483$ph;$$1499660 = $$2500;$121 = $142;
     } else {
      $$1482$lcssa = $$2483$ph;$$1499$lcssa = $$2500;$$pr564 = $142;
      break;
     }
    }
   } else {
    $$1482$lcssa = $$556;$$1499$lcssa = $115;$$pr564 = $$pr;
   }
   $144 = ($$pr564|0)<(0);
   if ($144) {
    $145 = (($$539) + 25)|0;
    $146 = (($145|0) / 9)&-1;
    $147 = (($146) + 1)|0;
    $148 = ($40|0)==(102);
    $$3484648 = $$1482$lcssa;$$3501647 = $$1499$lcssa;$150 = $$pr564;
    while(1) {
     $149 = (0 - ($150))|0;
     $151 = ($149|0)<(9);
     $152 = $151 ? $149 : 9;
     $153 = ($$3484648>>>0)<($$3501647>>>0);
     if ($153) {
      $157 = 1 << $152;
      $158 = (($157) + -1)|0;
      $159 = 1000000000 >>> $152;
      $$0487642 = 0;$$1489641 = $$3484648;
      while(1) {
       $160 = HEAP32[$$1489641>>2]|0;
       $161 = $160 & $158;
       $162 = $160 >>> $152;
       $163 = (($162) + ($$0487642))|0;
       HEAP32[$$1489641>>2] = $163;
       $164 = Math_imul($161, $159)|0;
       $165 = ((($$1489641)) + 4|0);
       $166 = ($165>>>0)<($$3501647>>>0);
       if ($166) {
        $$0487642 = $164;$$1489641 = $165;
       } else {
        break;
       }
      }
      $167 = HEAP32[$$3484648>>2]|0;
      $168 = ($167|0)==(0);
      $169 = ((($$3484648)) + 4|0);
      $$$3484 = $168 ? $169 : $$3484648;
      $170 = ($164|0)==(0);
      if ($170) {
       $$$3484692 = $$$3484;$$4502 = $$3501647;
      } else {
       $171 = ((($$3501647)) + 4|0);
       HEAP32[$$3501647>>2] = $164;
       $$$3484692 = $$$3484;$$4502 = $171;
      }
     } else {
      $154 = HEAP32[$$3484648>>2]|0;
      $155 = ($154|0)==(0);
      $156 = ((($$3484648)) + 4|0);
      $$$3484691 = $155 ? $156 : $$3484648;
      $$$3484692 = $$$3484691;$$4502 = $$3501647;
     }
     $172 = $148 ? $$556 : $$$3484692;
     $173 = $$4502;
     $174 = $172;
     $175 = (($173) - ($174))|0;
     $176 = $175 >> 2;
     $177 = ($176|0)>($147|0);
     $178 = (($172) + ($147<<2)|0);
     $$$4502 = $177 ? $178 : $$4502;
     $179 = HEAP32[$7>>2]|0;
     $180 = (($179) + ($152))|0;
     HEAP32[$7>>2] = $180;
     $181 = ($180|0)<(0);
     if ($181) {
      $$3484648 = $$$3484692;$$3501647 = $$$4502;$150 = $180;
     } else {
      $$3484$lcssa = $$$3484692;$$3501$lcssa = $$$4502;
      break;
     }
    }
   } else {
    $$3484$lcssa = $$1482$lcssa;$$3501$lcssa = $$1499$lcssa;
   }
   $182 = ($$3484$lcssa>>>0)<($$3501$lcssa>>>0);
   $183 = $$556;
   if ($182) {
    $184 = $$3484$lcssa;
    $185 = (($183) - ($184))|0;
    $186 = $185 >> 2;
    $187 = ($186*9)|0;
    $188 = HEAP32[$$3484$lcssa>>2]|0;
    $189 = ($188>>>0)<(10);
    if ($189) {
     $$1515 = $187;
    } else {
     $$0514637 = $187;$$0530636 = 10;
     while(1) {
      $190 = ($$0530636*10)|0;
      $191 = (($$0514637) + 1)|0;
      $192 = ($188>>>0)<($190>>>0);
      if ($192) {
       $$1515 = $191;
       break;
      } else {
       $$0514637 = $191;$$0530636 = $190;
      }
     }
    }
   } else {
    $$1515 = 0;
   }
   $193 = ($40|0)!=(102);
   $194 = $193 ? $$1515 : 0;
   $195 = (($$539) - ($194))|0;
   $196 = ($40|0)==(103);
   $197 = ($$539|0)!=(0);
   $198 = $197 & $196;
   $$neg = $198 << 31 >> 31;
   $199 = (($195) + ($$neg))|0;
   $200 = $$3501$lcssa;
   $201 = (($200) - ($183))|0;
   $202 = $201 >> 2;
   $203 = ($202*9)|0;
   $204 = (($203) + -9)|0;
   $205 = ($199|0)<($204|0);
   if ($205) {
    $206 = ((($$556)) + 4|0);
    $207 = (($199) + 9216)|0;
    $208 = (($207|0) / 9)&-1;
    $209 = (($208) + -1024)|0;
    $210 = (($206) + ($209<<2)|0);
    $211 = (($207|0) % 9)&-1;
    $$0527629 = (($211) + 1)|0;
    $212 = ($$0527629|0)<(9);
    if ($212) {
     $$0527631 = $$0527629;$$1531630 = 10;
     while(1) {
      $213 = ($$1531630*10)|0;
      $$0527 = (($$0527631) + 1)|0;
      $exitcond = ($$0527|0)==(9);
      if ($exitcond) {
       $$1531$lcssa = $213;
       break;
      } else {
       $$0527631 = $$0527;$$1531630 = $213;
      }
     }
    } else {
     $$1531$lcssa = 10;
    }
    $214 = HEAP32[$210>>2]|0;
    $215 = (($214>>>0) % ($$1531$lcssa>>>0))&-1;
    $216 = ($215|0)==(0);
    $217 = ((($210)) + 4|0);
    $218 = ($217|0)==($$3501$lcssa|0);
    $or$cond541 = $218 & $216;
    if ($or$cond541) {
     $$4492 = $210;$$4518 = $$1515;$$8 = $$3484$lcssa;
    } else {
     $219 = (($214>>>0) / ($$1531$lcssa>>>0))&-1;
     $220 = $219 & 1;
     $221 = ($220|0)==(0);
     $$542 = $221 ? 9007199254740992.0 : 9007199254740994.0;
     $222 = (($$1531$lcssa|0) / 2)&-1;
     $223 = ($215>>>0)<($222>>>0);
     $224 = ($215|0)==($222|0);
     $or$cond544 = $218 & $224;
     $$559 = $or$cond544 ? 1.0 : 1.5;
     $$$559 = $223 ? 0.5 : $$559;
     $225 = ($$0520|0)==(0);
     if ($225) {
      $$1467 = $$$559;$$1469 = $$542;
     } else {
      $226 = HEAP8[$$0521>>0]|0;
      $227 = ($226<<24>>24)==(45);
      $228 = -$$542;
      $229 = -$$$559;
      $$$542 = $227 ? $228 : $$542;
      $$$$559 = $227 ? $229 : $$$559;
      $$1467 = $$$$559;$$1469 = $$$542;
     }
     $230 = (($214) - ($215))|0;
     HEAP32[$210>>2] = $230;
     $231 = $$1469 + $$1467;
     $232 = $231 != $$1469;
     if ($232) {
      $233 = (($230) + ($$1531$lcssa))|0;
      HEAP32[$210>>2] = $233;
      $234 = ($233>>>0)>(999999999);
      if ($234) {
       $$5486623 = $$3484$lcssa;$$sink545622 = $210;
       while(1) {
        $235 = ((($$sink545622)) + -4|0);
        HEAP32[$$sink545622>>2] = 0;
        $236 = ($235>>>0)<($$5486623>>>0);
        if ($236) {
         $237 = ((($$5486623)) + -4|0);
         HEAP32[$237>>2] = 0;
         $$6 = $237;
        } else {
         $$6 = $$5486623;
        }
        $238 = HEAP32[$235>>2]|0;
        $239 = (($238) + 1)|0;
        HEAP32[$235>>2] = $239;
        $240 = ($239>>>0)>(999999999);
        if ($240) {
         $$5486623 = $$6;$$sink545622 = $235;
        } else {
         $$5486$lcssa = $$6;$$sink545$lcssa = $235;
         break;
        }
       }
      } else {
       $$5486$lcssa = $$3484$lcssa;$$sink545$lcssa = $210;
      }
      $241 = $$5486$lcssa;
      $242 = (($183) - ($241))|0;
      $243 = $242 >> 2;
      $244 = ($243*9)|0;
      $245 = HEAP32[$$5486$lcssa>>2]|0;
      $246 = ($245>>>0)<(10);
      if ($246) {
       $$4492 = $$sink545$lcssa;$$4518 = $244;$$8 = $$5486$lcssa;
      } else {
       $$2516618 = $244;$$2532617 = 10;
       while(1) {
        $247 = ($$2532617*10)|0;
        $248 = (($$2516618) + 1)|0;
        $249 = ($245>>>0)<($247>>>0);
        if ($249) {
         $$4492 = $$sink545$lcssa;$$4518 = $248;$$8 = $$5486$lcssa;
         break;
        } else {
         $$2516618 = $248;$$2532617 = $247;
        }
       }
      }
     } else {
      $$4492 = $210;$$4518 = $$1515;$$8 = $$3484$lcssa;
     }
    }
    $250 = ((($$4492)) + 4|0);
    $251 = ($$3501$lcssa>>>0)>($250>>>0);
    $$$3501 = $251 ? $250 : $$3501$lcssa;
    $$5519$ph = $$4518;$$7505$ph = $$$3501;$$9$ph = $$8;
   } else {
    $$5519$ph = $$1515;$$7505$ph = $$3501$lcssa;$$9$ph = $$3484$lcssa;
   }
   $$7505 = $$7505$ph;
   while(1) {
    $252 = ($$7505>>>0)>($$9$ph>>>0);
    if (!($252)) {
     $$lcssa673 = 0;
     break;
    }
    $253 = ((($$7505)) + -4|0);
    $254 = HEAP32[$253>>2]|0;
    $255 = ($254|0)==(0);
    if ($255) {
     $$7505 = $253;
    } else {
     $$lcssa673 = 1;
     break;
    }
   }
   $256 = (0 - ($$5519$ph))|0;
   do {
    if ($196) {
     $not$ = $197 ^ 1;
     $257 = $not$&1;
     $$539$ = (($257) + ($$539))|0;
     $258 = ($$539$|0)>($$5519$ph|0);
     $259 = ($$5519$ph|0)>(-5);
     $or$cond6 = $258 & $259;
     if ($or$cond6) {
      $260 = (($5) + -1)|0;
      $$neg567 = (($$539$) + -1)|0;
      $261 = (($$neg567) - ($$5519$ph))|0;
      $$0479 = $260;$$2476 = $261;
     } else {
      $262 = (($5) + -2)|0;
      $263 = (($$539$) + -1)|0;
      $$0479 = $262;$$2476 = $263;
     }
     $264 = $4 & 8;
     $265 = ($264|0)==(0);
     if ($265) {
      if ($$lcssa673) {
       $266 = ((($$7505)) + -4|0);
       $267 = HEAP32[$266>>2]|0;
       $268 = ($267|0)==(0);
       if ($268) {
        $$2529 = 9;
       } else {
        $269 = (($267>>>0) % 10)&-1;
        $270 = ($269|0)==(0);
        if ($270) {
         $$1528614 = 0;$$3533613 = 10;
         while(1) {
          $271 = ($$3533613*10)|0;
          $272 = (($$1528614) + 1)|0;
          $273 = (($267>>>0) % ($271>>>0))&-1;
          $274 = ($273|0)==(0);
          if ($274) {
           $$1528614 = $272;$$3533613 = $271;
          } else {
           $$2529 = $272;
           break;
          }
         }
        } else {
         $$2529 = 0;
        }
       }
      } else {
       $$2529 = 9;
      }
      $275 = $$0479 | 32;
      $276 = ($275|0)==(102);
      $277 = $$7505;
      $278 = (($277) - ($183))|0;
      $279 = $278 >> 2;
      $280 = ($279*9)|0;
      $281 = (($280) + -9)|0;
      if ($276) {
       $282 = (($281) - ($$2529))|0;
       $283 = ($282|0)>(0);
       $$546 = $283 ? $282 : 0;
       $284 = ($$2476|0)<($$546|0);
       $$2476$$547 = $284 ? $$2476 : $$546;
       $$1480 = $$0479;$$3477 = $$2476$$547;$$pre$phi690Z2D = 0;
       break;
      } else {
       $285 = (($281) + ($$5519$ph))|0;
       $286 = (($285) - ($$2529))|0;
       $287 = ($286|0)>(0);
       $$548 = $287 ? $286 : 0;
       $288 = ($$2476|0)<($$548|0);
       $$2476$$549 = $288 ? $$2476 : $$548;
       $$1480 = $$0479;$$3477 = $$2476$$549;$$pre$phi690Z2D = 0;
       break;
      }
     } else {
      $$1480 = $$0479;$$3477 = $$2476;$$pre$phi690Z2D = $264;
     }
    } else {
     $$pre689 = $4 & 8;
     $$1480 = $5;$$3477 = $$539;$$pre$phi690Z2D = $$pre689;
    }
   } while(0);
   $289 = $$3477 | $$pre$phi690Z2D;
   $290 = ($289|0)!=(0);
   $291 = $290&1;
   $292 = $$1480 | 32;
   $293 = ($292|0)==(102);
   if ($293) {
    $294 = ($$5519$ph|0)>(0);
    $295 = $294 ? $$5519$ph : 0;
    $$2513 = 0;$$pn566 = $295;
   } else {
    $296 = ($$5519$ph|0)<(0);
    $297 = $296 ? $256 : $$5519$ph;
    $298 = ($297|0)<(0);
    $299 = $298 << 31 >> 31;
    $300 = (_fmt_u($297,$299,$11)|0);
    $301 = $11;
    $302 = $300;
    $303 = (($301) - ($302))|0;
    $304 = ($303|0)<(2);
    if ($304) {
     $$1512607 = $300;
     while(1) {
      $305 = ((($$1512607)) + -1|0);
      HEAP8[$305>>0] = 48;
      $306 = $305;
      $307 = (($301) - ($306))|0;
      $308 = ($307|0)<(2);
      if ($308) {
       $$1512607 = $305;
      } else {
       $$1512$lcssa = $305;
       break;
      }
     }
    } else {
     $$1512$lcssa = $300;
    }
    $309 = $$5519$ph >> 31;
    $310 = $309 & 2;
    $311 = (($310) + 43)|0;
    $312 = $311&255;
    $313 = ((($$1512$lcssa)) + -1|0);
    HEAP8[$313>>0] = $312;
    $314 = $$1480&255;
    $315 = ((($$1512$lcssa)) + -2|0);
    HEAP8[$315>>0] = $314;
    $316 = $315;
    $317 = (($301) - ($316))|0;
    $$2513 = $315;$$pn566 = $317;
   }
   $318 = (($$0520) + 1)|0;
   $319 = (($318) + ($$3477))|0;
   $$1526 = (($319) + ($291))|0;
   $320 = (($$1526) + ($$pn566))|0;
   _pad_596($0,32,$2,$320,$4);
   _out_590($0,$$0521,$$0520);
   $321 = $4 ^ 65536;
   _pad_596($0,48,$2,$320,$321);
   if ($293) {
    $322 = ($$9$ph>>>0)>($$556>>>0);
    $$0496$$9 = $322 ? $$556 : $$9$ph;
    $323 = ((($8)) + 9|0);
    $324 = $323;
    $325 = ((($8)) + 8|0);
    $$5493597 = $$0496$$9;
    while(1) {
     $326 = HEAP32[$$5493597>>2]|0;
     $327 = (_fmt_u($326,0,$323)|0);
     $328 = ($$5493597|0)==($$0496$$9|0);
     if ($328) {
      $334 = ($327|0)==($323|0);
      if ($334) {
       HEAP8[$325>>0] = 48;
       $$1465 = $325;
      } else {
       $$1465 = $327;
      }
     } else {
      $329 = ($327>>>0)>($8>>>0);
      if ($329) {
       $330 = $327;
       $331 = (($330) - ($9))|0;
       _memset(($8|0),48,($331|0))|0;
       $$0464594 = $327;
       while(1) {
        $332 = ((($$0464594)) + -1|0);
        $333 = ($332>>>0)>($8>>>0);
        if ($333) {
         $$0464594 = $332;
        } else {
         $$1465 = $332;
         break;
        }
       }
      } else {
       $$1465 = $327;
      }
     }
     $335 = $$1465;
     $336 = (($324) - ($335))|0;
     _out_590($0,$$1465,$336);
     $337 = ((($$5493597)) + 4|0);
     $338 = ($337>>>0)>($$556>>>0);
     if ($338) {
      break;
     } else {
      $$5493597 = $337;
     }
    }
    $339 = ($289|0)==(0);
    if (!($339)) {
     _out_590($0,34254,1);
    }
    $340 = ($337>>>0)<($$7505>>>0);
    $341 = ($$3477|0)>(0);
    $342 = $340 & $341;
    if ($342) {
     $$4478590 = $$3477;$$6494589 = $337;
     while(1) {
      $343 = HEAP32[$$6494589>>2]|0;
      $344 = (_fmt_u($343,0,$323)|0);
      $345 = ($344>>>0)>($8>>>0);
      if ($345) {
       $346 = $344;
       $347 = (($346) - ($9))|0;
       _memset(($8|0),48,($347|0))|0;
       $$0463584 = $344;
       while(1) {
        $348 = ((($$0463584)) + -1|0);
        $349 = ($348>>>0)>($8>>>0);
        if ($349) {
         $$0463584 = $348;
        } else {
         $$0463$lcssa = $348;
         break;
        }
       }
      } else {
       $$0463$lcssa = $344;
      }
      $350 = ($$4478590|0)<(9);
      $351 = $350 ? $$4478590 : 9;
      _out_590($0,$$0463$lcssa,$351);
      $352 = ((($$6494589)) + 4|0);
      $353 = (($$4478590) + -9)|0;
      $354 = ($352>>>0)<($$7505>>>0);
      $355 = ($$4478590|0)>(9);
      $356 = $354 & $355;
      if ($356) {
       $$4478590 = $353;$$6494589 = $352;
      } else {
       $$4478$lcssa = $353;
       break;
      }
     }
    } else {
     $$4478$lcssa = $$3477;
    }
    $357 = (($$4478$lcssa) + 9)|0;
    _pad_596($0,48,$357,9,0);
   } else {
    $358 = ((($$9$ph)) + 4|0);
    $$7505$ = $$lcssa673 ? $$7505 : $358;
    $359 = ($$3477|0)>(-1);
    if ($359) {
     $360 = ((($8)) + 9|0);
     $361 = ($$pre$phi690Z2D|0)==(0);
     $362 = $360;
     $363 = (0 - ($9))|0;
     $364 = ((($8)) + 8|0);
     $$5602 = $$3477;$$7495601 = $$9$ph;
     while(1) {
      $365 = HEAP32[$$7495601>>2]|0;
      $366 = (_fmt_u($365,0,$360)|0);
      $367 = ($366|0)==($360|0);
      if ($367) {
       HEAP8[$364>>0] = 48;
       $$0 = $364;
      } else {
       $$0 = $366;
      }
      $368 = ($$7495601|0)==($$9$ph|0);
      do {
       if ($368) {
        $372 = ((($$0)) + 1|0);
        _out_590($0,$$0,1);
        $373 = ($$5602|0)<(1);
        $or$cond554 = $361 & $373;
        if ($or$cond554) {
         $$2 = $372;
         break;
        }
        _out_590($0,34254,1);
        $$2 = $372;
       } else {
        $369 = ($$0>>>0)>($8>>>0);
        if (!($369)) {
         $$2 = $$0;
         break;
        }
        $scevgep684 = (($$0) + ($363)|0);
        $scevgep684685 = $scevgep684;
        _memset(($8|0),48,($scevgep684685|0))|0;
        $$1598 = $$0;
        while(1) {
         $370 = ((($$1598)) + -1|0);
         $371 = ($370>>>0)>($8>>>0);
         if ($371) {
          $$1598 = $370;
         } else {
          $$2 = $370;
          break;
         }
        }
       }
      } while(0);
      $374 = $$2;
      $375 = (($362) - ($374))|0;
      $376 = ($$5602|0)>($375|0);
      $377 = $376 ? $375 : $$5602;
      _out_590($0,$$2,$377);
      $378 = (($$5602) - ($375))|0;
      $379 = ((($$7495601)) + 4|0);
      $380 = ($379>>>0)<($$7505$>>>0);
      $381 = ($378|0)>(-1);
      $382 = $380 & $381;
      if ($382) {
       $$5602 = $378;$$7495601 = $379;
      } else {
       $$5$lcssa = $378;
       break;
      }
     }
    } else {
     $$5$lcssa = $$3477;
    }
    $383 = (($$5$lcssa) + 18)|0;
    _pad_596($0,48,$383,18,0);
    $384 = $11;
    $385 = $$2513;
    $386 = (($384) - ($385))|0;
    _out_590($0,$$2513,$386);
   }
   $387 = $4 ^ 8192;
   _pad_596($0,32,$2,$320,$387);
   $$sink562 = $320;
  } else {
   $27 = $5 & 32;
   $28 = ($27|0)!=(0);
   $29 = $28 ? 34222 : 34226;
   $30 = ($$0471 != $$0471) | (0.0 != 0.0);
   $31 = $28 ? 34230 : 34234;
   $$0510 = $30 ? $31 : $29;
   $32 = (($$0520) + 3)|0;
   $33 = $4 & -65537;
   _pad_596($0,32,$2,$32,$33);
   _out_590($0,$$0521,$$0520);
   _out_590($0,$$0510,3);
   $34 = $4 ^ 8192;
   _pad_596($0,32,$2,$32,$34);
   $$sink562 = $32;
  }
 } while(0);
 $388 = ($$sink562|0)<($2|0);
 $$555 = $388 ? $2 : $$sink562;
 STACKTOP = sp;return ($$555|0);
}
function ___DOUBLE_BITS_597($0) {
 $0 = +$0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$1 = HEAP32[tempDoublePtr>>2]|0;
 $2 = HEAP32[tempDoublePtr+4>>2]|0;
 tempRet0 = ($2);
 return ($1|0);
}
function _frexpl($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (+_frexp($0,$1));
 return (+$2);
}
function _frexp($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$0 = 0.0, $$016 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, $storemerge = 0, $trunc$clear = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = (_bitshift64Lshr(($2|0),($3|0),52)|0);
 $5 = tempRet0;
 $6 = $4&65535;
 $trunc$clear = $6 & 2047;
 switch ($trunc$clear<<16>>16) {
 case 0:  {
  $7 = $0 != 0.0;
  if ($7) {
   $8 = $0 * 1.8446744073709552E+19;
   $9 = (+_frexp($8,$1));
   $10 = HEAP32[$1>>2]|0;
   $11 = (($10) + -64)|0;
   $$016 = $9;$storemerge = $11;
  } else {
   $$016 = $0;$storemerge = 0;
  }
  HEAP32[$1>>2] = $storemerge;
  $$0 = $$016;
  break;
 }
 case 2047:  {
  $$0 = $0;
  break;
 }
 default: {
  $12 = $4 & 2047;
  $13 = (($12) + -1022)|0;
  HEAP32[$1>>2] = $13;
  $14 = $3 & -2146435073;
  $15 = $14 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $2;HEAP32[tempDoublePtr+4>>2] = $15;$16 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $16;
 }
 }
 return (+$$0);
}
function _wcrtomb($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0|0);
 do {
  if ($3) {
   $$0 = 1;
  } else {
   $4 = ($1>>>0)<(128);
   if ($4) {
    $5 = $1&255;
    HEAP8[$0>>0] = $5;
    $$0 = 1;
    break;
   }
   $6 = (___pthread_self_847()|0);
   $7 = ((($6)) + 188|0);
   $8 = HEAP32[$7>>2]|0;
   $9 = HEAP32[$8>>2]|0;
   $not$ = ($9|0)==(0|0);
   if ($not$) {
    $10 = $1 & -128;
    $11 = ($10|0)==(57216);
    if ($11) {
     $13 = $1&255;
     HEAP8[$0>>0] = $13;
     $$0 = 1;
     break;
    } else {
     $12 = (___errno_location()|0);
     HEAP32[$12>>2] = 84;
     $$0 = -1;
     break;
    }
   }
   $14 = ($1>>>0)<(2048);
   if ($14) {
    $15 = $1 >>> 6;
    $16 = $15 | 192;
    $17 = $16&255;
    $18 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $17;
    $19 = $1 & 63;
    $20 = $19 | 128;
    $21 = $20&255;
    HEAP8[$18>>0] = $21;
    $$0 = 2;
    break;
   }
   $22 = ($1>>>0)<(55296);
   $23 = $1 & -8192;
   $24 = ($23|0)==(57344);
   $or$cond = $22 | $24;
   if ($or$cond) {
    $25 = $1 >>> 12;
    $26 = $25 | 224;
    $27 = $26&255;
    $28 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $27;
    $29 = $1 >>> 6;
    $30 = $29 & 63;
    $31 = $30 | 128;
    $32 = $31&255;
    $33 = ((($0)) + 2|0);
    HEAP8[$28>>0] = $32;
    $34 = $1 & 63;
    $35 = $34 | 128;
    $36 = $35&255;
    HEAP8[$33>>0] = $36;
    $$0 = 3;
    break;
   }
   $37 = (($1) + -65536)|0;
   $38 = ($37>>>0)<(1048576);
   if ($38) {
    $39 = $1 >>> 18;
    $40 = $39 | 240;
    $41 = $40&255;
    $42 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $41;
    $43 = $1 >>> 12;
    $44 = $43 & 63;
    $45 = $44 | 128;
    $46 = $45&255;
    $47 = ((($0)) + 2|0);
    HEAP8[$42>>0] = $46;
    $48 = $1 >>> 6;
    $49 = $48 & 63;
    $50 = $49 | 128;
    $51 = $50&255;
    $52 = ((($0)) + 3|0);
    HEAP8[$47>>0] = $51;
    $53 = $1 & 63;
    $54 = $53 | 128;
    $55 = $54&255;
    HEAP8[$52>>0] = $55;
    $$0 = 4;
    break;
   } else {
    $56 = (___errno_location()|0);
    HEAP32[$56>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___pthread_self_847() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___pthread_self_266() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___strerror_l($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$012$lcssa = 0, $$01214 = 0, $$016 = 0, $$113 = 0, $$115 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $$016 = 0;
 while(1) {
  $3 = (34256 + ($$016)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = ($5|0)==($0|0);
  if ($6) {
   label = 2;
   break;
  }
  $7 = (($$016) + 1)|0;
  $8 = ($7|0)==(87);
  if ($8) {
   $$01214 = 34344;$$115 = 87;
   label = 5;
   break;
  } else {
   $$016 = $7;
  }
 }
 if ((label|0) == 2) {
  $2 = ($$016|0)==(0);
  if ($2) {
   $$012$lcssa = 34344;
  } else {
   $$01214 = 34344;$$115 = $$016;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $$113 = $$01214;
   while(1) {
    $9 = HEAP8[$$113>>0]|0;
    $10 = ($9<<24>>24)==(0);
    $11 = ((($$113)) + 1|0);
    if ($10) {
     break;
    } else {
     $$113 = $11;
    }
   }
   $12 = (($$115) + -1)|0;
   $13 = ($12|0)==(0);
   if ($13) {
    $$012$lcssa = $11;
    break;
   } else {
    $$01214 = $11;$$115 = $12;
    label = 5;
   }
  }
 }
 $14 = ((($1)) + 20|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (___lctrans($$012$lcssa,$15)|0);
 return ($16|0);
}
function ___lctrans($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (___lctrans_impl($0,$1)|0);
 return ($2|0);
}
function ___lctrans_impl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = HEAP32[$1>>2]|0;
  $4 = ((($1)) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = (___mo_lookup($3,$5,$0)|0);
  $$0 = $6;
 }
 $7 = ($$0|0)!=(0|0);
 $8 = $7 ? $$0 : $0;
 return ($8|0);
}
function ___mo_lookup($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$090 = 0, $$094 = 0, $$191 = 0, $$195 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond102 = 0, $or$cond104 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($3) + 1794895138)|0;
 $5 = ((($0)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (_swapc($6,$4)|0);
 $8 = ((($0)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (_swapc($9,$4)|0);
 $11 = ((($0)) + 16|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = (_swapc($12,$4)|0);
 $14 = $1 >>> 2;
 $15 = ($7>>>0)<($14>>>0);
 L1: do {
  if ($15) {
   $16 = $7 << 2;
   $17 = (($1) - ($16))|0;
   $18 = ($10>>>0)<($17>>>0);
   $19 = ($13>>>0)<($17>>>0);
   $or$cond = $18 & $19;
   if ($or$cond) {
    $20 = $13 | $10;
    $21 = $20 & 3;
    $22 = ($21|0)==(0);
    if ($22) {
     $23 = $10 >>> 2;
     $24 = $13 >>> 2;
     $$090 = 0;$$094 = $7;
     while(1) {
      $25 = $$094 >>> 1;
      $26 = (($$090) + ($25))|0;
      $27 = $26 << 1;
      $28 = (($27) + ($23))|0;
      $29 = (($0) + ($28<<2)|0);
      $30 = HEAP32[$29>>2]|0;
      $31 = (_swapc($30,$4)|0);
      $32 = (($28) + 1)|0;
      $33 = (($0) + ($32<<2)|0);
      $34 = HEAP32[$33>>2]|0;
      $35 = (_swapc($34,$4)|0);
      $36 = ($35>>>0)<($1>>>0);
      $37 = (($1) - ($35))|0;
      $38 = ($31>>>0)<($37>>>0);
      $or$cond102 = $36 & $38;
      if (!($or$cond102)) {
       $$4 = 0;
       break L1;
      }
      $39 = (($35) + ($31))|0;
      $40 = (($0) + ($39)|0);
      $41 = HEAP8[$40>>0]|0;
      $42 = ($41<<24>>24)==(0);
      if (!($42)) {
       $$4 = 0;
       break L1;
      }
      $43 = (($0) + ($35)|0);
      $44 = (_strcmp($2,$43)|0);
      $45 = ($44|0)==(0);
      if ($45) {
       break;
      }
      $62 = ($$094|0)==(1);
      $63 = ($44|0)<(0);
      $64 = (($$094) - ($25))|0;
      $$195 = $63 ? $25 : $64;
      $$191 = $63 ? $$090 : $26;
      if ($62) {
       $$4 = 0;
       break L1;
      } else {
       $$090 = $$191;$$094 = $$195;
      }
     }
     $46 = (($27) + ($24))|0;
     $47 = (($0) + ($46<<2)|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = (_swapc($48,$4)|0);
     $50 = (($46) + 1)|0;
     $51 = (($0) + ($50<<2)|0);
     $52 = HEAP32[$51>>2]|0;
     $53 = (_swapc($52,$4)|0);
     $54 = ($53>>>0)<($1>>>0);
     $55 = (($1) - ($53))|0;
     $56 = ($49>>>0)<($55>>>0);
     $or$cond104 = $54 & $56;
     if ($or$cond104) {
      $57 = (($0) + ($53)|0);
      $58 = (($53) + ($49))|0;
      $59 = (($0) + ($58)|0);
      $60 = HEAP8[$59>>0]|0;
      $61 = ($60<<24>>24)==(0);
      $$ = $61 ? $57 : 0;
      $$4 = $$;
     } else {
      $$4 = 0;
     }
    } else {
     $$4 = 0;
    }
   } else {
    $$4 = 0;
   }
  } else {
   $$4 = 0;
  }
 } while(0);
 return ($$4|0);
}
function _swapc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0);
 $3 = (_llvm_bswap_i32(($0|0))|0);
 $$ = $2 ? $0 : $3;
 return ($$|0);
}
function _strcmp($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = ($2<<24>>24)!=($3<<24>>24);
 $5 = ($2<<24>>24)==(0);
 $or$cond9 = $5 | $4;
 if ($or$cond9) {
  $$lcssa = $3;$$lcssa8 = $2;
 } else {
  $$011 = $1;$$0710 = $0;
  while(1) {
   $6 = ((($$0710)) + 1|0);
   $7 = ((($$011)) + 1|0);
   $8 = HEAP8[$6>>0]|0;
   $9 = HEAP8[$7>>0]|0;
   $10 = ($8<<24>>24)!=($9<<24>>24);
   $11 = ($8<<24>>24)==(0);
   $or$cond = $11 | $10;
   if ($or$cond) {
    $$lcssa = $9;$$lcssa8 = $8;
    break;
   } else {
    $$011 = $7;$$0710 = $6;
   }
  }
 }
 $12 = $$lcssa8&255;
 $13 = $$lcssa&255;
 $14 = (($12) - ($13))|0;
 return ($14|0);
}
function ___fwritex($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$038 = 0, $$042 = 0, $$1 = 0, $$139 = 0, $$141 = 0, $$143 = 0, $$pre = 0, $$pre47 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($2)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $7 = (___towrite($2)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$3>>2]|0;
   $12 = $$pre;
   label = 5;
  } else {
   $$1 = 0;
  }
 } else {
  $6 = $4;
  $12 = $6;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $9 = ((($2)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($12) - ($10))|0;
   $13 = ($11>>>0)<($1>>>0);
   $14 = $10;
   if ($13) {
    $15 = ((($2)) + 36|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = (FUNCTION_TABLE_iiii[$16 & 1]($2,$0,$1)|0);
    $$1 = $17;
    break;
   }
   $18 = ((($2)) + 75|0);
   $19 = HEAP8[$18>>0]|0;
   $20 = ($19<<24>>24)>(-1);
   L10: do {
    if ($20) {
     $$038 = $1;
     while(1) {
      $21 = ($$038|0)==(0);
      if ($21) {
       $$139 = 0;$$141 = $0;$$143 = $1;$31 = $14;
       break L10;
      }
      $22 = (($$038) + -1)|0;
      $23 = (($0) + ($22)|0);
      $24 = HEAP8[$23>>0]|0;
      $25 = ($24<<24>>24)==(10);
      if ($25) {
       break;
      } else {
       $$038 = $22;
      }
     }
     $26 = ((($2)) + 36|0);
     $27 = HEAP32[$26>>2]|0;
     $28 = (FUNCTION_TABLE_iiii[$27 & 1]($2,$0,$$038)|0);
     $29 = ($28>>>0)<($$038>>>0);
     if ($29) {
      $$1 = $28;
      break L5;
     }
     $30 = (($0) + ($$038)|0);
     $$042 = (($1) - ($$038))|0;
     $$pre47 = HEAP32[$9>>2]|0;
     $$139 = $$038;$$141 = $30;$$143 = $$042;$31 = $$pre47;
    } else {
     $$139 = 0;$$141 = $0;$$143 = $1;$31 = $14;
    }
   } while(0);
   _memcpy(($31|0),($$141|0),($$143|0))|0;
   $32 = HEAP32[$9>>2]|0;
   $33 = (($32) + ($$143)|0);
   HEAP32[$9>>2] = $33;
   $34 = (($$139) + ($$143))|0;
   $$1 = $34;
  }
 } while(0);
 return ($$1|0);
}
function ___towrite($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 74|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (($3) + 255)|0;
 $5 = $4 | $3;
 $6 = $5&255;
 HEAP8[$1>>0] = $6;
 $7 = HEAP32[$0>>2]|0;
 $8 = $7 & 8;
 $9 = ($8|0)==(0);
 if ($9) {
  $11 = ((($0)) + 8|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($0)) + 4|0);
  HEAP32[$12>>2] = 0;
  $13 = ((($0)) + 44|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($0)) + 28|0);
  HEAP32[$15>>2] = $14;
  $16 = ((($0)) + 20|0);
  HEAP32[$16>>2] = $14;
  $17 = ((($0)) + 48|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = (($14) + ($18)|0);
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = $19;
  $$0 = 0;
 } else {
  $10 = $7 | 32;
  HEAP32[$0>>2] = $10;
  $$0 = -1;
 }
 return ($$0|0);
}
function _memcmp($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$01318 = 0, $$01417 = 0, $$019 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $14 = 0;
  } else {
   $$01318 = $0;$$01417 = $2;$$019 = $1;
   while(1) {
    $4 = HEAP8[$$01318>>0]|0;
    $5 = HEAP8[$$019>>0]|0;
    $6 = ($4<<24>>24)==($5<<24>>24);
    if (!($6)) {
     break;
    }
    $7 = (($$01417) + -1)|0;
    $8 = ((($$01318)) + 1|0);
    $9 = ((($$019)) + 1|0);
    $10 = ($7|0)==(0);
    if ($10) {
     $14 = 0;
     break L1;
    } else {
     $$01318 = $8;$$01417 = $7;$$019 = $9;
    }
   }
   $11 = $4&255;
   $12 = $5&255;
   $13 = (($11) - ($12))|0;
   $14 = $13;
  }
 } while(0);
 return ($14|0);
}
function _vsnprintf($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$$015 = 0, $$0 = 0, $$014 = 0, $$015 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $4 = sp + 124|0;
 $5 = sp;
 dest=$5; src=33532; stop=dest+124|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $6 = (($1) + -1)|0;
 $7 = ($6>>>0)>(2147483646);
 if ($7) {
  $8 = ($1|0)==(0);
  if ($8) {
   $$014 = $4;$$015 = 1;
   label = 4;
  } else {
   $9 = (___errno_location()|0);
   HEAP32[$9>>2] = 75;
   $$0 = -1;
  }
 } else {
  $$014 = $0;$$015 = $1;
  label = 4;
 }
 if ((label|0) == 4) {
  $10 = $$014;
  $11 = (-2 - ($10))|0;
  $12 = ($$015>>>0)>($11>>>0);
  $$$015 = $12 ? $11 : $$015;
  $13 = ((($5)) + 48|0);
  HEAP32[$13>>2] = $$$015;
  $14 = ((($5)) + 20|0);
  HEAP32[$14>>2] = $$014;
  $15 = ((($5)) + 44|0);
  HEAP32[$15>>2] = $$014;
  $16 = (($$014) + ($$$015)|0);
  $17 = ((($5)) + 16|0);
  HEAP32[$17>>2] = $16;
  $18 = ((($5)) + 28|0);
  HEAP32[$18>>2] = $16;
  $19 = (_vfprintf($5,$2,$3)|0);
  $20 = ($$$015|0)==(0);
  if ($20) {
   $$0 = $19;
  } else {
   $21 = HEAP32[$14>>2]|0;
   $22 = HEAP32[$17>>2]|0;
   $23 = ($21|0)==($22|0);
   $24 = $23 << 31 >> 31;
   $25 = (($21) + ($24)|0);
   HEAP8[$25>>0] = 0;
   $$0 = $19;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _sn_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($0)) + 20|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6;
 $8 = (($4) - ($7))|0;
 $9 = ($8>>>0)>($2>>>0);
 $$ = $9 ? $2 : $8;
 _memcpy(($6|0),($1|0),($$|0))|0;
 $10 = HEAP32[$5>>2]|0;
 $11 = (($10) + ($$)|0);
 HEAP32[$5>>2] = $11;
 return ($2|0);
}
function _sprintf($0,$1,$varargs) {
 $0 = $0|0;
 $1 = $1|0;
 $varargs = $varargs|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 HEAP32[$2>>2] = $varargs;
 $3 = (_vsprintf($0,$1,$2)|0);
 STACKTOP = sp;return ($3|0);
}
function _vsprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_vsnprintf($0,2147483647,$1,$2)|0);
 return ($3|0);
}
function _htonl($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___bswap_32_339($0)|0);
 return ($1|0);
}
function ___bswap_32_339($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_llvm_bswap_i32(($0|0))|0);
 return ($1|0);
}
function _ntohl($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___bswap_32($0)|0);
 return ($1|0);
}
function ___bswap_32($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_llvm_bswap_i32(($0|0))|0);
 return ($1|0);
}
function runPostSets() {
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _llvm_bswap_i32(x) {
    x = x|0;
    return (((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24))|0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $rem = 0, __stackBase__ = 0;
    __stackBase__ = STACKTOP;
    STACKTOP = STACKTOP + 16 | 0;
    $rem = __stackBase__ | 0;
    ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
    STACKTOP = __stackBase__;
    return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function _llvm_bswap_i16(x) {
    x = x|0;
    return (((x&0xff)<<8) | ((x>>8)&0xff))|0;
}
function ___muldsi3($a, $b) {
    $a = $a | 0;
    $b = $b | 0;
    var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
    $1 = $a & 65535;
    $2 = $b & 65535;
    $3 = Math_imul($2, $1) | 0;
    $6 = $a >>> 16;
    $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
    $11 = $b >>> 16;
    $12 = Math_imul($11, $1) | 0;
    return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
    $x_sroa_0_0_extract_trunc = $a$0;
    $y_sroa_0_0_extract_trunc = $b$0;
    $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
    $1$1 = tempRet0;
    $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
    return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}

  
function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&1](a1|0,a2|0,a3|0)|0;
}


function dynCall_vii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  FUNCTION_TABLE_vii[index&0](a1|0,a2|0);
}


function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&0](a1|0,a2|0)|0;
}

function b0(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(0);return 0;
}
function b1(p0,p1) {
 p0 = p0|0;p1 = p1|0; abort(1);
}
function b2(p0,p1) {
 p0 = p0|0;p1 = p1|0; abort(2);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_iiii = [b0,_sn_write];
var FUNCTION_TABLE_vii = [b1];
var FUNCTION_TABLE_iii = [b2];

  return { _llvm_bswap_i32: _llvm_bswap_i32, _nimiq_hard_verify: _nimiq_hard_verify, _i64Subtract: _i64Subtract, ___udivdi3: ___udivdi3, setThrew: setThrew, _ed25519_sign: _ed25519_sign, _bitshift64Lshr: _bitshift64Lshr, _nimiq_hard_hash_target: _nimiq_hard_hash_target, _bitshift64Shl: _bitshift64Shl, dynCall_iii: dynCall_iii, _bitshift64Ashr: _bitshift64Ashr, _memset: _memset, _sbrk: _sbrk, _memcpy: _memcpy, stackAlloc: stackAlloc, ___muldi3: ___muldi3, dynCall_vii: dynCall_vii, _nimiq_hard_hash: _nimiq_hard_hash, _ed25519_public_key_derive: _ed25519_public_key_derive, setTempRet0: setTempRet0, _i64Add: _i64Add, dynCall_iiii: dynCall_iiii, _llvm_bswap_i16: _llvm_bswap_i16, _emscripten_get_global_libc: _emscripten_get_global_libc, _ed25519_verify: _ed25519_verify, _get_static_memory_size: _get_static_memory_size, stackSave: stackSave, _nimiq_light_hash: _nimiq_light_hash, _free: _free, runPostSets: runPostSets, getTempRet0: getTempRet0, ___uremdi3: ___uremdi3, stackRestore: stackRestore, _malloc: _malloc, establishStackSpace: establishStackSpace, _ed25519_public_key_x: _ed25519_public_key_x, _get_static_memory_start: _get_static_memory_start };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var _nimiq_hard_verify = Module["_nimiq_hard_verify"] = asm["_nimiq_hard_verify"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var _ed25519_public_key_derive = Module["_ed25519_public_key_derive"] = asm["_ed25519_public_key_derive"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var _ed25519_sign = Module["_ed25519_sign"] = asm["_ed25519_sign"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _nimiq_hard_hash_target = Module["_nimiq_hard_hash_target"] = asm["_nimiq_hard_hash_target"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var _nimiq_hard_hash = Module["_nimiq_hard_hash"] = asm["_nimiq_hard_hash"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _llvm_bswap_i16 = Module["_llvm_bswap_i16"] = asm["_llvm_bswap_i16"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var _ed25519_verify = Module["_ed25519_verify"] = asm["_ed25519_verify"];
var _get_static_memory_size = Module["_get_static_memory_size"] = asm["_get_static_memory_size"];
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _nimiq_light_hash = Module["_nimiq_light_hash"] = asm["_nimiq_light_hash"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _ed25519_public_key_x = Module["_ed25519_public_key_x"] = asm["_ed25519_public_key_x"];
var _get_static_memory_start = Module["_get_static_memory_start"] = asm["_get_static_memory_start"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
;
Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];
Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];


// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;






// Modularize mode returns a function, which can be called to
// create instances. The instances provide a then() method,
// must like a Promise, that receives a callback. The callback
// is called when the module is ready to run, with the module
// as a parameter. (Like a Promise, it also returns the module
// so you can use the output of .then(..)).
Module['then'] = function(func) {
  // We may already be ready to run code at this time. if
  // so, just queue a call to the callback.
  if (Module['calledRun']) {
    func(Module);
  } else {
    // we are not ready to call then() yet. we must call it
    // at the same time we would call onRuntimeInitialized.
    var old = Module['onRuntimeInitialized'];
    Module['onRuntimeInitialized'] = function() {
      if (old) old();
      func(Module);
    };
  }
  return Module;
};

/**
 * @constructor
 * @extends {Error}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      Module.printErr('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}




  return Module;
};
if (typeof module === "object" && module.exports) {
  module['exports'] = Module;
};
