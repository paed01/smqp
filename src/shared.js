const regexMetaChars = /[.*+?^${}()|[\]\\]/g;

export function generateId() {
  return Math.random().toString(16).substring(2, 12);
}

function DirectRoutingKeyPattern(pattern) {
  this._match = pattern;
}
DirectRoutingKeyPattern.prototype.test = function test(routingKey) {
  return this._match === routingKey;
};

/**
 * Prefix followed by zero or more words, i.e. `#` or `some.prefix.#`
 * @param {string} prefix pattern words preceding the trailing `#`, joined by dots
 * @param {boolean} all match everything, pattern is `#`
 */
function EndMatchRoutingKeyPattern(prefix, all) {
  this._match = prefix;
  this._prefix = all ? '' : prefix + '.';
}
EndMatchRoutingKeyPattern.prototype.test = function test(routingKey) {
  return routingKey.startsWith(this._prefix) || routingKey === this._match;
};

/**
 * Get routing key pattern
 * @param {string} pattern routing key pattern
 * @returns {RoutingKeyPattern}
 *
 * @typedef {object} RoutingKeyPattern
 * @property {(this: RoutingKeyPattern, routingKey: string) => boolean} test method to test a routing key against the pattern; receiver-bound — destructuring is unsupported
 */
export function getRoutingKeyPattern(pattern) {
  const words = pattern.split('.');
  const wordCount = words.length;

  let wildcards = 0;
  let lastHashIdx = -1;
  for (let i = 0; i < wordCount; i++) {
    const word = words[i];
    if (word === '#') {
      ++wildcards;
      lastHashIdx = i;
    } else if (word === '*') {
      ++wildcards;
    }
  }

  if (!wildcards) return new DirectRoutingKeyPattern(pattern);

  if (wildcards === 1 && lastHashIdx === wordCount - 1) {
    if (wordCount === 1) return new EndMatchRoutingKeyPattern('', true);
    return new EndMatchRoutingKeyPattern(pattern.substring(0, pattern.length - 2), false);
  }

  let rpattern = '';
  let needDot = false;
  let prevHash = false;
  for (let i = 0; i < wordCount; i++) {
    const word = words[i];
    if (word === '#') {
      if (prevHash) continue;
      prevHash = true;
      if (i === 0) {
        rpattern += '(?:[^.]*\\.)*';
      } else {
        rpattern += '(?:\\.[^.]*)*';
      }
      continue;
    }

    prevHash = false;
    if (needDot) rpattern += '\\.';
    needDot = true;
    if (word === '*') {
      rpattern += '[^.]*';
    } else {
      rpattern += word.replace(regexMetaChars, '\\$&');
    }
  }

  if (!needDot) {
    // only hashes, e.g. `#.#`
    return new EndMatchRoutingKeyPattern('', true);
  }

  // a wildcard pattern never matches the empty routing key since it has no words
  return new RegExp(`^(?!$)${rpattern}$`);
}

export function sortByPriority(a, b) {
  return (b.options.priority || 0) - (a.options.priority || 0);
}
