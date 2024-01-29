class Aggregator {
    constructor(data) {
        this.agCode = data.agCode;
        this.agDisplayName = data.agDisplayName;
        this.agOptions = data.agOptions;
        this.agWeightCode = data.agWeightCode;
        this.agGeoJson = data.agGeoJson;
        this.selected = data.agSelected
    
        this.filterData = {
          fCode    : this.agCode       ,
          fName    : this.agDisplayName,
          fWidget  : "checkboxes"      ,
          fOptions : this.agOptions    ,
          fSelected: this.selected   
        }
    }
}

class Divider {
    constructor(data){
        this.aCode = data.aCode
    }
}