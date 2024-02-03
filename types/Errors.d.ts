export class SmqpError extends Error {
  name: string;
  type: string;
  code: string;
  constructor(message: string, code: string);
}

export const ERR_CONSUMER_TAG_CONFLICT = 'ERR_SMQP_CONSUMER_TAG_CONFLICT';
export const ERR_EXCHANGE_NOT_FOUND = 'ERR_SMQP_EXCHANGE_NOT_FOUND';
export const ERR_EXCHANGE_TYPE_MISMATCH = 'ERR_SMQP_EXCHANGE_TYPE_MISMATCH';
export const ERR_EXCLUSIVE_CONFLICT = 'ERR_SMQP_EXCLUSIVE_CONFLICT';
export const ERR_EXCLUSIVE_NOT_ALLOWED = 'ERR_SMQP_EXCLUSIVE_NOT_ALLOWED';
export const ERR_QUEUE_DURABLE_MISMATCH = 'ERR_SMQP_QUEUE_DURABLE_MISMATCH';
export const ERR_QUEUE_NAME_CONFLICT = 'ERR_SMQP_QUEUE_NAME_CONFLICT';
export const ERR_QUEUE_NOT_FOUND = 'ERR_SMQP_QUEUE_NOT_FOUND';
export const ERR_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND = 'ERR_SMQP_SHOVEL_DESTINATION_EXCHANGE_NOT_FOUND';
export const ERR_SHOVEL_NAME_CONFLICT = 'ERR_SMQP_SHOVEL_NAME_CONFLICT';
export const ERR_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND = 'ERR_SMQP_SHOVEL_SOURCE_EXCHANGE_NOT_FOUND';