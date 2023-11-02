// Class for Scenario
class Scenario {
    constructor(data) {
        this.modVersion     = data.modVersion;
        this.scnGroup       = data.scnGroup  ;
        this.scnYear        = data.scnYear   ;
        this.scnDesc        = data.scnDesc   ;
        this.geoJsonSeg     = data.geoJsonSeg;
        this.scnFolder      = data.modVersion + '__' + data.scnGroup + '__' + String(data.scnYear);
        this.roadwaySegData = null; // initialize to null for now

        // fetch the data from the JSON file and set it to the roadwaySeg property
        // _site\data\scnData\v900__Base__2019\roadway-vizmap.json
        fetch('data/scnData/' + this.scnFolder + '/roadway-vizmap.json')
            .then(response => response.json())
            .then(jsonData => {
                this.roadwaySegData = new AttributeFilterData(jsonData);
            })
            .catch(error => console.error('Error fetching data:', error));
    }
}