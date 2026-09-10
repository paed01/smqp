import { getRoutingKeyPattern } from 'smqp';

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

    it('#.# matches all including empty', () => {
      const pattern = getRoutingKeyPattern('#.#');
      expect(pattern.test('a.b.c')).to.be.true;
      expect(pattern.test('a')).to.be.true;
      expect(pattern.test('')).to.be.true;
    });

    it('* matches one', () => {
      const pattern = getRoutingKeyPattern('*');
      expect(pattern.test('a')).to.be.true;
      expect(pattern.test('a.b.c')).to.be.false;
      expect(pattern.test('abc')).to.be.true;
      expect(pattern.test('')).to.be.false;
    });

    it('* matches an empty word', () => {
      expect(getRoutingKeyPattern('a.*.c').test('a..c')).to.be.true;
      expect(getRoutingKeyPattern('a.*').test('a.')).to.be.true;
      expect(getRoutingKeyPattern('*.*').test('.')).to.be.true;
    });

    it('literal pattern matches routing key exactly', () => {
      const pattern = getRoutingKeyPattern('a.b');
      expect(pattern.test('a.b')).to.be.true;
      expect(pattern.test('a.b.c')).to.be.false;
      expect(pattern.test('a')).to.be.false;
      expect(pattern.test('')).to.be.false;
    });

    it('empty pattern matches empty routing key only', () => {
      const pattern = getRoutingKeyPattern('');
      expect(pattern.test('')).to.be.true;
      expect(pattern.test('a')).to.be.false;
    });

    it('prefix.# matches prefix followed by zero or more words', () => {
      const pattern = getRoutingKeyPattern('prefix.#');
      expect(pattern.test('prefix.a.b.c')).to.be.true;
      expect(pattern.test('prefix.a')).to.be.true;
      expect(pattern.test('prefix')).to.be.true;
      expect(pattern.test('prefixed')).to.be.false;
      expect(pattern.test('prefixed.a')).to.be.false;
      expect(pattern.test('a.prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
      expect(pattern.test('')).to.be.false;
    });

    it('prefix# is a literal word since # only has meaning as a whole word', () => {
      const pattern = getRoutingKeyPattern('prefix#');
      expect(pattern.test('prefix#')).to.be.true;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('prefixed')).to.be.false;
      expect(pattern.test('prefix.a')).to.be.false;
    });

    it('prefix* is a literal word since * only has meaning as a whole word', () => {
      const pattern = getRoutingKeyPattern('prefix*.a');
      expect(pattern.test('prefix*.a')).to.be.true;
      expect(pattern.test('prefixed.a')).to.be.false;
      expect(pattern.test('prefix.a')).to.be.false;
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
      expect(pattern.test('prefix.b')).to.be.true;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('prefix.*.suffix matches one that start with prefix and ends with suffix', () => {
      const pattern = getRoutingKeyPattern('prefix.*.b');
      expect(pattern.test('prefix.a.b')).to.be.true;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('prefix.a.b.c')).to.be.false;
      expect(pattern.test('prefix.b')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('prefix.*.inter.* matches both middle and end', () => {
      const pattern = getRoutingKeyPattern('prefix.*.inter.*');
      expect(pattern.test('prefix.a.inter.b')).to.be.true;
      expect(pattern.test('prefix.a.inter.*')).to.be.true;

      expect(pattern.test('prefix.a.inter.b.c')).to.be.false;
      expect(pattern.test('prefix.a.inter')).to.be.false;
    });

    it('prefix.*.inter.# matches one that start with prefix then any word and then inter and ends with zero or more words', () => {
      const pattern = getRoutingKeyPattern('prefix.*.inter.#');
      expect(pattern.test('prefix.a.inter.b')).to.be.true;
      expect(pattern.test('prefix.a.inter.b.c.d')).to.be.true;
      expect(pattern.test('prefix.a-oy.inter.b.c.d')).to.be.true;
      expect(pattern.test('prefix.a.inter')).to.be.true;

      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('prefix.a.b.inter.c')).to.be.false;
      expect(pattern.test('prefix')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
    });

    it('prefix.#.inter.* matches one that start with prefix then anything until inter is reached and then exactly one word', () => {
      const pattern = getRoutingKeyPattern('prefix.#.inter.*');
      expect(pattern.test('prefix.a.inter.b')).to.be.true;
      expect(pattern.test('prefix.a.b.inter.c')).to.be.true;
      expect(pattern.test('prefix.a-oy.c.d.inter.e')).to.be.true;
      expect(pattern.test('prefix.inter.b')).to.be.true;
      expect(pattern.test('prefix.a.inter.')).to.be.true;

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
      expect(pattern.test('suffix')).to.be.true;

      expect(pattern.test('prefix.a.inter.')).to.be.false;
      expect(pattern.test('prefix.a.inter.b.c.d')).to.be.false;
      expect(pattern.test('prefix.a.inter')).to.be.false;
      expect(pattern.test('prefix.a')).to.be.false;
      expect(pattern.test('suffixed')).to.be.false;
      expect(pattern.test('abc')).to.be.false;
      expect(pattern.test('')).to.be.false;
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

    it('*.# matches one or more words', () => {
      const pattern = getRoutingKeyPattern('*.#');
      expect(pattern.test('a')).to.be.true;
      expect(pattern.test('a.b')).to.be.true;
      expect(pattern.test('a.b.c')).to.be.true;
      expect(pattern.test('')).to.be.false;
    });

    it('#.* matches one or more words', () => {
      const pattern = getRoutingKeyPattern('#.*');
      expect(pattern.test('a')).to.be.true;
      expect(pattern.test('a.b')).to.be.true;
      expect(pattern.test('a.b.c')).to.be.true;
      expect(pattern.test('')).to.be.false;
    });

    it('#.b.# matches b anywhere', () => {
      const pattern = getRoutingKeyPattern('#.b.#');
      expect(pattern.test('b')).to.be.true;
      expect(pattern.test('a.b')).to.be.true;
      expect(pattern.test('b.c')).to.be.true;
      expect(pattern.test('a.b.c')).to.be.true;
      expect(pattern.test('a.c')).to.be.false;
      expect(pattern.test('ab')).to.be.false;
    });

    it('a.#.b.# backtracks over words consumed by #', () => {
      const pattern = getRoutingKeyPattern('a.#.b.#');
      expect(pattern.test('a.b')).to.be.true;
      expect(pattern.test('a.x.b')).to.be.true;
      expect(pattern.test('a.b.x')).to.be.true;
      expect(pattern.test('a.x.b.y')).to.be.true;
      expect(pattern.test('a.b.b')).to.be.true;
      expect(pattern.test('a.x')).to.be.false;
    });

    it('special characters match', () => {
      const pattern = getRoutingKeyPattern('prefix-a.*.b');
      expect(pattern.test('prefix-a.a.b')).to.be.true;
      expect(pattern.test('prefix-a.a')).to.be.false;
    });

    it('regex metacharacters in pattern words are matched literally', () => {
      expect(getRoutingKeyPattern('a(1).*').test('a(1).x')).to.be.true;
      expect(getRoutingKeyPattern('a(1).*').test('a1.x')).to.be.false;
      expect(getRoutingKeyPattern('a+.#').test('a+')).to.be.true;
      expect(getRoutingKeyPattern('a+.#').test('aa')).to.be.false;
      expect(getRoutingKeyPattern('[a].*').test('[a].b')).to.be.true;
      expect(getRoutingKeyPattern('[a].*').test('a.b')).to.be.false;
      expect(getRoutingKeyPattern('a|b.*').test('a|b.c')).to.be.true;
      expect(getRoutingKeyPattern('a|b.*').test('a.c')).to.be.false;
      expect(getRoutingKeyPattern('a$.#.^b').test('a$.^b')).to.be.true;
      expect(getRoutingKeyPattern('a\\d.*').test('a\\d.b')).to.be.true;
      expect(getRoutingKeyPattern('a\\d.*').test('a1.b')).to.be.false;
    });
  });
});
