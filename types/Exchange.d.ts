import { MessageProperties } from './Message.js';
import { Queue, Consumer, QueueState } from './Queue.js';

type exchangeType = 'topic' | 'direct';

type exchangeOptions = {
  durable?: boolean;
  autoDelete?: boolean;
  [x: string]: any;
};

type bindingOptions = {
  priority?: number;
  [x: string]: any;
};

export interface BindingState {
  id: string;
  options: bindingOptions;
  queueName: string;
  pattern: string;
}

export interface ExchangeState {
  name: string;
  type: exchangeType;
  options: exchangeOptions;
  bindings?: BindingState[];
  /** Undelivered message queue */
  deliveryQueue?: QueueState;
}

export interface Exchange {
  name: string;
  options: exchangeOptions;
  get type(): exchangeType;
  get bindingCount(): number;
  get bindings(): Binding[];
  get stopped(): boolean;
  publish(routingKey: string, content?: any, properties?: MessageProperties): number;
  bindQueue(queue: Queue, pattern: string, bindOptions?: bindingOptions): Binding;
  unbindQueue(queue: Queue, pattern: string): void;
  unbindQueueByName(queueName: string): void;
  close(): void;
  getState(): any;
  stop(): void;
  /**
   * Recover exchange
   * @param state
   * @param getQueue function to get queue instance from broker
   */
  recover(state: ExchangeState, getQueue: CallableFunction): Exchange;
  getBinding(queueName: string, pattern: string): Binding;
  emit(eventName: string, content?: any): any;
  on(pattern: string, handler: CallableFunction, consumeOptions?: {consumerTag?: string, [x: string]: any}): Consumer;
  off(pattern: string, handler: any): void;
}

export interface Binding {
  id: string;
  options: bindingOptions;
  pattern: string;
  exchange: Exchange;
  queue: Queue;
}
