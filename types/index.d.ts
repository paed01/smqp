declare module 'smqp' {
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
		ack(allUpTo: any): void;
		nack(allUpTo: any, requeue?: boolean): void;
		reject(requeue?: boolean): void;
		_consume(consumerTag: any, consumedCb: any): void;
		[kOnConsumed]: (CallableFunction | null | undefined)[];
		[kPending]: boolean;
	}
	const kPending: unique symbol;
	type SerializedMessage = Pick<Message, "fields" | "content" | "properties">;
	const kOnConsumed: unique symbol;
	export function Shovel(name: any, source: any, destination: any, options: any): Shovel | undefined;
	export class Shovel {
		constructor(name: any, source: any, destination: any, options: any);
		source: any;
		destination: any;
		events: any;
		emit(eventName: any, content: any): void;
		on(eventName: any, handler: any, options: any): any;
		off(eventName: any, handler: any): any;
		close(): void;
		_messageHandler(message: any): any;
		_onShovelMessage(routingKey: any, message: any): any;
		readonly name: string;
		readonly closed: boolean;
		readonly consumerTag: string;
	}
	function Exchange2Exchange(shovel: any): void;
	class Exchange2Exchange {
		constructor(shovel: any);
		on(...args: any[]): any;
		close(): any;
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
	 * Event exchange
	 * @param name optional event exchange name, defaults to smq.ename-<random>
	 */
	function EventExchange(name?: string): ExchangeBase;
	/**
	 * Exchange
	 * @param name name
	 * 
	 */
	function ExchangeBase(name: string, type: exchangeType, options?: ExchangeOptions, eventExchange?: ExchangeBase): void;
	class ExchangeBase {
		/**
		 * Exchange
		 * @param name name
		 * 
		 */
		constructor(name: string, type: exchangeType, options?: ExchangeOptions, eventExchange?: ExchangeBase);
		
		options: ExchangeOptions;
		events: ExchangeBase | undefined;
		publish(routingKey: any, content: any, properties: any): any;
		_onTopicMessage(routingKey: any, message: any): number;
		
		_onDirectMessage(routingKey: string, message: Message): 0 | 1;
		_emitReturn(routingKey: any, content: any, properties: any): void;
		bindQueue(queue: any, pattern: any, bindOptions: any): any;
		unbindQueue(queue: any, pattern: any): void;
		unbindQueueByName(queueName: any): void;
		close(): void;
		getState(): {
			bindings?: {
				id: string;
				options: {
					priority: number;
				};
				queueName: string;
				pattern: string;
			}[] | undefined;
			deliveryQueue?: {
				name: string;
				options: QueueOptions;
				messages?: SerializedMessage[];
			} | undefined;
			name: string;
			type: exchangeType;
			options: {
				[x: string]: any;
				durable?: boolean;
				autoDelete?: boolean;
			};
		};
		stop(): void;
		recover(state: any, getQueue: any): this | undefined;
		getBinding(queueName: any, pattern: any): any;
		emit(eventName: any, content: any): any;
		on(pattern: any, handler: any, consumeOptions: any): any;
		off(pattern: any, handler: any): any;
		closeBinding(binding: any): void;
		readonly name: string;
		readonly type: exchangeType;
		readonly bindingCount: number;
		readonly bindings: Binding[];
		readonly stopped: boolean;
		readonly undeliveredCount: number;
	}
	export class SmqpError extends Error {
		constructor(message: any, code: any);
		type: string;
		code: any;
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
	 * Get routing key pattern
	 * @param pattern routing key pattern
	 * */
	export function getRoutingKeyPattern(pattern: string): RoutingKeyPattern;
	/**
	 * Get routing key pattern
	 */
	type RoutingKeyPattern = {
		/**
		 * function to test routing key pattern
		 */
		test: typeof RegExp.test;
	};
	/**
	 * Smqp message broker
	 * @param owner optional broker owner, forwarded to message consumer
	 */
	export default function Broker_1(owner?: any): Broker_1 | undefined;
	export default class Broker_1 {
		/**
		 * Smqp message broker
		 * @param owner optional broker owner, forwarded to message consumer
		 */
		constructor(owner?: any);
		owner: any;
		events: ExchangeBase;
		/**
		 * Subscribe to exchange via queue
		 * @param exchangeName exhange name
		 * @param pattern routing key pattern
		 * @param queueName queue name
		 * @param onMessage message handlers
		 * @param options optional subscribe options
		 */
		subscribe(exchangeName: string, pattern: string, queueName: string, onMessage: onMessage, options?: SubscribeOptions): any;
		/**
		 * Subscribe to exchange via temporary, non-durable queue
		 * @param exchangeName exchange name
		 * @param pattern routing key pattern
		 * @param onMessage message handler
		 * @param options optional subscribe options
		 */
		subscribeTmp(exchangeName: string, pattern: string, onMessage: onMessage, options?: SubscribeOptions): any;
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
		subscribeOnce(exchangeName: string, pattern: string, onMessage: onMessage, options?: SubscribeOptions): any;
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
		assertExchange(exchangeName: string, type?: exchangeType, options?: ExchangeOptions): any;
		/**
		 * Bind queue to exchange with routing key pattern
		 * @param queueName queue name
		 * @param exchangeName exchange name
		 * @param pattern routing key pattern
		 * @param bindOptions optional binding options
		 */
		bindQueue(queueName: string, exchangeName: string, pattern: string, bindOptions?: BindingOptions): any;
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
		consume(queueName: string, onMessage: onMessage, options?: ConsumeOptions): any;
		/**
		 * Cancel consumer by tag
		 * @param consumerTag consumer tag
		 * @param requeue requeue messages held by the consumer, defaults to true
		 */
		cancel(consumerTag: string, requeue?: boolean): boolean;
		getConsumers(): {
			queue: any;
			consumerTag: any;
			ready: any;
			options: any;
		}[];
		/**
		 * Get consumer by tag
		 * @param consumerTag consumer tag
		 */
		getConsumer(consumerTag: string): any;
		/**
		 * Get exchange by name
		 * @param exchangeName exchange name
		 */
		getExchange(exchangeName: string): any;
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
		 * @param onlyWithContent omit exchanges and queues without content
		 */
		getState(onlyWithContent?: boolean): {
			exchanges: {
				bindings?: {
					id: string;
					options: {
						priority: number;
					};
					queueName: string;
					pattern: string;
				}[] | undefined;
				deliveryQueue?: {
					name: string;
					options: QueueOptions;
					messages?: SerializedMessage[];
				} | undefined;
				name: string;
				type: exchangeType;
				options: {
					[x: string]: any;
					durable?: boolean;
					autoDelete?: boolean;
				};
			}[] | undefined;
			queues: {
				name: string;
				options: QueueOptions;
				messages?: SerializedMessage[];
			}[] | undefined;
		} | undefined;
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
		publish(exchangeName: string, routingKey: string, content?: any, properties?: MessageProperties): any;
		/**
		 * Purge all non-pending messages from queue
		 * @param queueName queue name
		 */
		purgeQueue(queueName: string): any;
		/**
		 * Send content directly to a queue, bypassing exchanges
		 * @param queueName queue name
		 * @param content message content
		 * @param options optional message properties
		 */
		sendToQueue(queueName: string, content: any, options?: MessageProperties): any;
		private _getQueuesState;
		private _getExchangeState;
		/**
		 * Create queue
		 * @param queueName queue name, defaults to a generated name
		 * @param options optional queue options
		 */
		createQueue(queueName?: string, options?: QueueOptions): Queue;
		/**
		 * Get queue by name
		 * @param queueName queue name
		 */
		getQueue(queueName: string): any;
		/**
		 * Assert queue exists, create if absent
		 * @param queueName queue name, defaults to a generated name
		 * @param options optional queue options
		 */
		assertQueue(queueName?: string, options?: QueueOptions): any;
		/**
		 * Delete queue
		 * @param queueName queue name
		 * @param options optional delete guards
		 */
		deleteQueue(queueName: string, options?: DeleteQueueOptions): any;
		/**
		 * Get one message from queue
		 * @param queueName queue name
		 * @param options optional consume options
		 */
		get(queueName: string, options?: ConsumeOptions): any;
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
		 */
		validateConsumerTag(consumerTag: string): any;
		/**
		 * Create shovel between source and destination exchanges
		 * @param name unique shovel name
		 * @param source source spec
		 * @param destination destination spec
		 * @param options optional shovel options
		 */
		createShovel(name: string, source: ShovelSource, destination: ShovelDestination, options?: ShovelOptions): Shovel;
		/**
		 * Close shovel by name
		 * @param name shovel name
		 */
		closeShovel(name: string): boolean;
		/**
		 * Get shovel by name
		 * @param name shovel name
		 */
		getShovel(name: string): any;
		/** List all shovels */
		getShovels(): any[];
		/**
		 * Subscribe to broker event
		 * @param eventName event name pattern
		 * @param callback event callback
		 * @param options optional consume options
		 */
		on(eventName: string, callback: (event: {
			name: string;
		} & Record<string, any>) => void, options?: ConsumeOptions): any;
		/**
		 * Unsubscribe from broker event
		 * @param eventName event name previously passed to on
		 * @param callbackOrObject the callback used in on, or an object with the consumer tag
		 */
		off(eventName: string, callbackOrObject: Function | {
			consumerTag?: string;
		}): void;
		prefetch(): void;
		readonly exchangeCount: number;
		readonly queueCount: number;
		readonly consumerCount: number;
	}
	export function Queue(name: string, options: QueueOptions, eventEmitter: EventExchange): void;
	export class Queue {
		
		constructor(name: string, options: QueueOptions, eventEmitter: EventExchange);
		
		options: QueueOptions;
		
		messages: Message[];
		events: EventExchange;
		_onMessageConsumed: any;
		/**
		 * Enqueue a message
		 * @param fields message fields
		 * @param content message content
		 * @param properties message properties
		 */
		queueMessage(fields: MessageFields, content?: any, properties?: MessageProperties): number | undefined;
		/**
		 * Evict first non-pending message; returns true if it was the supplied message
		 * @param compareMessage message to compare against the evicted one
		 */
		evictFirst(compareMessage?: Message): boolean | undefined;
		_consumeNext(): number | undefined;
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
		assertConsumer(onMessage: onMessage, consumeOptions?: ConsumeOptions, owner?: any): any;
		/**
		 * Get next message from queue
		 * @param options optional consume options
		 */
		get(options?: ConsumeOptions): any;
		private _consumeMessages;
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
		peek(ignoreDelivered?: boolean): Message | undefined;
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
		on(eventName: QueueEventNames | string, handler: Function, options?: ConsumeOptions): any;
		/**
		 * Unsubscribe from a queue event
		 * @param eventName event name previously passed to on
		 * @param handler the handler used in on, or an object with the consumer tag
		 */
		off(eventName: QueueEventNames | string, handler: Function | {
			consumerTag?: string;
		}): any;
		purge(): number;
		private _dequeueMessage;
		getState(): {
			name: string;
			options: QueueOptions;
			messages?: SerializedMessage[];
		};
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
		} | undefined;
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
	export function Consumer(queue: Queue, onMessage: onMessage, options?: ConsumeOptions, owner?: any, eventEmitter?: {
		emit(eventName: string, content?: any): any;
		on(pattern: string, handler: Function): any;
	}): void;
	export class Consumer {
		/**
		 * Queue consumer
		 * @param queue queue this consumer reads from
		 * @param onMessage message handler
		 * @param options consume options
		 * @param owner forwarded to the message handler as the third arg
		 * @param eventEmitter internal queue event bridge
		 */
		constructor(queue: Queue, onMessage: onMessage, options?: ConsumeOptions, owner?: any, eventEmitter?: {
			emit(eventName: string, content?: any): any;
			on(pattern: string, handler: Function): any;
		});
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
		events: {
			emit(eventName: string, content?: any): any;
			on(pattern: string, handler: Function): any;
		} | undefined;
		_push(messages: any): void;
		_consume(): void;
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
		on(eventName: string, handler: Function): any;
		recover(): void;
		stop(): void;
		readonly consumerTag: string;
		readonly ready: boolean;
		readonly stopped: boolean;
		readonly capacity: number;
		readonly messageCount: number;
		readonly queueName: string;
	}
  type onMessage = (routingKey: string, message: Message, owner: any) => void;

  type exchangeType = 'topic' | 'direct';

  interface ConsumeOptions {
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

  interface SubscribeOptions extends ConsumeOptions {
	/** defaults to true, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down */
	autoDelete?: boolean;
	/** defaults to true, makes exchange and queue durable, i.e. will be returned when getting state */
	durable?: boolean;
	/** dead letter exchange */
	deadLetterExchange?: string;
	/** publish dead letter with routing key */
	deadLetterRoutingKey?: string;
  }

  interface QueueOptions {
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

  interface DeleteQueueOptions {
	ifUnused?: boolean;
	ifEmpty?: boolean;
  }

  type QueueEventNames =
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

  interface ExchangeOptions {
	/** makes exchange durable, i.e. will be returned when getting state, defaults to true */
	durable?: boolean;
	/** remove exchange when all bindings are gone, defaults to true */
	autoDelete?: boolean;
	[x: string]: any;
  }

  interface BindingOptions {
	priority?: number;
	[x: string]: any;
  }

  interface BindingState {
	id: string;
	options: BindingOptions;
	queueName: string;
	pattern: string;
  }

  interface QueueState {
	name: string;
	options: QueueOptions;
	messages?: MessageEnvelope[];
  }

  interface ExchangeState {
	name: string;
	type: exchangeType;
	options: ExchangeOptions;
	bindings?: BindingState[];
	/** undelivered message queue */
	deliveryQueue?: QueueState;
  }

  interface BrokerState {
	exchanges?: ExchangeState[];
	queues?: QueueState[];
  }

  interface MessageFields extends Record<string, any> {
	/** published through exchange */
	exchange?: string;
	/** published with routing key, if any */
	routingKey?: string;
	/** identifying the consumer for which the message is destined */
	consumerTag?: string;
	/** message has been redelivered, i.e. nacked or recovered */
	redelivered?: boolean;
  }

  interface MessageProperties extends Record<string, any> {
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

  interface MessageEnvelope {
	fields: MessageFields;
	content?: any;
	properties: MessageProperties;
  }

  interface ShovelOptions {
	cloneMessage?: (message: MessageEnvelope) => MessageEnvelope;
	[x: string]: any;
  }

  interface ShovelSource {
	/** source broker */
	broker: Broker_1;
	/** source exchange name */
	exchange: string;
	pattern?: string;
	priority?: number;
	queue?: string;
	consumerTag?: string;
  }

  interface ShovelDestination {
	/** destination broker */
	broker: Broker_1;
	/** destination exchange */
	exchange: string;
	/** optional destination exchange routing key, defaults to original message's routing key */
	exchangeKey?: string;
	/** optional object with message properties to overwrite when shovelling messages */
	publishProperties?: Record<string, any>;
  }
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
		 */
		getState(): {
			id: string;
			options: {
				priority: number;
			};
			queueName: string;
			pattern: string;
		};
	}

	export {};
}

//# sourceMappingURL=index.d.ts.map