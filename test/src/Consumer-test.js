import {Consumer} from '../../src/Queue';

describe('Consumer', () => {
  describe('ctor', () => {
    it('returns instance if called without new', () => {
      const consumer = Consumer({}, () => {});
      expect(consumer).to.be.instanceof(Consumer);
    });
  });
});
