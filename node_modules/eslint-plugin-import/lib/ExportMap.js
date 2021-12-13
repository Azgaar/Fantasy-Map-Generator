'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();exports.



























































































































































































































































































































































































































































































































































































































































































































































recursivePatternCapture = recursivePatternCapture;var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _path = require('path');var _doctrine = require('doctrine');var _doctrine2 = _interopRequireDefault(_doctrine);var _debug = require('debug');var _debug2 = _interopRequireDefault(_debug);var _eslint = require('eslint');var _parse = require('eslint-module-utils/parse');var _parse2 = _interopRequireDefault(_parse);var _visit = require('eslint-module-utils/visit');var _visit2 = _interopRequireDefault(_visit);var _resolve = require('eslint-module-utils/resolve');var _resolve2 = _interopRequireDefault(_resolve);var _ignore = require('eslint-module-utils/ignore');var _ignore2 = _interopRequireDefault(_ignore);var _hash = require('eslint-module-utils/hash');var _unambiguous = require('eslint-module-utils/unambiguous');var unambiguous = _interopRequireWildcard(_unambiguous);var _tsconfigLoader = require('tsconfig-paths/lib/tsconfig-loader');var _arrayIncludes = require('array-includes');var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);function _interopRequireWildcard(obj) {if (obj && obj.__esModule) {return obj;} else {var newObj = {};if (obj != null) {for (var key in obj) {if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];}}newObj['default'] = obj;return newObj;}}function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var ts = void 0;var log = (0, _debug2['default'])('eslint-plugin-import:ExportMap');var exportCache = new Map();var tsConfigCache = new Map();var ExportMap = function () {function ExportMap(path) {_classCallCheck(this, ExportMap);this.path = path;this.namespace = new Map(); // todo: restructure to key on path, value is resolver + map of names
    this.reexports = new Map(); /**
                                 * star-exports
                                 * @type {Set} of () => ExportMap
                                 */this.dependencies = new Set(); /**
                                                                   * dependencies of this module that are not explicitly re-exported
                                                                   * @type {Map} from path = () => ExportMap
                                                                   */this.imports = new Map();this.errors = [];}_createClass(ExportMap, [{ key: 'has', /**
                                                                                                                                                        * Note that this does not check explicitly re-exported names for existence
                                                                                                                                                        * in the base namespace, but it will expand all `export * from '...'` exports
                                                                                                                                                        * if not found in the explicit namespace.
                                                                                                                                                        * @param  {string}  name
                                                                                                                                                        * @return {Boolean} true if `name` is exported by this module.
                                                                                                                                                        */value: function () {function has(name) {if (this.namespace.has(name)) return true;if (this.reexports.has(name)) return true; // default exports must be explicitly re-exported (#328)
        if (name !== 'default') {var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {for (var _iterator = this.dependencies[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var dep = _step.value;var innerMap = dep(); // todo: report as unresolved?
              if (!innerMap) continue;if (innerMap.has(name)) return true;}} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator['return']) {_iterator['return']();}} finally {if (_didIteratorError) {throw _iteratorError;}}}}return false;}return has;}() /**
                                                                                                                                                                                                                                                                                                                                 * ensure that imported name fully resolves.
                                                                                                                                                                                                                                                                                                                                 * @param  {string} name
                                                                                                                                                                                                                                                                                                                                 * @return {{ found: boolean, path: ExportMap[] }}
                                                                                                                                                                                                                                                                                                                                 */ }, { key: 'hasDeep', value: function () {function hasDeep(name) {if (this.namespace.has(name)) return { found: true, path: [this] };if (this.reexports.has(name)) {var reexports = this.reexports.get(name);var imported = reexports.getImport(); // if import is ignored, return explicit 'null'
          if (imported == null) return { found: true, path: [this] }; // safeguard against cycles, only if name matches
          if (imported.path === this.path && reexports.local === name) {return { found: false, path: [this] };}var deep = imported.hasDeep(reexports.local);deep.path.unshift(this);return deep;} // default exports must be explicitly re-exported (#328)
        if (name !== 'default') {var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {for (var _iterator2 = this.dependencies[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var dep = _step2.value;var innerMap = dep();if (innerMap == null) return { found: true, path: [this] }; // todo: report as unresolved?
              if (!innerMap) continue; // safeguard against cycles
              if (innerMap.path === this.path) continue;var innerValue = innerMap.hasDeep(name);if (innerValue.found) {innerValue.path.unshift(this);return innerValue;}}} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2['return']) {_iterator2['return']();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}}return { found: false, path: [this] };}return hasDeep;}() }, { key: 'get', value: function () {function get(name) {if (this.namespace.has(name)) return this.namespace.get(name);if (this.reexports.has(name)) {var reexports = this.reexports.get(name);var imported = reexports.getImport(); // if import is ignored, return explicit 'null'
          if (imported == null) return null; // safeguard against cycles, only if name matches
          if (imported.path === this.path && reexports.local === name) return undefined;return imported.get(reexports.local);} // default exports must be explicitly re-exported (#328)
        if (name !== 'default') {var _iteratorNormalCompletion3 = true;var _didIteratorError3 = false;var _iteratorError3 = undefined;try {for (var _iterator3 = this.dependencies[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {var dep = _step3.value;var innerMap = dep(); // todo: report as unresolved?
              if (!innerMap) continue; // safeguard against cycles
              if (innerMap.path === this.path) continue;var innerValue = innerMap.get(name);if (innerValue !== undefined) return innerValue;}} catch (err) {_didIteratorError3 = true;_iteratorError3 = err;} finally {try {if (!_iteratorNormalCompletion3 && _iterator3['return']) {_iterator3['return']();}} finally {if (_didIteratorError3) {throw _iteratorError3;}}}}return undefined;}return get;}() }, { key: 'forEach', value: function () {function forEach(callback, thisArg) {var _this = this;this.namespace.forEach(function (v, n) {return callback.call(thisArg, v, n, _this);});this.reexports.forEach(function (reexports, name) {var reexported = reexports.getImport(); // can't look up meta for ignored re-exports (#348)
          callback.call(thisArg, reexported && reexported.get(reexports.local), name, _this);});this.dependencies.forEach(function (dep) {var d = dep(); // CJS / ignored dependencies won't exist (#717)
          if (d == null) return;d.forEach(function (v, n) {return n !== 'default' && callback.call(thisArg, v, n, _this);});});}return forEach;}() // todo: keys, values, entries?
  }, { key: 'reportErrors', value: function () {function reportErrors(context, declaration) {context.report({ node: declaration.source, message: 'Parse errors in imported module \'' + String(declaration.source.value) + '\': ' + ('' + String(this.errors.map(function (e) {return String(e.message) + ' (' + String(e.lineNumber) + ':' + String(e.column) + ')';}).join(', '))) });}return reportErrors;}() }, { key: 'hasDefault', get: function () {function get() {return this.get('default') != null;}return get;}() // stronger than this.has
  }, { key: 'size', get: function () {function get() {var size = this.namespace.size + this.reexports.size;this.dependencies.forEach(function (dep) {var d = dep(); // CJS / ignored dependencies won't exist (#717)
          if (d == null) return;size += d.size;});return size;}return get;}() }]);return ExportMap;}(); /**
                                                                                                         * parse docs from the first node that has leading comments
                                                                                                         */exports['default'] = ExportMap;function captureDoc(source, docStyleParsers) {var metadata = {}; // 'some' short-circuits on first 'true'
  for (var _len = arguments.length, nodes = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {nodes[_key - 2] = arguments[_key];}nodes.some(function (n) {try {var leadingComments = void 0; // n.leadingComments is legacy `attachComments` behavior
      if ('leadingComments' in n) {leadingComments = n.leadingComments;} else if (n.range) {leadingComments = source.getCommentsBefore(n);}if (!leadingComments || leadingComments.length === 0) return false;for (var name in docStyleParsers) {var doc = docStyleParsers[name](leadingComments);if (doc) {metadata.doc = doc;}}return true;} catch (err) {return false;}});return metadata;}var availableDocStyleParsers = { jsdoc: captureJsDoc, tomdoc: captureTomDoc }; /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                              * parse JSDoc from leading comments
                                                                                                                                                                                                                                                                                                                                                                                                                                                                              * @param {object[]} comments
                                                                                                                                                                                                                                                                                                                                                                                                                                                                              * @return {{ doc: object }}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                              */function captureJsDoc(comments) {var doc = void 0; // capture XSDoc
  comments.forEach(function (comment) {// skip non-block comments
    if (comment.type !== 'Block') return;try {doc = _doctrine2['default'].parse(comment.value, { unwrap: true });} catch (err) {/* don't care, for now? maybe add to `errors?` */}});return doc;} /**
                                                                                                                                                                                                    * parse TomDoc section from comments
                                                                                                                                                                                                    */function captureTomDoc(comments) {// collect lines up to first paragraph break
  var lines = [];for (var i = 0; i < comments.length; i++) {var comment = comments[i];if (comment.value.match(/^\s*$/)) break;lines.push(comment.value.trim());} // return doctrine-like object
  var statusMatch = lines.join(' ').match(/^(Public|Internal|Deprecated):\s*(.+)/);if (statusMatch) {return { description: statusMatch[2], tags: [{ title: statusMatch[1].toLowerCase(), description: statusMatch[2] }] };}}var supportedImportTypes = new Set(['ImportDefaultSpecifier', 'ImportNamespaceSpecifier']);ExportMap.get = function (source, context) {var path = (0, _resolve2['default'])(source, context);if (path == null) return null;return ExportMap['for'](childContext(path, context));};ExportMap['for'] = function (context) {var path = context.path;var cacheKey = (0, _hash.hashObject)(context).digest('hex');var exportMap = exportCache.get(cacheKey); // return cached ignore
  if (exportMap === null) return null;var stats = _fs2['default'].statSync(path);if (exportMap != null) {// date equality check
    if (exportMap.mtime - stats.mtime === 0) {return exportMap;} // future: check content equality?
  } // check valid extensions first
  if (!(0, _ignore.hasValidExtension)(path, context)) {exportCache.set(cacheKey, null);return null;} // check for and cache ignore
  if ((0, _ignore2['default'])(path, context)) {log('ignored path due to ignore settings:', path);exportCache.set(cacheKey, null);return null;}var content = _fs2['default'].readFileSync(path, { encoding: 'utf8' }); // check for and cache unambiguous modules
  if (!unambiguous.test(content)) {log('ignored path due to unambiguous regex:', path);exportCache.set(cacheKey, null);return null;}log('cache miss', cacheKey, 'for path', path);exportMap = ExportMap.parse(path, content, context); // ambiguous modules return null
  if (exportMap == null) return null;exportMap.mtime = stats.mtime;exportCache.set(cacheKey, exportMap);return exportMap;};ExportMap.parse = function (path, content, context) {var m = new ExportMap(path);var isEsModuleInteropTrue = isEsModuleInterop();var ast = void 0;var visitorKeys = void 0;try {var result = (0, _parse2['default'])(path, content, context);ast = result.ast;visitorKeys = result.visitorKeys;} catch (err) {m.errors.push(err);return m; // can't continue
  }m.visitorKeys = visitorKeys;var hasDynamicImports = false;function processDynamicImport(source) {hasDynamicImports = true;if (source.type !== 'Literal') {return null;}var p = remotePath(source.value);if (p == null) {return null;}var importedSpecifiers = new Set();importedSpecifiers.add('ImportNamespaceSpecifier');var getter = thunkFor(p, context);m.imports.set(p, { getter: getter, declarations: new Set([{ source: { // capturing actual node reference holds full AST in memory!
          value: source.value, loc: source.loc }, importedSpecifiers: importedSpecifiers }]) });}(0, _visit2['default'])(ast, visitorKeys, { ImportExpression: function () {function ImportExpression(node) {processDynamicImport(node.source);}return ImportExpression;}(), CallExpression: function () {function CallExpression(node) {if (node.callee.type === 'Import') {processDynamicImport(node.arguments[0]);}}return CallExpression;}() });if (!unambiguous.isModule(ast) && !hasDynamicImports) return null;var docstyle = context.settings && context.settings['import/docstyle'] || ['jsdoc'];var docStyleParsers = {};docstyle.forEach(function (style) {docStyleParsers[style] = availableDocStyleParsers[style];}); // attempt to collect module doc
  if (ast.comments) {ast.comments.some(function (c) {if (c.type !== 'Block') return false;try {var doc = _doctrine2['default'].parse(c.value, { unwrap: true });if (doc.tags.some(function (t) {return t.title === 'module';})) {m.doc = doc;return true;}} catch (err) {/* ignore */}return false;});}var namespaces = new Map();function remotePath(value) {return _resolve2['default'].relative(value, path, context.settings);}function resolveImport(value) {var rp = remotePath(value);if (rp == null) return null;return ExportMap['for'](childContext(rp, context));}function getNamespace(identifier) {if (!namespaces.has(identifier.name)) return;return function () {return resolveImport(namespaces.get(identifier.name));};}function addNamespace(object, identifier) {var nsfn = getNamespace(identifier);if (nsfn) {Object.defineProperty(object, 'namespace', { get: nsfn });}return object;}function processSpecifier(s, n, m) {var nsource = n.source && n.source.value;var exportMeta = {};var local = void 0;switch (s.type) {case 'ExportDefaultSpecifier':if (!nsource) return;local = 'default';break;case 'ExportNamespaceSpecifier':m.namespace.set(s.exported.name, Object.defineProperty(exportMeta, 'namespace', { get: function () {function get() {return resolveImport(nsource);}return get;}() }));return;case 'ExportAllDeclaration':m.namespace.set(s.exported.name, addNamespace(exportMeta, s.source.value));return;case 'ExportSpecifier':if (!n.source) {m.namespace.set(s.exported.name, addNamespace(exportMeta, s.local));return;} // else falls through
      default:local = s.local.name;break;} // todo: JSDoc
    m.reexports.set(s.exported.name, { local: local, getImport: function () {function getImport() {return resolveImport(nsource);}return getImport;}() });}function captureDependency(_ref, isOnlyImportingTypes) {var source = _ref.source;var importedSpecifiers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new Set();if (source == null) return null;var p = remotePath(source.value);if (p == null) return null;var declarationMetadata = { // capturing actual node reference holds full AST in memory!
      source: { value: source.value, loc: source.loc }, isOnlyImportingTypes: isOnlyImportingTypes, importedSpecifiers: importedSpecifiers };var existing = m.imports.get(p);if (existing != null) {existing.declarations.add(declarationMetadata);return existing.getter;}var getter = thunkFor(p, context);m.imports.set(p, { getter: getter, declarations: new Set([declarationMetadata]) });return getter;}var source = makeSourceCode(content, ast);function readTsConfig() {var tsConfigInfo = (0, _tsconfigLoader.tsConfigLoader)({ cwd: context.parserOptions && context.parserOptions.tsconfigRootDir || process.cwd(), getEnv: function () {function getEnv(key) {return process.env[key];}return getEnv;}() });try {if (tsConfigInfo.tsConfigPath !== undefined) {// Projects not using TypeScript won't have `typescript` installed.
        if (!ts) {ts = require('typescript');}var configFile = ts.readConfigFile(tsConfigInfo.tsConfigPath, ts.sys.readFile);return ts.parseJsonConfigFileContent(configFile.config, ts.sys, (0, _path.dirname)(tsConfigInfo.tsConfigPath));}} catch (e) {// Catch any errors
    }return null;}function isEsModuleInterop() {var cacheKey = (0, _hash.hashObject)({ tsconfigRootDir: context.parserOptions && context.parserOptions.tsconfigRootDir }).digest('hex');var tsConfig = tsConfigCache.get(cacheKey);if (typeof tsConfig === 'undefined') {tsConfig = readTsConfig(context);tsConfigCache.set(cacheKey, tsConfig);}return tsConfig && tsConfig.options ? tsConfig.options.esModuleInterop : false;}ast.body.forEach(function (n) {if (n.type === 'ExportDefaultDeclaration') {var exportMeta = captureDoc(source, docStyleParsers, n);if (n.declaration.type === 'Identifier') {addNamespace(exportMeta, n.declaration);}m.namespace.set('default', exportMeta);return;}if (n.type === 'ExportAllDeclaration') {var getter = captureDependency(n, n.exportKind === 'type');if (getter) m.dependencies.add(getter);if (n.exported) {processSpecifier(n, n.exported, m);}return;} // capture namespaces in case of later export
    if (n.type === 'ImportDeclaration') {// import type { Foo } (TS and Flow)
      var declarationIsType = n.importKind === 'type'; // import './foo' or import {} from './foo' (both 0 specifiers) is a side effect and
      // shouldn't be considered to be just importing types
      var specifiersOnlyImportingTypes = n.specifiers.length;var importedSpecifiers = new Set();n.specifiers.forEach(function (specifier) {if (supportedImportTypes.has(specifier.type)) {importedSpecifiers.add(specifier.type);}if (specifier.type === 'ImportSpecifier') {importedSpecifiers.add(specifier.imported.name);} // import { type Foo } (Flow)
        specifiersOnlyImportingTypes = specifiersOnlyImportingTypes && specifier.importKind === 'type';});captureDependency(n, declarationIsType || specifiersOnlyImportingTypes, importedSpecifiers);var ns = n.specifiers.find(function (s) {return s.type === 'ImportNamespaceSpecifier';});if (ns) {namespaces.set(ns.local.name, n.source.value);}return;}if (n.type === 'ExportNamedDeclaration') {// capture declaration
      if (n.declaration != null) {switch (n.declaration.type) {case 'FunctionDeclaration':case 'ClassDeclaration':case 'TypeAlias': // flowtype with babel-eslint parser
          case 'InterfaceDeclaration':case 'DeclareFunction':case 'TSDeclareFunction':case 'TSEnumDeclaration':case 'TSTypeAliasDeclaration':case 'TSInterfaceDeclaration':case 'TSAbstractClassDeclaration':case 'TSModuleDeclaration':m.namespace.set(n.declaration.id.name, captureDoc(source, docStyleParsers, n));break;case 'VariableDeclaration':n.declaration.declarations.forEach(function (d) {return recursivePatternCapture(d.id, function (id) {return m.namespace.set(id.name, captureDoc(source, docStyleParsers, d, n));});});break;}}n.specifiers.forEach(function (s) {return processSpecifier(s, n, m);});}var exports = ['TSExportAssignment'];if (isEsModuleInteropTrue) {exports.push('TSNamespaceExportDeclaration');} // This doesn't declare anything, but changes what's being exported.
    if ((0, _arrayIncludes2['default'])(exports, n.type)) {var exportedName = n.type === 'TSNamespaceExportDeclaration' ? n.id.name : n.expression && n.expression.name || n.expression.id && n.expression.id.name || null;var declTypes = ['VariableDeclaration', 'ClassDeclaration', 'TSDeclareFunction', 'TSEnumDeclaration', 'TSTypeAliasDeclaration', 'TSInterfaceDeclaration', 'TSAbstractClassDeclaration', 'TSModuleDeclaration'];var exportedDecls = ast.body.filter(function (_ref2) {var type = _ref2.type,id = _ref2.id,declarations = _ref2.declarations;return (0, _arrayIncludes2['default'])(declTypes, type) && (id && id.name === exportedName || declarations && declarations.find(function (d) {return d.id.name === exportedName;}));});if (exportedDecls.length === 0) {// Export is not referencing any local declaration, must be re-exporting
        m.namespace.set('default', captureDoc(source, docStyleParsers, n));return;}if (isEsModuleInteropTrue // esModuleInterop is on in tsconfig
      && !m.namespace.has('default') // and default isn't added already
      ) {m.namespace.set('default', {}); // add default export
        }exportedDecls.forEach(function (decl) {if (decl.type === 'TSModuleDeclaration') {if (decl.body && decl.body.type === 'TSModuleDeclaration') {m.namespace.set(decl.body.id.name, captureDoc(source, docStyleParsers, decl.body));} else if (decl.body && decl.body.body) {decl.body.body.forEach(function (moduleBlockNode) {// Export-assignment exports all members in the namespace,
              // explicitly exported or not.
              var namespaceDecl = moduleBlockNode.type === 'ExportNamedDeclaration' ? moduleBlockNode.declaration : moduleBlockNode;if (!namespaceDecl) {// TypeScript can check this for us; we needn't
              } else if (namespaceDecl.type === 'VariableDeclaration') {namespaceDecl.declarations.forEach(function (d) {return recursivePatternCapture(d.id, function (id) {return m.namespace.set(id.name, captureDoc(source, docStyleParsers, decl, namespaceDecl, moduleBlockNode));});});} else {m.namespace.set(namespaceDecl.id.name, captureDoc(source, docStyleParsers, moduleBlockNode));}});}} else {// Export as default
          m.namespace.set('default', captureDoc(source, docStyleParsers, decl));}});}});if (isEsModuleInteropTrue // esModuleInterop is on in tsconfig
  && m.namespace.size > 0 // anything is exported
  && !m.namespace.has('default') // and default isn't added already
  ) {m.namespace.set('default', {}); // add default export
    }return m;}; /**
                  * The creation of this closure is isolated from other scopes
                  * to avoid over-retention of unrelated variables, which has
                  * caused memory leaks. See #1266.
                  */function thunkFor(p, context) {return function () {return ExportMap['for'](childContext(p, context));};} /**
                                                                                                                              * Traverse a pattern/identifier node, calling 'callback'
                                                                                                                              * for each leaf identifier.
                                                                                                                              * @param  {node}   pattern
                                                                                                                              * @param  {Function} callback
                                                                                                                              * @return {void}
                                                                                                                              */function recursivePatternCapture(pattern, callback) {switch (pattern.type) {case 'Identifier': // base case
      callback(pattern);break;case 'ObjectPattern':pattern.properties.forEach(function (p) {if (p.type === 'ExperimentalRestProperty' || p.type === 'RestElement') {callback(p.argument);return;}recursivePatternCapture(p.value, callback);});break;case 'ArrayPattern':pattern.elements.forEach(function (element) {if (element == null) return;if (element.type === 'ExperimentalRestProperty' || element.type === 'RestElement') {callback(element.argument);return;}recursivePatternCapture(element, callback);});break;case 'AssignmentPattern':callback(pattern.left);break;}} /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       * don't hold full context object in memory, just grab what we need.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       */function childContext(path, context) {var settings = context.settings,parserOptions = context.parserOptions,parserPath = context.parserPath;return { settings: settings, parserOptions: parserOptions, parserPath: parserPath, path: path };} /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        * sometimes legacy support isn't _that_ hard... right?
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        */function makeSourceCode(text, ast) {if (_eslint.SourceCode.length > 1) {// ESLint 3
    return new _eslint.SourceCode(text, ast);} else {// ESLint 4, 5
    return new _eslint.SourceCode({ text: text, ast: ast });}}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9FeHBvcnRNYXAuanMiXSwibmFtZXMiOlsicmVjdXJzaXZlUGF0dGVybkNhcHR1cmUiLCJ1bmFtYmlndW91cyIsInRzIiwibG9nIiwiZXhwb3J0Q2FjaGUiLCJNYXAiLCJ0c0NvbmZpZ0NhY2hlIiwiRXhwb3J0TWFwIiwicGF0aCIsIm5hbWVzcGFjZSIsInJlZXhwb3J0cyIsImRlcGVuZGVuY2llcyIsIlNldCIsImltcG9ydHMiLCJlcnJvcnMiLCJuYW1lIiwiaGFzIiwiZGVwIiwiaW5uZXJNYXAiLCJmb3VuZCIsImdldCIsImltcG9ydGVkIiwiZ2V0SW1wb3J0IiwibG9jYWwiLCJkZWVwIiwiaGFzRGVlcCIsInVuc2hpZnQiLCJpbm5lclZhbHVlIiwidW5kZWZpbmVkIiwiY2FsbGJhY2siLCJ0aGlzQXJnIiwiZm9yRWFjaCIsInYiLCJuIiwiY2FsbCIsInJlZXhwb3J0ZWQiLCJkIiwiY29udGV4dCIsImRlY2xhcmF0aW9uIiwicmVwb3J0Iiwibm9kZSIsInNvdXJjZSIsIm1lc3NhZ2UiLCJ2YWx1ZSIsIm1hcCIsImUiLCJsaW5lTnVtYmVyIiwiY29sdW1uIiwiam9pbiIsInNpemUiLCJjYXB0dXJlRG9jIiwiZG9jU3R5bGVQYXJzZXJzIiwibWV0YWRhdGEiLCJub2RlcyIsInNvbWUiLCJsZWFkaW5nQ29tbWVudHMiLCJyYW5nZSIsImdldENvbW1lbnRzQmVmb3JlIiwibGVuZ3RoIiwiZG9jIiwiZXJyIiwiYXZhaWxhYmxlRG9jU3R5bGVQYXJzZXJzIiwianNkb2MiLCJjYXB0dXJlSnNEb2MiLCJ0b21kb2MiLCJjYXB0dXJlVG9tRG9jIiwiY29tbWVudHMiLCJjb21tZW50IiwidHlwZSIsImRvY3RyaW5lIiwicGFyc2UiLCJ1bndyYXAiLCJsaW5lcyIsImkiLCJtYXRjaCIsInB1c2giLCJ0cmltIiwic3RhdHVzTWF0Y2giLCJkZXNjcmlwdGlvbiIsInRhZ3MiLCJ0aXRsZSIsInRvTG93ZXJDYXNlIiwic3VwcG9ydGVkSW1wb3J0VHlwZXMiLCJjaGlsZENvbnRleHQiLCJjYWNoZUtleSIsImRpZ2VzdCIsImV4cG9ydE1hcCIsInN0YXRzIiwiZnMiLCJzdGF0U3luYyIsIm10aW1lIiwic2V0IiwiY29udGVudCIsInJlYWRGaWxlU3luYyIsImVuY29kaW5nIiwidGVzdCIsIm0iLCJpc0VzTW9kdWxlSW50ZXJvcFRydWUiLCJpc0VzTW9kdWxlSW50ZXJvcCIsImFzdCIsInZpc2l0b3JLZXlzIiwicmVzdWx0IiwiaGFzRHluYW1pY0ltcG9ydHMiLCJwcm9jZXNzRHluYW1pY0ltcG9ydCIsInAiLCJyZW1vdGVQYXRoIiwiaW1wb3J0ZWRTcGVjaWZpZXJzIiwiYWRkIiwiZ2V0dGVyIiwidGh1bmtGb3IiLCJkZWNsYXJhdGlvbnMiLCJsb2MiLCJJbXBvcnRFeHByZXNzaW9uIiwiQ2FsbEV4cHJlc3Npb24iLCJjYWxsZWUiLCJhcmd1bWVudHMiLCJpc01vZHVsZSIsImRvY3N0eWxlIiwic2V0dGluZ3MiLCJzdHlsZSIsImMiLCJ0IiwibmFtZXNwYWNlcyIsInJlc29sdmUiLCJyZWxhdGl2ZSIsInJlc29sdmVJbXBvcnQiLCJycCIsImdldE5hbWVzcGFjZSIsImlkZW50aWZpZXIiLCJhZGROYW1lc3BhY2UiLCJvYmplY3QiLCJuc2ZuIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJwcm9jZXNzU3BlY2lmaWVyIiwicyIsIm5zb3VyY2UiLCJleHBvcnRNZXRhIiwiZXhwb3J0ZWQiLCJjYXB0dXJlRGVwZW5kZW5jeSIsImlzT25seUltcG9ydGluZ1R5cGVzIiwiZGVjbGFyYXRpb25NZXRhZGF0YSIsImV4aXN0aW5nIiwibWFrZVNvdXJjZUNvZGUiLCJyZWFkVHNDb25maWciLCJ0c0NvbmZpZ0luZm8iLCJjd2QiLCJwYXJzZXJPcHRpb25zIiwidHNjb25maWdSb290RGlyIiwicHJvY2VzcyIsImdldEVudiIsImtleSIsImVudiIsInRzQ29uZmlnUGF0aCIsInJlcXVpcmUiLCJjb25maWdGaWxlIiwicmVhZENvbmZpZ0ZpbGUiLCJzeXMiLCJyZWFkRmlsZSIsInBhcnNlSnNvbkNvbmZpZ0ZpbGVDb250ZW50IiwiY29uZmlnIiwidHNDb25maWciLCJvcHRpb25zIiwiZXNNb2R1bGVJbnRlcm9wIiwiYm9keSIsImV4cG9ydEtpbmQiLCJkZWNsYXJhdGlvbklzVHlwZSIsImltcG9ydEtpbmQiLCJzcGVjaWZpZXJzT25seUltcG9ydGluZ1R5cGVzIiwic3BlY2lmaWVycyIsInNwZWNpZmllciIsIm5zIiwiZmluZCIsImlkIiwiZXhwb3J0cyIsImV4cG9ydGVkTmFtZSIsImV4cHJlc3Npb24iLCJkZWNsVHlwZXMiLCJleHBvcnRlZERlY2xzIiwiZmlsdGVyIiwiZGVjbCIsIm1vZHVsZUJsb2NrTm9kZSIsIm5hbWVzcGFjZURlY2wiLCJwYXR0ZXJuIiwicHJvcGVydGllcyIsImFyZ3VtZW50IiwiZWxlbWVudHMiLCJlbGVtZW50IiwibGVmdCIsInBhcnNlclBhdGgiLCJ0ZXh0IiwiU291cmNlQ29kZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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STRGLGtCQUFKLENBQWUsRUFBRUQsVUFBRixFQUFRM0YsUUFBUixFQUFmLENBQVAsQ0FDRCxDQUNGIiwiZmlsZSI6IkV4cG9ydE1hcC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAncGF0aCc7XG5cbmltcG9ydCBkb2N0cmluZSBmcm9tICdkb2N0cmluZSc7XG5cbmltcG9ydCBkZWJ1ZyBmcm9tICdkZWJ1Zyc7XG5cbmltcG9ydCB7IFNvdXJjZUNvZGUgfSBmcm9tICdlc2xpbnQnO1xuXG5pbXBvcnQgcGFyc2UgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9wYXJzZSc7XG5pbXBvcnQgdmlzaXQgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy92aXNpdCc7XG5pbXBvcnQgcmVzb2x2ZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3Jlc29sdmUnO1xuaW1wb3J0IGlzSWdub3JlZCwgeyBoYXNWYWxpZEV4dGVuc2lvbiB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvaWdub3JlJztcblxuaW1wb3J0IHsgaGFzaE9iamVjdCB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvaGFzaCc7XG5pbXBvcnQgKiBhcyB1bmFtYmlndW91cyBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3VuYW1iaWd1b3VzJztcblxuaW1wb3J0IHsgdHNDb25maWdMb2FkZXIgfSBmcm9tICd0c2NvbmZpZy1wYXRocy9saWIvdHNjb25maWctbG9hZGVyJztcblxuaW1wb3J0IGluY2x1ZGVzIGZyb20gJ2FycmF5LWluY2x1ZGVzJztcblxubGV0IHRzO1xuXG5jb25zdCBsb2cgPSBkZWJ1ZygnZXNsaW50LXBsdWdpbi1pbXBvcnQ6RXhwb3J0TWFwJyk7XG5cbmNvbnN0IGV4cG9ydENhY2hlID0gbmV3IE1hcCgpO1xuY29uc3QgdHNDb25maWdDYWNoZSA9IG5ldyBNYXAoKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXhwb3J0TWFwIHtcbiAgY29uc3RydWN0b3IocGF0aCkge1xuICAgIHRoaXMucGF0aCA9IHBhdGg7XG4gICAgdGhpcy5uYW1lc3BhY2UgPSBuZXcgTWFwKCk7XG4gICAgLy8gdG9kbzogcmVzdHJ1Y3R1cmUgdG8ga2V5IG9uIHBhdGgsIHZhbHVlIGlzIHJlc29sdmVyICsgbWFwIG9mIG5hbWVzXG4gICAgdGhpcy5yZWV4cG9ydHMgPSBuZXcgTWFwKCk7XG4gICAgLyoqXG4gICAgICogc3Rhci1leHBvcnRzXG4gICAgICogQHR5cGUge1NldH0gb2YgKCkgPT4gRXhwb3J0TWFwXG4gICAgICovXG4gICAgdGhpcy5kZXBlbmRlbmNpZXMgPSBuZXcgU2V0KCk7XG4gICAgLyoqXG4gICAgICogZGVwZW5kZW5jaWVzIG9mIHRoaXMgbW9kdWxlIHRoYXQgYXJlIG5vdCBleHBsaWNpdGx5IHJlLWV4cG9ydGVkXG4gICAgICogQHR5cGUge01hcH0gZnJvbSBwYXRoID0gKCkgPT4gRXhwb3J0TWFwXG4gICAgICovXG4gICAgdGhpcy5pbXBvcnRzID0gbmV3IE1hcCgpO1xuICAgIHRoaXMuZXJyb3JzID0gW107XG4gIH1cblxuICBnZXQgaGFzRGVmYXVsdCgpIHsgcmV0dXJuIHRoaXMuZ2V0KCdkZWZhdWx0JykgIT0gbnVsbDsgfSAvLyBzdHJvbmdlciB0aGFuIHRoaXMuaGFzXG5cbiAgZ2V0IHNpemUoKSB7XG4gICAgbGV0IHNpemUgPSB0aGlzLm5hbWVzcGFjZS5zaXplICsgdGhpcy5yZWV4cG9ydHMuc2l6ZTtcbiAgICB0aGlzLmRlcGVuZGVuY2llcy5mb3JFYWNoKGRlcCA9PiB7XG4gICAgICBjb25zdCBkID0gZGVwKCk7XG4gICAgICAvLyBDSlMgLyBpZ25vcmVkIGRlcGVuZGVuY2llcyB3b24ndCBleGlzdCAoIzcxNylcbiAgICAgIGlmIChkID09IG51bGwpIHJldHVybjtcbiAgICAgIHNpemUgKz0gZC5zaXplO1xuICAgIH0pO1xuICAgIHJldHVybiBzaXplO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGRvZXMgbm90IGNoZWNrIGV4cGxpY2l0bHkgcmUtZXhwb3J0ZWQgbmFtZXMgZm9yIGV4aXN0ZW5jZVxuICAgKiBpbiB0aGUgYmFzZSBuYW1lc3BhY2UsIGJ1dCBpdCB3aWxsIGV4cGFuZCBhbGwgYGV4cG9ydCAqIGZyb20gJy4uLidgIGV4cG9ydHNcbiAgICogaWYgbm90IGZvdW5kIGluIHRoZSBleHBsaWNpdCBuYW1lc3BhY2UuXG4gICAqIEBwYXJhbSAge3N0cmluZ30gIG5hbWVcbiAgICogQHJldHVybiB7Qm9vbGVhbn0gdHJ1ZSBpZiBgbmFtZWAgaXMgZXhwb3J0ZWQgYnkgdGhpcyBtb2R1bGUuXG4gICAqL1xuICBoYXMobmFtZSkge1xuICAgIGlmICh0aGlzLm5hbWVzcGFjZS5oYXMobmFtZSkpIHJldHVybiB0cnVlO1xuICAgIGlmICh0aGlzLnJlZXhwb3J0cy5oYXMobmFtZSkpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gZGVmYXVsdCBleHBvcnRzIG11c3QgYmUgZXhwbGljaXRseSByZS1leHBvcnRlZCAoIzMyOClcbiAgICBpZiAobmFtZSAhPT0gJ2RlZmF1bHQnKSB7XG4gICAgICBmb3IgKGNvbnN0IGRlcCBvZiB0aGlzLmRlcGVuZGVuY2llcykge1xuICAgICAgICBjb25zdCBpbm5lck1hcCA9IGRlcCgpO1xuXG4gICAgICAgIC8vIHRvZG86IHJlcG9ydCBhcyB1bnJlc29sdmVkP1xuICAgICAgICBpZiAoIWlubmVyTWFwKSBjb250aW51ZTtcblxuICAgICAgICBpZiAoaW5uZXJNYXAuaGFzKG5hbWUpKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogZW5zdXJlIHRoYXQgaW1wb3J0ZWQgbmFtZSBmdWxseSByZXNvbHZlcy5cbiAgICogQHBhcmFtICB7c3RyaW5nfSBuYW1lXG4gICAqIEByZXR1cm4ge3sgZm91bmQ6IGJvb2xlYW4sIHBhdGg6IEV4cG9ydE1hcFtdIH19XG4gICAqL1xuICBoYXNEZWVwKG5hbWUpIHtcbiAgICBpZiAodGhpcy5uYW1lc3BhY2UuaGFzKG5hbWUpKSByZXR1cm4geyBmb3VuZDogdHJ1ZSwgcGF0aDogW3RoaXNdIH07XG5cbiAgICBpZiAodGhpcy5yZWV4cG9ydHMuaGFzKG5hbWUpKSB7XG4gICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0cy5nZXQobmFtZSk7XG4gICAgICBjb25zdCBpbXBvcnRlZCA9IHJlZXhwb3J0cy5nZXRJbXBvcnQoKTtcblxuICAgICAgLy8gaWYgaW1wb3J0IGlzIGlnbm9yZWQsIHJldHVybiBleHBsaWNpdCAnbnVsbCdcbiAgICAgIGlmIChpbXBvcnRlZCA9PSBudWxsKSByZXR1cm4geyBmb3VuZDogdHJ1ZSwgcGF0aDogW3RoaXNdIH07XG5cbiAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlcywgb25seSBpZiBuYW1lIG1hdGNoZXNcbiAgICAgIGlmIChpbXBvcnRlZC5wYXRoID09PSB0aGlzLnBhdGggJiYgcmVleHBvcnRzLmxvY2FsID09PSBuYW1lKSB7XG4gICAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgcGF0aDogW3RoaXNdIH07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRlZXAgPSBpbXBvcnRlZC5oYXNEZWVwKHJlZXhwb3J0cy5sb2NhbCk7XG4gICAgICBkZWVwLnBhdGgudW5zaGlmdCh0aGlzKTtcblxuICAgICAgcmV0dXJuIGRlZXA7XG4gICAgfVxuXG5cbiAgICAvLyBkZWZhdWx0IGV4cG9ydHMgbXVzdCBiZSBleHBsaWNpdGx5IHJlLWV4cG9ydGVkICgjMzI4KVxuICAgIGlmIChuYW1lICE9PSAnZGVmYXVsdCcpIHtcbiAgICAgIGZvciAoY29uc3QgZGVwIG9mIHRoaXMuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIGNvbnN0IGlubmVyTWFwID0gZGVwKCk7XG4gICAgICAgIGlmIChpbm5lck1hcCA9PSBudWxsKSByZXR1cm4geyBmb3VuZDogdHJ1ZSwgcGF0aDogW3RoaXNdIH07XG4gICAgICAgIC8vIHRvZG86IHJlcG9ydCBhcyB1bnJlc29sdmVkP1xuICAgICAgICBpZiAoIWlubmVyTWFwKSBjb250aW51ZTtcblxuICAgICAgICAvLyBzYWZlZ3VhcmQgYWdhaW5zdCBjeWNsZXNcbiAgICAgICAgaWYgKGlubmVyTWFwLnBhdGggPT09IHRoaXMucGF0aCkgY29udGludWU7XG5cbiAgICAgICAgY29uc3QgaW5uZXJWYWx1ZSA9IGlubmVyTWFwLmhhc0RlZXAobmFtZSk7XG4gICAgICAgIGlmIChpbm5lclZhbHVlLmZvdW5kKSB7XG4gICAgICAgICAgaW5uZXJWYWx1ZS5wYXRoLnVuc2hpZnQodGhpcyk7XG4gICAgICAgICAgcmV0dXJuIGlubmVyVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHBhdGg6IFt0aGlzXSB9O1xuICB9XG5cbiAgZ2V0KG5hbWUpIHtcbiAgICBpZiAodGhpcy5uYW1lc3BhY2UuaGFzKG5hbWUpKSByZXR1cm4gdGhpcy5uYW1lc3BhY2UuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKHRoaXMucmVleHBvcnRzLmhhcyhuYW1lKSkge1xuICAgICAgY29uc3QgcmVleHBvcnRzID0gdGhpcy5yZWV4cG9ydHMuZ2V0KG5hbWUpO1xuICAgICAgY29uc3QgaW1wb3J0ZWQgPSByZWV4cG9ydHMuZ2V0SW1wb3J0KCk7XG5cbiAgICAgIC8vIGlmIGltcG9ydCBpcyBpZ25vcmVkLCByZXR1cm4gZXhwbGljaXQgJ251bGwnXG4gICAgICBpZiAoaW1wb3J0ZWQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG5cbiAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlcywgb25seSBpZiBuYW1lIG1hdGNoZXNcbiAgICAgIGlmIChpbXBvcnRlZC5wYXRoID09PSB0aGlzLnBhdGggJiYgcmVleHBvcnRzLmxvY2FsID09PSBuYW1lKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICByZXR1cm4gaW1wb3J0ZWQuZ2V0KHJlZXhwb3J0cy5sb2NhbCk7XG4gICAgfVxuXG4gICAgLy8gZGVmYXVsdCBleHBvcnRzIG11c3QgYmUgZXhwbGljaXRseSByZS1leHBvcnRlZCAoIzMyOClcbiAgICBpZiAobmFtZSAhPT0gJ2RlZmF1bHQnKSB7XG4gICAgICBmb3IgKGNvbnN0IGRlcCBvZiB0aGlzLmRlcGVuZGVuY2llcykge1xuICAgICAgICBjb25zdCBpbm5lck1hcCA9IGRlcCgpO1xuICAgICAgICAvLyB0b2RvOiByZXBvcnQgYXMgdW5yZXNvbHZlZD9cbiAgICAgICAgaWYgKCFpbm5lck1hcCkgY29udGludWU7XG5cbiAgICAgICAgLy8gc2FmZWd1YXJkIGFnYWluc3QgY3ljbGVzXG4gICAgICAgIGlmIChpbm5lck1hcC5wYXRoID09PSB0aGlzLnBhdGgpIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IGlubmVyVmFsdWUgPSBpbm5lck1hcC5nZXQobmFtZSk7XG4gICAgICAgIGlmIChpbm5lclZhbHVlICE9PSB1bmRlZmluZWQpIHJldHVybiBpbm5lclZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBmb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdGhpcy5uYW1lc3BhY2UuZm9yRWFjaCgodiwgbikgPT5cbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdiwgbiwgdGhpcykpO1xuXG4gICAgdGhpcy5yZWV4cG9ydHMuZm9yRWFjaCgocmVleHBvcnRzLCBuYW1lKSA9PiB7XG4gICAgICBjb25zdCByZWV4cG9ydGVkID0gcmVleHBvcnRzLmdldEltcG9ydCgpO1xuICAgICAgLy8gY2FuJ3QgbG9vayB1cCBtZXRhIGZvciBpZ25vcmVkIHJlLWV4cG9ydHMgKCMzNDgpXG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHJlZXhwb3J0ZWQgJiYgcmVleHBvcnRlZC5nZXQocmVleHBvcnRzLmxvY2FsKSwgbmFtZSwgdGhpcyk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmRlcGVuZGVuY2llcy5mb3JFYWNoKGRlcCA9PiB7XG4gICAgICBjb25zdCBkID0gZGVwKCk7XG4gICAgICAvLyBDSlMgLyBpZ25vcmVkIGRlcGVuZGVuY2llcyB3b24ndCBleGlzdCAoIzcxNylcbiAgICAgIGlmIChkID09IG51bGwpIHJldHVybjtcblxuICAgICAgZC5mb3JFYWNoKCh2LCBuKSA9PlxuICAgICAgICBuICE9PSAnZGVmYXVsdCcgJiYgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2LCBuLCB0aGlzKSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyB0b2RvOiBrZXlzLCB2YWx1ZXMsIGVudHJpZXM/XG5cbiAgcmVwb3J0RXJyb3JzKGNvbnRleHQsIGRlY2xhcmF0aW9uKSB7XG4gICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgbm9kZTogZGVjbGFyYXRpb24uc291cmNlLFxuICAgICAgbWVzc2FnZTogYFBhcnNlIGVycm9ycyBpbiBpbXBvcnRlZCBtb2R1bGUgJyR7ZGVjbGFyYXRpb24uc291cmNlLnZhbHVlfSc6IGAgK1xuICAgICAgICAgICAgICAgICAgYCR7dGhpcy5lcnJvcnNcbiAgICAgICAgICAgICAgICAgICAgLm1hcChlID0+IGAke2UubWVzc2FnZX0gKCR7ZS5saW5lTnVtYmVyfToke2UuY29sdW1ufSlgKVxuICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKX1gLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogcGFyc2UgZG9jcyBmcm9tIHRoZSBmaXJzdCBub2RlIHRoYXQgaGFzIGxlYWRpbmcgY29tbWVudHNcbiAqL1xuZnVuY3Rpb24gY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgLi4ubm9kZXMpIHtcbiAgY29uc3QgbWV0YWRhdGEgPSB7fTtcblxuICAvLyAnc29tZScgc2hvcnQtY2lyY3VpdHMgb24gZmlyc3QgJ3RydWUnXG4gIG5vZGVzLnNvbWUobiA9PiB7XG4gICAgdHJ5IHtcblxuICAgICAgbGV0IGxlYWRpbmdDb21tZW50cztcblxuICAgICAgLy8gbi5sZWFkaW5nQ29tbWVudHMgaXMgbGVnYWN5IGBhdHRhY2hDb21tZW50c2AgYmVoYXZpb3JcbiAgICAgIGlmICgnbGVhZGluZ0NvbW1lbnRzJyBpbiBuKSB7XG4gICAgICAgIGxlYWRpbmdDb21tZW50cyA9IG4ubGVhZGluZ0NvbW1lbnRzO1xuICAgICAgfSBlbHNlIGlmIChuLnJhbmdlKSB7XG4gICAgICAgIGxlYWRpbmdDb21tZW50cyA9IHNvdXJjZS5nZXRDb21tZW50c0JlZm9yZShuKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFsZWFkaW5nQ29tbWVudHMgfHwgbGVhZGluZ0NvbW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gZG9jU3R5bGVQYXJzZXJzKSB7XG4gICAgICAgIGNvbnN0IGRvYyA9IGRvY1N0eWxlUGFyc2Vyc1tuYW1lXShsZWFkaW5nQ29tbWVudHMpO1xuICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgbWV0YWRhdGEuZG9jID0gZG9jO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIG1ldGFkYXRhO1xufVxuXG5jb25zdCBhdmFpbGFibGVEb2NTdHlsZVBhcnNlcnMgPSB7XG4gIGpzZG9jOiBjYXB0dXJlSnNEb2MsXG4gIHRvbWRvYzogY2FwdHVyZVRvbURvYyxcbn07XG5cbi8qKlxuICogcGFyc2UgSlNEb2MgZnJvbSBsZWFkaW5nIGNvbW1lbnRzXG4gKiBAcGFyYW0ge29iamVjdFtdfSBjb21tZW50c1xuICogQHJldHVybiB7eyBkb2M6IG9iamVjdCB9fVxuICovXG5mdW5jdGlvbiBjYXB0dXJlSnNEb2MoY29tbWVudHMpIHtcbiAgbGV0IGRvYztcblxuICAvLyBjYXB0dXJlIFhTRG9jXG4gIGNvbW1lbnRzLmZvckVhY2goY29tbWVudCA9PiB7XG4gICAgLy8gc2tpcCBub24tYmxvY2sgY29tbWVudHNcbiAgICBpZiAoY29tbWVudC50eXBlICE9PSAnQmxvY2snKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIGRvYyA9IGRvY3RyaW5lLnBhcnNlKGNvbW1lbnQudmFsdWUsIHsgdW53cmFwOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLyogZG9uJ3QgY2FyZSwgZm9yIG5vdz8gbWF5YmUgYWRkIHRvIGBlcnJvcnM/YCAqL1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGRvYztcbn1cblxuLyoqXG4gICogcGFyc2UgVG9tRG9jIHNlY3Rpb24gZnJvbSBjb21tZW50c1xuICAqL1xuZnVuY3Rpb24gY2FwdHVyZVRvbURvYyhjb21tZW50cykge1xuICAvLyBjb2xsZWN0IGxpbmVzIHVwIHRvIGZpcnN0IHBhcmFncmFwaCBicmVha1xuICBjb25zdCBsaW5lcyA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY29tbWVudCA9IGNvbW1lbnRzW2ldO1xuICAgIGlmIChjb21tZW50LnZhbHVlLm1hdGNoKC9eXFxzKiQvKSkgYnJlYWs7XG4gICAgbGluZXMucHVzaChjb21tZW50LnZhbHVlLnRyaW0oKSk7XG4gIH1cblxuICAvLyByZXR1cm4gZG9jdHJpbmUtbGlrZSBvYmplY3RcbiAgY29uc3Qgc3RhdHVzTWF0Y2ggPSBsaW5lcy5qb2luKCcgJykubWF0Y2goL14oUHVibGljfEludGVybmFsfERlcHJlY2F0ZWQpOlxccyooLispLyk7XG4gIGlmIChzdGF0dXNNYXRjaCkge1xuICAgIHJldHVybiB7XG4gICAgICBkZXNjcmlwdGlvbjogc3RhdHVzTWF0Y2hbMl0sXG4gICAgICB0YWdzOiBbe1xuICAgICAgICB0aXRsZTogc3RhdHVzTWF0Y2hbMV0udG9Mb3dlckNhc2UoKSxcbiAgICAgICAgZGVzY3JpcHRpb246IHN0YXR1c01hdGNoWzJdLFxuICAgICAgfV0sXG4gICAgfTtcbiAgfVxufVxuXG5jb25zdCBzdXBwb3J0ZWRJbXBvcnRUeXBlcyA9IG5ldyBTZXQoWydJbXBvcnREZWZhdWx0U3BlY2lmaWVyJywgJ0ltcG9ydE5hbWVzcGFjZVNwZWNpZmllciddKTtcblxuRXhwb3J0TWFwLmdldCA9IGZ1bmN0aW9uIChzb3VyY2UsIGNvbnRleHQpIHtcbiAgY29uc3QgcGF0aCA9IHJlc29sdmUoc291cmNlLCBjb250ZXh0KTtcbiAgaWYgKHBhdGggPT0gbnVsbCkgcmV0dXJuIG51bGw7XG5cbiAgcmV0dXJuIEV4cG9ydE1hcC5mb3IoY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpKTtcbn07XG5cbkV4cG9ydE1hcC5mb3IgPSBmdW5jdGlvbiAoY29udGV4dCkge1xuICBjb25zdCB7IHBhdGggfSA9IGNvbnRleHQ7XG5cbiAgY29uc3QgY2FjaGVLZXkgPSBoYXNoT2JqZWN0KGNvbnRleHQpLmRpZ2VzdCgnaGV4Jyk7XG4gIGxldCBleHBvcnRNYXAgPSBleHBvcnRDYWNoZS5nZXQoY2FjaGVLZXkpO1xuXG4gIC8vIHJldHVybiBjYWNoZWQgaWdub3JlXG4gIGlmIChleHBvcnRNYXAgPT09IG51bGwpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMocGF0aCk7XG4gIGlmIChleHBvcnRNYXAgIT0gbnVsbCkge1xuICAgIC8vIGRhdGUgZXF1YWxpdHkgY2hlY2tcbiAgICBpZiAoZXhwb3J0TWFwLm10aW1lIC0gc3RhdHMubXRpbWUgPT09IDApIHtcbiAgICAgIHJldHVybiBleHBvcnRNYXA7XG4gICAgfVxuICAgIC8vIGZ1dHVyZTogY2hlY2sgY29udGVudCBlcXVhbGl0eT9cbiAgfVxuXG4gIC8vIGNoZWNrIHZhbGlkIGV4dGVuc2lvbnMgZmlyc3RcbiAgaWYgKCFoYXNWYWxpZEV4dGVuc2lvbihwYXRoLCBjb250ZXh0KSkge1xuICAgIGV4cG9ydENhY2hlLnNldChjYWNoZUtleSwgbnVsbCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBjaGVjayBmb3IgYW5kIGNhY2hlIGlnbm9yZVxuICBpZiAoaXNJZ25vcmVkKHBhdGgsIGNvbnRleHQpKSB7XG4gICAgbG9nKCdpZ25vcmVkIHBhdGggZHVlIHRvIGlnbm9yZSBzZXR0aW5nczonLCBwYXRoKTtcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLCB7IGVuY29kaW5nOiAndXRmOCcgfSk7XG5cbiAgLy8gY2hlY2sgZm9yIGFuZCBjYWNoZSB1bmFtYmlndW91cyBtb2R1bGVzXG4gIGlmICghdW5hbWJpZ3VvdXMudGVzdChjb250ZW50KSkge1xuICAgIGxvZygnaWdub3JlZCBwYXRoIGR1ZSB0byB1bmFtYmlndW91cyByZWdleDonLCBwYXRoKTtcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgbG9nKCdjYWNoZSBtaXNzJywgY2FjaGVLZXksICdmb3IgcGF0aCcsIHBhdGgpO1xuICBleHBvcnRNYXAgPSBFeHBvcnRNYXAucGFyc2UocGF0aCwgY29udGVudCwgY29udGV4dCk7XG5cbiAgLy8gYW1iaWd1b3VzIG1vZHVsZXMgcmV0dXJuIG51bGxcbiAgaWYgKGV4cG9ydE1hcCA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICBleHBvcnRNYXAubXRpbWUgPSBzdGF0cy5tdGltZTtcblxuICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIGV4cG9ydE1hcCk7XG4gIHJldHVybiBleHBvcnRNYXA7XG59O1xuXG5cbkV4cG9ydE1hcC5wYXJzZSA9IGZ1bmN0aW9uIChwYXRoLCBjb250ZW50LCBjb250ZXh0KSB7XG4gIGNvbnN0IG0gPSBuZXcgRXhwb3J0TWFwKHBhdGgpO1xuICBjb25zdCBpc0VzTW9kdWxlSW50ZXJvcFRydWUgPSBpc0VzTW9kdWxlSW50ZXJvcCgpO1xuXG4gIGxldCBhc3Q7XG4gIGxldCB2aXNpdG9yS2V5cztcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBwYXJzZShwYXRoLCBjb250ZW50LCBjb250ZXh0KTtcbiAgICBhc3QgPSByZXN1bHQuYXN0O1xuICAgIHZpc2l0b3JLZXlzID0gcmVzdWx0LnZpc2l0b3JLZXlzO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBtLmVycm9ycy5wdXNoKGVycik7XG4gICAgcmV0dXJuIG07IC8vIGNhbid0IGNvbnRpbnVlXG4gIH1cblxuICBtLnZpc2l0b3JLZXlzID0gdmlzaXRvcktleXM7XG5cbiAgbGV0IGhhc0R5bmFtaWNJbXBvcnRzID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gcHJvY2Vzc0R5bmFtaWNJbXBvcnQoc291cmNlKSB7XG4gICAgaGFzRHluYW1pY0ltcG9ydHMgPSB0cnVlO1xuICAgIGlmIChzb3VyY2UudHlwZSAhPT0gJ0xpdGVyYWwnKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgcCA9IHJlbW90ZVBhdGgoc291cmNlLnZhbHVlKTtcbiAgICBpZiAocCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgaW1wb3J0ZWRTcGVjaWZpZXJzID0gbmV3IFNldCgpO1xuICAgIGltcG9ydGVkU3BlY2lmaWVycy5hZGQoJ0ltcG9ydE5hbWVzcGFjZVNwZWNpZmllcicpO1xuICAgIGNvbnN0IGdldHRlciA9IHRodW5rRm9yKHAsIGNvbnRleHQpO1xuICAgIG0uaW1wb3J0cy5zZXQocCwge1xuICAgICAgZ2V0dGVyLFxuICAgICAgZGVjbGFyYXRpb25zOiBuZXcgU2V0KFt7XG4gICAgICAgIHNvdXJjZToge1xuICAgICAgICAvLyBjYXB0dXJpbmcgYWN0dWFsIG5vZGUgcmVmZXJlbmNlIGhvbGRzIGZ1bGwgQVNUIGluIG1lbW9yeSFcbiAgICAgICAgICB2YWx1ZTogc291cmNlLnZhbHVlLFxuICAgICAgICAgIGxvYzogc291cmNlLmxvYyxcbiAgICAgICAgfSxcbiAgICAgICAgaW1wb3J0ZWRTcGVjaWZpZXJzLFxuICAgICAgfV0pLFxuICAgIH0pO1xuICB9XG5cbiAgdmlzaXQoYXN0LCB2aXNpdG9yS2V5cywge1xuICAgIEltcG9ydEV4cHJlc3Npb24obm9kZSkge1xuICAgICAgcHJvY2Vzc0R5bmFtaWNJbXBvcnQobm9kZS5zb3VyY2UpO1xuICAgIH0sXG4gICAgQ2FsbEV4cHJlc3Npb24obm9kZSkge1xuICAgICAgaWYgKG5vZGUuY2FsbGVlLnR5cGUgPT09ICdJbXBvcnQnKSB7XG4gICAgICAgIHByb2Nlc3NEeW5hbWljSW1wb3J0KG5vZGUuYXJndW1lbnRzWzBdKTtcbiAgICAgIH1cbiAgICB9LFxuICB9KTtcblxuICBpZiAoIXVuYW1iaWd1b3VzLmlzTW9kdWxlKGFzdCkgJiYgIWhhc0R5bmFtaWNJbXBvcnRzKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBkb2NzdHlsZSA9IChjb250ZXh0LnNldHRpbmdzICYmIGNvbnRleHQuc2V0dGluZ3NbJ2ltcG9ydC9kb2NzdHlsZSddKSB8fCBbJ2pzZG9jJ107XG4gIGNvbnN0IGRvY1N0eWxlUGFyc2VycyA9IHt9O1xuICBkb2NzdHlsZS5mb3JFYWNoKHN0eWxlID0+IHtcbiAgICBkb2NTdHlsZVBhcnNlcnNbc3R5bGVdID0gYXZhaWxhYmxlRG9jU3R5bGVQYXJzZXJzW3N0eWxlXTtcbiAgfSk7XG5cbiAgLy8gYXR0ZW1wdCB0byBjb2xsZWN0IG1vZHVsZSBkb2NcbiAgaWYgKGFzdC5jb21tZW50cykge1xuICAgIGFzdC5jb21tZW50cy5zb21lKGMgPT4ge1xuICAgICAgaWYgKGMudHlwZSAhPT0gJ0Jsb2NrJykgcmV0dXJuIGZhbHNlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZG9jID0gZG9jdHJpbmUucGFyc2UoYy52YWx1ZSwgeyB1bndyYXA6IHRydWUgfSk7XG4gICAgICAgIGlmIChkb2MudGFncy5zb21lKHQgPT4gdC50aXRsZSA9PT0gJ21vZHVsZScpKSB7XG4gICAgICAgICAgbS5kb2MgPSBkb2M7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikgeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgbmFtZXNwYWNlcyA9IG5ldyBNYXAoKTtcblxuICBmdW5jdGlvbiByZW1vdGVQYXRoKHZhbHVlKSB7XG4gICAgcmV0dXJuIHJlc29sdmUucmVsYXRpdmUodmFsdWUsIHBhdGgsIGNvbnRleHQuc2V0dGluZ3MpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZUltcG9ydCh2YWx1ZSkge1xuICAgIGNvbnN0IHJwID0gcmVtb3RlUGF0aCh2YWx1ZSk7XG4gICAgaWYgKHJwID09IG51bGwpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBFeHBvcnRNYXAuZm9yKGNoaWxkQ29udGV4dChycCwgY29udGV4dCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TmFtZXNwYWNlKGlkZW50aWZpZXIpIHtcbiAgICBpZiAoIW5hbWVzcGFjZXMuaGFzKGlkZW50aWZpZXIubmFtZSkpIHJldHVybjtcblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZUltcG9ydChuYW1lc3BhY2VzLmdldChpZGVudGlmaWVyLm5hbWUpKTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkTmFtZXNwYWNlKG9iamVjdCwgaWRlbnRpZmllcikge1xuICAgIGNvbnN0IG5zZm4gPSBnZXROYW1lc3BhY2UoaWRlbnRpZmllcik7XG4gICAgaWYgKG5zZm4pIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3QsICduYW1lc3BhY2UnLCB7IGdldDogbnNmbiB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvY2Vzc1NwZWNpZmllcihzLCBuLCBtKSB7XG4gICAgY29uc3QgbnNvdXJjZSA9IG4uc291cmNlICYmIG4uc291cmNlLnZhbHVlO1xuICAgIGNvbnN0IGV4cG9ydE1ldGEgPSB7fTtcbiAgICBsZXQgbG9jYWw7XG5cbiAgICBzd2l0Y2ggKHMudHlwZSkge1xuICAgIGNhc2UgJ0V4cG9ydERlZmF1bHRTcGVjaWZpZXInOlxuICAgICAgaWYgKCFuc291cmNlKSByZXR1cm47XG4gICAgICBsb2NhbCA9ICdkZWZhdWx0JztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0V4cG9ydE5hbWVzcGFjZVNwZWNpZmllcic6XG4gICAgICBtLm5hbWVzcGFjZS5zZXQocy5leHBvcnRlZC5uYW1lLCBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0TWV0YSwgJ25hbWVzcGFjZScsIHtcbiAgICAgICAgZ2V0KCkgeyByZXR1cm4gcmVzb2x2ZUltcG9ydChuc291cmNlKTsgfSxcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybjtcbiAgICBjYXNlICdFeHBvcnRBbGxEZWNsYXJhdGlvbic6XG4gICAgICBtLm5hbWVzcGFjZS5zZXQocy5leHBvcnRlZC5uYW1lLCBhZGROYW1lc3BhY2UoZXhwb3J0TWV0YSwgcy5zb3VyY2UudmFsdWUpKTtcbiAgICAgIHJldHVybjtcbiAgICBjYXNlICdFeHBvcnRTcGVjaWZpZXInOlxuICAgICAgaWYgKCFuLnNvdXJjZSkge1xuICAgICAgICBtLm5hbWVzcGFjZS5zZXQocy5leHBvcnRlZC5uYW1lLCBhZGROYW1lc3BhY2UoZXhwb3J0TWV0YSwgcy5sb2NhbCkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBlbHNlIGZhbGxzIHRocm91Z2hcbiAgICBkZWZhdWx0OlxuICAgICAgbG9jYWwgPSBzLmxvY2FsLm5hbWU7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyB0b2RvOiBKU0RvY1xuICAgIG0ucmVleHBvcnRzLnNldChzLmV4cG9ydGVkLm5hbWUsIHsgbG9jYWwsIGdldEltcG9ydDogKCkgPT4gcmVzb2x2ZUltcG9ydChuc291cmNlKSB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNhcHR1cmVEZXBlbmRlbmN5KHsgc291cmNlIH0sIGlzT25seUltcG9ydGluZ1R5cGVzLCBpbXBvcnRlZFNwZWNpZmllcnMgPSBuZXcgU2V0KCkpIHtcbiAgICBpZiAoc291cmNlID09IG51bGwpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgcCA9IHJlbW90ZVBhdGgoc291cmNlLnZhbHVlKTtcbiAgICBpZiAocCA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRlY2xhcmF0aW9uTWV0YWRhdGEgPSB7XG4gICAgICAvLyBjYXB0dXJpbmcgYWN0dWFsIG5vZGUgcmVmZXJlbmNlIGhvbGRzIGZ1bGwgQVNUIGluIG1lbW9yeSFcbiAgICAgIHNvdXJjZTogeyB2YWx1ZTogc291cmNlLnZhbHVlLCBsb2M6IHNvdXJjZS5sb2MgfSxcbiAgICAgIGlzT25seUltcG9ydGluZ1R5cGVzLFxuICAgICAgaW1wb3J0ZWRTcGVjaWZpZXJzLFxuICAgIH07XG5cbiAgICBjb25zdCBleGlzdGluZyA9IG0uaW1wb3J0cy5nZXQocCk7XG4gICAgaWYgKGV4aXN0aW5nICE9IG51bGwpIHtcbiAgICAgIGV4aXN0aW5nLmRlY2xhcmF0aW9ucy5hZGQoZGVjbGFyYXRpb25NZXRhZGF0YSk7XG4gICAgICByZXR1cm4gZXhpc3RpbmcuZ2V0dGVyO1xuICAgIH1cblxuICAgIGNvbnN0IGdldHRlciA9IHRodW5rRm9yKHAsIGNvbnRleHQpO1xuICAgIG0uaW1wb3J0cy5zZXQocCwgeyBnZXR0ZXIsIGRlY2xhcmF0aW9uczogbmV3IFNldChbZGVjbGFyYXRpb25NZXRhZGF0YV0pIH0pO1xuICAgIHJldHVybiBnZXR0ZXI7XG4gIH1cblxuICBjb25zdCBzb3VyY2UgPSBtYWtlU291cmNlQ29kZShjb250ZW50LCBhc3QpO1xuXG4gIGZ1bmN0aW9uIHJlYWRUc0NvbmZpZygpIHtcbiAgICBjb25zdCB0c0NvbmZpZ0luZm8gPSB0c0NvbmZpZ0xvYWRlcih7XG4gICAgICBjd2Q6XG4gICAgICAgIChjb250ZXh0LnBhcnNlck9wdGlvbnMgJiYgY29udGV4dC5wYXJzZXJPcHRpb25zLnRzY29uZmlnUm9vdERpcikgfHxcbiAgICAgICAgcHJvY2Vzcy5jd2QoKSxcbiAgICAgIGdldEVudjogKGtleSkgPT4gcHJvY2Vzcy5lbnZba2V5XSxcbiAgICB9KTtcbiAgICB0cnkge1xuICAgICAgaWYgKHRzQ29uZmlnSW5mby50c0NvbmZpZ1BhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBQcm9qZWN0cyBub3QgdXNpbmcgVHlwZVNjcmlwdCB3b24ndCBoYXZlIGB0eXBlc2NyaXB0YCBpbnN0YWxsZWQuXG4gICAgICAgIGlmICghdHMpIHsgdHMgPSByZXF1aXJlKCd0eXBlc2NyaXB0Jyk7IH1cbiAgXG4gICAgICAgIGNvbnN0IGNvbmZpZ0ZpbGUgPSB0cy5yZWFkQ29uZmlnRmlsZSh0c0NvbmZpZ0luZm8udHNDb25maWdQYXRoLCB0cy5zeXMucmVhZEZpbGUpO1xuICAgICAgICByZXR1cm4gdHMucGFyc2VKc29uQ29uZmlnRmlsZUNvbnRlbnQoXG4gICAgICAgICAgY29uZmlnRmlsZS5jb25maWcsXG4gICAgICAgICAgdHMuc3lzLFxuICAgICAgICAgIGRpcm5hbWUodHNDb25maWdJbmZvLnRzQ29uZmlnUGF0aCksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gQ2F0Y2ggYW55IGVycm9yc1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNFc01vZHVsZUludGVyb3AoKSB7XG4gICAgY29uc3QgY2FjaGVLZXkgPSBoYXNoT2JqZWN0KHtcbiAgICAgIHRzY29uZmlnUm9vdERpcjogY29udGV4dC5wYXJzZXJPcHRpb25zICYmIGNvbnRleHQucGFyc2VyT3B0aW9ucy50c2NvbmZpZ1Jvb3REaXIsXG4gICAgfSkuZGlnZXN0KCdoZXgnKTtcbiAgICBsZXQgdHNDb25maWcgPSB0c0NvbmZpZ0NhY2hlLmdldChjYWNoZUtleSk7XG4gICAgaWYgKHR5cGVvZiB0c0NvbmZpZyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRzQ29uZmlnID0gcmVhZFRzQ29uZmlnKGNvbnRleHQpO1xuICAgICAgdHNDb25maWdDYWNoZS5zZXQoY2FjaGVLZXksIHRzQ29uZmlnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHNDb25maWcgJiYgdHNDb25maWcub3B0aW9ucyA/IHRzQ29uZmlnLm9wdGlvbnMuZXNNb2R1bGVJbnRlcm9wIDogZmFsc2U7XG4gIH1cblxuICBhc3QuYm9keS5mb3JFYWNoKGZ1bmN0aW9uIChuKSB7XG4gICAgaWYgKG4udHlwZSA9PT0gJ0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbicpIHtcbiAgICAgIGNvbnN0IGV4cG9ydE1ldGEgPSBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBuKTtcbiAgICAgIGlmIChuLmRlY2xhcmF0aW9uLnR5cGUgPT09ICdJZGVudGlmaWVyJykge1xuICAgICAgICBhZGROYW1lc3BhY2UoZXhwb3J0TWV0YSwgbi5kZWNsYXJhdGlvbik7XG4gICAgICB9XG4gICAgICBtLm5hbWVzcGFjZS5zZXQoJ2RlZmF1bHQnLCBleHBvcnRNZXRhKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobi50eXBlID09PSAnRXhwb3J0QWxsRGVjbGFyYXRpb24nKSB7XG4gICAgICBjb25zdCBnZXR0ZXIgPSBjYXB0dXJlRGVwZW5kZW5jeShuLCBuLmV4cG9ydEtpbmQgPT09ICd0eXBlJyk7XG4gICAgICBpZiAoZ2V0dGVyKSBtLmRlcGVuZGVuY2llcy5hZGQoZ2V0dGVyKTtcbiAgICAgIGlmIChuLmV4cG9ydGVkKSB7XG4gICAgICAgIHByb2Nlc3NTcGVjaWZpZXIobiwgbi5leHBvcnRlZCwgbSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gY2FwdHVyZSBuYW1lc3BhY2VzIGluIGNhc2Ugb2YgbGF0ZXIgZXhwb3J0XG4gICAgaWYgKG4udHlwZSA9PT0gJ0ltcG9ydERlY2xhcmF0aW9uJykge1xuICAgICAgLy8gaW1wb3J0IHR5cGUgeyBGb28gfSAoVFMgYW5kIEZsb3cpXG4gICAgICBjb25zdCBkZWNsYXJhdGlvbklzVHlwZSA9IG4uaW1wb3J0S2luZCA9PT0gJ3R5cGUnO1xuICAgICAgLy8gaW1wb3J0ICcuL2Zvbycgb3IgaW1wb3J0IHt9IGZyb20gJy4vZm9vJyAoYm90aCAwIHNwZWNpZmllcnMpIGlzIGEgc2lkZSBlZmZlY3QgYW5kXG4gICAgICAvLyBzaG91bGRuJ3QgYmUgY29uc2lkZXJlZCB0byBiZSBqdXN0IGltcG9ydGluZyB0eXBlc1xuICAgICAgbGV0IHNwZWNpZmllcnNPbmx5SW1wb3J0aW5nVHlwZXMgPSBuLnNwZWNpZmllcnMubGVuZ3RoO1xuICAgICAgY29uc3QgaW1wb3J0ZWRTcGVjaWZpZXJzID0gbmV3IFNldCgpO1xuICAgICAgbi5zcGVjaWZpZXJzLmZvckVhY2goc3BlY2lmaWVyID0+IHtcbiAgICAgICAgaWYgKHN1cHBvcnRlZEltcG9ydFR5cGVzLmhhcyhzcGVjaWZpZXIudHlwZSkpIHtcbiAgICAgICAgICBpbXBvcnRlZFNwZWNpZmllcnMuYWRkKHNwZWNpZmllci50eXBlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3BlY2lmaWVyLnR5cGUgPT09ICdJbXBvcnRTcGVjaWZpZXInKSB7XG4gICAgICAgICAgaW1wb3J0ZWRTcGVjaWZpZXJzLmFkZChzcGVjaWZpZXIuaW1wb3J0ZWQubmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbXBvcnQgeyB0eXBlIEZvbyB9IChGbG93KVxuICAgICAgICBzcGVjaWZpZXJzT25seUltcG9ydGluZ1R5cGVzID1cbiAgICAgICAgICBzcGVjaWZpZXJzT25seUltcG9ydGluZ1R5cGVzICYmIHNwZWNpZmllci5pbXBvcnRLaW5kID09PSAndHlwZSc7XG4gICAgICB9KTtcbiAgICAgIGNhcHR1cmVEZXBlbmRlbmN5KG4sIGRlY2xhcmF0aW9uSXNUeXBlIHx8IHNwZWNpZmllcnNPbmx5SW1wb3J0aW5nVHlwZXMsIGltcG9ydGVkU3BlY2lmaWVycyk7XG5cbiAgICAgIGNvbnN0IG5zID0gbi5zcGVjaWZpZXJzLmZpbmQocyA9PiBzLnR5cGUgPT09ICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInKTtcbiAgICAgIGlmIChucykge1xuICAgICAgICBuYW1lc3BhY2VzLnNldChucy5sb2NhbC5uYW1lLCBuLnNvdXJjZS52YWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKG4udHlwZSA9PT0gJ0V4cG9ydE5hbWVkRGVjbGFyYXRpb24nKSB7XG4gICAgICAvLyBjYXB0dXJlIGRlY2xhcmF0aW9uXG4gICAgICBpZiAobi5kZWNsYXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAgIHN3aXRjaCAobi5kZWNsYXJhdGlvbi50eXBlKSB7XG4gICAgICAgIGNhc2UgJ0Z1bmN0aW9uRGVjbGFyYXRpb24nOlxuICAgICAgICBjYXNlICdDbGFzc0RlY2xhcmF0aW9uJzpcbiAgICAgICAgY2FzZSAnVHlwZUFsaWFzJzogLy8gZmxvd3R5cGUgd2l0aCBiYWJlbC1lc2xpbnQgcGFyc2VyXG4gICAgICAgIGNhc2UgJ0ludGVyZmFjZURlY2xhcmF0aW9uJzpcbiAgICAgICAgY2FzZSAnRGVjbGFyZUZ1bmN0aW9uJzpcbiAgICAgICAgY2FzZSAnVFNEZWNsYXJlRnVuY3Rpb24nOlxuICAgICAgICBjYXNlICdUU0VudW1EZWNsYXJhdGlvbic6XG4gICAgICAgIGNhc2UgJ1RTVHlwZUFsaWFzRGVjbGFyYXRpb24nOlxuICAgICAgICBjYXNlICdUU0ludGVyZmFjZURlY2xhcmF0aW9uJzpcbiAgICAgICAgY2FzZSAnVFNBYnN0cmFjdENsYXNzRGVjbGFyYXRpb24nOlxuICAgICAgICBjYXNlICdUU01vZHVsZURlY2xhcmF0aW9uJzpcbiAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQobi5kZWNsYXJhdGlvbi5pZC5uYW1lLCBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBuKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1ZhcmlhYmxlRGVjbGFyYXRpb24nOlxuICAgICAgICAgIG4uZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zLmZvckVhY2goKGQpID0+XG4gICAgICAgICAgICByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZShkLmlkLFxuICAgICAgICAgICAgICBpZCA9PiBtLm5hbWVzcGFjZS5zZXQoaWQubmFtZSwgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgZCwgbikpKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbi5zcGVjaWZpZXJzLmZvckVhY2goKHMpID0+IHByb2Nlc3NTcGVjaWZpZXIocywgbiwgbSkpO1xuICAgIH1cblxuICAgIGNvbnN0IGV4cG9ydHMgPSBbJ1RTRXhwb3J0QXNzaWdubWVudCddO1xuICAgIGlmIChpc0VzTW9kdWxlSW50ZXJvcFRydWUpIHtcbiAgICAgIGV4cG9ydHMucHVzaCgnVFNOYW1lc3BhY2VFeHBvcnREZWNsYXJhdGlvbicpO1xuICAgIH1cblxuICAgIC8vIFRoaXMgZG9lc24ndCBkZWNsYXJlIGFueXRoaW5nLCBidXQgY2hhbmdlcyB3aGF0J3MgYmVpbmcgZXhwb3J0ZWQuXG4gICAgaWYgKGluY2x1ZGVzKGV4cG9ydHMsIG4udHlwZSkpIHtcbiAgICAgIGNvbnN0IGV4cG9ydGVkTmFtZSA9IG4udHlwZSA9PT0gJ1RTTmFtZXNwYWNlRXhwb3J0RGVjbGFyYXRpb24nXG4gICAgICAgID8gbi5pZC5uYW1lXG4gICAgICAgIDogKG4uZXhwcmVzc2lvbiAmJiBuLmV4cHJlc3Npb24ubmFtZSB8fCAobi5leHByZXNzaW9uLmlkICYmIG4uZXhwcmVzc2lvbi5pZC5uYW1lKSB8fCBudWxsKTtcbiAgICAgIGNvbnN0IGRlY2xUeXBlcyA9IFtcbiAgICAgICAgJ1ZhcmlhYmxlRGVjbGFyYXRpb24nLFxuICAgICAgICAnQ2xhc3NEZWNsYXJhdGlvbicsXG4gICAgICAgICdUU0RlY2xhcmVGdW5jdGlvbicsXG4gICAgICAgICdUU0VudW1EZWNsYXJhdGlvbicsXG4gICAgICAgICdUU1R5cGVBbGlhc0RlY2xhcmF0aW9uJyxcbiAgICAgICAgJ1RTSW50ZXJmYWNlRGVjbGFyYXRpb24nLFxuICAgICAgICAnVFNBYnN0cmFjdENsYXNzRGVjbGFyYXRpb24nLFxuICAgICAgICAnVFNNb2R1bGVEZWNsYXJhdGlvbicsXG4gICAgICBdO1xuICAgICAgY29uc3QgZXhwb3J0ZWREZWNscyA9IGFzdC5ib2R5LmZpbHRlcigoeyB0eXBlLCBpZCwgZGVjbGFyYXRpb25zIH0pID0+IGluY2x1ZGVzKGRlY2xUeXBlcywgdHlwZSkgJiYgKFxuICAgICAgICAoaWQgJiYgaWQubmFtZSA9PT0gZXhwb3J0ZWROYW1lKSB8fCAoZGVjbGFyYXRpb25zICYmIGRlY2xhcmF0aW9ucy5maW5kKChkKSA9PiBkLmlkLm5hbWUgPT09IGV4cG9ydGVkTmFtZSkpXG4gICAgICApKTtcbiAgICAgIGlmIChleHBvcnRlZERlY2xzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBFeHBvcnQgaXMgbm90IHJlZmVyZW5jaW5nIGFueSBsb2NhbCBkZWNsYXJhdGlvbiwgbXVzdCBiZSByZS1leHBvcnRpbmdcbiAgICAgICAgbS5uYW1lc3BhY2Uuc2V0KCdkZWZhdWx0JywgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgbikpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoXG4gICAgICAgIGlzRXNNb2R1bGVJbnRlcm9wVHJ1ZSAvLyBlc01vZHVsZUludGVyb3AgaXMgb24gaW4gdHNjb25maWdcbiAgICAgICAgJiYgIW0ubmFtZXNwYWNlLmhhcygnZGVmYXVsdCcpIC8vIGFuZCBkZWZhdWx0IGlzbid0IGFkZGVkIGFscmVhZHlcbiAgICAgICkge1xuICAgICAgICBtLm5hbWVzcGFjZS5zZXQoJ2RlZmF1bHQnLCB7fSk7IC8vIGFkZCBkZWZhdWx0IGV4cG9ydFxuICAgICAgfVxuICAgICAgZXhwb3J0ZWREZWNscy5mb3JFYWNoKChkZWNsKSA9PiB7XG4gICAgICAgIGlmIChkZWNsLnR5cGUgPT09ICdUU01vZHVsZURlY2xhcmF0aW9uJykge1xuICAgICAgICAgIGlmIChkZWNsLmJvZHkgJiYgZGVjbC5ib2R5LnR5cGUgPT09ICdUU01vZHVsZURlY2xhcmF0aW9uJykge1xuICAgICAgICAgICAgbS5uYW1lc3BhY2Uuc2V0KGRlY2wuYm9keS5pZC5uYW1lLCBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBkZWNsLmJvZHkpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRlY2wuYm9keSAmJiBkZWNsLmJvZHkuYm9keSkge1xuICAgICAgICAgICAgZGVjbC5ib2R5LmJvZHkuZm9yRWFjaCgobW9kdWxlQmxvY2tOb2RlKSA9PiB7XG4gICAgICAgICAgICAgIC8vIEV4cG9ydC1hc3NpZ25tZW50IGV4cG9ydHMgYWxsIG1lbWJlcnMgaW4gdGhlIG5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgLy8gZXhwbGljaXRseSBleHBvcnRlZCBvciBub3QuXG4gICAgICAgICAgICAgIGNvbnN0IG5hbWVzcGFjZURlY2wgPSBtb2R1bGVCbG9ja05vZGUudHlwZSA9PT0gJ0V4cG9ydE5hbWVkRGVjbGFyYXRpb24nID9cbiAgICAgICAgICAgICAgICBtb2R1bGVCbG9ja05vZGUuZGVjbGFyYXRpb24gOlxuICAgICAgICAgICAgICAgIG1vZHVsZUJsb2NrTm9kZTtcblxuICAgICAgICAgICAgICBpZiAoIW5hbWVzcGFjZURlY2wpIHtcbiAgICAgICAgICAgICAgICAvLyBUeXBlU2NyaXB0IGNhbiBjaGVjayB0aGlzIGZvciB1czsgd2UgbmVlZG4ndFxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKG5hbWVzcGFjZURlY2wudHlwZSA9PT0gJ1ZhcmlhYmxlRGVjbGFyYXRpb24nKSB7XG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlRGVjbC5kZWNsYXJhdGlvbnMuZm9yRWFjaCgoZCkgPT5cbiAgICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKGQuaWQsIChpZCkgPT4gbS5uYW1lc3BhY2Uuc2V0KFxuICAgICAgICAgICAgICAgICAgICBpZC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBkZWNsLCBuYW1lc3BhY2VEZWNsLCBtb2R1bGVCbG9ja05vZGUpLFxuICAgICAgICAgICAgICAgICAgKSksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQoXG4gICAgICAgICAgICAgICAgICBuYW1lc3BhY2VEZWNsLmlkLm5hbWUsXG4gICAgICAgICAgICAgICAgICBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBtb2R1bGVCbG9ja05vZGUpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEV4cG9ydCBhcyBkZWZhdWx0XG4gICAgICAgICAgbS5uYW1lc3BhY2Uuc2V0KCdkZWZhdWx0JywgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgZGVjbCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChcbiAgICBpc0VzTW9kdWxlSW50ZXJvcFRydWUgLy8gZXNNb2R1bGVJbnRlcm9wIGlzIG9uIGluIHRzY29uZmlnXG4gICAgJiYgbS5uYW1lc3BhY2Uuc2l6ZSA+IDAgLy8gYW55dGhpbmcgaXMgZXhwb3J0ZWRcbiAgICAmJiAhbS5uYW1lc3BhY2UuaGFzKCdkZWZhdWx0JykgLy8gYW5kIGRlZmF1bHQgaXNuJ3QgYWRkZWQgYWxyZWFkeVxuICApIHtcbiAgICBtLm5hbWVzcGFjZS5zZXQoJ2RlZmF1bHQnLCB7fSk7IC8vIGFkZCBkZWZhdWx0IGV4cG9ydFxuICB9XG5cbiAgcmV0dXJuIG07XG59O1xuXG4vKipcbiAqIFRoZSBjcmVhdGlvbiBvZiB0aGlzIGNsb3N1cmUgaXMgaXNvbGF0ZWQgZnJvbSBvdGhlciBzY29wZXNcbiAqIHRvIGF2b2lkIG92ZXItcmV0ZW50aW9uIG9mIHVucmVsYXRlZCB2YXJpYWJsZXMsIHdoaWNoIGhhc1xuICogY2F1c2VkIG1lbW9yeSBsZWFrcy4gU2VlICMxMjY2LlxuICovXG5mdW5jdGlvbiB0aHVua0ZvcihwLCBjb250ZXh0KSB7XG4gIHJldHVybiAoKSA9PiBFeHBvcnRNYXAuZm9yKGNoaWxkQ29udGV4dChwLCBjb250ZXh0KSk7XG59XG5cblxuLyoqXG4gKiBUcmF2ZXJzZSBhIHBhdHRlcm4vaWRlbnRpZmllciBub2RlLCBjYWxsaW5nICdjYWxsYmFjaydcbiAqIGZvciBlYWNoIGxlYWYgaWRlbnRpZmllci5cbiAqIEBwYXJhbSAge25vZGV9ICAgcGF0dGVyblxuICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUocGF0dGVybiwgY2FsbGJhY2spIHtcbiAgc3dpdGNoIChwYXR0ZXJuLnR5cGUpIHtcbiAgY2FzZSAnSWRlbnRpZmllcic6IC8vIGJhc2UgY2FzZVxuICAgIGNhbGxiYWNrKHBhdHRlcm4pO1xuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ09iamVjdFBhdHRlcm4nOlxuICAgIHBhdHRlcm4ucHJvcGVydGllcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgaWYgKHAudHlwZSA9PT0gJ0V4cGVyaW1lbnRhbFJlc3RQcm9wZXJ0eScgfHwgcC50eXBlID09PSAnUmVzdEVsZW1lbnQnKSB7XG4gICAgICAgIGNhbGxiYWNrKHAuYXJndW1lbnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZShwLnZhbHVlLCBjYWxsYmFjayk7XG4gICAgfSk7XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnQXJyYXlQYXR0ZXJuJzpcbiAgICBwYXR0ZXJuLmVsZW1lbnRzLmZvckVhY2goKGVsZW1lbnQpID0+IHtcbiAgICAgIGlmIChlbGVtZW50ID09IG51bGwpIHJldHVybjtcbiAgICAgIGlmIChlbGVtZW50LnR5cGUgPT09ICdFeHBlcmltZW50YWxSZXN0UHJvcGVydHknIHx8IGVsZW1lbnQudHlwZSA9PT0gJ1Jlc3RFbGVtZW50Jykge1xuICAgICAgICBjYWxsYmFjayhlbGVtZW50LmFyZ3VtZW50KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZWxlbWVudCwgY2FsbGJhY2spO1xuICAgIH0pO1xuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ0Fzc2lnbm1lbnRQYXR0ZXJuJzpcbiAgICBjYWxsYmFjayhwYXR0ZXJuLmxlZnQpO1xuICAgIGJyZWFrO1xuICB9XG59XG5cbi8qKlxuICogZG9uJ3QgaG9sZCBmdWxsIGNvbnRleHQgb2JqZWN0IGluIG1lbW9yeSwganVzdCBncmFiIHdoYXQgd2UgbmVlZC5cbiAqL1xuZnVuY3Rpb24gY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpIHtcbiAgY29uc3QgeyBzZXR0aW5ncywgcGFyc2VyT3B0aW9ucywgcGFyc2VyUGF0aCB9ID0gY29udGV4dDtcbiAgcmV0dXJuIHtcbiAgICBzZXR0aW5ncyxcbiAgICBwYXJzZXJPcHRpb25zLFxuICAgIHBhcnNlclBhdGgsXG4gICAgcGF0aCxcbiAgfTtcbn1cblxuXG4vKipcbiAqIHNvbWV0aW1lcyBsZWdhY3kgc3VwcG9ydCBpc24ndCBfdGhhdF8gaGFyZC4uLiByaWdodD9cbiAqL1xuZnVuY3Rpb24gbWFrZVNvdXJjZUNvZGUodGV4dCwgYXN0KSB7XG4gIGlmIChTb3VyY2VDb2RlLmxlbmd0aCA+IDEpIHtcbiAgICAvLyBFU0xpbnQgM1xuICAgIHJldHVybiBuZXcgU291cmNlQ29kZSh0ZXh0LCBhc3QpO1xuICB9IGVsc2Uge1xuICAgIC8vIEVTTGludCA0LCA1XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VDb2RlKHsgdGV4dCwgYXN0IH0pO1xuICB9XG59XG4iXX0=