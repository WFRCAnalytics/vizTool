// Class for Storing data by attribute and filter group
class AttributeFilterData {
    constructor(data) {
        this.attributes = data.attributes.map(attr => new DataAttribute(attr));
        this.filters = data.filters.map(filter => new DataFilter(filter));
        this.data = data.data;
    }
}

class DataAttribute {
    constructor(data) {
        this.attributeCode = data.attributeCode;
        this.DisplayName = data.DisplayName;
        if (data.filterGroup) {
            this.filterGroup = data.filterGroup;
        }
        else {
            this.filterGroup = "";
        }
    }
}

class DataFilter {
    constructor(data) {
        if (data.fCode && data.alias && data.fWidget && data.fOptions) {
            this.fCode = data.fCode;
            this.alias = data.alias;
            this.fWidget = data.fWidget;
            this.fOptions = data.fOptions;
        } else if (data.dCode && data.dName && data.dWidget && data.dOptions) {
            this.fCode = data.dCode;
            this.alias = data.dName;
            this.fWidget = data.dWidget;
            this.fOptions = data.dOptions;
        } else {
            // Handle the case where neither 'f' nor 'd' keys are present in data
        }
    }
}