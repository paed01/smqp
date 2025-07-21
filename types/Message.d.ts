export interface MessageFields extends Record<string, any> {
  /** published through exchange */
  exchange?: string;
  /** published with routing key, if any */
  routingKey?: string;
  /** identifying the consumer for which the message is destined */
  consumerTag?: string;
  /** message has been redelivered, i.e. nacked or recovered */
  redelivered?: boolean;
}

export interface MessageProperties extends Record<string, any> {
  /** unique identifier for the message */
  messageId?: string;
  /** integer, expire message after milliseconds */
  expiration?: number;
  /** integer, message time to live in milliseconds */
  ttl?: number;
  /** Date.now() when message was sent */
  timestamp?: number;
  /** indicating if message is mandatory. True emits return if not routed to any queue */
  mandatory?: boolean;
  /** persist message, if unset queue option durable prevails */
  persistent?: boolean;
  /** shovel or e2e message source exchange */
  'source-exchange'?: string;
  /** shovel name */
  'shovel-name'?: string;
}

export abstract class MessageMessage {
  fields: MessageFields;
  content?: any;
  properties: MessageProperties;
}

export class Message extends MessageMessage {
  constructor(fields: MessageFields, content?: any, properties?: MessageProperties);
  /**
   * Acknowledge message
   * @param allUpTo all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged. Defaults to false
   */
  ack(allUpTo?: boolean): void;
  /**
   * Reject message
   * @param allUpTo all outstanding messages prior to and including the given message shall be considered rejected. If false, or omitted, only the message supplied is rejected. Defaults to false
   * @param requeue put the message or messages back on the queue, defaults to true
   */
  nack(allUpTo?: boolean, requeue?: boolean): void;
  /**
   * Reject message
   * @param requeue put the message back on the queue, defaults to true
   */
  reject(requeue?: boolean): void;
  /** Message is pending ack */
  get pending(): boolean;
}
