export type onMessage = (routingKey: string, message: import('../src/Message.js').Message, owner: any) => void;

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

export interface MessageEnvelope {
  fields: MessageFields;
  content?: any;
  properties: MessageProperties;
}

export interface ShovelOptions {
  cloneMessage?: (message: MessageEnvelope) => MessageEnvelope;
  [x: string]: any;
}

export interface ShovelSource {
  /** source broker */
  broker: import('../src/Broker.js').Broker;
  /** source exchange name */
  exchange: string;
  pattern?: string;
  priority?: number;
  queue?: string;
  consumerTag?: string;
}

export interface ShovelDestination {
  /** destination broker */
  broker: import('../src/Broker.js').Broker;
  /** destination exchange */
  exchange: string;
  /** optional destination exchange routing key, defaults to original message's routing key */
  exchangeKey?: string;
  /** optional object with message properties to overwrite when shovelling messages */
  publishProperties?: Record<string, any>;
}

declare module '../src/Broker.js' {
  interface Broker {
    readonly exchangeCount: number;
    readonly queueCount: number;
    readonly consumerCount: number;
  }
}

declare module '../src/Exchange.js' {
  interface ExchangeBase {
    readonly name: string;
    readonly type: import('#types').exchangeType;
    readonly bindingCount: number;
    readonly bindings: import('../src/Binding.js').Binding[];
    readonly stopped: boolean;
    readonly undeliveredCount: number;
  }
}

declare module '../src/Queue.js' {
  interface Queue {
    readonly name: string;
    readonly consumerCount: number;
    readonly consumers: Consumer[];
    readonly exclusive: boolean;
    readonly messageCount: number;
    readonly stopped: boolean;
  }
  interface Consumer {
    readonly consumerTag: string;
    readonly ready: boolean;
    readonly stopped: boolean;
    readonly capacity: number;
    readonly messageCount: number;
    readonly queueName: string;
  }
}

declare module '../src/Shovel.js' {
  interface Shovel {
    readonly name: string;
    readonly closed: boolean;
    readonly consumerTag: string;
  }
  interface Exchange2Exchange {
    readonly name: string;
    readonly source: string;
    readonly destination: string;
    readonly pattern: string;
    readonly queue: string;
    readonly consumerTag: string;
  }
}
