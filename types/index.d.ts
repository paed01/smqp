declare module 'smqp' {
  export class ConsumeMessage extends Message {
	fields: Required<MessageFields>;
	properties: MessageProperties;
  }

  export type onMessage = (routingKey: string, message: ConsumeMessage, owner: any) => void;

  /**
   * Minimal event-emitter shape used as the `eventEmitter` argument of `Queue`, `Consumer`, and `Shovel`.
   * `ExchangeBase` and `EventExchange` instances satisfy this structurally; the `Queue` constructor only
   * needs `emit`/`on`/`off`, so this narrows the type away from the full `ExchangeBase` surface.
   */
  export interface ExchangeEventEmitter {
	readonly name: string;
	emit(eventName: string, content?: any): void;
	on(pattern: string, handler: Function, options?: ConsumeOptions): Consumer;
	off(pattern: string, handler: Function): undefined;
  }

  export type exchangeType = 'topic' | 'direct';

  export interface ConsumeOptions {
	/** set to true if there is no need to acknowledge message, message is immediately consumed */
	noAck?: boolean;
	/** unique consumer tag */
	consumerTag?: string;
	/** queue is exclusively consumed */
	exclusive?: boolean;
	/** defaults to 1, number of messages to consume at a time */
	prefetch?: number;
	/** defaults to 0, higher value gets messages first */
	priority?: number;
	[x: string]: any;
  }

  export interface SubscribeOptions extends ConsumeOptions {
	/** defaults to true, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down */
	autoDelete?: boolean;
	/** defaults to true, makes exchange and queue durable, i.e. will be returned when getting state */
	durable?: boolean;
	/** dead letter exchange */
	deadLetterExchange?: string;
	/** publish dead letter with routing key */
	deadLetterRoutingKey?: string;
  }

  export interface QueueOptions {
	/** remove queue when last consumer leaves, defaults to true */
	autoDelete?: boolean;
	/** makes queue durable, i.e. will be returned when getting state */
	durable?: boolean;
	messageTtl?: number;
	maxLength?: number;
	deadLetterExchange?: string;
	deadLetterRoutingKey?: string;
	[x: string]: any;
  }

  export interface DeleteQueueOptions {
	ifUnused?: boolean;
	ifEmpty?: boolean;
  }

  export type QueueEventNames =
	/** consumer was cancelled */
	| 'consumer.cancel'
	/** consumer was added */
	| 'consume'
	/** message was dead-lettered, payload includes `deadLetterExchange` name and message */
	| 'dead-letter'
	/** queue was deleted */
	| 'delete'
	/** queue is depleted */
	| 'depleted'
	/** message was queued */
	| 'message'
	/** queue is ready to receive new messages */
	| 'ready'
	/** queue is saturated, i.e. max capacity was reached */
	| 'saturated';

  export interface ExchangeOptions {
	/** makes exchange durable, i.e. will be returned when getting state, defaults to true */
	durable?: boolean;
	/** remove exchange when all bindings are gone, defaults to true */
	autoDelete?: boolean;
	[x: string]: any;
  }

  export interface BindingOptions {
	priority?: number;
	[x: string]: any;
  }

  export interface BindingState {
	id: string;
	options: BindingOptions;
	queueName: string;
	pattern: string;
  }

  export interface QueueState {
	name: string;
	options: QueueOptions;
	messages?: MessageEnvelope[];
  }

  export interface ConsumerState {
	/** Consuming queue name */
	queue: string;
	consumerTag: string;
	ready: boolean;
	options: ConsumeOptions;
  }

  export interface ExchangeState {
	name: string;
	type: exchangeType;
	options: ExchangeOptions;
	bindings?: BindingState[];
	/** undelivered message queue */
	deliveryQueue?: QueueState;
  }

  export interface BrokerState {
	exchanges?: ExchangeState[];
	queues?: QueueState[];
  }

  export interface QueueStats {
	/** queue name */
	name: string;
	/** total number of messages in queue, including delivered but unacked */
	messageCount: number;
	/** number of delivered but not yet acked/nacked messages */
	unackedCount: number;
	/** number of consumers */
	consumerCount: number;
  }

  export interface BrokerStats {
	/** total number of messages across all queues */
	messageCount: number;
	/** total number of delivered but not yet acked/nacked messages across all queues */
	unackedCount: number;
	/** total number of queue consumers */
	consumerCount: number;
	/** stats per queue */
	queues: QueueStats[];
  }

  export interface MessageFields extends Record<string, any> {
	/** published through exchange */
	exchange?: string;
	/** published with routing key, if any */
	routingKey?: string;
	/** identifying the consumer for which the message is destined */
	consumerTag?: string;
	/** message has been redelivered, i.e. nacked or recovered */
	redelivered?: boolean;
  }

  export interface MessageProperties extends Record<string, any> {
	/** unique identifier for the message */
	messageId?: string;
	/** integer, expire message after milliseconds */
	expiration?: number;
	/** integer, message time to live in milliseconds */
	ttl?: number;
	/** Date.now() when message was sent */
	timestamp?: number;
	/** indicating if message is mandatory. True emits return if not routed to any queue */
	mandatory?: boolean;
	/** persist message, if unset queue option durable prevails */
	persistent?: boolean;
	/** shovel or e2e message source exchange */
	'source-exchange'?: string;
	/** shovel name */
	'shovel-name'?: string;
  }

  export type MessageEnvelope = Pick<ConsumeMessage, 'fields' | 'content' | 'properties'>;

  export interface ShovelOptions {
	cloneMessage?: (message: MessageEnvelope) => Partial<MessageEnvelope>;
	[x: string]: any;
  }

  export interface ShovelSource {
	/** source broker */
	broker: Broker;
	/** source exchange name */
	exchange: string;
	pattern?: string;
	priority?: number;
	queue?: string;
	consumerTag?: string;
  }

  export interface ShovelDestination {
	/** destination broker */
	broker: Broker;
	/** destination exchange */
	exchange: string;
	/** optional destination exchange routing key, defaults to original message's routing key */
	exchangeKey?: string;
	/** optional object with message properties to overwrite when shovelling messages */
	publishProperties?: Record<string, any>;
  }
	export class SmqpError extends Error {
		/**
		 * @param message Error message
		 * @param code Error code
		 */
		constructor(message: string, code: string);
		type: string;
		code: string;
	}
	export const ERR_CONSUMER_TAG_CONFLICT: "ERR_SMQP_CONSUMER_TAG_CONFLICT";
	export const ERR_EXCHANGE_TYPE_MISMATCH: "ERR_SMQP_EXCHANGE_TYPE_MISMATCH";
	export const ERR_EXCLUSIVE_CONFLICT: "ERR_SMQP_EXCLUSIVE_CONFLICT";
	export const ERR_EXCLUSIVE_NOT_ALLOWED: "ERR_SMQP_EXCLUSIVE_NOT_ALLOWED";
	export const ERR_QUEUE_DURABLE_MISMATCH: "ERR_SMQP_QUEUE_DURABLE_MISMATCH";
	export const ERR_QUEUE_NAME_CONFLICT: "ERR_SMQP_QUEUE_NAME_CONFLICT";
	export const ERR_QUEUE_NOT_FOUND: "ERR_SMQP_QUEUE_NOT_FOUND";
	export const ERR_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND: "ERR_SMQP_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND";
	export const ERR_SHOVEL_NAME_CONFLICT: "ERR_SMQP_SHOVEL_NAME_CONFLICT";
	export const ERR_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND: "ERR_SMQP_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND";
	/**
	 * Smqp message broker
	 * @param owner optional broker owner, forwarded to message consumer
	 */
	export function Broker(owner?: any): Broker;
	export class Broker {
		/**
		 * Smqp message broker
		 * @param owner optional broker owner, forwarded to message consumer
		 */
		constructor(owner?: any);
		owner: any;
		events: ExchangeEventEmitter;
		/**
		 * Subscribe to exchange via queue
		 * @param exchangeName exhange name
		 * @param pattern routing key pattern
		 * @param queueName queue name
		 * @param onMessage message handlers
		 * @param options optional subscribe options
		 */
		subscribe(exchangeName: string, pattern: string, queueName: string, onMessage: onMessage, options?: SubscribeOptions): Consumer;
		/**
		 * Subscribe to exchange via temporary, non-durable queue
		 * @param exchangeName exchange name
		 * @param pattern routing key pattern
		 * @param onMessage message handler
		 * @param options optional subscribe options
		 */
		subscribeTmp(exchangeName: string, pattern: string, onMessage: onMessage, options?: SubscribeOptions): Consumer;
		/**
		 * Subscribe once to first matching message, then auto-cancel.
		 *
		 * Only `consumerTag` and `priority` from `options` are honored. `noAck`, `autoDelete`,
		 * and `durable` are forced internally; queue-lifecycle and dead-letter options are ignored
		 * because the temporary queue is deleted after the first delivery.
		 *
		 * @param exchangeName exchange name
		 * @param pattern routing key pattern
		 * @param onMessage message handler
		 * @param options optional subscribe options
		 */
		subscribeOnce(exchangeName: string, pattern: string, onMessage: onMessage, options?: SubscribeOptions): Consumer;
		/**
		 * Cancel consumer matching queue + handler
		 * @param queueName queue name
		 * @param onMessage handler previously passed to subscribe
		 */
		unsubscribe(queueName: string, onMessage: onMessage): void;
		/**
		 * Assert exchange exists, create if absent
		 * @param exchangeName exchange name
		 * @param type exchange type, defaults to topic
		 * @param options optional exchange options
		 */
		assertExchange(exchangeName: string, type?: exchangeType, options?: ExchangeOptions): ExchangeBase;
		/**
		 * Bind queue to exchange with routing key pattern
		 * @param queueName queue name
		 * @param exchangeName exchange name
		 * @param pattern routing key pattern
		 * @param bindOptions optional binding options
		 */
		bindQueue(queueName: string, exchangeName: string, pattern: string, bindOptions?: BindingOptions): Binding;
		/**
		 * Unbind queue from exchange
		 * @param queueName queue name
		 * @param exchangeName exchange name
		 * @param pattern routing key pattern
		 */
		unbindQueue(queueName: string, exchangeName: string, pattern: string): void;
		/**
		 * Add consumer to queue
		 * @param queueName queue name
		 * @param onMessage message handler
		 * @param options optional consume options
		 */
		consume(queueName: string, onMessage: onMessage, options?: ConsumeOptions): Consumer;
		/**
		 * Cancel consumer by tag
		 * @param consumerTag consumer tag
		 * @param requeue requeue messages held by the consumer, defaults to true
		 */
		cancel(consumerTag: string, requeue?: boolean): boolean;
		/** List all consumers as serializable projections */
		getConsumers(): ConsumerState[];
		/**
		 * Get consumer by tag
		 * @param consumerTag consumer tag
		 * */
		getConsumer(consumerTag: string): Consumer | undefined;
		/**
		 * Get exchange by name
		 * @param exchangeName exchange name
		 * */
		getExchange(exchangeName: string): ExchangeBase;
		/**
		 * Delete exchange
		 * @param exchangeName exchange name
		 * @param options only delete if no bindings remain
		 */
		deleteExchange(exchangeName: string, options?: {
			ifUnused?: boolean;
		}): boolean;
		/**
		 * Stop broker with corresponding exchanges and queues, entities remain but does not accepts messages
		 */
		stop(): void;
		/**
		 * Close and clean-up all entities
		 */
		close(): void;
		/**
		 * Danger! Resets all entities, stop, close and delete
		 */
		reset(): void;
		/**
		 * Get broker state for persistence
		 * */
		getState(): BrokerState;
		/**
		 * Get broker state for persistence
		 * */
		getState(onlyWithContent: true): BrokerState | undefined;
		/**
		 * Get broker state for persistence
		 * */
		getState(onlyWithContent: false): BrokerState;
		/**
		 * Recover broker from previously captured state
		 * @param state broker state, omit to recover stopped entities in place
		 */
		recover(state?: BrokerState): this;
		/**
		 * Bind one exchange to another via internal shovel
		 * @param source source exchange name
		 * @param destination destination exchange name
		 * @param pattern routing key pattern, defaults to #
		 * @param args optional shovel options
		 */
		bindExchange(source: string, destination: string, pattern?: string, args?: ShovelOptions): Exchange2Exchange;
		/**
		 * Unbind exchange-to-exchange shovel
		 * @param source source exchange name
		 * @param destination destination exchange name
		 * @param pattern routing key pattern, defaults to #
		 */
		unbindExchange(source: string, destination: string, pattern?: string): boolean;
		/**
		 * Publish a message to an exchange
		 * @param exchangeName exchange name
		 * @param routingKey routing key
		 * @param content message content
		 * @param properties optional message properties
		 */
		publish(exchangeName: string, routingKey: string, content?: any, properties?: MessageProperties): number;
		/**
		 * Get broker statistics on demand, totals across all queues plus stats per queue
		 * */
		getStats(): BrokerStats;
		/**
		 * Purge all non-pending messages from queue
		 * @param queueName queue name
		 */
		purgeQueue(queueName: string): number;
		/**
		 * Evict expired undelivered messages from one or all queues
		 * @param queueName queue name, evicts from all queues if omitted
		 * @returns number of evicted messages
		 */
		evictExpired(queueName?: string): number;
		/**
		 * Send content directly to a queue, bypassing exchanges. The message routing key is an empty string
		 * @param queueName queue name
		 * @param content message content
		 * @param options optional message properties
		 */
		sendToQueue(queueName: string, content: any, options?: MessageProperties): number;
		private _getQueuesState;
		private _getExchangeState;
		/**
		 * Create queue
		 * @param queueName queue name, defaults to a generated name
		 * @param options optional queue options
		 */
		createQueue(queueName?: string | null | undefined, options?: QueueOptions): Queue;
		/**
		 * Get queue by name
		 * @param queueName queue name
		 * */
		getQueue(queueName: string): Queue | undefined;
		/**
		 * Assert queue exists, create if absent
		 * @param queueName queue name, defaults to a generated name
		 * @param options optional queue options
		 */
		assertQueue(queueName?: string, options?: QueueOptions): Queue;
		/**
		 * Delete queue
		 * @param queueName queue name
		 * @param options optional delete guards
		 */
		deleteQueue(queueName: string, options?: DeleteQueueOptions): {
			messageCount: number;
		};
		/**
		 * Get one message from queue
		 * @param queueName queue name
		 * @param options optional consume options
		 */
		get(queueName: string, options?: ConsumeOptions): ConsumeMessage;
		/**
		 * Acknowledge message
		 * @param message message to ack
		 * @param allUpTo ack all messages up to and including this one
		 */
		ack(message: Message, allUpTo?: boolean): void;
		/** Acknowledge all outstanding messages across all queues */
		ackAll(): void;
		/**
		 * Reject message
		 * @param message message to nack
		 * @param allUpTo nack all messages up to and including this one
		 * @param requeue requeue nacked messages, defaults to true
		 */
		nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
		/**
		 * Reject all outstanding messages across all queues
		 * @param requeue requeue nacked messages, defaults to true
		 */
		nackAll(requeue?: boolean): void;
		/**
		 * Reject message
		 * @param message message to reject
		 * @param requeue requeue rejected message, defaults to true
		 */
		reject(message: Message, requeue?: boolean): void;
		/**
		 * Validate that a consumer tag is unused; throws if occupied
		 * @param consumerTag consumer tag to validate
		 * @returns is consumer tag available
		 */
		validateConsumerTag(consumerTag: string): boolean;
		/**
		 * Create shovel between source and destination exchanges
		 * @param name unique shovel name
		 * @param source source spec; the source broker is this broker
		 * @param destination destination spec
		 * @param options optional shovel options
		 */
		createShovel(name: string, source: Omit<ShovelSource, "broker">, destination: ShovelDestination, options?: ShovelOptions): Shovel;
		/**
		 * Close shovel by name
		 * @param name shovel name
		 */
		closeShovel(name: string): boolean;
		/**
		 * Get shovel by name
		 * @param name shovel name
		 * */
		getShovel(name: string): Shovel | undefined;
		/**
		 * List all shovels
		 * */
		getShovels(): Shovel[];
		/**
		 * Subscribe to broker event
		 * @param eventName event name pattern
		 * @param callback event callback
		 * @param options optional consume options
		 */
		on(eventName: string, callback: (event: {
			name: string;
		} & Record<string, any>) => void, options?: ConsumeOptions): Consumer;
		/**
		 * Unsubscribe from broker event
		 * @param eventName event name previously passed to on
		 * @param callbackOrObject the callback used in on, or an object with the consumer tag
		 * */
		off(eventName: string, callbackOrObject: Function | {
			consumerTag?: string;
		}): undefined;
		prefetch(): void;
		readonly exchangeCount: number;
		readonly queueCount: number;
		readonly consumerCount: number;
	}
	/**
	 * What it is all about - message
	 * 
	 */
	export function Message(fields: MessageFields, content?: any, properties?: MessageProperties, onConsumed?: CallableFunction): void;
	export class Message {
		/**
		 * What it is all about - message
		 * 
		 */
		constructor(fields: MessageFields, content?: any, properties?: MessageProperties, onConsumed?: CallableFunction);
		/**
		 * Message fields
		 * */
		fields: MessageFields;
		/**
		 * Message content
		 * */
		content: any;
		/**
		 * Message properties
		 * */
		properties: MessageProperties;
		get pending(): boolean;
		/**
		 * Acknowledge message
		 * @param allUpTo all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged. Defaults to false
		 */
		ack(allUpTo?: boolean): void;
		/**
		 * Reject message
		 * @param allUpTo all outstanding messages prior to and including the given message shall be considered rejected. If false, or omitted, only the message supplied is rejected. Defaults to false
		 * @param requeue put the message or messages back on the queue, defaults to true
		 */
		nack(allUpTo?: boolean, requeue?: boolean): void;
		/**
		 * Reject message
		 * @param requeue put the message back on the queue, defaults to true
		 */
		reject(requeue?: boolean): void;
		private _consume;
		private _clearPending;
	}
	/**
	 * Queue
	 * @param name optional, but recommended queue name, defaults to `smq.qname-<random>`
	 * @param options queue options
	 * @param eventEmitter optional event emitter
	 */
	export function Queue(name?: string, options?: QueueOptions, eventEmitter?: ExchangeEventEmitter): void;
	export class Queue {
		/**
		 * Queue
		 * @param name optional, but recommended queue name, defaults to `smq.qname-<random>`
		 * @param options queue options
		 * @param eventEmitter optional event emitter
		 */
		constructor(name?: string, options?: QueueOptions, eventEmitter?: ExchangeEventEmitter);
		
		options: QueueOptions;
		
		messages: Message[];
		events: ExchangeEventEmitter;
		/**
		 * Enqueue a message
		 * @param fields message fields
		 * @param content message content
		 * @param properties message properties
		 */
		queueMessage(fields: MessageFields, content?: any, properties?: MessageProperties): number;
		/**
		 * Evict first non-pending message; returns true if it was the supplied message
		 * @param compareMessage message to compare against the evicted one
		 */
		evictFirst(compareMessage?: Message): boolean;
		private _consumeNext;
		/**
		 * Add a consumer
		 * @param onMessage message handler
		 * @param consumeOptions optional consume options
		 * @param owner forwarded to the message handler as the third arg
		 */
		consume(onMessage: onMessage, consumeOptions?: ConsumeOptions, owner?: any): Consumer;
		/**
		 * Assert consumer matching handler + options exists, create if absent
		 * @param onMessage message handler
		 * @param consumeOptions optional consume options
		 * @param owner forwarded to the message handler as the third arg
		 */
		assertConsumer(onMessage: onMessage, consumeOptions?: ConsumeOptions, owner?: any): Consumer;
		/**
		 * Get next message from queue
		 * @param options optional consume options
		 * */
		get(options?: ConsumeOptions): ConsumeMessage | undefined;
		private _consumeMessages;
		/**
		 * Evict expired undelivered messages, dead-lettering them if the queue has a dead letter exchange
		 * @returns number of evicted messages
		 */
		evictExpired(): number;
		private _evict;
		/**
		 * Acknowledge message
		 * @param message message to ack
		 * @param allUpTo ack all messages up to and including this one
		 */
		ack(message: Message, allUpTo?: boolean): void;
		/**
		 * Reject message
		 * @param message message to nack
		 * @param allUpTo nack all messages up to and including this one
		 * @param requeue requeue nacked message(s), defaults to true
		 */
		nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
		/**
		 * Reject message
		 * @param message message to reject
		 * @param requeue requeue rejected message, defaults to true
		 */
		reject(message: Message, requeue?: boolean): void;
		ackAll(): void;
		/**
		 * Reject all pending messages
		 * @param requeue requeue nacked messages, defaults to true
		 */
		nackAll(requeue?: boolean): void;
		private _getPendingMessages;
		/**
		 * Peek at the next message without consuming it
		 * @param ignoreDelivered skip pending messages
		 */
		peek(ignoreDelivered?: boolean): Message;
		/**
		 * Cancel consumer by tag
		 * @param consumerTag consumer tag
		 * @param requeue requeue messages held by the consumer, defaults to true
		 */
		cancel(consumerTag: string, requeue?: boolean): boolean;
		/**
		 * Cancel consumer matching the given handler
		 * @param onMessage handler previously passed to consume
		 * @param requeue requeue messages held by the consumer, defaults to true
		 */
		dismiss(onMessage: onMessage, requeue?: boolean): void;
		/**
		 * Unbind consumer from queue
		 * @param consumer consumer to unbind
		 * @param requeue requeue messages held by the consumer, defaults to true
		 */
		unbindConsumer(consumer: Consumer, requeue?: boolean): void;
		/**
		 * Emit a queue event
		 * @param eventName event name (without `queue.` prefix)
		 * @param content event payload
		 */
		emit(eventName: string, content?: any): void;
		/**
		 * Subscribe to a queue event
		 * @param eventName event name (without `queue.` prefix); accepts known names or a routing pattern
		 * @param handler event handler
		 * @param options optional consume options
		 */
		on(eventName: QueueEventNames | string, handler: Function, options?: ConsumeOptions): Consumer;
		/**
		 * Unsubscribe from a queue event
		 * @param eventName event name previously passed to on
		 * @param handler the handler used in on, or an object with the consumer tag
		 */
		off(eventName: QueueEventNames | string, handler: Function | {
			consumerTag?: string;
		}): undefined;
		purge(): number;
		private _dequeueMessage;
		/**
		 * Get queue statistics on demand
		 * */
		getStats(): QueueStats;
		/**
		 * Snapshot queue state
		 * */
		getState(): QueueState;
		/**
		 * Recover queue from previously captured state
		 * @param state queue state, omit to recover stopped queue in place
		 */
		recover(state?: QueueState): this;
		/**
		 * Delete queue
		 * @param options optional delete guards
		 */
		delete(options?: DeleteQueueOptions): {
			messageCount: number;
		};
		close(): void;
		stop(): void;
		private _getCapacity;
		readonly name: string;
		readonly consumerCount: number;
		readonly consumers: Consumer[];
		readonly exclusive: boolean;
		readonly messageCount: number;
		readonly stopped: boolean;
	}
	/**
	 * Queue consumer
	 * @param queue queue this consumer reads from
	 * @param onMessage message handler
	 * @param options consume options
	 * @param owner forwarded to the message handler as the third arg
	 * @param eventEmitter internal queue event bridge
	 */
	export function Consumer(queue: Queue, onMessage: onMessage, options?: ConsumeOptions, owner?: any, eventEmitter?: ExchangeEventEmitter): void;
	export class Consumer {
		/**
		 * Queue consumer
		 * @param queue queue this consumer reads from
		 * @param onMessage message handler
		 * @param options consume options
		 * @param owner forwarded to the message handler as the third arg
		 * @param eventEmitter internal queue event bridge
		 */
		constructor(queue: Queue, onMessage: onMessage, options?: ConsumeOptions, owner?: any, eventEmitter?: ExchangeEventEmitter);
		options: {
			noAck: boolean;
			consumerTag?: string;
			exclusive?: boolean;
			prefetch: number;
			priority: number;
		};
		queue: Queue;
		onMessage: onMessage;
		owner: any;
		events: ExchangeEventEmitter;
		/**
		 * Project consumer state for serialization (used by `Broker.getConsumers` and `JSON.stringify`)
		 * */
		toJSON(): ConsumerState;
		private _push;
		private _consume;
		/**
		 * Reject all messages held by this consumer
		 * @param requeue requeue nacked messages, defaults to true
		 */
		nackAll(requeue?: boolean): void;
		/** Acknowledge all messages held by this consumer */
		ackAll(): void;
		/**
		 * Cancel consumer
		 * @param requeue requeue messages held by the consumer, defaults to true
		 */
		cancel(requeue?: boolean): void;
		/**
		 * Set consumer prefetch count
		 * @param value new prefetch count
		 */
		prefetch(value: number): void;
		/**
		 * Emit consumer event
		 * @param eventName event name (without `consumer.` prefix)
		 * @param content event payload
		 */
		emit(eventName: string, content?: any): void;
		/**
		 * Subscribe to consumer event
		 * @param eventName event name (without `consumer.` prefix)
		 * @param handler event handler
		 */
		on(eventName: string, handler: Function): Consumer;
		recover(): void;
		stop(): void;
		readonly consumerTag: string;
		readonly ready: boolean;
		readonly stopped: boolean;
		readonly capacity: number;
		readonly messageCount: number;
		readonly queueName: string;
	}
	/**
	 * Shovel — pipe messages from a source exchange to a destination exchange
	 * @param name unique shovel name
	 * @param source source spec
	 * @param destination destination spec
	 * @param options optional shovel options
	 */
	export function Shovel(name: string, source: ShovelSource, destination: ShovelDestination, options?: ShovelOptions): Shovel;
	export class Shovel {
		/**
		 * Shovel — pipe messages from a source exchange to a destination exchange
		 * @param name unique shovel name
		 * @param source source spec
		 * @param destination destination spec
		 * @param options optional shovel options
		 */
		constructor(name: string, source: ShovelSource, destination: ShovelDestination, options?: ShovelOptions);
		source: {
			pattern: string;
			broker: Broker;
			exchange: string;
			priority?: number;
			queue?: string;
			consumerTag?: string;
		};
		destination: {
			broker: Broker;
			exchange: string;
			exchangeKey?: string;
			publishProperties?: Record<string, any>;
		};
		
		events: ExchangeEventEmitter;
		/**
		 * Emit shovel event
		 * @param eventName event name (without `shovel.` prefix)
		 * @param content event payload
		 */
		emit(eventName: string, content?: any): void;
		/**
		 * Subscribe to shovel event
		 * @param eventName event name (without `shovel.` prefix)
		 * @param handler event handler
		 * @param options optional consume options
		 */
		on(eventName: string, handler: Function, options?: ConsumeOptions): Consumer;
		/**
		 * Unsubscribe from shovel event
		 * @param eventName event name previously passed to on
		 * @param handler the handler used in on, or an object with the consumer tag
		 */
		off(eventName: string, handler: Function | {
			consumerTag?: string;
		}): undefined;
		/** Close shovel and cancel its source consumer */
		close(): void;
		private _messageHandler;
		private _onShovelMessage;
		readonly name: string;
		readonly closed: boolean;
		readonly consumerTag: string;
	}
	/**
	 * Exchange-to-exchange shovel wrapper, returned by `broker.bindExchange`
	 * @param shovel underlying shovel
	 */
	function Exchange2Exchange(shovel: Shovel): void;
	class Exchange2Exchange {
		/**
		 * Exchange-to-exchange shovel wrapper, returned by `broker.bindExchange`
		 * @param shovel underlying shovel
		 */
		constructor(shovel: Shovel);
		/**
		 * Subscribe to underlying shovel events
		 * @param eventName event name (without `shovel.` prefix)
		 * @param handler event handler
		 * */
		on(eventName: string, handler: Function): Consumer;
		/** Close the underlying shovel */
		close(): void;
		readonly name: string;
		readonly source: string;
		readonly destination: string;
		readonly pattern: string;
		readonly queue: string;
		readonly consumerTag: string;
	}
	/**
	 * Exchange
	 * @param name required exchange name
	 * @param type optional type, defaults to topic
	 * @param options optional exchange options
	 */
	export function Exchange(name: string, type?: exchangeType, options?: ExchangeOptions): ExchangeBase;
	/**
	 * Exchange
	 * @param name name
	 * 
	 */
	function ExchangeBase(name: string, type: exchangeType, options?: ExchangeOptions, eventExchange?: ExchangeEventEmitter): void;
	class ExchangeBase {
		/**
		 * Exchange
		 * @param name name
		 * 
		 */
		constructor(name: string, type: exchangeType, options?: ExchangeOptions, eventExchange?: ExchangeEventEmitter);
		
		options: ExchangeOptions;
		
		events: ExchangeEventEmitter;
		/**
		 * Publish a message through the exchange
		 * @param routingKey routing key
		 * @param content message content
		 * @param properties optional message properties
		 * @returns number of consumed messages
		 */
		publish(routingKey: string, content?: any, properties?: MessageProperties): number | undefined;
		private _onTopicMessage;
		private _onDirectMessage;
		private _emitReturn;
		/**
		 * Bind a queue to this exchange with a routing key pattern
		 * @param queue queue to bind
		 * @param pattern routing key pattern
		 * @param bindOptions optional binding options
		 * */
		bindQueue(queue: Queue, pattern: string, bindOptions?: BindingOptions): Binding;
		/**
		 * Unbind a queue from this exchange
		 * @param queue queue previously bound
		 * @param pattern routing key pattern
		 */
		unbindQueue(queue: Queue, pattern: string): void;
		/**
		 * Unbind every binding pointing at the named queue
		 * @param queueName queue name
		 */
		unbindQueueByName(queueName: string): void;
		close(): void;
		/**
		 * Get state
		 * */
		getState(): ExchangeState;
		stop(): void;
		/**
		 * Recover exchange from previously captured state
		 * @param state exchange state, omit to recover stopped exchange in place
		 * @param getQueue callback to resolve a queue by name (used during binding restore)
		 */
		recover(state?: ExchangeState, getQueue?: (name: string) => Queue): this;
		/**
		 * Find a binding by queue name and pattern
		 * @param queueName queue name
		 * @param pattern routing key pattern
		 * */
		getBinding(queueName: string, pattern: string): Binding;
		/**
		 * Emit an exchange event (or, if no event sub-exchange, publish on the exchange itself)
		 * @param eventName event name (without `exchange.` prefix)
		 * @param content event payload
		 * */
		emit(eventName: string, content?: any): void;
		/**
		 * Subscribe to an exchange event
		 * @param pattern event name pattern (without `exchange.` prefix)
		 * @param handler event handler
		 * @param consumeOptions optional consume options
		 * */
		on(pattern: string, handler: onMessage, consumeOptions?: ConsumeOptions): Consumer;
		/**
		 * Unsubscribe from an exchange event
		 * @param pattern event name pattern previously passed to on
		 * @param handler the handler used in on, or an object with the consumer tag
		 * */
		off(pattern: string, handler: onMessage | {
			consumerTag?: string;
		}): undefined;
		/**
		 * Remove a single binding from this exchange
		 * @param binding binding to close
		 */
		closeBinding(binding: Binding): void;
		readonly name: string;
		readonly type: exchangeType;
		readonly bindingCount: number;
		readonly bindings: Binding[];
		readonly stopped: boolean;
		readonly undeliveredCount: number;
	}
	/**
	 * Get routing key pattern
	 * @param pattern routing key pattern
	 * */
	export function getRoutingKeyPattern(pattern: string): RoutingKeyPattern;
	/**
	 * Get routing key pattern
	 */
	type RoutingKeyPattern = {
		/**
		 * method to test a routing key against the pattern; receiver-bound — destructuring is unsupported
		 */
		test: (this: RoutingKeyPattern, routingKey: string) => boolean;
	};
	/**
	 *
	 * @param pattern message routing key pattern
	 * 
	 */
	function Binding(exchange: ExchangeBase, queue: Queue, pattern: string, bindOptions?: BindingOptions): void;
	class Binding {
		/**
		 *
		 * @param pattern message routing key pattern
		 * 
		 */
		constructor(exchange: ExchangeBase, queue: Queue, pattern: string, bindOptions?: BindingOptions);
		id: string;
		options: {
			priority: number;
		};
		pattern: string;
		exchange: ExchangeBase;
		queue: Queue;
		
		_compiledPattern: {
			test(routingKey: string): boolean;
		};
		/**
		 * Test routing key against pattern
		 * @param routingKey message routing key
		 */
		testPattern(routingKey: string): boolean;
		/**
		 * Close binding
		 */
		close(): void;
		/**
		 * Get binding state
		 * */
		getState(): BindingState;
	}

	export {};
}

//# sourceMappingURL=index.d.ts.map