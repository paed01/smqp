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

export interface Queue {
  name: string;
  options: queueOptions;
  get consumerCount(): number;
  get consumers(): Consumer[];
  get exclusive(): boolean;
  get messageCount(): number;
  get stopped(): boolean;
  queueMessage(fields: MessageFields, content: any, properties: MessageProperties): number;
  evictFirst(compareMessage?: Message): boolean;
  consume(onMessage: onMessage, consumeOptions?: consumeOptions, owner?: any): Consumer;
  assertConsumer(onMessage: onMessage, consumeOptions?: consumeOptions, owner?: any): Consumer;
  get(options?: consumeOptions): Message;
  ack(message: Message, allUpTo?: boolean): void;
  nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
  reject(message: Message, requeue?: boolean): void;
  ackAll(): void;
  nackAll(requeue?: boolean): void;
  peek(ignoreDelivered?: boolean): Message;
  cancel(consumerTag: string): void;
  dismiss(onMessage: onMessage): void;
  unbindConsumer(consumer: any): void;
  emit(eventName: string, content?: any): void;
  on(eventName: string, handler: CallableFunction): Consumer;
  off(eventName: string, handler: CallableFunction): Consumer;
  purge(): number;
  getState(): QueueState;
  recover(state: any): number | Queue;
  delete(options?: deleteQueueOptions): {
    messageCount: number;
  };
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
