class Attribute {
    constructor(attributeCode) {
        if (!attributeCode) {
            throw new Error("Attribute code (attributeCode) is required.");
        }

        if (!configAttributes || typeof configAttributes !== 'object') {
            throw new Error("configAttributes is not defined or is not an object.");
        }

        const _configAttribute = configAttributes[attributeCode];

        if (!_configAttribute) {
            throw new Error(`No configuration found for attribute code: ${attributeCode}`);
        }

        this.attributeCode = attributeCode;
        this.aDisplayName             = _configAttribute.aDisplayName || null;
        this.agWeightCode             = _configAttribute.agWeightCode || null;
        this.agWeightCodeFilter       = _configAttribute.agWeightCodeFilter || null;
        this.rendererCollection       = _configAttribute.rendererCollection ? new RendererCollection(_configAttribute.rendererCollection) : null;
        this.agFilterOptionsMethod    = _configAttribute.agFilterOptionsMethod || "sum";
    }
}
    