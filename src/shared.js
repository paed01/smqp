export {generateId, getRoutingKeyPattern, sortByPriority};

function generateId() {
  const min = 110000;
  const max = 9999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}

function getRoutingKeyPattern(pattern) {
  const rpattern = pattern
    .replace('.', '\\.')
    .replace('*', '[^.]+?')
    .replace('#', '.+?');

  return new RegExp(`^${rpattern}$`);
}

function sortByPriority(a, b) {
  if (!("priority" in a.options)) throw new Error(JSON.stringify(a));

  return b.options.priority - a.options.priority;
}
