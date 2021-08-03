export {generateId, getRoutingKeyPattern, sortByPriority};

const allDots = /\./g;
const allAstx = /\*/g;
const allHashs = /#/g;

function generateId() {
  const min = 110000;
  const max = 9999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}

function getRoutingKeyPattern(pattern) {
  const len = pattern.length;
  const hashIdx = pattern.indexOf('#');
  const astxIdx = pattern.indexOf('*');
  if (hashIdx === -1) {
    if (astxIdx === -1) {
      return directMatch();
    }
  } else if (hashIdx === len - 1 && astxIdx === -1) {
    return endMatch();
  }

  const rpattern = pattern
    .replace(allDots, '\\.')
    .replace(allAstx, '[^.]+?')
    .replace(allHashs, '.+?');

  return new RegExp(`^${rpattern}$`);

  function directMatch() {
    return {
      test
    };
    function test(routingKey) {
      return routingKey === pattern;
    }
  }

  function endMatch() {
    const testString = pattern.replace('#', '');
    return {
      test
    };
    function test(routingKey) {
      return routingKey.indexOf(testString) === 0;
    }
  }
}

function sortByPriority(a, b) {
  return (b.options.priority || 0) - (a.options.priority || 0);
}
