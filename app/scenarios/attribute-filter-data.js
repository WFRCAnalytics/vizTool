// Class for Storing data by attribute and filter group
class AttributeFilterData {
    constructor(data) {
        this.attributes = data.attributes.map(attr => new DataAttribute(attr));
        this.filters = data.filters.map(filter => new DataFilter(filter));
        // Filter-combo keys are built independently by the JS sidebar (from configured
        // fOptions values) and by the Python export (from raw CSV values), so a value like
        // fPurp5pAll's "All Purposes" can end up as "All" in one config and "ALL" in
        // another. Lowercasing both sides at lookup time (see Scenario.getDataForFilter and
        // getDataForFilterOptionsList) avoids silently returning no data on that mismatch.
        this.data = Object.fromEntries(
            Object.entries(data.data).map(([key, value]) => [key.toLowerCase(), value])
        );
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
        } else if (data.filterCode && data.fOptions) {
            // Scenario data files (j-*.json) embed their own filter metadata under this
            // shape - filterCode/filterDescription/fOptions - a different schema than the
            // sidebar's configured filters.json widgets above, but the only one actually
            // present in real scenario data. Without this branch every entry fell through
            // to the empty case below, so this.filters was always an array of {} - callers
            // relying on it (e.g. Measure._buildFilterGroupCombos looking up a filter
            // dimension's full option list) silently got nothing back.
            this.fCode = data.filterCode;
            this.alias = data.filterDescription || data.filterCode;
            this.fWidget = data.fWidget || null;
            this.fOptions = data.fOptions;
        } else {
            // Handle the case where none of the known shapes match
        }
    }
}