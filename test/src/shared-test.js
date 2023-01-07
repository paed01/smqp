import {getRoutingKeyPattern} from '../../src/index.js';

describe('shared', () => {
  describe('routingKey pattern', () => {
    it('# matches all', () => {
      const pattern = getRoutingKeyPattern('#');
      expect(pattern.test('a.b.c')).to.be.true;
      expect(pattern.test('abc')).to.be.true;
      expect(pattern.test('a')).to.be.true;
    });

    it('# matches empty', () => {
      const pattern = getRoutingKeyPattern('#');
      expect(pattern.test('')).to.be.true;
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

    it('prefix# matches starts with prefix', () => {
      const pattern = getRoutingKeyPattern('prefix#');
      expect(pattern.test('prefix')).to.be.true;
      expect(pattern.test('prefixed')).to.be.true;
      expect(pattern.test('prefix.a.inter.suffix')).to.be.true;
      expect(pattern.test('prefix.a-oy.c.d.inter.suffix')).to.be.true;
      expect(pattern.test('prefix.a.inter.')).to.be.true;

      expect(pattern.test('prefiks.a')).to.be.false;
      expect(pattern.test('a.prefix.b')).to.be.false;
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

    it('prefix.*.inter.* matches both middle and end', () => {
      const pattern = getRoutingKeyPattern('prefix.*.inter.*');
      expect(pattern.test('prefix.a.inter.b')).to.be.true;
      expect(pattern.test('prefix.a.inter.*')).to.be.true;

      expect(pattern.test('prefix.a.inter.b.c')).to.be.false;
    });

    it('prefix.*.inter.# matches one that start with prefix then any word chars and then inter and ends with anything', () => {
      const pattern = getRoutingKeyPattern('prefix.*.inter.#');
      expect(pattern.test('prefix.a.inter.b')).to.be.true;
      expect(pattern.test('prefix.a.inter.b.c.d')).to.be.true;
      expect(pattern.test('prefix.a-oy.inter.b.c.d')).to.be.true;

      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('prefix.a.inter')).to.be.false;
      expect(pattern.test('prefix.a.b.inter.c')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('prefix.#.inter.* matches one that start with prefix then anything until inter is reached and then ends with any word chars', () => {
      const pattern = getRoutingKeyPattern('prefix.#.inter.*');
      expect(pattern.test('prefix.a.inter.b')).to.be.true;
      expect(pattern.test('prefix.a.b.inter.c')).to.be.true;
      expect(pattern.test('prefix.a-oy.c.d.inter.e')).to.be.true;

      expect(pattern.test('prefix.a.inter.')).to.be.false;
      expect(pattern.test('prefix.a.interbc')).to.be.false;
      expect(pattern.test('prefix.a.inter.b.c.d')).to.be.false;
      expect(pattern.test('prefix.a.inter')).to.be.false;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('#.suffix matches ends with suffix', () => {
      const pattern = getRoutingKeyPattern('#.suffix');
      expect(pattern.test('prefix.a.inter.suffix')).to.be.true;
      expect(pattern.test('prefix.a.b.inter.suffix')).to.be.true;
      expect(pattern.test('prefix.a-oy.c.d.inter.suffix')).to.be.true;

      expect(pattern.test('prefix.a.inter.')).to.be.false;
      expect(pattern.test('prefix.a.inter.b.c.d')).to.be.false;
      expect(pattern.test('prefix.a.inter')).to.be.false;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('suffix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('*.suffix matches prefix that ends with suffix', () => {
      const pattern = getRoutingKeyPattern('*.suffix');
      expect(pattern.test('prefix.suffix')).to.be.true;
      expect(pattern.test('a.suffix')).to.be.true;
      expect(pattern.test('me-me.suffix')).to.be.true;

      expect(pattern.test('prefix.a.suffix')).to.be.false;
      expect(pattern.test('prefix.a.suffix.')).to.be.false;
      expect(pattern.test('prefix.a.inter.b.c.suffix')).to.be.false;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('suffix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('special characters match', () => {
      const pattern = getRoutingKeyPattern('prefix-a.*.b');
      expect(pattern.test('prefix-a.a.b')).to.be.true;
      expect(pattern.test('prefix-a.a')).to.be.false;
    });
  });
});
