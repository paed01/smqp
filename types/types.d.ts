import { Message } from './Message.js';
import { Consumer } from './Queue.js';

export type onMessage = (routingKey: string, message: Message, owner: any) => void;

interface ConsumeOptions {
  noAck?: boolean;
  consumerTag?: string;
  exclusive?: boolean;
  prefetch?: number;
  priority?: number;
  [x: string]: any;
}

export interface ExchangeEventEmitter {
  emit(eventName: string, content?: any): number | undefined;
  on(pattern: string, handler: CallableFunction, consumeOptions?: ConsumeOptions): Consumer;
  off(pattern: string, handler: CallableFunction | ConsumeOptions): void;
}
