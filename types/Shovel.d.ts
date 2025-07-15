import { Consumer } from './Queue.js';
import { ExchangeEventEmitter } from './types.js';
import { Broker } from './Broker.js';
import { MessageMessage } from './Message.js';

export interface ShovelOptions {
  cloneMessage?: (message: MessageMessage) => MessageMessage;
  [x: string]: any;
}

export interface ShovelSource {
  /** source broker */
  broker: Broker;
  /** source exchange name */
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

export class Shovel extends ExchangeEventEmitter {
  constructor(name: string, source: ShovelSource, destination: ShovelDestination, options?: ShovelOptions);
  get name(): string;
  source: ShovelSource;
  destination: ShovelDestination;
  get closed(): boolean;
  get consumerTag(): string;
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
