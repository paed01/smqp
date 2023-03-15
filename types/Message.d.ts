export interface MessageFields {
  routingKey: string;
  consumerTag?: string;
  redelivered?: boolean;
  exchange: string;
  [x: string]: any;
}

export interface MessageProperties {
  expiration?: number | undefined;
  messageId?: string | undefined;
  timestamp?: number | undefined;
  mandatory?: boolean;
  [x: string]: any;
}

export interface Message {
  fields: MessageFields;
  content?: any;
  properties: MessageProperties;
  ack(allUpTo?: boolean): void;
  nack(allUpTo?: boolean, requeue?: boolean): void;
  reject(requeue?: boolean): void;
}
