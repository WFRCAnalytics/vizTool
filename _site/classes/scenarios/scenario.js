// Class for Scenario
class Scenario {
  constructor(data) {
    this.modVersion       = data.modVersion;
    this.scnGroup         = data.scnGroup  ;
    this.scnYear          = data.scnYear   ;
    this.scnDesc          = data.scnDesc   ;
    this.geoJsonSeg       = data.geoJsonSeg;
    this.scnFolder        = data.modVersion + '__' + data.scnGroup + '__' + String(data.scnYear);
    // Array to store the data
    this.jsonData = {};

    // Fetch and store data for each file
    // AUTOMATE USING CONFIG
    this.fetchAndStoreData('roadway-vizmap');
    this.fetchAndStoreData('roadway-trends');
    this.fetchAndStoreData('transit-segments-riders');
    this.fetchAndStoreData('zones-modetrips-vizmap');
    this.fetchAndStoreData('zones-se-vizmap');
    this.fetchAndStoreData('zones-jobhh-vizmap');
  }

  // Function to fetch and store data
  fetchAndStoreData(fileName) {
    fetch(`data/scnData/${this.scnFolder}/${fileName}.json`)
      .then(response => response.json())
      .then(jsonData => {
        // Store the processed data in the object with the filename as key
        this.jsonData[fileName] = new AttributeFilterData(jsonData);
      })
      .catch(error => console.error(`Error fetching data from ${fileName}:`, error));
  }

  getDataForFilter(a_jsonDataKey, a_filter) {
    console.log('getDataForFilter');
    return this.jsonData[a_jsonDataKey].data[a_filter];
  }

  getFilterGroupForAttribute(a_jsonDataKey, a_aCode) {
    console.log('getFilterGroupForAttribute:' + a_aCode);
    return this.jsonData[a_jsonDataKey].attributes.find(item => item.aCode === a_aCode)?.filterGroup ?? "";
  }
  
  getDataForFilterOptionsList(a_jsonDataKey, a_lstFilters) {
    console.log('getDataForFilterOptionsList:' + a_lstFilters);

    // Initialize an object to hold the aggregated sums
    let aggregatedSums = {};

    const _parent = this;

    // Modified sumFields function to handle the summing of specific attributes for each key
    function sumFields(data) {
      Object.keys(data).forEach(key => {
        if (!aggregatedSums[key]) {
          aggregatedSums[key] = {};
        }

        _parent.jsonData[a_jsonDataKey].attributes.forEach(attr => {
          if (data[key].hasOwnProperty(attr.aCode)) {
            if (!aggregatedSums[key][attr.aCode]) {
              aggregatedSums[key][attr.aCode] = 0;
            }
            aggregatedSums[key][attr.aCode] += data[key][attr.aCode];
          }
        });
      });
    }

    // Loop through each combination of filters
    a_lstFilters.forEach(function(filter) {
      let _data = [];
      if (_parent.jsonData[a_jsonDataKey]) {
        _data = _parent.jsonData[a_jsonDataKey].data[filter];
      }
      

      // Sum the fields in the data object
      if (_data) {
        sumFields(_data);
      }
    });

    return aggregatedSums;
  }

}