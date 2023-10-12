class Attribute {
    constructor(data) {
        this.aCode = data.aCode;
        this.rendererCollection = new RendererCollection(data.rendererCollection)
    }
}