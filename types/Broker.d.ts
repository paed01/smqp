import { Queue, Consumer, queueOptions, onMessage, consumeOptions, deleteQueueOptions, QueueState } from "./Queue.js";
import { Shovel, Exchange2Exchange, ShovelDestination, shovelOptions } from "./Shovel.js";
import { Message, MessageProperties } from "./Message.js";
import { Exchange, exchangeType, Binding, exchangeOptions, bindingOptions, ExchangeState } from "./Exchange.js";

type subscribeOptions = {
  /** defaults to true, exchange will be deleted when all bindings are removed; the queue will be removed when all consumers are down */
  autoDelete?: boolean,
  /** defaults to true, makes exchange and queue durable, i.e. will be returned when getting state */
  durable?: boolean,
  /** unique consumer tag */
  consumerTag?: string,
  /** dead letter exchange */
  deadLetterExchange?: string,
  /** publish dead letter with routing key */
  deadLetterRoutingKey?: string;
  /** queue is exclusively consumed */
  exclusive?: boolean,
  /** set to true if there is no need to acknowledge message */
  noAck?: boolean,
  /** defaults to 1, number of messages to consume at a time */
  prefetch?: number,
  /** defaults to 0, higher value gets messages first */
  priority?: number,
  [x: string]: any,
};

interface ConsumerInfo {
  queue: string;
  consumerTag: string;
  ready: boolean;
  options: consumeOptions;
}

interface BrokerShovelSource {
  exchange: string;
  pattern?: string;
  priority?: number;
  queue?: string;
  consumerTag?: string;
}

export interface BrokerState {
  exchanges?: ExchangeState[];
  queues?: QueueState[];
}

export function Broker(owner?: any): Broker;
export class Broker {
  constructor(owner?: any);
  owner: any;
  get exchangeCount(): number;
  get queueCount(): number;
  get consumerCount(): number;
  subscribe(exchangeName: string, pattern: string, queueName: string, onMessage: onMessage, options?: subscribeOptions): Consumer;
  subscribeTmp(exchangeName: string, pattern: string, onMessage: onMessage, options?: subscribeOptions): Consumer;
  subscribeOnce(exchangeName: string, pattern: string, onMessage: onMessage, options?: subscribeOptions): Consumer;
  unsubscribe(queueName: string, onMessage: onMessage): void;
  assertExchange(exchangeName: string, type?: exchangeType, options?: exchangeOptions): Exchange;
  assertQueue(queueName: string, options?: queueOptions): Queue;
  bindQueue(queueName: string, exchangeName: string, pattern: string, bindOptions?: bindingOptions): Binding;
  unbindQueue(queueName: string, exchangeName: string, pattern: string): void;
  consume(queueName: string, onMessage: onMessage, options?: consumeOptions): Consumer;
  /**
   * Cancel consumer
   * @param consumerTag Consumer tag
   * @param requeue optional boolean to requeue messages consumed by consumer, defaults to true
   * @returns true if found, false if not
   */
  cancel(consumerTag: string, requeue?: boolean): boolean;
  getExchange(exchangeName: string): Exchange;
  getQueue(queueName: string): Queue;
  createQueue(queueName: string, options: any): Queue;
  deleteExchange(exchangeName: string, { ifUnused }?: {
    ifUnused?: boolean;
  }): boolean;
  purgeQueue(queueName: string): number;
  sendToQueue(queueName: string, content: any, options?: MessageProperties): number;
  deleteQueue(queueName: string, options?: deleteQueueOptions):  { messageCount: number };
  bindExchange(source: string, destination: string, pattern?: string, options?: shovelOptions): Exchange2Exchange;
  unbindExchange(source: string, destination: string, pattern?: string): boolean;
  createShovel(name: string, source: BrokerShovelSource, destination: ShovelDestination, options?: shovelOptions): Shovel;
  closeShovel(name: string): boolean;
  getShovel(name: string): Shovel;
  getShovels(): Shovel[];
  getConsumers(): ConsumerInfo[];
  getConsumer(consumerTag: string): Consumer;
  stop(): void;
  close(): void;
  /**
   * Get broker state with durable entities
   */
  getState(): BrokerState;
  /**
   * Get broker state with durable entities
   * @param {boolean} onlyWithContent only return state if any durable exchanges or queues that have messages
   */
  getState(onlyWithContent: boolean): BrokerState | undefined;
  recover(state?: BrokerState): Broker;
  publish(exchangeName: string, routingKey: string, content?: any, options?: MessageProperties): number;
  get(queueName: string, { noAck }?: {
    noAck: boolean;
  }): Message | undefined;
  ack(message: Message, allUpTo?: boolean): void;
  ackAll(): void;
  nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
  nackAll(requeue?: boolean): void;
  reject(message: Message, requeue?: boolean): void;
  /**
   * Check if consumer tag is occupied
   * @param consumerTag
   * @returns {boolean} true if not occupied, throws SmqpError if it is
   */
  validateConsumerTag(consumerTag: string): boolean;
  /**
   * Listen broker for events
   * @param eventName event name, e.g. return for undelivered messages, a routing key pattern can be used, e.g. queue.# for all queue events
   * @param callback event handler function
   * @param options consume options, consumerTag is probably the most usable option, noAck is ignored and always true
   */
  on(eventName: string, callback: CallableFunction, options?: consumeOptions): Consumer;
  off(eventName: string, callbackOrObject: CallableFunction | consumeOptions): void;
  prefetch(value?: number): void;
  /** DANGER deletes all broker entities and closes broker */
  reset(): void;
}
