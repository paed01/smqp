import { ExchangeEventEmitter } from './types.js';
import { MessageProperties } from './Message.js';
import { Queue, QueueState } from './Queue.js';

type exchangeType = 'topic' | 'direct';

interface ExchangeOptions {
  /** makes exchange durable, i.e. will be returned when getting state, defaults to true */
  durable?: boolean;
  /** remove exchange when all bindings are gone, defaults to true */
  autoDelete?: boolean;
  [x: string]: any;
}

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
  options: ExchangeOptions;
  bindings?: BindingState[];
  /** Undelivered message queue */
  deliveryQueue?: QueueState;
}

export class Exchange extends ExchangeEventEmitter {
  constructor(name: string, type?: exchangeType, options?: ExchangeOptions);
  get name(): string;
  options: ExchangeOptions;
  get type(): exchangeType;
  get bindingCount(): number;
  get bindings(): Binding[];
  get stopped(): boolean;
  publish(routingKey: string, content?: any, properties?: MessageProperties): number;
  bindQueue(queue: Queue, pattern: string, bindOptions?: bindingOptions): Binding;
  unbindQueue(queue: Queue, pattern: string): void;
  unbindQueueByName(queueName: string): void;
  closeBinding(binding: Binding): void;
  close(): void;
  getState(): ExchangeState;
  stop(): void;
  /**
   * Recover exchange
   */
  recover(): Exchange;
  /**
   * Recover exchange
   * @param state
   * @param getQueue function to get queue instance from broker
   */
  recover(state: ExchangeState, getQueue: CallableFunction): Exchange;
  getBinding(queueName: string, pattern: string): Binding;
}

export interface Binding {
  id: string;
  options: bindingOptions;
  pattern: string;
  exchange: Exchange;
  queue: Queue;
}
