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
        this.aCode = data.aCode;
        this.aName = data.aName;
        this.filterGroup = data.filterGroup;
    }
}

class DataFilter {
    constructor(data) {
        this.fCode = data.fCode;
        this.fName = data.fName;
        this.fWidget = data.fWidget;
        this.fOptions = data.fOptions;
    }
}