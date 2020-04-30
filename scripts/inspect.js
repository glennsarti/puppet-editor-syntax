if (process.argv.length != 4) {
  console.log('usage: node index.js <mainGrammarPath> <filePath>');
  process.exit(0);
}

var GRAMMAR_PATH = process.argv[process.argv.length - 2];
var FILE_PATH = process.argv[process.argv.length - 1];

const fs = require('fs');
const vsctm = require('vscode-textmate');
const oniguruma = require('oniguruma');

/**
 * Utility to read a file as a promise
 */
function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (error, data) => error ? reject(error) : resolve(data));
  })
}

// Create a registry that can create a grammar from a scope name.
const registry = new vsctm.Registry({
  onigLib: Promise.resolve({
      createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
      createOnigString: (str) => new oniguruma.OnigString(str)
  }),
  loadGrammar: (scopeName) => {
    if (scopeName === 'source.puppet') {
      // https://github.com/textmate/javascript.tmbundle/blob/master/Syntaxes/JavaScript.plist
      return readFile(GRAMMAR_PATH).then(data => vsctm.parseRawGrammar(data.toString()))
    }
    console.log(`Unknown scope name: ${scopeName}`);
    return null;
  }
});

// Load the JavaScript grammar and any other grammars included by it async.
registry.loadGrammar('source.puppet').then(grammar => {
  const fileContents = fs.readFileSync(FILE_PATH).toString();
  const text = fileContents.split(/\r\n|\r|\n/);

  let ruleStack = vsctm.INITIAL;
  for (let i = 0; i < text.length; i++) {
    const line = text[i];
    console.log(`\nTokenizing line: ${line}`);
    const lineTokens = grammar.tokenizeLine(line, ruleStack);
    for (let j = 0; j < lineTokens.tokens.length; j++) {
      const token = lineTokens.tokens[j];
      console.log(` - token from ${token.startIndex} to ${token.endIndex} ` +
        `(${line.substring(token.startIndex, token.endIndex)}) ` +
        `with scopes ${token.scopes.join(', ')}`
      );
    }
    ruleStack = lineTokens.ruleStack;
  }
});
