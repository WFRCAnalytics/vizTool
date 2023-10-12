class Attribute {
    constructor(data) {
        this.aCode = data.aCode;
        this.rendererCollection = new this.rendererCollection(data.rendererCollection)
    }
}