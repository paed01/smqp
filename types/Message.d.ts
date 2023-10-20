export interface MessageFields {
  /** published through exchange */
  exchange?: string;
  /** published with routing key, if any */
  routingKey?: string;
  /** identifying the consumer for which the message is destined */
  consumerTag?: string;
  /** message has been delivered before, i.e. nacked or recovered */
  redelivered?: boolean;
  [x: string]: any;
}

export interface MessageProperties {
  /** integer, expire message after milliseconds */
  expiration?: number;
  /** unique identifier for the message */
  messageId?: string;
  /** Date.now() when message was sent */
  timestamp?: number;
  /** indicating if message is mandatory. True emits return if not routed to any queue */
  mandatory?: boolean;
  /** persist message, if unset queue option durable prevails */
  persistent?: boolean;
  [x: string]: any;
}

export interface MessageMessage {
  fields: MessageFields;
  content?: any;
  properties: MessageProperties;
}

export interface Message extends MessageMessage {
  /**
   * Acknowledge message
   * @param [allUpTo=false] all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged.
  */
  ack(allUpTo?: boolean): void;
  /**
   * Reject message
   * @param [allUpTo=false] all outstanding messages prior to and including the given message shall be considered rejected. If false, or omitted, only the message supplied is rejected.
   * @param [requeue=true] put the message or messages back on the queue
  */
  nack(allUpTo?: boolean, requeue?: boolean): void;
  /**
   * Reject message
   * @param [requeue=true]: put the message back on the queue
  */
  reject(requeue?: boolean): void;
  /** Message is pending ack */
  get pending(): boolean
}
