




/**
 * @template T
 */
class PriorityQueue extends Array {
    /**
     * @param {{comparator: (a:T, B:T) => number | boolean}} options
     */
    constructor({comparator}) {
        super();
    }
    

    /**
     * @param {T} value 
     */
    enqueue(value) {
        this.push(value);
        this.sort(comparator);
    }
    
    /**
     * @returns {T}
     */
    dequeue() {
        return this.shift();
    }
}


globalThis.PriorityQueue = PriorityQueue;

