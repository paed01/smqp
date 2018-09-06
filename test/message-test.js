import {Broker} from '../index';

describe('message', () => {
  it('published and consumed message has fields property with consumerTag, routingKey, and exchange', () => {
    const broker = Broker();

    broker.assertExchange('event');
    const queue = broker.assertQueue('event-q');
    broker.bindQueue('event-q', 'event', '#');
    broker.consume(queue.name, onMessage, {noAck: true, consumerTag: 'c-1'});

    let msg;

    broker.publish('event', 'test.1');

    expect(msg).to.be.ok;
    expect(msg).to.have.property('fields').that.eql({
      consumerTag: 'c-1',
      exchange: 'event',
      routingKey: 'test.1',
    });

    function onMessage(_, message) {
      msg = message;
    }
  });
});
