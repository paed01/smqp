export { generateId, getRoutingKeyPattern, sortByPriority };

const allDots = /\./g;
const allAstx = /\*/g;
const allHashs = /#/g;

function generateId() {
  return Math.random().toString(16).substring(2, 12);
}

function DirectRoutingKeyPattern(pattern) {
  this._match = pattern;
}
DirectRoutingKeyPattern.prototype.test = function test(routingKey) {
  return this._match === routingKey;
};

function EndMatchRoutingKeyPattern(pattern) {
  this._match = pattern.replace('#', '');
}
EndMatchRoutingKeyPattern.prototype.test = function test(routingKey) {
  return !routingKey.indexOf(this._match);
};

function getRoutingKeyPattern(pattern) {
  const len = pattern.length;
  const hashIdx = pattern.indexOf('#');
  const astxIdx = pattern.indexOf('*');
  if (hashIdx === -1) {
    if (astxIdx === -1) {
      return new DirectRoutingKeyPattern(pattern);
    }
  } else if (hashIdx === len - 1 && astxIdx === -1) {
    return new EndMatchRoutingKeyPattern(pattern);
  }

  const rpattern = pattern
    .replace(allDots, '\\.')
    .replace(allAstx, '[^.]+?')
    .replace(allHashs, '.*?');

  return new RegExp(`^${rpattern}$`);
}

function sortByPriority(a, b) {
  return (b.options.priority || 0) - (a.options.priority || 0);
}
