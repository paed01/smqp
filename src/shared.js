export {generateId, sortByPriority};

function generateId() {
  const min = 110000;
  const max = 9999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}

function sortByPriority(a, b) {
  return b.options.priority - a.options.priority;
}
