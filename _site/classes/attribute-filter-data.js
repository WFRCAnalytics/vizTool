// Class for Storing data by attribute and filter group
class AttributeFilterData {
    constructor(data) {
        this.attributes = data.attributes.map(attr => new Attribute(attr));
        this.filters = data.filters.map(filter => new Filter(filter));
        this.data = data.data;
    }
}