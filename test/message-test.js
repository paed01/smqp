import {Broker} from '../index.js';
import {Message} from '../src/Message.js';
import ck from 'chronokinesis';

describe('message', () => {
  after(ck.reset);

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

  it('recovered message maintains properties', () => {
    const original = Broker();

    original.assertExchange('event');
    const queue = original.assertQueue('event-q', {durable: true});
    original.bindQueue('event-q', 'event', '#');

    ck.freeze();
    let msg1;
    original.publish('event', 'test.1', {data: 1}, {expiration: 10000});
    original.consume(queue.name, onMessage1, {consumerTag: 'c-1'});

    const now = Date.now();

    expect(msg1).to.be.ok;
    expect(msg1).to.have.property('fields').that.eql({
      consumerTag: 'c-1',
      exchange: 'event',
      routingKey: 'test.1',
    });
    expect(msg1).to.have.property('properties').with.property('messageId').that.is.ok;
    expect(msg1.properties).to.have.property('timestamp', now);
    expect(msg1.properties).to.have.property('expiration', 10000);
    expect(msg1.properties).to.have.property('ttl', now + 10000);

    const state = original.getState();

    ck.reset();
    const broker = Broker().recover(state);

    let msg2;
    broker.consume(queue.name, onMessage2, {consumerTag: 'c-2'});

    expect(msg2).to.be.ok;
    expect(msg2).to.have.property('fields').that.eql({
      consumerTag: 'c-2',
      exchange: 'event',
      routingKey: 'test.1',
      redelivered: true,
    });
    expect(msg2).to.have.property('properties').with.property('messageId').that.is.ok;
    expect(msg2.properties).to.have.property('timestamp', now);
    expect(msg2.properties).to.have.property('expiration', 10000);
    expect(msg2.properties).to.have.property('ttl', now + 10000);

    function onMessage1(_, message) {
      msg1 = message;
    }
    function onMessage2(_, message) {
      msg2 = message;
    }
  });

  it('new message without args sets fields consumer tag to undefined', () => {
    expect(new Message()).to.have.property('fields').that.deep.equal({consumerTag: undefined});
  });

  it('new message without args sets properties message id and timestamp', () => {
    const msg = new Message();
    expect(msg).to.have.property('properties').that.is.an('object');
    expect(msg.properties).to.have.property('messageId').that.is.a('string');
    expect(msg.properties).to.have.property('timestamp').that.is.a('number');
  });

  // it('consume(undefined) defaults consumer argument to empty object', () => {
  //   const msg = new Message();
  //   msg.consume();
  //   expect(msg.fields).to.have.property('consumerTag', undefined);
  // });
});
