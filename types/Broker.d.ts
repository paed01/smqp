import { Queue, Consumer, queueOptions, onMessage, consumeOptions, deleteQueueOptions } from "./Queue.js";
import { Shovel, ShovelSource, ShovelDestination, shovelOptions } from "./Shovel.js";
import { Message, MessageProperties } from "./Message.js";
import { Exchange, exchangeType, Binding, exchangeOptions, bindingOptions } from "./Exchange.js";

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
  options: {};
}

interface Exchange2Exchange {
  name: string;
  source: string;
  destination: string;
  on(...onargs: any[]): Consumer;
  close(): void;
}

interface BrokerShovelSource {
  exchange: string;
  pattern?: string;
  priority?: number;
  queue?: string;
  consumerTag?: string;
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
  cancel(consumerTag: string, requeue?: boolean): boolean;
  getExchange(exchangeName: string): Exchange | undefined;
  getQueue(queueName: string): Queue | void;
  createQueue(queueName: string, options: any): Queue;
  deleteExchange(exchangeName: string, { ifUnused }?: {
    ifUnused?: boolean;
  }): boolean;
  purgeQueue(queueName: string): number | undefined;
  sendToQueue(queueName: string, content: any, options?: MessageProperties): number;
  deleteQueue(queueName: string, options?: deleteQueueOptions):  { messageCount: number } | boolean | void;
  bindExchange(source: string, destination: string, pattern?: string, options?: shovelOptions): Exchange2Exchange;
  unbindExchange(source: string, destination: string, pattern?: string): boolean;
  createShovel(name: string, source: BrokerShovelSource, destination: ShovelDestination, options?: shovelOptions): Shovel;
  closeShovel(name: string): boolean;
  getShovel(name: string): Shovel | void;
  getShovels(): Shovel[];
  getConsumers(): ConsumerInfo[];
  getConsumer(consumerTag: string): Consumer | undefined;
  stop(): void;
  close(): void;
  getState(onlyWithContent?: boolean): any;
  recover(state: any): Broker;
  publish(exchangeName: string, routingKey: string, content?: any, options?: MessageProperties): number;
  get(queueName: string, { noAck }?: {
    noAck: boolean;
  }): Message | undefined;
  ack(message: Message, allUpTo?: boolean): void;
  ackAll(): void;
  nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
  nackAll(requeue?: boolean): void;
  reject(message: Message, requeue?: boolean): void;
  validateConsumerTag(consumerTag: string): boolean;
  on(eventName: string, callback: CallableFunction, options?: any): Consumer;
  off(eventName: string, callbackOrObject: any): void;
  prefetch(value?: number): void;
  /** DANGER deletes all broker entities and closes broker */
  reset(): void;
}
