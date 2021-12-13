'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       * @fileOverview Ensures that no imported module imports the linted module.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       * @author Ben Mosher
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       */

var _resolve = require('eslint-module-utils/resolve');var _resolve2 = _interopRequireDefault(_resolve);
var _ExportMap = require('../ExportMap');var _ExportMap2 = _interopRequireDefault(_ExportMap);
var _importType = require('../core/importType');
var _moduleVisitor = require('eslint-module-utils/moduleVisitor');var _moduleVisitor2 = _interopRequireDefault(_moduleVisitor);
var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}}

// todo: cache cycles / deep relationships for faster repeat evaluation
module.exports = {
  meta: {
    type: 'suggestion',
    docs: { url: (0, _docsUrl2['default'])('no-cycle') },
    schema: [(0, _moduleVisitor.makeOptionsSchema)({
      maxDepth: {
        oneOf: [
        {
          description: 'maximum dependency depth to traverse',
          type: 'integer',
          minimum: 1 },

        {
          'enum': ['∞'],
          type: 'string' }] },



      ignoreExternal: {
        description: 'ignore external modules',
        type: 'boolean',
        'default': false } })] },




  create: function () {function create(context) {
      var myPath = context.getPhysicalFilename ? context.getPhysicalFilename() : context.getFilename();
      if (myPath === '<text>') return {}; // can't cycle-check a non-file

      var options = context.options[0] || {};
      var maxDepth = typeof options.maxDepth === 'number' ? options.maxDepth : Infinity;
      var ignoreModule = function () {function ignoreModule(name) {return options.ignoreExternal && (0, _importType.isExternalModule)(
          name,
          context.settings,
          (0, _resolve2['default'])(name, context),
          context);}return ignoreModule;}();


      function checkSourceValue(sourceNode, importer) {
        if (ignoreModule(sourceNode.value)) {
          return; // ignore external modules
        }

        if (
        importer.type === 'ImportDeclaration' && (
        // import type { Foo } (TS and Flow)
        importer.importKind === 'type' ||
        // import { type Foo } (Flow)
        importer.specifiers.every(function (_ref) {var importKind = _ref.importKind;return importKind === 'type';})))

        {
          return; // ignore type imports
        }

        var imported = _ExportMap2['default'].get(sourceNode.value, context);

        if (imported == null) {
          return; // no-unresolved territory
        }

        if (imported.path === myPath) {
          return; // no-self-import territory
        }

        var untraversed = [{ mget: function () {function mget() {return imported;}return mget;}(), route: [] }];
        var traversed = new Set();
        function detectCycle(_ref2) {var mget = _ref2.mget,route = _ref2.route;
          var m = mget();
          if (m == null) return;
          if (traversed.has(m.path)) return;
          traversed.add(m.path);var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {

            for (var _iterator = m.imports[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var _ref3 = _step.value;var _ref4 = _slicedToArray(_ref3, 2);var path = _ref4[0];var _ref4$ = _ref4[1];var getter = _ref4$.getter;var declarations = _ref4$.declarations;
              if (traversed.has(path)) continue;
              var toTraverse = [].concat(_toConsumableArray(declarations)).filter(function (_ref5) {var source = _ref5.source,isOnlyImportingTypes = _ref5.isOnlyImportingTypes;return (
                  !ignoreModule(source.value) &&
                  // Ignore only type imports
                  !isOnlyImportingTypes);});

              /*
                                             Only report as a cycle if there are any import declarations that are considered by
                                             the rule. For example:
                                              a.ts:
                                             import { foo } from './b' // should not be reported as a cycle
                                              b.ts:
                                             import type { Bar } from './a'
                                             */


              if (path === myPath && toTraverse.length > 0) return true;
              if (route.length + 1 < maxDepth) {var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
                  for (var _iterator2 = toTraverse[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var _ref6 = _step2.value;var source = _ref6.source;
                    untraversed.push({ mget: getter, route: route.concat(source) });
                  }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2['return']) {_iterator2['return']();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
              }
            }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator['return']) {_iterator['return']();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
        }

        while (untraversed.length > 0) {
          var next = untraversed.shift(); // bfs!
          if (detectCycle(next)) {
            var message = next.route.length > 0 ? 'Dependency cycle via ' + String(
            routeString(next.route)) :
            'Dependency cycle detected.';
            context.report(importer, message);
            return;
          }
        }
      }

      return (0, _moduleVisitor2['default'])(checkSourceValue, context.options[0]);
    }return create;}() };


function routeString(route) {
  return route.map(function (s) {return String(s.value) + ':' + String(s.loc.start.line);}).join('=>');
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uby1jeWNsZS5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsInR5cGUiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwibWF4RGVwdGgiLCJvbmVPZiIsImRlc2NyaXB0aW9uIiwibWluaW11bSIsImlnbm9yZUV4dGVybmFsIiwiY3JlYXRlIiwiY29udGV4dCIsIm15UGF0aCIsImdldFBoeXNpY2FsRmlsZW5hbWUiLCJnZXRGaWxlbmFtZSIsIm9wdGlvbnMiLCJJbmZpbml0eSIsImlnbm9yZU1vZHVsZSIsIm5hbWUiLCJzZXR0aW5ncyIsImNoZWNrU291cmNlVmFsdWUiLCJzb3VyY2VOb2RlIiwiaW1wb3J0ZXIiLCJ2YWx1ZSIsImltcG9ydEtpbmQiLCJzcGVjaWZpZXJzIiwiZXZlcnkiLCJpbXBvcnRlZCIsIkV4cG9ydHMiLCJnZXQiLCJwYXRoIiwidW50cmF2ZXJzZWQiLCJtZ2V0Iiwicm91dGUiLCJ0cmF2ZXJzZWQiLCJTZXQiLCJkZXRlY3RDeWNsZSIsIm0iLCJoYXMiLCJhZGQiLCJpbXBvcnRzIiwiZ2V0dGVyIiwiZGVjbGFyYXRpb25zIiwidG9UcmF2ZXJzZSIsImZpbHRlciIsInNvdXJjZSIsImlzT25seUltcG9ydGluZ1R5cGVzIiwibGVuZ3RoIiwicHVzaCIsImNvbmNhdCIsIm5leHQiLCJzaGlmdCIsIm1lc3NhZ2UiLCJyb3V0ZVN0cmluZyIsInJlcG9ydCIsIm1hcCIsInMiLCJsb2MiLCJzdGFydCIsImxpbmUiLCJqb2luIl0sIm1hcHBpbmdzIjoic29CQUFBOzs7OztBQUtBLHNEO0FBQ0EseUM7QUFDQTtBQUNBLGtFO0FBQ0EscUM7O0FBRUE7QUFDQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU0sWUFERjtBQUVKQyxVQUFNLEVBQUVDLEtBQUssMEJBQVEsVUFBUixDQUFQLEVBRkY7QUFHSkMsWUFBUSxDQUFDLHNDQUFrQjtBQUN6QkMsZ0JBQVU7QUFDUkMsZUFBTztB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LWN5Y2xlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IEVuc3VyZXMgdGhhdCBubyBpbXBvcnRlZCBtb2R1bGUgaW1wb3J0cyB0aGUgbGludGVkIG1vZHVsZS5cbiAqIEBhdXRob3IgQmVuIE1vc2hlclxuICovXG5cbmltcG9ydCByZXNvbHZlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZSc7XG5pbXBvcnQgRXhwb3J0cyBmcm9tICcuLi9FeHBvcnRNYXAnO1xuaW1wb3J0IHsgaXNFeHRlcm5hbE1vZHVsZSB9IGZyb20gJy4uL2NvcmUvaW1wb3J0VHlwZSc7XG5pbXBvcnQgbW9kdWxlVmlzaXRvciwgeyBtYWtlT3B0aW9uc1NjaGVtYSB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvbW9kdWxlVmlzaXRvcic7XG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJztcblxuLy8gdG9kbzogY2FjaGUgY3ljbGVzIC8gZGVlcCByZWxhdGlvbnNoaXBzIGZvciBmYXN0ZXIgcmVwZWF0IGV2YWx1YXRpb25cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgdHlwZTogJ3N1Z2dlc3Rpb24nLFxuICAgIGRvY3M6IHsgdXJsOiBkb2NzVXJsKCduby1jeWNsZScpIH0sXG4gICAgc2NoZW1hOiBbbWFrZU9wdGlvbnNTY2hlbWEoe1xuICAgICAgbWF4RGVwdGg6IHtcbiAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ21heGltdW0gZGVwZW5kZW5jeSBkZXB0aCB0byB0cmF2ZXJzZScsXG4gICAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgICBtaW5pbXVtOiAxLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgZW51bTogWyfiiJ4nXSxcbiAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgaWdub3JlRXh0ZXJuYWw6IHtcbiAgICAgICAgZGVzY3JpcHRpb246ICdpZ25vcmUgZXh0ZXJuYWwgbW9kdWxlcycsXG4gICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pXSxcbiAgfSxcblxuICBjcmVhdGUoY29udGV4dCkge1xuICAgIGNvbnN0IG15UGF0aCA9IGNvbnRleHQuZ2V0UGh5c2ljYWxGaWxlbmFtZSA/IGNvbnRleHQuZ2V0UGh5c2ljYWxGaWxlbmFtZSgpIDogY29udGV4dC5nZXRGaWxlbmFtZSgpO1xuICAgIGlmIChteVBhdGggPT09ICc8dGV4dD4nKSByZXR1cm4ge307IC8vIGNhbid0IGN5Y2xlLWNoZWNrIGEgbm9uLWZpbGVcblxuICAgIGNvbnN0IG9wdGlvbnMgPSBjb250ZXh0Lm9wdGlvbnNbMF0gfHwge307XG4gICAgY29uc3QgbWF4RGVwdGggPSB0eXBlb2Ygb3B0aW9ucy5tYXhEZXB0aCA9PT0gJ251bWJlcicgPyBvcHRpb25zLm1heERlcHRoIDogSW5maW5pdHk7XG4gICAgY29uc3QgaWdub3JlTW9kdWxlID0gKG5hbWUpID0+IG9wdGlvbnMuaWdub3JlRXh0ZXJuYWwgJiYgaXNFeHRlcm5hbE1vZHVsZShcbiAgICAgIG5hbWUsXG4gICAgICBjb250ZXh0LnNldHRpbmdzLFxuICAgICAgcmVzb2x2ZShuYW1lLCBjb250ZXh0KSxcbiAgICAgIGNvbnRleHQsXG4gICAgKTtcblxuICAgIGZ1bmN0aW9uIGNoZWNrU291cmNlVmFsdWUoc291cmNlTm9kZSwgaW1wb3J0ZXIpIHtcbiAgICAgIGlmIChpZ25vcmVNb2R1bGUoc291cmNlTm9kZS52YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuOyAvLyBpZ25vcmUgZXh0ZXJuYWwgbW9kdWxlc1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIGltcG9ydGVyLnR5cGUgPT09ICdJbXBvcnREZWNsYXJhdGlvbicgJiYgKFxuICAgICAgICAgIC8vIGltcG9ydCB0eXBlIHsgRm9vIH0gKFRTIGFuZCBGbG93KVxuICAgICAgICAgIGltcG9ydGVyLmltcG9ydEtpbmQgPT09ICd0eXBlJyB8fFxuICAgICAgICAgIC8vIGltcG9ydCB7IHR5cGUgRm9vIH0gKEZsb3cpXG4gICAgICAgICAgaW1wb3J0ZXIuc3BlY2lmaWVycy5ldmVyeSgoeyBpbXBvcnRLaW5kIH0pID0+IGltcG9ydEtpbmQgPT09ICd0eXBlJylcbiAgICAgICAgKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybjsgLy8gaWdub3JlIHR5cGUgaW1wb3J0c1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpbXBvcnRlZCA9IEV4cG9ydHMuZ2V0KHNvdXJjZU5vZGUudmFsdWUsIGNvbnRleHQpO1xuXG4gICAgICBpZiAoaW1wb3J0ZWQgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm47ICAvLyBuby11bnJlc29sdmVkIHRlcnJpdG9yeVxuICAgICAgfVxuXG4gICAgICBpZiAoaW1wb3J0ZWQucGF0aCA9PT0gbXlQYXRoKSB7XG4gICAgICAgIHJldHVybjsgIC8vIG5vLXNlbGYtaW1wb3J0IHRlcnJpdG9yeVxuICAgICAgfVxuXG4gICAgICBjb25zdCB1bnRyYXZlcnNlZCA9IFt7IG1nZXQ6ICgpID0+IGltcG9ydGVkLCByb3V0ZTpbXSB9XTtcbiAgICAgIGNvbnN0IHRyYXZlcnNlZCA9IG5ldyBTZXQoKTtcbiAgICAgIGZ1bmN0aW9uIGRldGVjdEN5Y2xlKHsgbWdldCwgcm91dGUgfSkge1xuICAgICAgICBjb25zdCBtID0gbWdldCgpO1xuICAgICAgICBpZiAobSA9PSBudWxsKSByZXR1cm47XG4gICAgICAgIGlmICh0cmF2ZXJzZWQuaGFzKG0ucGF0aCkpIHJldHVybjtcbiAgICAgICAgdHJhdmVyc2VkLmFkZChtLnBhdGgpO1xuXG4gICAgICAgIGZvciAoY29uc3QgW3BhdGgsIHsgZ2V0dGVyLCBkZWNsYXJhdGlvbnMgfV0gb2YgbS5pbXBvcnRzKSB7XG4gICAgICAgICAgaWYgKHRyYXZlcnNlZC5oYXMocGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICAgIGNvbnN0IHRvVHJhdmVyc2UgPSBbLi4uZGVjbGFyYXRpb25zXS5maWx0ZXIoKHsgc291cmNlLCBpc09ubHlJbXBvcnRpbmdUeXBlcyB9KSA9PlxuICAgICAgICAgICAgIWlnbm9yZU1vZHVsZShzb3VyY2UudmFsdWUpICYmXG4gICAgICAgICAgICAvLyBJZ25vcmUgb25seSB0eXBlIGltcG9ydHNcbiAgICAgICAgICAgICFpc09ubHlJbXBvcnRpbmdUeXBlcyxcbiAgICAgICAgICApO1xuICAgICAgICAgIC8qXG4gICAgICAgICAgT25seSByZXBvcnQgYXMgYSBjeWNsZSBpZiB0aGVyZSBhcmUgYW55IGltcG9ydCBkZWNsYXJhdGlvbnMgdGhhdCBhcmUgY29uc2lkZXJlZCBieVxuICAgICAgICAgIHRoZSBydWxlLiBGb3IgZXhhbXBsZTpcblxuICAgICAgICAgIGEudHM6XG4gICAgICAgICAgaW1wb3J0IHsgZm9vIH0gZnJvbSAnLi9iJyAvLyBzaG91bGQgbm90IGJlIHJlcG9ydGVkIGFzIGEgY3ljbGVcblxuICAgICAgICAgIGIudHM6XG4gICAgICAgICAgaW1wb3J0IHR5cGUgeyBCYXIgfSBmcm9tICcuL2EnXG4gICAgICAgICAgKi9cbiAgICAgICAgICBpZiAocGF0aCA9PT0gbXlQYXRoICYmIHRvVHJhdmVyc2UubGVuZ3RoID4gMCkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgaWYgKHJvdXRlLmxlbmd0aCArIDEgPCBtYXhEZXB0aCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IHNvdXJjZSB9IG9mIHRvVHJhdmVyc2UpIHtcbiAgICAgICAgICAgICAgdW50cmF2ZXJzZWQucHVzaCh7IG1nZXQ6IGdldHRlciwgcm91dGU6IHJvdXRlLmNvbmNhdChzb3VyY2UpIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB3aGlsZSAodW50cmF2ZXJzZWQubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBuZXh0ID0gdW50cmF2ZXJzZWQuc2hpZnQoKTsgLy8gYmZzIVxuICAgICAgICBpZiAoZGV0ZWN0Q3ljbGUobmV4dCkpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gKG5leHQucm91dGUubGVuZ3RoID4gMFxuICAgICAgICAgICAgPyBgRGVwZW5kZW5jeSBjeWNsZSB2aWEgJHtyb3V0ZVN0cmluZyhuZXh0LnJvdXRlKX1gXG4gICAgICAgICAgICA6ICdEZXBlbmRlbmN5IGN5Y2xlIGRldGVjdGVkLicpO1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KGltcG9ydGVyLCBtZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kdWxlVmlzaXRvcihjaGVja1NvdXJjZVZhbHVlLCBjb250ZXh0Lm9wdGlvbnNbMF0pO1xuICB9LFxufTtcblxuZnVuY3Rpb24gcm91dGVTdHJpbmcocm91dGUpIHtcbiAgcmV0dXJuIHJvdXRlLm1hcChzID0+IGAke3MudmFsdWV9OiR7cy5sb2Muc3RhcnQubGluZX1gKS5qb2luKCc9PicpO1xufVxuIl19