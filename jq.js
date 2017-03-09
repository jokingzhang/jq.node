'use strict';

let content = '';
const vm = require('vm');
const {args, showHelp} = require('./args');
const _ = require('lodash/fp');
const highlight = args.color
  ? require('cardinal').highlight
  : _.identity;
const stripAnsi = require('strip-ansi');
require('./mixins')(_);

if (process.stdin.isTTY) {
  showHelp();
  process.exit(0);
}

const deps = {};

if (args.require) {
  const lazyRequire = require('lazy-require');
  const TMP = require('os').tmpdir();
  _.castArray(args.require).reduce((deps, dep) => {
    dep = dep.split(':');
    let depAlias = dep[0];
    let depName = dep[1] ? dep[1]: dep[0];
    deps[depAlias] = lazyRequire(depName, {
      cwd: TMP,
      save: false
    })
    return deps;
  }, deps);

}
process.stdin.resume().on('data', function(buf) {
  content += buf.toString();
}).on('end', function() {
  const sandbox = Object.assign({}, _, {
    console: console,
    exit: process.exit.bind(process),
    $$input$$: args.rawInput ? stripAnsi(content) : JSON.parse(stripAnsi(content))
  }, deps);
  const scriptStrWithPipes = args._[0];
  const scriptStr = (!scriptStrWithPipes || scriptStrWithPipes === '.'
    ? 'identity'
    : scriptStrWithPipes).replace(/ \| /g, ',');
  const source = `flow(${scriptStr})($$input$$);`;
  const script = new vm.Script(source);
  const context = new vm.createContext(sandbox);
  let result;
  try {
    result = script.runInContext(context);
  } catch (err) {
    console.error('[Invalid Expression] %s', source);
    console.error(err);
    process.exit(1);
  }

  if(args.rawPrint) {
    console.dir(result, {depth: null});
  } else {
    const output = args.json || !_.isString(result)
      ? highlight(JSON.stringify(result, null, 2) || '')
      : result;
    console.log(output);
  }
});
