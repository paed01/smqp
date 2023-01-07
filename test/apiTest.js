import * as smqp from '../src/index.js';

describe('smqp', () => {
  it('exposes Broker', () => {
    expect(smqp.Broker).to.be.a('function');
  });

  it('exposes Shovel', () => {
    expect(smqp.Shovel).to.be.a('function');
  });

  it('exposes getRoutingKeyPattern()', () => {
    expect(smqp.getRoutingKeyPattern).to.be.a('function');
  });
});
