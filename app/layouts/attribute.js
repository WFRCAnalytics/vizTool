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

        this.attributeCode            = attributeCode;
        this.alias                    = _configAttribute.alias || null;
        this.definition                = _configAttribute.definition || null;
        this.agWeightCode             = _configAttribute.agWeightCode || null;
        this.labelsOn                 = _configAttribute.hasOwnProperty('labelsOn') ? _configAttribute.labelsOn : true;
        this.agWeightCodeFilter       = _configAttribute.agWeightCodeFilter || null;
        this.rendererCollection       = _configAttribute.rendererCollection ? new RendererCollection(_configAttribute.rendererCollection, this.alias) : null;
        this.agFilterOptionsMethod    = _configAttribute.agFilterOptionsMethod || "sum";
        this.stackable                = _configAttribute.hasOwnProperty('stackable') ? _configAttribute.stackable : true;
        this.aggregatable             = _configAttribute.hasOwnProperty('aggregatable') ? _configAttribute.aggregatable : true;
        // vizMap's FeatureLayer orderBy (which magnitude draws on top when features overlap -
        // see its own comment in vizmap.js) defaults to ascending (larger on top) for every
        // attribute unless explicitly flipped here.
        this.drawOrderDescending      = _configAttribute.hasOwnProperty('drawOrderDescending') ? _configAttribute.drawOrderDescending : false;

        this.filterOverride           = _configAttribute.filterOverride || null;
    }
}
    