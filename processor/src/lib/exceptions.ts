export class MemoryAccessException extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, MemoryAccessException.prototype);
    }
}

export class MemoryRangeException extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, MemoryAccessException.prototype);
    }
}
