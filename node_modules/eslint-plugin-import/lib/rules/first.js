'use strict';var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}

function getImportValue(node) {
  return node.type === 'ImportDeclaration' ?
  node.source.value :
  node.moduleReference.expression.value;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      url: (0, _docsUrl2['default'])('first') },

    fixable: 'code',
    schema: [
    {
      type: 'string',
      'enum': ['absolute-first', 'disable-absolute-first'] }] },




  create: function () {function create(context) {
      function isPossibleDirective(node) {
        return node.type === 'ExpressionStatement' &&
        node.expression.type === 'Literal' &&
        typeof node.expression.value === 'string';
      }

      return {
        'Program': function () {function Program(n) {
            var body = n.body;
            var absoluteFirst = context.options[0] === 'absolute-first';
            var message = 'Import in body of module; reorder to top.';
            var sourceCode = context.getSourceCode();
            var originSourceCode = sourceCode.getText();
            var nonImportCount = 0;
            var anyExpressions = false;
            var anyRelative = false;
            var lastLegalImp = null;
            var errorInfos = [];
            var shouldSort = true;
            var lastSortNodesIndex = 0;
            body.forEach(function (node, index) {
              if (!anyExpressions && isPossibleDirective(node)) {
                return;
              }

              anyExpressions = true;

              if (node.type === 'ImportDeclaration' || node.type === 'TSImportEqualsDeclaration') {
                if (absoluteFirst) {
                  if (/^\./.test(getImportValue(node))) {
                    anyRelative = true;
                  } else if (anyRelative) {
                    context.report({
                      node: node.type === 'ImportDeclaration' ? node.source : node.moduleReference,
                      message: 'Absolute imports should come before relative imports.' });

                  }
                }
                if (nonImportCount > 0) {var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
                    for (var _iterator = context.getDeclaredVariables(node)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var variable = _step.value;
                      if (!shouldSort) break;
                      var references = variable.references;
                      if (references.length) {var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
                          for (var _iterator2 = references[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var reference = _step2.value;
                            if (reference.identifier.range[0] < node.range[1]) {
                              shouldSort = false;
                              break;
                            }
                          }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2['return']) {_iterator2['return']();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
                      }
                    }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator['return']) {_iterator['return']();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
                  shouldSort && (lastSortNodesIndex = errorInfos.length);
                  errorInfos.push({
                    node: node,
                    range: [body[index - 1].range[1], node.range[1]] });

                } else {
                  lastLegalImp = node;
                }
              } else {
                nonImportCount++;
              }
            });
            if (!errorInfos.length) return;
            errorInfos.forEach(function (errorInfo, index) {
              var node = errorInfo.node;
              var infos = {
                node: node,
                message: message };

              if (index < lastSortNodesIndex) {
                infos.fix = function (fixer) {
                  return fixer.insertTextAfter(node, '');
                };
              } else if (index === lastSortNodesIndex) {
                var sortNodes = errorInfos.slice(0, lastSortNodesIndex + 1);
                infos.fix = function (fixer) {
                  var removeFixers = sortNodes.map(function (_errorInfo) {
                    return fixer.removeRange(_errorInfo.range);
                  });
                  var range = [0, removeFixers[removeFixers.length - 1].range[1]];
                  var insertSourceCode = sortNodes.map(function (_errorInfo) {
                    var nodeSourceCode = String.prototype.slice.apply(
                    originSourceCode, _errorInfo.range);

                    if (/\S/.test(nodeSourceCode[0])) {
                      return '\n' + nodeSourceCode;
                    }
                    return nodeSourceCode;
                  }).join('');
                  var insertFixer = null;
                  var replaceSourceCode = '';
                  if (!lastLegalImp) {
                    insertSourceCode =
                    insertSourceCode.trim() + insertSourceCode.match(/^(\s+)/)[0];
                  }
                  insertFixer = lastLegalImp ?
                  fixer.insertTextAfter(lastLegalImp, insertSourceCode) :
                  fixer.insertTextBefore(body[0], insertSourceCode);
                  var fixers = [insertFixer].concat(removeFixers);
                  fixers.forEach(function (computedFixer, i) {
                    replaceSourceCode += originSourceCode.slice(
                    fixers[i - 1] ? fixers[i - 1].range[1] : 0, computedFixer.range[0]) +
                    computedFixer.text;
                  });
                  return fixer.replaceTextRange(range, replaceSourceCode);
                };
              }
              context.report(infos);
            });
          }return Program;}() };

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9maXJzdC5qcyJdLCJuYW1lcyI6WyJnZXRJbXBvcnRWYWx1ZSIsIm5vZGUiLCJ0eXBlIiwic291cmNlIiwidmFsdWUiLCJtb2R1bGVSZWZlcmVuY2UiLCJleHByZXNzaW9uIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwiZml4YWJsZSIsInNjaGVtYSIsImNyZWF0ZSIsImNvbnRleHQiLCJpc1Bvc3NpYmxlRGlyZWN0aXZlIiwibiIsImJvZHkiLCJhYnNvbHV0ZUZpcnN0Iiwib3B0aW9ucyIsIm1lc3NhZ2UiLCJzb3VyY2VDb2RlIiwiZ2V0U291cmNlQ29kZSIsIm9yaWdpblNvdXJjZUNvZGUiLCJnZXRUZXh0Iiwibm9uSW1wb3J0Q291bnQiLCJhbnlFeHByZXNzaW9ucyIsImFueVJlbGF0aXZlIiwibGFzdExlZ2FsSW1wIiwiZXJyb3JJbmZvcyIsInNob3VsZFNvcnQiLCJsYXN0U29ydE5vZGVzSW5kZXgiLCJmb3JFYWNoIiwiaW5kZXgiLCJ0ZXN0IiwicmVwb3J0IiwiZ2V0RGVjbGFyZWRWYXJpYWJsZXMiLCJ2YXJpYWJsZSIsInJlZmVyZW5jZXMiLCJsZW5ndGgiLCJyZWZlcmVuY2UiLCJpZGVudGlmaWVyIiwicmFuZ2UiLCJwdXNoIiwiZXJyb3JJbmZvIiwiaW5mb3MiLCJmaXgiLCJmaXhlciIsImluc2VydFRleHRBZnRlciIsInNvcnROb2RlcyIsInNsaWNlIiwicmVtb3ZlRml4ZXJzIiwibWFwIiwiX2Vycm9ySW5mbyIsInJlbW92ZVJhbmdlIiwiaW5zZXJ0U291cmNlQ29kZSIsIm5vZGVTb3VyY2VDb2RlIiwiU3RyaW5nIiwicHJvdG90eXBlIiwiYXBwbHkiLCJqb2luIiwiaW5zZXJ0Rml4ZXIiLCJyZXBsYWNlU291cmNlQ29kZSIsInRyaW0iLCJtYXRjaCIsImluc2VydFRleHRCZWZvcmUiLCJmaXhlcnMiLCJjb25jYXQiLCJjb21wdXRlZEZpeGVyIiwiaSIsInRleHQiLCJyZXBsYWNlVGV4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ZCxDQUFvQixDQUFwQixDQUR4QjtBQUVsQjBCLGtDQUFjRSxJQUZsQjtBQUdELG1CQUpEO0FBS0EseUJBQU92QixNQUFNd0IsZ0JBQU4sQ0FBdUI3QixLQUF2QixFQUE4Qm9CLGlCQUE5QixDQUFQO0FBQ0QsaUJBOUJEO0FBK0JEO0FBQ0RoRCxzQkFBUXFCLE1BQVIsQ0FBZVUsS0FBZjtBQUNELGFBN0NEO0FBOENELFdBdkdELGtCQURLLEVBQVA7O0FBMEdELEtBaEljLG1CQUFqQiIsImZpbGUiOiJmaXJzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnO1xuXG5mdW5jdGlvbiBnZXRJbXBvcnRWYWx1ZShub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdJbXBvcnREZWNsYXJhdGlvbidcbiAgICA/IG5vZGUuc291cmNlLnZhbHVlXG4gICAgOiBub2RlLm1vZHVsZVJlZmVyZW5jZS5leHByZXNzaW9uLnZhbHVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIHR5cGU6ICdzdWdnZXN0aW9uJyxcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ2ZpcnN0JyksXG4gICAgfSxcbiAgICBmaXhhYmxlOiAnY29kZScsXG4gICAgc2NoZW1hOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICBlbnVtOiBbJ2Fic29sdXRlLWZpcnN0JywgJ2Rpc2FibGUtYWJzb2x1dGUtZmlyc3QnXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcblxuICBjcmVhdGUoY29udGV4dCkge1xuICAgIGZ1bmN0aW9uIGlzUG9zc2libGVEaXJlY3RpdmUobm9kZSkge1xuICAgICAgcmV0dXJuIG5vZGUudHlwZSA9PT0gJ0V4cHJlc3Npb25TdGF0ZW1lbnQnICYmXG4gICAgICAgIG5vZGUuZXhwcmVzc2lvbi50eXBlID09PSAnTGl0ZXJhbCcgJiZcbiAgICAgICAgdHlwZW9mIG5vZGUuZXhwcmVzc2lvbi52YWx1ZSA9PT0gJ3N0cmluZyc7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICdQcm9ncmFtJzogZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgY29uc3QgYm9keSA9IG4uYm9keTtcbiAgICAgICAgY29uc3QgYWJzb2x1dGVGaXJzdCA9IGNvbnRleHQub3B0aW9uc1swXSA9PT0gJ2Fic29sdXRlLWZpcnN0JztcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9ICdJbXBvcnQgaW4gYm9keSBvZiBtb2R1bGU7IHJlb3JkZXIgdG8gdG9wLic7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNvZGUgPSBjb250ZXh0LmdldFNvdXJjZUNvZGUoKTtcbiAgICAgICAgY29uc3Qgb3JpZ2luU291cmNlQ29kZSA9IHNvdXJjZUNvZGUuZ2V0VGV4dCgpO1xuICAgICAgICBsZXQgbm9uSW1wb3J0Q291bnQgPSAwO1xuICAgICAgICBsZXQgYW55RXhwcmVzc2lvbnMgPSBmYWxzZTtcbiAgICAgICAgbGV0IGFueVJlbGF0aXZlID0gZmFsc2U7XG4gICAgICAgIGxldCBsYXN0TGVnYWxJbXAgPSBudWxsO1xuICAgICAgICBjb25zdCBlcnJvckluZm9zID0gW107XG4gICAgICAgIGxldCBzaG91bGRTb3J0ID0gdHJ1ZTtcbiAgICAgICAgbGV0IGxhc3RTb3J0Tm9kZXNJbmRleCA9IDA7XG4gICAgICAgIGJvZHkuZm9yRWFjaChmdW5jdGlvbiAobm9kZSwgaW5kZXgpIHtcbiAgICAgICAgICBpZiAoIWFueUV4cHJlc3Npb25zICYmIGlzUG9zc2libGVEaXJlY3RpdmUobm9kZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhbnlFeHByZXNzaW9ucyA9IHRydWU7XG5cbiAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAnSW1wb3J0RGVjbGFyYXRpb24nIHx8IG5vZGUudHlwZSA9PT0gJ1RTSW1wb3J0RXF1YWxzRGVjbGFyYXRpb24nKSB7XG4gICAgICAgICAgICBpZiAoYWJzb2x1dGVGaXJzdCkge1xuICAgICAgICAgICAgICBpZiAoL15cXC4vLnRlc3QoZ2V0SW1wb3J0VmFsdWUobm9kZSkpKSB7XG4gICAgICAgICAgICAgICAgYW55UmVsYXRpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFueVJlbGF0aXZlKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgICAgICAgbm9kZTogbm9kZS50eXBlID09PSAnSW1wb3J0RGVjbGFyYXRpb24nID8gbm9kZS5zb3VyY2UgOiBub2RlLm1vZHVsZVJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdBYnNvbHV0ZSBpbXBvcnRzIHNob3VsZCBjb21lIGJlZm9yZSByZWxhdGl2ZSBpbXBvcnRzLicsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub25JbXBvcnRDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB2YXJpYWJsZSBvZiBjb250ZXh0LmdldERlY2xhcmVkVmFyaWFibGVzKG5vZGUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzaG91bGRTb3J0KSBicmVhaztcbiAgICAgICAgICAgICAgICBjb25zdCByZWZlcmVuY2VzID0gdmFyaWFibGUucmVmZXJlbmNlcztcbiAgICAgICAgICAgICAgICBpZiAocmVmZXJlbmNlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcmVmZXJlbmNlIG9mIHJlZmVyZW5jZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZmVyZW5jZS5pZGVudGlmaWVyLnJhbmdlWzBdIDwgbm9kZS5yYW5nZVsxXSkge1xuICAgICAgICAgICAgICAgICAgICAgIHNob3VsZFNvcnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzaG91bGRTb3J0ICYmIChsYXN0U29ydE5vZGVzSW5kZXggPSBlcnJvckluZm9zLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGVycm9ySW5mb3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgICByYW5nZTogW2JvZHlbaW5kZXggLSAxXS5yYW5nZVsxXSwgbm9kZS5yYW5nZVsxXV0sXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbGFzdExlZ2FsSW1wID0gbm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9uSW1wb3J0Q291bnQrKztcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWVycm9ySW5mb3MubGVuZ3RoKSByZXR1cm47XG4gICAgICAgIGVycm9ySW5mb3MuZm9yRWFjaChmdW5jdGlvbiAoZXJyb3JJbmZvLCBpbmRleCkge1xuICAgICAgICAgIGNvbnN0IG5vZGUgPSBlcnJvckluZm8ubm9kZTtcbiAgICAgICAgICBjb25zdCBpbmZvcyA9IHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKGluZGV4IDwgbGFzdFNvcnROb2Rlc0luZGV4KSB7XG4gICAgICAgICAgICBpbmZvcy5maXggPSBmdW5jdGlvbiAoZml4ZXIpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZpeGVyLmluc2VydFRleHRBZnRlcihub2RlLCAnJyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IGxhc3RTb3J0Tm9kZXNJbmRleCkge1xuICAgICAgICAgICAgY29uc3Qgc29ydE5vZGVzID0gZXJyb3JJbmZvcy5zbGljZSgwLCBsYXN0U29ydE5vZGVzSW5kZXggKyAxKTtcbiAgICAgICAgICAgIGluZm9zLmZpeCA9IGZ1bmN0aW9uIChmaXhlcikge1xuICAgICAgICAgICAgICBjb25zdCByZW1vdmVGaXhlcnMgPSBzb3J0Tm9kZXMubWFwKGZ1bmN0aW9uIChfZXJyb3JJbmZvKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpeGVyLnJlbW92ZVJhbmdlKF9lcnJvckluZm8ucmFuZ2UpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgY29uc3QgcmFuZ2UgPSBbMCwgcmVtb3ZlRml4ZXJzW3JlbW92ZUZpeGVycy5sZW5ndGggLSAxXS5yYW5nZVsxXV07XG4gICAgICAgICAgICAgIGxldCBpbnNlcnRTb3VyY2VDb2RlID0gc29ydE5vZGVzLm1hcChmdW5jdGlvbiAoX2Vycm9ySW5mbykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVTb3VyY2VDb2RlID0gU3RyaW5nLnByb3RvdHlwZS5zbGljZS5hcHBseShcbiAgICAgICAgICAgICAgICAgIG9yaWdpblNvdXJjZUNvZGUsIF9lcnJvckluZm8ucmFuZ2UsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAoL1xcUy8udGVzdChub2RlU291cmNlQ29kZVswXSkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAnXFxuJyArIG5vZGVTb3VyY2VDb2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbm9kZVNvdXJjZUNvZGU7XG4gICAgICAgICAgICAgIH0pLmpvaW4oJycpO1xuICAgICAgICAgICAgICBsZXQgaW5zZXJ0Rml4ZXIgPSBudWxsO1xuICAgICAgICAgICAgICBsZXQgcmVwbGFjZVNvdXJjZUNvZGUgPSAnJztcbiAgICAgICAgICAgICAgaWYgKCFsYXN0TGVnYWxJbXApIHtcbiAgICAgICAgICAgICAgICBpbnNlcnRTb3VyY2VDb2RlID1cbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0U291cmNlQ29kZS50cmltKCkgKyBpbnNlcnRTb3VyY2VDb2RlLm1hdGNoKC9eKFxccyspLylbMF07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW5zZXJ0Rml4ZXIgPSBsYXN0TGVnYWxJbXAgP1xuICAgICAgICAgICAgICAgIGZpeGVyLmluc2VydFRleHRBZnRlcihsYXN0TGVnYWxJbXAsIGluc2VydFNvdXJjZUNvZGUpIDpcbiAgICAgICAgICAgICAgICBmaXhlci5pbnNlcnRUZXh0QmVmb3JlKGJvZHlbMF0sIGluc2VydFNvdXJjZUNvZGUpO1xuICAgICAgICAgICAgICBjb25zdCBmaXhlcnMgPSBbaW5zZXJ0Rml4ZXJdLmNvbmNhdChyZW1vdmVGaXhlcnMpO1xuICAgICAgICAgICAgICBmaXhlcnMuZm9yRWFjaChmdW5jdGlvbiAoY29tcHV0ZWRGaXhlciwgaSkge1xuICAgICAgICAgICAgICAgIHJlcGxhY2VTb3VyY2VDb2RlICs9IChvcmlnaW5Tb3VyY2VDb2RlLnNsaWNlKFxuICAgICAgICAgICAgICAgICAgZml4ZXJzW2kgLSAxXSA/IGZpeGVyc1tpIC0gMV0ucmFuZ2VbMV0gOiAwLCBjb21wdXRlZEZpeGVyLnJhbmdlWzBdLFxuICAgICAgICAgICAgICAgICkgKyBjb21wdXRlZEZpeGVyLnRleHQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZpeGVyLnJlcGxhY2VUZXh0UmFuZ2UocmFuZ2UsIHJlcGxhY2VTb3VyY2VDb2RlKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRleHQucmVwb3J0KGluZm9zKTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH07XG4gIH0sXG59O1xuIl19