class Aggregator {
    constructor(data) {
        this.agCode = data.agCode;
        this.agDisplayName = data.agDisplayName;
        this.agOptions = data.agOptions;
        this.agWeightCode = data.agWeightCode;
        this.agGeoJson = data.agGeoJson;
        this.selected = data.agSelected
    

        // only run if it is vizTrends and has an agGeoJson defined
        if (this.agGeoJson) {
          const response = await fetch(this.agGeoJson);
          const dataGeoJson = await response.json();

          const _options = dataGeoJson.features.map(feature => ({ value: feature.FIPS, label: feature.NAME }));

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

        } else {
          this.filterData = {
            fCode           : this.agCode          ,
            fName           : this.agDisplayName   ,
            fWidget         : "checkboxes"         ,
            fOptions        : this.agOptions       ,
            fSelected       : this.selected        ,
            subAgDisplayName: data.subAgDisplayName,
            subAgSelected   : data.subAgSelected   ,
            subAgOptions    : data.subAgOptions
          }
        }

    }
}