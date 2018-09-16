import {Exchange} from '../../src/Exchange';

describe('Exchange', () => {
  it('requires name', () => {
    const exchange = Exchange('event');
    expect(exchange).to.have.property('name', 'event');
  });
});
