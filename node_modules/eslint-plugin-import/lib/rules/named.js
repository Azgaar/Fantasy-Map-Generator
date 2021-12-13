'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _path = require('path');var path = _interopRequireWildcard(_path);
var _ExportMap = require('../ExportMap');var _ExportMap2 = _interopRequireDefault(_ExportMap);
var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}function _interopRequireWildcard(obj) {if (obj && obj.__esModule) {return obj;} else {var newObj = {};if (obj != null) {for (var key in obj) {if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];}}newObj['default'] = obj;return newObj;}}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      url: (0, _docsUrl2['default'])('named') },

    schema: [
    {
      type: 'object',
      properties: {
        commonjs: {
          type: 'boolean' } },


      additionalProperties: false }] },




  create: function () {function create(context) {
      var options = context.options[0] || {};

      function checkSpecifiers(key, type, node) {
        // ignore local exports and type imports/exports
        if (
        node.source == null ||
        node.importKind === 'type' ||
        node.importKind === 'typeof' ||
        node.exportKind === 'type')
        {
          return;
        }

        if (!node.specifiers.some(function (im) {return im.type === type;})) {
          return; // no named imports/exports
        }

        var imports = _ExportMap2['default'].get(node.source.value, context);
        if (imports == null) {
          return;
        }

        if (imports.errors.length) {
          imports.reportErrors(context, node);
          return;
        }

        node.specifiers.forEach(function (im) {
          if (
          im.type !== type
          // ignore type imports
          || im.importKind === 'type' || im.importKind === 'typeof')
          {
            return;
          }

          var deepLookup = imports.hasDeep(im[key].name);

          if (!deepLookup.found) {
            if (deepLookup.path.length > 1) {
              var deepPath = deepLookup.path.
              map(function (i) {return path.relative(path.dirname(context.getPhysicalFilename ? context.getPhysicalFilename() : context.getFilename()), i.path);}).
              join(' -> ');

              context.report(im[key], String(im[key].name) + ' not found via ' + String(deepPath));
            } else {
              context.report(im[key], im[key].name + ' not found in \'' + node.source.value + '\'');
            }
          }
        });
      }

      function checkRequire(node) {
        if (
        !options.commonjs ||
        node.type !== 'VariableDeclarator'
        // return if it's not an object destructure or it's an empty object destructure
        || !node.id || node.id.type !== 'ObjectPattern' || node.id.properties.length === 0
        // return if there is no call expression on the right side
        || !node.init || node.init.type !== 'CallExpression')
        {
          return;
        }

        var call = node.init;var _call$arguments = _slicedToArray(
        call.arguments, 1),source = _call$arguments[0];
        var variableImports = node.id.properties;
        var variableExports = _ExportMap2['default'].get(source.value, context);

        if (
        // return if it's not a commonjs require statement
        call.callee.type !== 'Identifier' || call.callee.name !== 'require' || call.arguments.length !== 1
        // return if it's not a string source
        || source.type !== 'Literal' ||
        variableExports == null)
        {
          return;
        }

        if (variableExports.errors.length) {
          variableExports.reportErrors(context, node);
          return;
        }

        variableImports.forEach(function (im) {
          if (im.type !== 'Property' || !im.key || im.key.type !== 'Identifier') {
            return;
          }

          var deepLookup = variableExports.hasDeep(im.key.name);

          if (!deepLookup.found) {
            if (deepLookup.path.length > 1) {
              var deepPath = deepLookup.path.
              map(function (i) {return path.relative(path.dirname(context.getFilename()), i.path);}).
              join(' -> ');

              context.report(im.key, String(im.key.name) + ' not found via ' + String(deepPath));
            } else {
              context.report(im.key, im.key.name + ' not found in \'' + source.value + '\'');
            }
          }
        });
      }

      return {
        ImportDeclaration: checkSpecifiers.bind(null, 'imported', 'ImportSpecifier'),

        ExportNamedDeclaration: checkSpecifiers.bind(null, 'local', 'ExportSpecifier'),

        VariableDeclarator: checkRequire };

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uYW1lZC5qcyJdLCJuYW1lcyI6WyJwYXRoIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJ0eXBlIiwiZG9jcyIsInVybCIsInNjaGVtYSIsInByb3BlcnRpZXMiLCJjb21tb25qcyIsImFkZGl0aW9uYWxQcm9wZXJ0aWVzIiwiY3JlYXRlIiwiY29udGV4dCIsIm9wdGlvbnMiLCJjaGVja1NwZWNpZmllcnMiLCJrZXkiLCJub2RlIiwic291cmNlIiwiaW1wb3J0S2luZCIsImV4cG9ydEtpbmQiLCJzcGVjaWZpZXJzIiwic29tZSIsImltIiwiaW1wb3J0cyIsIkV4cG9ydHMiLCJnZXQiLCJ2YWx1ZSIsImVycm9ycyIsImxlbmd0aCIsInJlcG9ydEVycm9ycyIsImZvckVhY2giLCJkZWVwTG9va3VwIiwiaGFzRGVlcCIsIm5hbWUiLCJmb3VuZCIsImRlZXBQYXRoIiwibWFwIiwicmVsYXRpdmUiLCJkaXJuYW1lIiwiZ2V0UGh5c2ljYWxGaWxlbmFtZSIsImdldEZpbGVuYW1lIiwiaSIsImpvaW4iLCJyZXBvcnQiLCJjaGVja1JlcXVpcmUiLCJpZCIsImluaXQiLCJjYWxsIiwiYXJndW1lbnRzIiwidmFyaWFibGVJbXBvcnRzIiwidmFyaWFibGVFeHBvcnRzIiwiY2FsbGVlIiwiSW1wb3J0RGVjbGFyYXRpb24iLCJiaW5kIiwiRXhwb3J0TmFtZWREZWNsYXJhdGlvbiIsIlZhcmlhYmxlRGVjbGFyYXRvciJdLCJtYXBwaW5ncyI6InFvQkFBQSw0QixJQUFZQSxJO0FBQ1oseUM7QUFDQSxxQzs7QUFFQUMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU0sU0FERjtBQUVKQyxVQUFNO0FBQ0pDLFdBQUssMEJBQVEsT0FBUixDQURELEVBRkY7O0FBS0pDLFlBQVE7QUFDTjtBQUNFSCxZQUFNLFFBRFI7QUFFRUksa0JBQVk7QUFDVkMsa0JBQVU7QUFDUkwsZ0JBQU0sU0FERSxFQURBLEVBRmQ7OztBQU9FTSw0QkFB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QVE0QixXQUFSLEVBQWIsQ0FBZCxFQUFtREMsRUFBRXpDLElBQXJELENBQUwsRUFEVTtBQUVkMEMsa0JBRmMsQ0FFVCxNQUZTLENBQWpCOztBQUlBOUIsc0JBQVErQixNQUFSLENBQWVyQixHQUFHUCxHQUFsQixTQUEwQk8sR0FBR1AsR0FBSCxDQUFPa0IsSUFBakMsK0JBQXVERSxRQUF2RDtBQUNELGFBTkQsTUFNTztBQUNMdkIsc0JBQVErQixNQUFSLENBQWVyQixHQUFHUCxHQUFsQixFQUF1Qk8sR0FBR1AsR0FBSCxDQUFPa0IsSUFBUCxHQUFjLGtCQUFkLEdBQW1DaEIsT0FBT1MsS0FBMUMsR0FBa0QsSUFBekU7QUFDRDtBQUNGO0FBQ0YsU0FsQkQ7QUFtQkQ7O0FBRUQsYUFBTztBQUNMMEIsMkJBQW1CdEMsZ0JBQWdCdUMsSUFBaEIsQ0FBcUIsSUFBckIsRUFBMkIsVUFBM0IsRUFBdUMsaUJBQXZDLENBRGQ7O0FBR0xDLGdDQUF3QnhDLGdCQUFnQnVDLElBQWhCLENBQXFCLElBQXJCLEVBQTJCLE9BQTNCLEVBQW9DLGlCQUFwQyxDQUhuQjs7QUFLTEUsNEJBQW9CWCxZQUxmLEVBQVA7O0FBT0QsS0FwSWMsbUJBQWpCIiwiZmlsZSI6Im5hbWVkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBFeHBvcnRzIGZyb20gJy4uL0V4cG9ydE1hcCc7XG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICB0eXBlOiAncHJvYmxlbScsXG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduYW1lZCcpLFxuICAgIH0sXG4gICAgc2NoZW1hOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgY29tbW9uanM6IHtcbiAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG5cbiAgY3JlYXRlKGNvbnRleHQpIHtcbiAgICBjb25zdCBvcHRpb25zID0gY29udGV4dC5vcHRpb25zWzBdIHx8IHt9O1xuXG4gICAgZnVuY3Rpb24gY2hlY2tTcGVjaWZpZXJzKGtleSwgdHlwZSwgbm9kZSkge1xuICAgICAgLy8gaWdub3JlIGxvY2FsIGV4cG9ydHMgYW5kIHR5cGUgaW1wb3J0cy9leHBvcnRzXG4gICAgICBpZiAoXG4gICAgICAgIG5vZGUuc291cmNlID09IG51bGxcbiAgICAgICAgfHwgbm9kZS5pbXBvcnRLaW5kID09PSAndHlwZSdcbiAgICAgICAgfHwgbm9kZS5pbXBvcnRLaW5kID09PSAndHlwZW9mJ1xuICAgICAgICB8fCBub2RlLmV4cG9ydEtpbmQgPT09ICd0eXBlJ1xuICAgICAgKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFub2RlLnNwZWNpZmllcnMuc29tZSgoaW0pID0+IGltLnR5cGUgPT09IHR5cGUpKSB7XG4gICAgICAgIHJldHVybjsgLy8gbm8gbmFtZWQgaW1wb3J0cy9leHBvcnRzXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGltcG9ydHMgPSBFeHBvcnRzLmdldChub2RlLnNvdXJjZS52YWx1ZSwgY29udGV4dCk7XG4gICAgICBpZiAoaW1wb3J0cyA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGltcG9ydHMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBpbXBvcnRzLnJlcG9ydEVycm9ycyhjb250ZXh0LCBub2RlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBub2RlLnNwZWNpZmllcnMuZm9yRWFjaChmdW5jdGlvbiAoaW0pIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGltLnR5cGUgIT09IHR5cGVcbiAgICAgICAgICAvLyBpZ25vcmUgdHlwZSBpbXBvcnRzXG4gICAgICAgICAgfHwgaW0uaW1wb3J0S2luZCA9PT0gJ3R5cGUnIHx8IGltLmltcG9ydEtpbmQgPT09ICd0eXBlb2YnXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlZXBMb29rdXAgPSBpbXBvcnRzLmhhc0RlZXAoaW1ba2V5XS5uYW1lKTtcblxuICAgICAgICBpZiAoIWRlZXBMb29rdXAuZm91bmQpIHtcbiAgICAgICAgICBpZiAoZGVlcExvb2t1cC5wYXRoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGNvbnN0IGRlZXBQYXRoID0gZGVlcExvb2t1cC5wYXRoXG4gICAgICAgICAgICAgIC5tYXAoaSA9PiBwYXRoLnJlbGF0aXZlKHBhdGguZGlybmFtZShjb250ZXh0LmdldFBoeXNpY2FsRmlsZW5hbWUgPyBjb250ZXh0LmdldFBoeXNpY2FsRmlsZW5hbWUoKSA6IGNvbnRleHQuZ2V0RmlsZW5hbWUoKSksIGkucGF0aCkpXG4gICAgICAgICAgICAgIC5qb2luKCcgLT4gJyk7XG5cbiAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KGltW2tleV0sIGAke2ltW2tleV0ubmFtZX0gbm90IGZvdW5kIHZpYSAke2RlZXBQYXRofWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZXh0LnJlcG9ydChpbVtrZXldLCBpbVtrZXldLm5hbWUgKyAnIG5vdCBmb3VuZCBpbiBcXCcnICsgbm9kZS5zb3VyY2UudmFsdWUgKyAnXFwnJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja1JlcXVpcmUobm9kZSkge1xuICAgICAgaWYgKFxuICAgICAgICAhb3B0aW9ucy5jb21tb25qc1xuICAgICAgICB8fCBub2RlLnR5cGUgIT09ICdWYXJpYWJsZURlY2xhcmF0b3InXG4gICAgICAgIC8vIHJldHVybiBpZiBpdCdzIG5vdCBhbiBvYmplY3QgZGVzdHJ1Y3R1cmUgb3IgaXQncyBhbiBlbXB0eSBvYmplY3QgZGVzdHJ1Y3R1cmVcbiAgICAgICAgfHwgIW5vZGUuaWQgfHwgbm9kZS5pZC50eXBlICE9PSAnT2JqZWN0UGF0dGVybicgfHwgbm9kZS5pZC5wcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMFxuICAgICAgICAvLyByZXR1cm4gaWYgdGhlcmUgaXMgbm8gY2FsbCBleHByZXNzaW9uIG9uIHRoZSByaWdodCBzaWRlXG4gICAgICAgIHx8ICFub2RlLmluaXQgfHwgbm9kZS5pbml0LnR5cGUgIT09ICdDYWxsRXhwcmVzc2lvbidcbiAgICAgICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNhbGwgPSBub2RlLmluaXQ7XG4gICAgICBjb25zdCBbc291cmNlXSA9IGNhbGwuYXJndW1lbnRzO1xuICAgICAgY29uc3QgdmFyaWFibGVJbXBvcnRzID0gbm9kZS5pZC5wcm9wZXJ0aWVzO1xuICAgICAgY29uc3QgdmFyaWFibGVFeHBvcnRzID0gRXhwb3J0cy5nZXQoc291cmNlLnZhbHVlLCBjb250ZXh0KTtcblxuICAgICAgaWYgKFxuICAgICAgICAvLyByZXR1cm4gaWYgaXQncyBub3QgYSBjb21tb25qcyByZXF1aXJlIHN0YXRlbWVudFxuICAgICAgICBjYWxsLmNhbGxlZS50eXBlICE9PSAnSWRlbnRpZmllcicgfHwgY2FsbC5jYWxsZWUubmFtZSAhPT0gJ3JlcXVpcmUnIHx8IGNhbGwuYXJndW1lbnRzLmxlbmd0aCAhPT0gMVxuICAgICAgICAvLyByZXR1cm4gaWYgaXQncyBub3QgYSBzdHJpbmcgc291cmNlXG4gICAgICAgIHx8IHNvdXJjZS50eXBlICE9PSAnTGl0ZXJhbCdcbiAgICAgICAgfHwgdmFyaWFibGVFeHBvcnRzID09IG51bGxcbiAgICAgICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh2YXJpYWJsZUV4cG9ydHMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICB2YXJpYWJsZUV4cG9ydHMucmVwb3J0RXJyb3JzKGNvbnRleHQsIG5vZGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhcmlhYmxlSW1wb3J0cy5mb3JFYWNoKGZ1bmN0aW9uIChpbSkge1xuICAgICAgICBpZiAoaW0udHlwZSAhPT0gJ1Byb3BlcnR5JyB8fCAhaW0ua2V5IHx8IGltLmtleS50eXBlICE9PSAnSWRlbnRpZmllcicpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWVwTG9va3VwID0gdmFyaWFibGVFeHBvcnRzLmhhc0RlZXAoaW0ua2V5Lm5hbWUpO1xuXG4gICAgICAgIGlmICghZGVlcExvb2t1cC5mb3VuZCkge1xuICAgICAgICAgIGlmIChkZWVwTG9va3VwLnBhdGgubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY29uc3QgZGVlcFBhdGggPSBkZWVwTG9va3VwLnBhdGhcbiAgICAgICAgICAgICAgLm1hcChpID0+IHBhdGgucmVsYXRpdmUocGF0aC5kaXJuYW1lKGNvbnRleHQuZ2V0RmlsZW5hbWUoKSksIGkucGF0aCkpXG4gICAgICAgICAgICAgIC5qb2luKCcgLT4gJyk7XG5cbiAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KGltLmtleSwgYCR7aW0ua2V5Lm5hbWV9IG5vdCBmb3VuZCB2aWEgJHtkZWVwUGF0aH1gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoaW0ua2V5LCBpbS5rZXkubmFtZSArICcgbm90IGZvdW5kIGluIFxcJycgKyBzb3VyY2UudmFsdWUgKyAnXFwnJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgSW1wb3J0RGVjbGFyYXRpb246IGNoZWNrU3BlY2lmaWVycy5iaW5kKG51bGwsICdpbXBvcnRlZCcsICdJbXBvcnRTcGVjaWZpZXInKSxcblxuICAgICAgRXhwb3J0TmFtZWREZWNsYXJhdGlvbjogY2hlY2tTcGVjaWZpZXJzLmJpbmQobnVsbCwgJ2xvY2FsJywgJ0V4cG9ydFNwZWNpZmllcicpLFxuXG4gICAgICBWYXJpYWJsZURlY2xhcmF0b3I6IGNoZWNrUmVxdWlyZSxcbiAgICB9O1xuICB9LFxufTtcbiJdfQ==