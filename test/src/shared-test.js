import {getRoutingKeyPattern} from '../../src/shared';

describe('shared', () => {
  describe('routingKey pattern', () => {
    it('# matches all', () => {
      const pattern = getRoutingKeyPattern('#');
      expect(pattern.test('a.b.c')).to.be.true;
      expect(pattern.test('abc')).to.be.true;
      expect(pattern.test('a')).to.be.true;
    });

    it('* matches one', () => {
      const pattern = getRoutingKeyPattern('*');
      expect(pattern.test('a')).to.be.true;
      expect(pattern.test('a.b.c')).to.be.false;
      expect(pattern.test('abc')).to.be.true;
    });

    it('prefix.# matches all that start with prefix', () => {
      const pattern = getRoutingKeyPattern('prefix.#');
      expect(pattern.test('prefix.a.b.c')).to.be.true;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('prefix.* matches one that start with prefix', () => {
      const pattern = getRoutingKeyPattern('prefix.*');
      expect(pattern.test('prefix.a')).to.be.true;
      expect(pattern.test('prefix.a.b.c')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('prefix.#.suffix matches all that start with prefix and ends with suffix', () => {
      const pattern = getRoutingKeyPattern('prefix.#.b');
      expect(pattern.test('prefix.a.b')).to.be.true;
      expect(pattern.test('prefix.a.o.u.b')).to.be.true;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('prefix.*.suffix matches one that start with prefix and ends with suffix', () => {
      const pattern = getRoutingKeyPattern('prefix.*.b');
      expect(pattern.test('prefix.a.b')).to.be.true;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('prefix.a.b.c')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('special characters match', () => {
      const pattern = getRoutingKeyPattern('prefix-a.*.b');
      expect(pattern.test('prefix-a.a.b')).to.be.true;
      expect(pattern.test('prefix-a.a')).to.be.false;
    });
  });
});
