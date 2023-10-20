class Attribute {
    constructor(data) {
        this.aCode = data.aCode;
        this.rendererCollection = data.rendererCollection ? new RendererCollection(data.rendererCollection) : null;
    }
}