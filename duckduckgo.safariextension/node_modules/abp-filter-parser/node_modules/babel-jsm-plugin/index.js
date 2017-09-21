module.exports = function (babel) {
  var exportIds = [];
  var t = babel.types;
  return new babel.Transformer("babel-jsm-plugin", {
    ExportNamedDeclaration: {
      enter: function(node, parent) {
        // For variable declarations since exports will have multiple id names in one
        if (node.declaration.declarations) {
          node.declaration.declarations.forEach(function(declaration) {
            exportIds.push(declaration.id.name);
          }.bind(this));
          return node.declaration;
        }
        exportIds.push(node.declaration.id.name);
        // Replace with declarations, which removes the export
        return node.declaration;
      },
    },
    Program: {
      exit: function(node, parent) {
        var arrayOfSymbols = t.arrayExpression([]);
        exportIds.forEach(function(exportedId) {
          // Create an array of strings with the export identifier names
          arrayOfSymbols.elements.push(t.literal(exportedId));

          // Add in this.identifier = identifier for each export and add it to the end
          var assignmentStatement = t.expressionStatement(
            t.assignmentExpression('=', t.identifier('this.' + exportedId), t.identifier(exportedId)));
          this.pushContainer('body', assignmentStatement);
        }.bind(this));

        // Create an assignment for this.EXPORTED_SYMBOLS = ['export1', 'export2', ...]
        var exportsVar = t.expressionStatement(
          t.assignmentExpression('=', t.identifier('this.EXPORTED_SYMBOLS'), arrayOfSymbols));
        this.unshiftContainer('body', exportsVar);
      },
    },
  });
};
