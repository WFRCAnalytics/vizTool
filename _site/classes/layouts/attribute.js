class Attribute {
    constructor(data) {
        this.aCode = data.aCode;
        this.aLabelExpressionInfo = data.aLabelExpressionInfo;
        this.rendererCollection = data.rendererCollection ? new RendererCollection(data.rendererCollection) : null;
    }
}