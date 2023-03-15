import { Consumer } from './Queue.js';
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
  broker: Broker;
  exchange: string;
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
