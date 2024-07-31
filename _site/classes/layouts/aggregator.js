class Aggregator {
    constructor(data) {
        this.agCode = data.agCode;
        this.agDisplayName = data.agDisplayName;
        this.agCodeNameField = data.agCodeNameField;
        this.agOptions = data.agOptions;
        this.agGeoJson = data.agGeoJson;
        this.agGeoJsonLabelField = data.agGeoJsonLabelField,
        this.agGeoJsonValueField = data.agGeoJsonValueField,
        this.selected = data.agSelected ? data.agSelected : [];
    
        let _options;

        // only run if it is vizTrends and has an agGeoJson defined
        if (this.agGeoJson) {
          _options = dataGeojsons[this.agGeoJson].features.map(feature => ({
            value: String(feature.properties[this.agGeoJsonValueField]), // Assuming these are under `properties`
            label: feature.properties[this.agGeoJsonLabelField]  // Adjust if they are located elsewhere
          }));
        } else {
          _options = this.agOptions;
        }

        this.filterData = {
          fCode           : this.agCode          ,
          fName           : this.agDisplayName   ,
          fWidget         : "checkboxes"         ,
          fOptions        : _options             ,
          fSelected       : this.selected        ,
          subAgDisplayName: data.subAgDisplayName,
          subAgSelected   : data.subAgSelected   ,
          subAgOptions    : data.subAgOptions
        }
    }
}