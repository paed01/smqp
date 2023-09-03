import { Shovel } from '../../src/Shovel.js';

describe('Shovel', () => {
  describe('ctor', () => {
    it('throws if name is not passed', () => {
      expect(() => new Shovel()).to.throw(TypeError, /name/);
    });

    it('throws if name is not a string', () => {
      expect(() => new Shovel({})).to.throw(TypeError, /name/);
    });
  });
});
