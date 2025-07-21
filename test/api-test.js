import * as smqp from 'smqp';

describe('smqp', () => {
  it('exposes Broker', () => {
    expect(smqp.Broker).to.be.a('function');
  });

  it('exposes Message', () => {
    expect(smqp.Message).to.be.a('function');
  });

  it('exposes Exchange', () => {
    expect(smqp.Exchange).to.be.a('function');
  });

  it('exposes Queue', () => {
    expect(smqp.Queue).to.be.a('function');
  });

  it('exposes Consumer', () => {
    expect(smqp.Consumer).to.be.a('function');
  });

  it('exposes Shovel', () => {
    expect(smqp.Shovel).to.be.a('function');
  });

  it('exposes SmqpError', () => {
    expect(smqp.SmqpError).to.be.a('function');
  });

  it('exposes getRoutingKeyPattern()', () => {
    expect(smqp.getRoutingKeyPattern).to.be.a('function');
  });
});
