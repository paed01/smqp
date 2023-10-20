import { Message, MessageFields, MessageProperties, MessageMessage } from './Message.js';

type onMessage = (
  routingKey: string,
  message: Message,
  owner: any
) => void

type queueOptions = {
  autoDelete?: boolean;
  durable?: boolean;
  messageTtl?: number;
  maxLength?: number;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  [x: string]: any;
};

type consumeOptions = {
  noAck?: boolean;
  consumerTag?: string;
  exclusive?: boolean;
  prefetch?: number;
  priority?: number;
  [x: string]: any;
};

type deleteQueueOptions = {
  ifUnused?: boolean;
  ifEmpty?: boolean;
}

export interface QueueState {
  name: string;
  options: queueOptions;
  messages?: MessageMessage[];
}

export const enum QueueEventNames {
  /** Consumer was cancelled */
  QueueConsumerCancel = 'consumer.cancel',
  /** Consumer was added */
  QueueConsume = 'consume',
  /** Message was dead-lettered, sends deadLetterExchange name and message */
  QueueDeadLetter = 'dead-letter',
  /** Queue was deleted */
  QueueDelete = 'delete',
  /** Queue is depleted */
  QueueDepleted = 'depleted',
  /** Message was queued */
  QueueMessage = 'message',
  /** Queue is ready to receive new messages */
  QueueReady = 'ready',
  /** Queue is saturated, i.e. max capacity was reached */
  QueueSaturated = 'saturated',
}

export interface Queue {
  name: string;
  options: queueOptions;
  get consumerCount(): number;
  get consumers(): Consumer[];
  get exclusive(): boolean;
  get messageCount(): number;
  get stopped(): boolean;
  queueMessage(fields: MessageFields, content?: any, properties?: MessageProperties): number;
  evictFirst(compareMessage?: Message): boolean;
  consume(onMessage: onMessage, consumeOptions?: consumeOptions, owner?: any): Consumer;
  assertConsumer(onMessage: onMessage, consumeOptions?: consumeOptions, owner?: any): Consumer;
  get(options?: consumeOptions): Message | undefined;
  ack(message: Message, allUpTo?: boolean): void;
  nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
  reject(message: Message, requeue?: boolean): void;
  ackAll(): void;
  nackAll(requeue?: boolean): void;
  peek(ignoreDelivered?: boolean): Message | undefined;
  cancel(consumerTag: string, requeue?: boolean): boolean;
  dismiss(onMessage: onMessage, requeue?: boolean): void;
  unbindConsumer(consumer: Consumer, requeue?: boolean): void;
  emit(eventName: string, content?: any): void;
  on(eventName: string | QueueEventNames, handler: CallableFunction, options?: consumeOptions): Consumer;
  off(eventName: string | QueueEventNames, handler: CallableFunction | consumeOptions): Consumer;
  purge(): number;
  getState(): QueueState;
  recover(state?: QueueState): Queue;
  delete(options?: deleteQueueOptions): { messageCount: number };
  close(): void;
  stop(): void;
}

export interface Consumer {
  options: consumeOptions;
  get consumerTag(): string;
  get ready(): boolean;
  get stopped(): boolean;
  get capacity(): number;
  get messageCount(): number;
  get queueName(): string;
  nackAll(requeue?: boolean): void;
  ackAll(): void;
  cancel(requeue?: boolean): void;
  prefetch(value: number): void;
}
