export enum REDIS_EVENT_TYPES {
    DELETE = 'del',
    SET = 'set',
}

export enum REDIS_CLIENTS {
    SUBSCRIBE = 'subscriber',
    PUBLISH = 'publish'
}

export enum EVENT_TYPES {
    QUEUE_CREATED = 'queue.created',
    QUEUE_REMOVED = 'queue.removed'
}

export enum UI_TYPES {
    BULL_BOARD = 'bull-board',
    ARENA = 'arena'
}
