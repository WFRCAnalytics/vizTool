class Attribute {
    constructor(aCode) {
        if (!aCode) {
            throw new Error("Attribute code (aCode) is required.");
        }

        if (!configAttributes || typeof configAttributes !== 'object') {
            throw new Error("configAttributes is not defined or is not an object.");
        }

        const _configAttribute = configAttributes[aCode];

        if (!_configAttribute) {
            throw new Error(`No configuration found for attribute code: ${aCode}`);
        }

        this.aCode = aCode;
        this.aDisplayName       = _configAttribute.aDisplayName || null;
        this.agWeightCode       = _configAttribute.agWeightCode || null;
        this.agWeightCodeFilter = _configAttribute.agWeightCodeFilter || null;
        this.rendererCollection = _configAttribute.rendererCollection ? new RendererCollection(_configAttribute.rendererCollection) : null;
    }
}
    