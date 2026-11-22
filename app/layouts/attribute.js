class Attribute {
    constructor(attributeCode, jsonName = null) {
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

        // Which area-based-summary methodology (trip/facility/segment) this attribute's data
        // actually comes from - resolved off the owning jsonName, not attributeCode, since
        // attribute codes are a global namespace shared across entities with different
        // methodologies (e.g. aVMT on both Zone Trip Metrics and Zone Facility Metrics).
        this.vmtBasis = (typeof getVmtBasisForJsonName === 'function') ? getVmtBasisForJsonName(jsonName) : null;

        const _basisDefinition = this.vmtBasis && _configAttribute.definitionByBasis
            ? _configAttribute.definitionByBasis[this.vmtBasis]
            : null;

        this.attributeCode            = attributeCode;
        this.alias                    = _configAttribute.alias || null;
        this.definition                = _basisDefinition || _configAttribute.definition || null;
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
        this.drawOrderDescending      = _configAttribute.hasOwnProperty('drawOrderDescending') ? _configAttribute.drawOrderDescending : true;

        this.filterOverride           = _configAttribute.filterOverride || null;
    }
}
    