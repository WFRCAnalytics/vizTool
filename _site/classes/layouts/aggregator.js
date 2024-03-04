class Aggregator {
    constructor(data) {
        this.agCode = data.agCode;
        this.agDisplayName = data.agDisplayName;
        this.agCodeNameField = data.agCodeNameField;
        this.agOptions = data.agOptions;
        this.agGeoJson = data.agGeoJson;
        this.selected = data.agSelected
    
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