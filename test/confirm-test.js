import {Broker} from '../index';
import ck from 'chronokinesis';

describe('Confirm messages with confirm property', () => {
  after(ck.reset);

  describe('broker.sendToQueue()', () => {
    it('emits ack event when message is acked', (done) => {
      const broker = Broker();
      broker.assertQueue('event-q');
      broker.on('message.ack', (event) => {
        expect(event.name).to.equal('message.ack');
        expect(event.content).to.equal('MSG');
        expect(event.properties).to.have.property('myProp', 1);
        done();
      });

      broker.sendToQueue('event-q', 'MSG', {confirm: true, myProp: 1});

      const message = broker.get('event-q');
      message.ack();
    });

    it('emits nack event when message is nacked without requeue', (done) => {
      const broker = Broker();
      broker.assertQueue('event-q');
      broker.on('message.nack', (event) => {
        expect(event.content).to.equal('MSG');
        expect(event.properties).to.have.property('myProp', 1);
        expect(event.properties).to.have.property('confirm', 'my-confirm-id');
        done();
      });

      broker.sendToQueue('event-q', 'MSG', {confirm: 'my-confirm-id', myProp: 1});

      const message = broker.get('event-q');
      message.nack(false, false);
    });

    it('emits nack event when message is nacked without requeue first time but not second', () => {
      const broker = Broker();
      broker.assertQueue('event-q');

      const events = [];

      broker.on('message.nack', (event) => {
        events.push(event);
      });

      broker.sendToQueue('event-q', 'MSG', {confirm: true});

      let message = broker.get('event-q');
      message.nack(false, true);

      expect(events, 'nack with requeue').to.have.length(0);

      message = broker.get('event-q');
      message.nack(false, false);

      expect(events, 'nack without requeue').to.have.length(1);
      expect(events[0].content).to.equal('MSG');
    });

    it('emits ack event when two messages are acked with falsy allUpTo', () => {
      const broker = Broker();
      broker.assertQueue('event-q');

      const events = [];

      broker.on('message.*', (event) => {
        events.push(event);
      });

      broker.sendToQueue('event-q', 'MSG1', {confirm: true});
      broker.sendToQueue('event-q', 'MSG2', {confirm: true});

      const message1 = broker.get('event-q');
      const message2 = broker.get('event-q');

      expect(message1.content).to.equal('MSG1');
      expect(message2.content).to.equal('MSG2');

      message2.ack();
      message1.ack();

      expect(events, 'ack events').to.have.length(2);
      expect(events[0]).to.have.property('name', 'message.ack');
      expect(events[0]).to.have.property('content', 'MSG2');
      expect(events[1]).to.have.property('name', 'message.ack');
      expect(events[1]).to.have.property('content', 'MSG1');
    });

    it('emits ack event when second message is acks allUpTo', () => {
      const broker = Broker();
      broker.assertQueue('event-q');

      const events = [];

      broker.on('message.ack', (event) => {
        events.push(event);
      });

      broker.sendToQueue('event-q', 'MSG1', {confirm: true});
      broker.sendToQueue('event-q', 'MSG2', {confirm: true});

      const message1 = broker.get('event-q');
      const message2 = broker.get('event-q');

      expect(message1.content).to.equal('MSG1');
      expect(message2.content).to.equal('MSG2');

      message2.ack(true);

      expect(events, 'ack events').to.have.length(2);
      expect(events[0].content).to.equal('MSG2');
      expect(events[1].content).to.equal('MSG1');
    });

    it('emits nack event when message has timed out', () => {
      const broker = Broker();
      broker.assertQueue('event-q', {messageTtl: 200});

      const events = [];

      broker.on('message.nack', (event) => {
        events.push(event);
      });

      broker.sendToQueue('event-q', 'MSG', {confirm: true});

      ck.travel(Date.now() + 400);

      broker.get('event-q');

      expect(events, 'ack events').to.have.length(1);
      expect(events[0].content).to.equal('MSG');
    });

    it('no confirm property emits no consume events when message is acked or nacked', () => {
      const broker = Broker();
      broker.assertQueue('event-q');

      const events = [];
      broker.on('message.ack', (event) => {
        events.push(event);
      });

      broker.sendToQueue('event-q', 'MSG1');
      broker.sendToQueue('event-q', 'MSG2');

      let message = broker.get('event-q');
      message.ack();

      message = broker.get('event-q');
      message.nack(false, false);

      expect(events).to.have.length(0);
    });
  });

  describe('broker.publish()', () => {
    it('topic exchange emits undelivered event when message was undelivered', (done) => {
      const broker = Broker();
      broker.assertExchange('event', 'topic');

      broker.on('message.undelivered', (event) => {
        expect(event.content).to.equal('MSG');
        done();
      });

      broker.publish('event', 'test.1', 'MSG', {confirm: true});
    });

    it('topic exchange emits undelivered event when message was undelivered', (done) => {
      const broker = Broker();
      broker.assertExchange('event', 'topic');

      broker.on('message.undelivered', (event) => {
        expect(event.content).to.equal('MSG');
        done();
      });

      broker.publish('event', 'test.1', 'MSG', {confirm: true});
    });

    it('topic exchange emits no undelivered event if not confirm', () => {
      const broker = Broker();
      broker.assertExchange('event', 'topic');

      const events = [];
      broker.on('message.undelivered', (event) => {
        events.push(event);
      });

      broker.publish('load', 'test.1', 'MSG');

      expect(events).to.have.length(0);
    });

    it('direct exchange emits no undelivered event if not confirm', () => {
      const broker = Broker();
      broker.assertExchange('load', 'direct');

      const events = [];
      broker.on('message.undelivered', (event) => {
        events.push(event);
      });

      broker.publish('load', 'test.1', 'MSG');

      expect(events).to.have.length(0);
    });

    it('emits ack event when message is acked', (done) => {
      const broker = Broker();
      broker.assertExchange('event');
      broker.assertQueue('event-q');
      broker.bindQueue('event-q', 'event', '#');

      broker.on('message.ack', (event) => {
        expect(event.content).to.equal('MSG');
        done();
      });

      broker.publish('event', 'test.1', 'MSG', {confirm: true});

      const message = broker.get('event-q');
      message.ack();
    });
  });
});
