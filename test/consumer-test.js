import {Broker} from '../index';

describe('queue', () => {
  it('noAck option consumes message immediately', () => {
    const broker = Broker();

    const queue = broker.assertQueue('event-q');
    broker.consume(queue.name, onMessage, {noAck: true});

    queue.queueMessage('test');

    expect(queue.length).to.equal(0);

    function onMessage() {
      expect(queue.length).to.equal(0);
    }
  });
});
