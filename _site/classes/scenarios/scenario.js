// Class for Scenario
class Scenario {
  constructor(data, dataMenu) {
    this.modVersion = data.modVersion;
    this.scnGroup   = data.scnGroup;
    this.scnYear    = data.scnYear; 
    this.scnDesc    = data.scnDesc;
    this.scnFolder  = data.modVersion + '__' + data.scnGroup + '__' + String(data.scnYear);
    this.geojsons   = data.geojsons;
    this.jsonData   = {}; // Array to store the data
  }

  // loadData has to be called after menuItems is loaded
  loadData(dataMenu) {

    let jsonFileNames = new Set();
    
    dataMenu.forEach(menuItem => {
      if (menuItem.modelEntities) {
        menuItem.modelEntities.forEach(modelEntity => {
          if (modelEntity.vizLayout && modelEntity.vizLayout.jsonFileName) {
            jsonFileNames.add(modelEntity.vizLayout.jsonFileName);
          }
        });
      }
    });

    jsonFileNames.forEach(uniqueFileName => {
      this.fetchAndStoreData(uniqueFileName);
    });
    
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