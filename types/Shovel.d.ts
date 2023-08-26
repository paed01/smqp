import { Consumer } from './Queue.js';
import { Broker } from './Broker.js';
import { Message } from './Message.js';

type shovelOptions = {
  cloneMessage?: (message: Message) => Message;
  [x: string]: any;
};

export interface ShovelSource {
  broker: Broker;
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

export class Shovel {
  constructor(name: string, source: ShovelSource, destination: ShovelDestination, options?: shovelOptions);
  name: string;
  source: ShovelSource;
  destination: ShovelDestination;
  get closed(): boolean;
  get consumerTag(): string;
  emit(eventName: string, content: any): void;
  on(eventName: string, handler: CallableFunction): Consumer;
  off(eventName: string, handler: any): Consumer;
  close(): void;
}

export class Exchange2Exchange {
  constructor(shovel: Shovel);
  readonly name: string;
  readonly source: string;
  /** name of source e2e queue */
  readonly queue: string;
  readonly pattern: string;
  readonly destination: string;
  readonly consumerTag: string;
  on(eventName: string, handler: CallableFunction): Consumer;
  close(): void;
}
