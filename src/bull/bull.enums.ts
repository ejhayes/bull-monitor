export enum REDIS_KEYSPACE_EVENT_TYPES {
  DELETE = 'del',
  HSET = 'hset',
}

export enum REDIS_EVENT_TYPES {
  END = 'end',
  ERROR = 'error',
  PMESSAGE = 'pmessage',
  READY = 'ready',
  RECONNECTING = 'reconnecting',
}

export enum REDIS_CLIENTS {
  PUBLISH = 'publish',
  SUBSCRIBE = 'subscriber',
}

export enum EVENT_TYPES {
  QUEUE_CREATED = 'queue.created',
  QUEUE_REMOVED = 'queue.removed',
}

export enum UI_TYPES {
  ARENA = 'arena',
  BULL_BOARD = 'bull-board',
}
