var expect = require('expect.js');
var fs = require('fs');

function getLineTokens(grammar, content, debug = false) {
  var tokens = grammar.tokenizeLine(content).tokens;

  for (var i = 0; i < tokens.length; i++) {
    tokens[i]['value'] = content.substring(tokens[i]['startIndex'], tokens[i]['endIndex']);
    // We only care about value and scopes. Delete the other keys.
    delete tokens[i]['startIndex'];
    delete tokens[i]['endIndex'];
  }

  if (debug) {
    console.log("------------------");
    console.log(content);
    console.log("------------------");
    console.log(tokens);
    console.log("------------------");
  };

  return tokens;
}

describe('puppet.tmLanguage', function() {
  var grammar;

  this.timeout(20000);

  before('Load Grammar', function(done) {
    var tm = require('vscode-textmate');
    var registry = new tm.Registry();
    // Load the Textmate Grammar
    const grammarPath = './syntaxes/puppet.tmLanguage';
    const content = fs.readFileSync(grammarPath);
    const rawGrammar = tm.parseRawGrammar(content.toString(), grammarPath);
    registry.addGrammar(rawGrammar).then( (newGrammar) => {
      grammar = newGrammar;
      return done();
    });
  });

  it("default scope is source.puppet", function() {
    var tokens = getLineTokens(grammar, '');

    expect(tokens[0]).to.eql({value: '', scopes: ['source.puppet']});
  });


  describe('separators', function() {
    it("tokenizes attribute separator", function() {
      var tokens = getLineTokens(grammar, 'ensure => present');
      expect(tokens[1]).to.eql({value: '=>', scopes: ['source.puppet', 'punctuation.separator.key-value.puppet']});
    });

    it("tokenizes attribute separator with string values", function() {
      var tokens = getLineTokens(grammar, 'ensure => "present"');
      expect(tokens[1]).to.eql({value: '=>', scopes: ['source.puppet', 'punctuation.separator.key-value.puppet']});
    });
  });


  describe('numbers', function() {
    var hexTestCases = ['0xff', '0xabcdef0123456789', '0x0']
    var integerTestCases = ['10', '0', '-9', '10000']
    var octalTestCases = ['077', '01234567', '00']
    var floatingPointTestCases = ['+1.0e2', '-1.0e-2', '1.0', '1.0e0']
    var notANumberTestCases = ['abc', '0xg123', '.1', '+1.0eas']

    var contexts = {
      'variable assignment': { 'manifest': "$var = ##TESTCASE##", 'expectedTokenIndex': 3 },
      'beginning of array': { 'manifest': "$var = [##TESTCASE##, 'abc']", 'expectedTokenIndex': 3 },
      'end of array': { 'manifest': "$var = ['abc', ##TESTCASE##]", 'expectedTokenIndex': 7 },
      'middle of array': { 'manifest': "$var = ['abc', ##TESTCASE##, 1.0]", 'expectedTokenIndex': 7 },
      'hash value': { 'manifest': "$var = { 'abc' => ##TESTCASE##}", 'expectedTokenIndex': 9 }
    }
    for(var contextName in contexts) {
      context(contextName, function() {
        describe('hex', function() {
          hexTestCases.forEach(function(testCase){
            it(testCase, function() {
              var manifest = contexts[contextName]['manifest'].replace('##TESTCASE##', testCase)
              var tokenIndex = contexts[contextName]['expectedTokenIndex']
              var tokens = getLineTokens(grammar, manifest);
              expect(tokens[tokenIndex]).to.eql({value: testCase, scopes: ['source.puppet', 'constant.numeric.hexadecimal.puppet']});
            });
          });
        });

        describe('integer', function() {
          integerTestCases.forEach(function(testCase){
            it(testCase, function() {
              var manifest = contexts[contextName]['manifest'].replace('##TESTCASE##', testCase)
              var tokenIndex = contexts[contextName]['expectedTokenIndex']
              var tokens = getLineTokens(grammar, manifest);
              expect(tokens[tokenIndex]).to.eql({value: testCase, scopes: ['source.puppet', 'constant.numeric.integer.puppet']});
            });
          });
        });

        describe('octal', function() {
          octalTestCases.forEach(function(testCase){
            it(testCase, function() {
              var manifest = contexts[contextName]['manifest'].replace('##TESTCASE##', testCase)
              var tokenIndex = contexts[contextName]['expectedTokenIndex']
              var tokens = getLineTokens(grammar, manifest);
              expect(tokens[tokenIndex]).to.eql({value: testCase, scopes: ['source.puppet', 'constant.numeric.integer.puppet']});
            });
          });
        });

        describe('floating point', function() {
          floatingPointTestCases.forEach(function(testCase){
            it(testCase, function() {
              var manifest = contexts[contextName]['manifest'].replace('##TESTCASE##', testCase)
              var tokenIndex = contexts[contextName]['expectedTokenIndex']
              var tokens = getLineTokens(grammar, manifest);
              expect(tokens[tokenIndex]).to.eql({value: testCase, scopes: ['source.puppet', 'constant.numeric.integer.puppet']});
            });
          });
        });

        describe('not a number', function() {
          notANumberTestCases.forEach(function(testCase){
            it(testCase, function() {
              var manifest = contexts[contextName]['manifest'].replace('##TESTCASE##', testCase)
              var tokenIndex = contexts[contextName]['expectedTokenIndex']
              var tokens = getLineTokens(grammar, manifest);
              // Not a big fan of this, but don't know how to express "undefined OR not equal to..."
              if (tokens[tokenIndex] == undefined) {
                expect(tokens[tokenIndex]).to.be(undefined)
              } else {
                expect(tokens[tokenIndex]).to.not.be({value: testCase, scopes: ['source.puppet', 'constant.numeric.hexadecimal.puppet']});
                expect(tokens[tokenIndex]).to.not.be({value: testCase, scopes: ['source.puppet', 'constant.numeric.integer.puppet']});
              }
            });
          });
        });
      });
    };
  });

  describe('arrays', function() {
    it("tokenizes line comments", function() {
      var tokens = getLineTokens(grammar, "package{ [\n'element1', # This is a comment\n'element2']:\nensure => present\n}")

      expect(tokens[7]).to.eql({value: '#', scopes: ['source.puppet', 'meta.array.puppet', 'comment.line.number-sign.puppet', 'punctuation.definition.comment.puppet']});
      expect(tokens[8]).to.eql({value: ' This is a comment\n', scopes: ['source.puppet', 'meta.array.puppet', 'comment.line.number-sign.puppet']});
    });
  });

  describe('puppet tasks and plans', function() {
    it("tokenizes plan keyword", function() {
      var tokens = getLineTokens(grammar, "plan mymodule::my_plan() {}")
      expect(tokens[0]).to.eql({value: 'plan', scopes: ['source.puppet', 'meta.definition.plan.puppet', 'storage.type.puppet']});
    });
  });

  describe('data types', function() {
    var contexts = {
      'in class parameters': { 'manifest': "class class_name(\n  ##TESTCASE##) {}", 'expectedTokenIndex': 4, 'scopesPrefix': ['source.puppet', 'meta.definition.class.puppet'] },
      'in class body':       { 'manifest': "class class_name() {\n  ##TESTCASE##\n}", 'expectedTokenIndex': 5, 'scopesPrefix': ['source.puppet'] },
      'in manifest root':    { 'manifest': "##TESTCASE##}", 'expectedTokenIndex': 0, 'scopesPrefix': ['source.puppet'] },
      'in plan parameters':  { 'manifest': "plan plan_name(\n  ##TESTCASE##) {}", 'expectedTokenIndex': 4, 'scopesPrefix': ['source.puppet', 'meta.definition.plan.puppet'] },
    }

    for(var contextName in contexts) {
      context(contextName, function() {
        var tokenIndex = contexts[contextName]['expectedTokenIndex']
        var scopesPrefix = contexts[contextName]['scopesPrefix']
        var manifest = contexts[contextName]['manifest']

        it("tokenizes scalar parameter types", function() {
          var tokens = getLineTokens(grammar, manifest.replace('##TESTCASE##', 'String $testvar'))
          expect(tokens[tokenIndex]).to.eql({value: 'String', scopes: scopesPrefix.concat(['storage.type.puppet'])});
        });

        it("tokenizes scalar parameter variable assignment", function() {
          var tokens = getLineTokens(grammar, manifest.replace('##TESTCASE##', 'String $testvar = "abc123"'))
          expect(tokens[tokenIndex]).to.eql({value: 'String', scopes: scopesPrefix.concat(['storage.type.puppet'])});
        });

        it("tokenizes qualified scalar parameter types", function() {
          var tokens = getLineTokens(grammar, manifest.replace('##TESTCASE##', 'MyModule12::String $testvar = "abc123"'))
          expect(tokens[tokenIndex+0]).to.eql({value: 'MyModule12', scopes: scopesPrefix.concat(['storage.type.puppet'])});
          expect(tokens[tokenIndex+1]).to.eql({value: '::', scopes: scopesPrefix.concat([])});
          expect(tokens[tokenIndex+2]).to.eql({value: 'String', scopes: scopesPrefix.concat(['storage.type.puppet'])});
        });

        it("tokenizes array parameter types", function() {
          var tokens = getLineTokens(grammar, manifest.replace('##TESTCASE##', 'Array[String] $testvar'))
          expect(tokens[tokenIndex+0]).to.eql({value: 'Array', scopes: scopesPrefix.concat(['storage.type.puppet'])});
          expect(tokens[tokenIndex+1]).to.eql({value: '[', scopes: scopesPrefix.concat(['meta.array.puppet', 'punctuation.definition.array.begin.puppet'])});
          expect(tokens[tokenIndex+2]).to.eql({value: 'String', scopes: scopesPrefix.concat(['meta.array.puppet', 'storage.type.puppet'])});
          expect(tokens[tokenIndex+3]).to.eql({value: ']', scopes: scopesPrefix.concat(['meta.array.puppet', 'punctuation.definition.array.end.puppet'])});
        });

        it("tokenizes nested array parameter types", function() {
          var tokens = getLineTokens(grammar, manifest.replace('##TESTCASE##', 'Array[String[1]] $testvar'))
          expect(tokens[tokenIndex+0]).to.eql({value: 'Array', scopes: scopesPrefix.concat(['storage.type.puppet'])});
          expect(tokens[tokenIndex+1]).to.eql({value: '[', scopes: scopesPrefix.concat(['meta.array.puppet', 'punctuation.definition.array.begin.puppet'])});
          expect(tokens[tokenIndex+2]).to.eql({value: 'String', scopes: scopesPrefix.concat(['meta.array.puppet', 'storage.type.puppet'])});
          expect(tokens[tokenIndex+3]).to.eql({value: '[', scopes: scopesPrefix.concat(['meta.array.puppet', 'meta.array.puppet', 'punctuation.definition.array.begin.puppet'])});
          expect(tokens[tokenIndex+4]).to.eql({value: '1', scopes: scopesPrefix.concat(['meta.array.puppet', 'meta.array.puppet', 'constant.numeric.integer.puppet'])});
          expect(tokens[tokenIndex+5]).to.eql({value: ']', scopes: scopesPrefix.concat(['meta.array.puppet', 'meta.array.puppet', 'punctuation.definition.array.end.puppet'])});
          expect(tokens[tokenIndex+6]).to.eql({value: ']', scopes: scopesPrefix.concat(['meta.array.puppet', 'punctuation.definition.array.end.puppet'])});
        });

        it("tokenizes qualified nested array parameter types", function() {
          var tokens = getLineTokens(grammar, manifest.replace('##TESTCASE##', 'Array[MyModule::String[1]] $testvar'))
          expect(tokens[tokenIndex+0]).to.eql({value: 'Array', scopes: scopesPrefix.concat(['storage.type.puppet'])});
          expect(tokens[tokenIndex+1]).to.eql({value: '[', scopes: scopesPrefix.concat(['meta.array.puppet', 'punctuation.definition.array.begin.puppet'])});
          expect(tokens[tokenIndex+2]).to.eql({value: 'MyModule', scopes: scopesPrefix.concat(['meta.array.puppet', 'storage.type.puppet'])});
          expect(tokens[tokenIndex+3]).to.eql({value: '::', scopes: scopesPrefix.concat(['meta.array.puppet'])});
          expect(tokens[tokenIndex+4]).to.eql({value: 'String', scopes: scopesPrefix.concat(['meta.array.puppet', 'storage.type.puppet'])});
          expect(tokens[tokenIndex+5]).to.eql({value: '[', scopes: scopesPrefix.concat(['meta.array.puppet', 'meta.array.puppet', 'punctuation.definition.array.begin.puppet'])});
          expect(tokens[tokenIndex+6]).to.eql({value: '1', scopes: scopesPrefix.concat(['meta.array.puppet', 'meta.array.puppet', 'constant.numeric.integer.puppet'])});
          expect(tokens[tokenIndex+7]).to.eql({value: ']', scopes: scopesPrefix.concat(['meta.array.puppet', 'meta.array.puppet', 'punctuation.definition.array.end.puppet'])});
          expect(tokens[tokenIndex+8]).to.eql({value: ']', scopes: scopesPrefix.concat(['meta.array.puppet', 'punctuation.definition.array.end.puppet'])});
        });
      });
    };

    context('in class parameters with inherits', function() {
      // Currently the inherits matcher is overzealous and this test fails.
      it("tokenizes scalar parameter types", function() {
        var tokens = getLineTokens(grammar, "class class_name inherits other_class(\n  String $testvar) {}")
        expect(tokens[6]).to.eql({value: 'other_class', scopes: ['source.puppet', 'meta.definition.class.puppet', 'meta.definition.class.inherits.puppet', 'support.type.puppet']});
        expect(tokens[8]).to.eql({value: 'String', scopes: ['source.puppet', 'meta.definition.class.puppet', 'storage.type.puppet']});
      });
    });
  });

  describe('blocks', function() {
    it("tokenizes single quoted node", function() {
      var tokens = getLineTokens(grammar, "node 'hostname' {")
      expect(tokens[0]).to.eql({value: 'node', scopes: ['source.puppet', 'meta.definition.class.puppet', 'storage.type.puppet']});
    });

    it("tokenizes double quoted node", function() {
      var tokens = getLineTokens(grammar, 'node "hostname" {')
      expect(tokens[0]).to.eql({value: 'node', scopes: ['source.puppet', 'meta.definition.class.puppet', 'storage.type.puppet']});
    });

    it("tokenizes non-default class parameters", function() {
      var tokens = getLineTokens(grammar, 'class "classname" ($myvar) {')
      expect(tokens[5]).to.eql({value: '$', scopes: ['source.puppet', 'meta.definition.class.puppet', 'meta.function.argument.puppet', 'variable.other.puppet', 'punctuation.definition.variable.puppet']});
      expect(tokens[6]).to.eql({value: 'myvar', scopes: ['source.puppet', 'meta.definition.class.puppet', 'meta.function.argument.puppet', 'variable.other.puppet']});
    });

    it("tokenizes default class parameters", function() {
      var tokens = getLineTokens(grammar, 'class "classname" ($myvar = "myval") {')
      expect(tokens[5]).to.eql({value: '$', scopes: ['source.puppet', 'meta.definition.class.puppet', 'meta.function.argument.puppet', 'variable.other.puppet', 'punctuation.definition.variable.puppet']});
      expect(tokens[6]).to.eql({value: 'myvar', scopes: ['source.puppet', 'meta.definition.class.puppet', 'meta.function.argument.puppet', 'variable.other.puppet']});
    });

    it("tokenizes non-default class parameter types", function() {
      var tokens = getLineTokens(grammar, 'class "classname" (String $myvar) {')
      expect(tokens[5]).to.eql({value: 'String', scopes: ['source.puppet', 'meta.definition.class.puppet', 'storage.type.puppet']});
      expect(tokens[8]).to.eql({value: 'myvar', scopes: ['source.puppet', 'meta.definition.class.puppet', 'meta.function.argument.puppet', 'variable.other.puppet']});
    });

    it("tokenizes default class parameter types", function() {
      var tokens = getLineTokens(grammar, 'class "classname" (String $myvar = "myval") {')
      expect(tokens[5]).to.eql({value: 'String', scopes: ['source.puppet', 'meta.definition.class.puppet', 'storage.type.puppet']});
      expect(tokens[8]).to.eql({value: 'myvar', scopes: ['source.puppet', 'meta.definition.class.puppet', 'meta.function.argument.puppet', 'variable.other.puppet']});
    });


    it("tokenizes include as an include function", function() {
      var tokens = getLineTokens(grammar, "contain foo")
      expect(tokens[0]).to.eql({value: 'contain', scopes: ['source.puppet', 'meta.include.puppet', 'keyword.control.import.include.puppet']});
    });

    it("tokenizes contain as an include function", function() {
      var tokens = getLineTokens(grammar, 'include foo')
      expect(tokens[0]).to.eql({value: 'include', scopes: ['source.puppet', 'meta.include.puppet', 'keyword.control.import.include.puppet']});
    });

    it("tokenizes resource type and string title", function() {
      var tokens = getLineTokens(grammar, "package {'foo':}")
      expect(tokens[0]).to.eql({value: 'package', scopes: ['source.puppet', 'meta.definition.resource.puppet', 'storage.type.puppet']});
      expect(tokens[2]).to.eql({value: "'foo'", scopes: ['source.puppet', 'meta.definition.resource.puppet', 'entity.name.section.puppet']});
    });

    it("tokenizes resource type and variable title", function() {
      var tokens = getLineTokens(grammar, "package {$foo:}")
      expect(tokens[0]).to.eql({value: 'package', scopes: ['source.puppet', 'meta.definition.resource.puppet', 'storage.type.puppet']});
      expect(tokens[2]).to.eql({value: '$foo', scopes: ['source.puppet', 'meta.definition.resource.puppet', 'entity.name.section.puppet']});
    });

    it("tokenizes require classname as an include", function() {
      var tokens = getLineTokens(grammar, "require ::foo")
      expect(tokens[0]).to.eql({value: 'require', scopes: ['source.puppet', 'meta.include.puppet', 'keyword.control.import.include.puppet']});
    });

    it("tokenizes require => variable as a parameter", function() {
      var tokens = getLineTokens(grammar, "require => Class['foo']")
      expect(tokens[0]).to.eql({value: 'require ', scopes: ['source.puppet', 'constant.other.key.puppet']});
    });

    it("tokenizes regular variables", function() {
      var tokens = getLineTokens(grammar, '$foo')
      expect(tokens[0]).to.eql({value: '$', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
      expect(tokens[1]).to.eql({value: 'foo', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet']});

      var tokens = getLineTokens(grammar, '$_foo')
      expect(tokens[0]).to.eql({value: '$', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
      expect(tokens[1]).to.eql({value: '_foo', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet']});

      var tokens = getLineTokens(grammar, '$_foo_')
      expect(tokens[0]).to.eql({value: '$', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
      expect(tokens[1]).to.eql({value: '_foo_', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet']});

      var tokens = getLineTokens(grammar, '$::foo')
      expect(tokens[0]).to.eql({value: '$', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
      expect(tokens[1]).to.eql({value: '::foo', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet']});
    });

    it("tokenizes resource types correctly", function() {
      var tokens = getLineTokens(grammar, "file {'/var/tmp':}")
      expect(tokens[0]).to.eql({value: 'file', scopes: ['source.puppet', 'meta.definition.resource.puppet', 'storage.type.puppet']});

      var tokens = getLineTokens(grammar, "package {'foo':}")
      expect(tokens[0]).to.eql({value: 'package', scopes: ['source.puppet', 'meta.definition.resource.puppet', 'storage.type.puppet']});
    });
  });

  describe('chaining arrows', function() {
    var contexts = {
      'ordering arrow':  { 'text': '->', 'scope': 'keyword.control.orderarrow.puppet' },
      'notifying arrow': { 'text': '~>', 'scope': 'keyword.control.notifyarrow.puppet' },
    }

    for(var contextName in contexts) {
      context(contextName, function() {
        var arrowText = contexts[contextName]['text'];
        var arrowScope = contexts[contextName]['scope'];

        it("tokenizes single line chaining", function() {
          var tokens = getLineTokens(grammar, "Package['ntp'] ##ARROW## File['/etc/ntp.conf']".replace('##ARROW##', arrowText));
          expect(tokens[7]).to.eql({value: arrowText, scopes: ['source.puppet'].concat(arrowScope)});
          // Ensure that the trailing and leading resources are still tokenized correctly
          expect(tokens[0]).to.eql({value: 'Package', scopes: ['source.puppet', 'storage.type.puppet']});
          expect(tokens[9]).to.eql({value: 'File', scopes: ['source.puppet', 'storage.type.puppet']});
        });

        it("tokenizes single line chaining without whitespace", function() {
          var tokens = getLineTokens(grammar, "Package['ntp']##ARROW##File['/etc/ntp.conf']".replace('##ARROW##', arrowText));
          expect(tokens[6]).to.eql({value: arrowText, scopes: ['source.puppet'].concat(arrowScope)});
          // Ensure that the trailing and leading resources are still tokenized correctly
          expect(tokens[0]).to.eql({value: 'Package', scopes: ['source.puppet', 'storage.type.puppet']});
          expect(tokens[7]).to.eql({value: 'File', scopes: ['source.puppet', 'storage.type.puppet']});
        });

        it("tokenizes multiline class at end chaining", function() {
          var tokens = getLineTokens(grammar, "class a {\n} ##ARROW##\nclass b { }".replace('##ARROW##', arrowText));
          expect(tokens[5]).to.eql({value: arrowText, scopes: ['source.puppet'].concat(arrowScope)});
          // Ensure that the trailing class is still tokenized correctly
          expect(tokens[7]).to.eql({value: 'class', scopes: ['source.puppet', 'meta.definition.class.puppet', 'storage.type.puppet']});
        });

        it("tokenizes multiline class at beginning chaining", function() {
          var tokens = getLineTokens(grammar, "class a {\n}\n ##ARROW## class b { }".replace('##ARROW##', arrowText));
          expect(tokens[5]).to.eql({value: arrowText, scopes: ['source.puppet'].concat(arrowScope)});
          // Ensure that the trailing class is still tokenized correctly
          expect(tokens[7]).to.eql({value: 'class', scopes: ['source.puppet', 'meta.definition.class.puppet', 'storage.type.puppet']});
        });
      });
    };
  });

  describe('regular expressions', function() {
    var contexts = {
      'in basic variable assignment': { 'manifest': "$foo = /abc123/", 'expectedTokenIndex': 3, 'expectedRegExText': 'abc123' },
      'in basic if statement': { 'manifest': "if 'foo' =~ /walrus/ {\n  $walrus = true\n}", 'expectedTokenIndex': 6, 'expectedRegExText': 'walrus' },
      'with special characters': { 'manifest': "$foo = /ab\\c#12\\/3/\n$bar = 'wee'", 'expectedTokenIndex': 3, 'expectedRegExText': 'ab\\c#12\\/3' },
      'in the same line with other slashes': { 'manifest': "/puppet-agent-5\..*/ => 'puppet5/',", 'expectedTokenIndex': 0, 'expectedRegExText': 'puppet-agent-5\..*' },
    }

    for(var contextName in contexts) {
      context(contextName, function() {
        var tokenIndex = contexts[contextName]['expectedTokenIndex']
        var expectedRegExText = contexts[contextName]['expectedRegExText']
        var manifest = contexts[contextName]['manifest']

        it("tokenizes regular expression " + contextName, function() {
          var tokens = getLineTokens(grammar, manifest);
          expect(tokens[tokenIndex]).to.eql({value: '/' + expectedRegExText + '/', scopes: ['source.puppet', 'string.regexp.literal.puppet']});
        });
      });
    };
  });

  describe('variable names', function() {
    // Straight up variable names
    var contexts = {
      'a bare variable name'               : { 'testcase': "myvar123_456" },
      'a top level variable name'          : { 'testcase': "::my23_456abc" },
      'a qualified variable name'          : { 'testcase': "myscope::myvar123_456" },
      'a top level qualified variable name': { 'testcase': "::myscope::myvar123_456" },
      'a long qualified variable name'     : { 'testcase': "ab::cd::ef::g123::myvar123_456" },
      'a hashtable reference'              : { 'testcase': "facts['123']", 'varname': 'facts' },
      'a function call suffix'             : { 'testcase': "abc123.split()", 'varname': 'abc123' },
    }
    for(var contextName in contexts) {
      context(contextName, function() {
        var testcase = contexts[contextName]['testcase']
        var varname = contexts[contextName]['varname']
        // A bit of magic, if the context doesn't define a varname, just use the testcase
        if (varname === undefined) { varname = testcase; }

        it("tokenizes " + contextName + " entirely with preceding dollar sign", function() {
          var tokens = getLineTokens(grammar, "$foo = $" + testcase);

          expect(tokens[3]).to.eql({value: '$', scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
          expect(tokens[4]).to.eql({value: varname, scopes: ['source.puppet', 'variable.other.readwrite.global.puppet']});
        });
      });
    };

    // Negative tests
    var contexts = {
      'starts with a number'                        : { 'testcase': "123abc" },
      'starts with an underscore in top level scope': { 'testcase': "::_abc" },
      'has an underscore inside the qualified name' : { 'testcase': "abc::_hij" },
    }
    for(var contextName in contexts) {
      context(contextName, function() {
        var testcase = contexts[contextName]['testcase']
        var varname = contexts[contextName]['varname']
        // A bit of magic, if the context doesn't define a varname, just use the testcase
        if (varname === undefined) { varname = testcase; }
        it("does not tokenizes a variable name which " + contextName, function() {
          var tokens = getLineTokens(grammar, "$foo = $" + testcase);
          expect(tokens[4]).to.not.eql({value: varname, scopes: ['source.puppet', 'variable.other.readwrite.global.puppet']});
        });
      });
    };
  });

  describe('interpolated strings', function() {
    var contexts = {
      'a short variable name'                                   : { 'testcase': "var" },
      'a short variable name with underscore'                   : { 'testcase': "_var" },
      'a qualified variable name'                               : { 'testcase': "ab12::cd34::var" },
      'a qualified short variable name'                         : { 'testcase': "::var" },
      'a variable with a hashtable reference'                   : { 'testcase': "facts['123']", 'varname': 'facts' },
      'a short variable with a hashtable reference'             : { 'testcase': "_facts['123']", 'varname': '_facts' },
      'a variable with a function call suffix'                  : { 'testcase': "abc123.split()", 'varname': 'abc123' },
      'a variable with an underscore and a function call suffix': { 'testcase': "_abc123.split()", 'varname': '_abc123' },
    }
    for(var contextName in contexts) {
      context(contextName, function() {
        var testcase = contexts[contextName]['testcase']
        var varname = contexts[contextName]['varname']
        // A bit of magic, if the context doesn't define a varname, just use the testcase
        if (varname === undefined) { varname = testcase; }

        var positionContexts = {
          "whole string"             : { 'prefix': "",        'suffix': "",        'offset': 0 },
          "right hand side of string": { 'prefix': "prefix ", 'suffix': "",        'offset': 1 },
          "left hand side of string" : { 'prefix': "",        'suffix': " suffix", 'offset': 0 },
          "inside of string"         : { 'prefix': "prefix ", 'suffix': " suffix", 'offset': 1 },
        }
        for(var posContextName in positionContexts) {
          context(posContextName, function() {
            var prefixText = positionContexts[posContextName]['prefix'];
            var suffixText = positionContexts[posContextName]['suffix'];
            var tokenOffset = positionContexts[posContextName]['offset'];

            it("tokenizes " + contextName + ", interpolated within double quotes", function() {
              var tokens = getLineTokens(grammar, "$foo = \"" + prefixText + "${" + testcase + "}" + suffixText + "\"");
              expect(tokens[5 + tokenOffset]).to.eql({value: varname, scopes: ['source.puppet', 'string.quoted.double.interpolated.puppet', 'meta.embedded.line.puppet', 'source.puppet', 'variable.other.readwrite.global.puppet']});
            });

            it("tokenizes " + contextName + ", prefixed with dollarsign, interpolated within double quotes", function() {
              var tokens = getLineTokens(grammar, "$foo = \"" + prefixText + "${$" + testcase + "}" + suffixText + "\"");
              expect(tokens[5 + tokenOffset]).to.eql({value: '$', scopes:
                ['source.puppet', 'string.quoted.double.interpolated.puppet', 'meta.embedded.line.puppet', 'source.puppet', 'variable.other.readwrite.global.puppet','punctuation.definition.variable.puppet']});
              expect(tokens[6 + tokenOffset]).to.eql({value: varname, scopes:
                ['source.puppet', 'string.quoted.double.interpolated.puppet', 'meta.embedded.line.puppet', 'source.puppet', 'variable.other.readwrite.global.puppet']});
            });
          });
        };
      });
    };
  });

  describe('non-interpolated heredoc', function() {
    var contexts = {
      'start simple variation 1'     : { 'start': "END" },
      'start simple variation 2'     : { 'start': "  END" },
      'start simple variation 3'     : { 'start': "END  " },
      'start simple variation 4'     : { 'start': "\tEND  " },
      'start syntax variation 1'     : { 'start': "END:abc123" },
      'start syntax variation 2'     : { 'start': "END: abc123 " },
      'start syntax variation 3'     : { 'start': "END: abc123" },
      'start syntax variation 4'     : { 'start': "END:abc123 " },
      'start syntax variation 5'     : { 'start': "\tEND\t:\tabc123\t" },
      'start escapes variation 1'    : { 'start': "END/" },
      'start escapes variation 2'    : { 'start': "END/ts" },
      'start escapes variation 3'    : { 'start': "END/tsrnL$" },
      'start escapes variation 4'    : { 'start': "END / tsrnL$" },
      'start escapes variation 5'    : { 'start': " END/ tsrnL$ " },
      'start escapes variation 6'    : { 'start': " END/tsrnL$\t" },
      'start escapes variation 7'    : { 'start': "\tEND\t/\ttsrnL$\t" },
      'start everything variation 1' : { 'start': "\t  END   :  abc123foobar/\ttsrnL$   \t  " },
      'start everything variation 2' : { 'start': "END:abc123foobar/tsrnL$" },

      'end simple variation 1'  : { 'end': "END" },
      'end simple variation 2'  : { 'end': "  END" },
      'end simple variation 3'  : { 'end': "  END  ", "endTokenText": "  END" },
      'end simple variation 4'  : { 'end': "END\t",   "endTokenText": "END" },
      'end simple variation 5'  : { 'end': "|END" },
      'end simple variation 6'  : { 'end': "|  END  ", "endTokenText": "|  END" },
      'end simple variation 7'  : { 'end': "  |  \t END" },
      'end simple variation 8'  : { 'end': "-END" },
      'end simple variation 9'  : { 'end': "-  END  ", "endTokenText": "-  END" },
      'end simple variation 10' : { 'end': "\t-  \t END" },
      'end simple variation 11' : { 'end': "|-END" },
      'end simple variation 12' : { 'end': "|-  END  ", "endTokenText": "|-  END" },
      'end simple variation 13' : { 'end': "\t|-  \t END" },
    }
    for(var contextName in contexts) {
      context(contextName, function() {
        var start = contexts[contextName]['start']
        var startTokenText = contexts[contextName]['startTokenText']
        var end = contexts[contextName]['end']
        var endTokenText = contexts[contextName]['endTokenText']
        // A bit of magic, if the context doesn't define a start, just use 'END'
        if (start === undefined) { start = 'END'; }
        if (startTokenText === undefined) { startTokenText = "@(" + start + ")" }
        if (end === undefined) { end = 'END'; }
        if (endTokenText === undefined) { endTokenText = end }

        it("tokenizes a " + contextName + " heredoc", function() {
          var heredocStart = "@(" + start + ")"
          var tokens = getLineTokens(grammar, "$foo = " + heredocStart + "\nText ${$foo} goes here\n" + end + "\n$foo = 'bar'");

          // Expect that the heredoc is tokenized
          expect(tokens[3]).to.eql({value: heredocStart, scopes: ['source.puppet', 'string.unquoted.heredoc.puppet', 'punctuation.definition.string.begin.puppet']});
          expect(tokens[4]).to.eql({value: "\nText ${$foo} goes here\n", scopes: ['source.puppet', 'string.unquoted.heredoc.puppet']});
          expect(tokens[5]).to.eql({value: endTokenText, scopes: ['source.puppet', 'string.unquoted.heredoc.puppet', 'punctuation.definition.string.end.puppet']});
          // Expect that things after heredoc is tokenized
          expect(tokens[7]).to.eql({value: "$", scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
        });
      });
    };

    context('negative tests', function() {
      var contexts = {
        'mismatched start end' : { 'start': "FOO", 'end': "BAR" },
        'bad syntax'           : { 'start': "END: asd:123 /" },
        'bad escapes'          : { 'start': "END/abc" },
        'bad end marker'       : { 'end': "abc |- END" },
      }
      for(var contextName in contexts) {
        context(contextName, function() {
          var start = contexts[contextName]['start']
          var startTokenText = contexts[contextName]['startTokenText']
          var end = contexts[contextName]['end']
          var endTokenText = contexts[contextName]['endTokenText']
          // A bit of magic, if the context doesn't define a start, just use 'END'
          if (start === undefined) { start = 'END'; }
          if (startTokenText === undefined) { startTokenText = "@(" + start + ")" }
          if (end === undefined) { end = 'END'; }
          if (endTokenText === undefined) { endTokenText = end }

          it("does not tokenizes a " + contextName + " heredoc", function() {
            var heredocStart = "@(" + start + ")"
            var heredocEnd = end
            var tokens = getLineTokens(grammar, "$foo = " + heredocStart + "\nText goes here\n" + end + "\n$foo = 'bar'");

            // Expect that the heredoc is not tokenized
            expect(tokens[4]).to.not.eql({value: "\nText goes here\n", scopes: ['source.puppet', 'string.unquoted.heredoc.puppet']});
            expect(tokens[5]).to.not.eql({value: endTokenText, scopes: ['source.puppet', 'string.unquoted.heredoc.puppet', 'punctuation.definition.string.end.puppet']});
            // Expect that things after heredoc is not tokenized
            expect(tokens[7]).to.not.eql({value: "$", scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
            });
        });
      };
    });
  });

  describe('interpolated heredoc', function() {
    var contexts = {
      'start simple variation 1'     : { 'start': '"END"' },
      'start simple variation 2'     : { 'start': '  "END"' },
      'start simple variation 3'     : { 'start': '"END"  ' },
      'start simple variation 4'     : { 'start': '\t"END"  ' },
      'start syntax variation 1'     : { 'start': '"END":abc123' },
      'start syntax variation 2'     : { 'start': '"END": abc123 ' },
      'start syntax variation 3'     : { 'start': '"END": abc123' },
      'start syntax variation 4'     : { 'start': '"END":abc123 ' },
      'start syntax variation 5'     : { 'start': '\t"END"\t:\tabc123\t' },
      'start escapes variation 1'    : { 'start': '"END"/' },
      'start escapes variation 2'    : { 'start': '"END"/ts' },
      'start escapes variation 3'    : { 'start': '"END"/tsrnL$' },
      'start escapes variation 4'    : { 'start': '"END" / tsrnL$' },
      'start escapes variation 5'    : { 'start': ' "END"/ tsrnL$ ' },
      'start escapes variation 6'    : { 'start': ' "END"/tsrnL$\t' },
      'start escapes variation 7'    : { 'start': '\t"END"\t/\ttsrnL$\t' },
      'start everything variation 1' : { 'start': '\t  "END"   :  abc123foobar/\ttsrnL$   \t  ' },
      'start everything variation 2' : { 'start': '"END":abc123foobar/tsrnL$' },
    }
    for(var contextName in contexts) {
      context(contextName, function() {
        var start = contexts[contextName]['start']
        var startTokenText = contexts[contextName]['startTokenText']
        var end = contexts[contextName]['end']
        var endTokenText = contexts[contextName]['endTokenText']
        // A bit of magic, if the context doesn't define a start, just use 'END'
        if (start === undefined) { start = 'END'; }
        if (startTokenText === undefined) { startTokenText = "@(" + start + ")" }
        if (end === undefined) { end = 'END'; }
        if (endTokenText === undefined) { endTokenText = end }

        it("tokenizes a " + contextName + " heredoc", function() {
          var heredocStart = "@(" + start + ")"
          var heredocEnd = end
          var tokens = getLineTokens(grammar, "$foo = " + heredocStart + "\nText ${$foo} goes here\n" + end + "\n$foo = 'bar'");

          // Expect that the heredoc is tokenized
          expect(tokens[3]).to.eql({value: heredocStart, scopes: ['source.puppet', 'string.interpolated.heredoc.puppet', 'punctuation.definition.string.begin.puppet']});
          // Expect that interpolated strings tokenized
          expect(tokens[5]).to.eql({value: "${", scopes: ['source.puppet', 'string.interpolated.heredoc.puppet', 'meta.embedded.line.puppet', 'punctuation.section.embedded.begin.puppet']});
          // Expect that the heredoc end marker is tokenized
          expect(tokens[10]).to.eql({value: endTokenText, scopes: ['source.puppet', 'string.interpolated.heredoc.puppet', 'punctuation.definition.string.end.puppet']});
          // Expect that things after heredoc is tokenized
          expect(tokens[12]).to.eql({value: "$", scopes: ['source.puppet', 'variable.other.readwrite.global.puppet', 'punctuation.definition.variable.puppet']});
        });
      });
    };

    context('negative tests', function() {
      var contexts = {
        'mismatched start end' : { 'start': '"FOO"', 'end': 'BAR' },
        'bad syntax'           : { 'start': '"END": asd:123 /' },
        'bad escapes'          : { 'start': '"END"/abc' },
        'bad end marker'       : { 'end': 'abc |- END' },
      }
      for(var contextName in contexts) {
        context(contextName, function() {
          var start = contexts[contextName]['start']
          var startTokenText = contexts[contextName]['startTokenText']
          var end = contexts[contextName]['end']
          var endTokenText = contexts[contextName]['endTokenText']
          // A bit of magic, if the context doesn't define a start, just use 'END'
          if (start === undefined) { start = 'END'; }
          if (startTokenText === undefined) { startTokenText = "@(" + start + ")" }
          if (end === undefined) { end = 'END'; }
          if (endTokenText === undefined) { endTokenText = end }

          it("does not tokenizes a " + contextName + " heredoc", function() {
            var heredocStart = "@(" + start + ")"
            var heredocEnd = end
            var tokens = getLineTokens(grammar, "$foo = " + heredocStart + "\nText goes here\n" + end + "\n$foo = 'bar'");

            // Expect that the heredoc is not tokenized
            expect(tokens[5]).to.not.eql({value: endTokenText, scopes: ['source.puppet', 'string.interpolated.heredoc.puppet', 'punctuation.definition.string.end.puppet']});
          });
        });
      };
    });
  });
});
