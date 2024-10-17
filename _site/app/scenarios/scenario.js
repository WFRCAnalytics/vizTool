// Class for Scenario
class Scenario {
  constructor(data, dataMenu) {
    this.modVersion = data.modVersion;
    this.scnGroup   = data.scnGroup;
    this.scnYear    = data.scnYear; 
    this.alias      = data.alias || null;
    this.scnFolder  = data.modVersion + '__' + data.scnGroup + '__' + String(data.scnYear);
    this.geojsons   = jsonScenario.models.find(entry => entry.modVersion === this.modVersion).geojsons;
    this.jsonData   = {}; // Array to store the data
    this.keys       = jsonScenario.models.find(entry => entry.modVersion === this.modVersion).keys;
  }

  // loadData has to be called after menuItems is loaded
  async loadData(dataMenu, updateProgress) {
    let jsonFileNames = new Set();
    
    // Collect unique JSON file names
    dataMenu.forEach(menuItem => {
      if (menuItem.modelEntities) {
        menuItem.modelEntities.forEach(modelEntity => {
          if (modelEntity.vizLayout && modelEntity.vizLayout.jsonName) {
            jsonFileNames.add(modelEntity.vizLayout.jsonName);
          }
        });
      }
    });
    
    totalFilesToLoad += jsonFileNames.size;

    // Fetch and store data, and update progress after each file is fetched
    jsonFileNames.forEach(uniqueFileName => {
      this.fetchAndStoreData(uniqueFileName).then(() => {
        totalLoadedFiles++;
        updateProgress();  // Call the progress update function after each file is fetched
      }).catch(error => {
        console.error(`Error loading ${uniqueFileName}:`, error);  // Handle errors if necessary
        totalLoadedFiles++;  // Still increment the loaded files counter
        updateProgress();  // Call the progress update function even if file doesn't exist
      });
    });
  }


  getGeoJsonFileNameFromKey(key) {
    return this.geojsons[key];
  }

  getKeyFileNameFromGeoJsonKey(basegeometrykey, aggeometrykey) {
    return this.keys[basegeometrykey][aggeometrykey];
  }

  // Function to fetch and store data
  async fetchAndStoreData(fileName) {
    try {
        const response = await fetch(`scenario-data/${this.scnFolder}/${fileName}.json`);

        if (!response.ok) {
            // If the response is not OK (e.g., 404), log an error and return
            console.log(`File not found: ${fileName}`);
            return;  // Do not proceed with storing data
        }

        const jsonData = await response.json();
        // Store the processed data in the object with the filename as key
        this.jsonData[fileName] = new AttributeFilterData(jsonData);
    } catch (error) {
        // Log any other errors (e.g., network issues)
        console.log(`Error fetching data from ${fileName}:`, error);
    }
  }

  getDataForFilter(a_jsonDataKey, a_filter) {
    console.log('getDataForFilter');
    return this.jsonData[a_jsonDataKey].data[a_filter];
  }
  
  getDataForFilterOptionsListByAggregator(data_jsonDataKey   , data_lstFilters   , data_aCode   , data_geojsonsKey = '', baseGeoJsonId='',
                                           agg_geojsonsKey='',                        aggCode='',                           // agg = Agggregate... combine by geography
                                            wt_jsonDataKey='',   wt_lstFilters='',   wt_aCode='',   wt_geojsonsKey = '') {  // wt  = Weight    ... calculate weighted average
    console.log('getDataForFilterOptionsListByAggregator');

    let _dataGeo;
    let _dataAggGeo;
    let _dataWt;

    const _data = getDataForFilterOptionsList(data_jsonDataKey, data_lstFilters);

    if (agg_geojsonsKey=='') {
      _dataGeo    = this.geojsons[data_geojsonsKey]
      _dataAggGeo = this.geojsons[ agg_geojsonsKey];
    }
    if (wt_jsonDataKey!='') {_dataWt = getDataForFilterOptionsList(wt_jsonDataKey, wt_lstFilters);
    }

    const dataResults = {};

    // NO AGGREGATOR
    if (agg_geojsonsKey!='') {
      dataResults[data_aCode] = _data[data_aCode] || 0;

    // WITH AGGREGATOR
    } else {
      
      // aggregate json data for give display feature
      _dataAggGeo.forEach((agFt) => {
        
        // get associated json records for given aggregator
        let _featuresToAg = _dataGeo.filter(feature => 
          feature.attributes[aggCode] === agFt.attributes[aggCode]
        );

        _featuresToAg.forEach((baseFt) => {

          const _idFt = baseFt.properties[baseGeoJsonId];

          // main value
          if (_data !== undefined) {
            if (_data[_idFt]) {
              if (_data[_idFt][_aCode]) {
                if (!wt_aCode) {
                  _valueMain += _data[_idFt][data_aCode];
                } else {
                  try {
                    var _wtMain = _dataWt[_idFt][wt_aCode];
                    if (_wtMain) {
                      _valueMainXWt += _data[_idFt][data_aCode] * _wtMain;
                      _valueMainSumWt += _wtMain;
                    }
                  } catch (error) {
                    //console.error("An error occurred while processing the weight:", error);
                    // Handle the error or perform error recovery
                    _valueMainXWt += 0;
                    _valueMainSumWt += 0;
                  }
                }
              }
            }
          }
        });

        
        if (_wtCode) {
          if (_valueMainSumWt>0) {
            _valueMain = _valueMainXWt / _valueMainSumWt;
          }
        }
      });
    }
  }



  getFilterGroupForAttribute(a_jsonDataKey, a_aCode) {
    console.log('getFilterGroupForAttribute:' + a_aCode);
  
    if (!this.jsonData) {
      console.error('Error: jsonData is undefined');
      return "";
    }
  
    const jsonDataForKey = this.jsonData[a_jsonDataKey];
    if (!jsonDataForKey) {
      console.error(`Error: jsonData for key "${a_jsonDataKey}" is undefined`);
      return "";
    }
  
    if (!jsonDataForKey.attributes) {
      console.error(`Error: attributes for jsonData key "${a_jsonDataKey}" are undefined`);
      return "";
    }
  
    const attribute = jsonDataForKey.attributes.find(item => item.attributeCode === a_aCode);
    if (!attribute) {
      console.error(`Error: No attribute found with attributeCode "${a_aCode}" in jsonData key "${a_jsonDataKey}"`);
      return "";
    }
  
    return attribute.filterGroup ?? "";
  }
  
  getDataForFilterOptionsList(a_jsonDataKey, a_lstFilters, a_agFilterOptionsMethod = "sum") {
    // Initialize objects to hold the aggregated sums, counts, and minimums
    let aggregatedData = {};
    let countData = {}; // To keep track of counts for averaging
    let minData = {}; // To track minimum values
    let maxData = {}; // To track minimum values
  
    const _parent = this;
  
    // Modified function to handle the summing, averaging, and minimum of specific attributes for each key
    function aggregateFields(data, method) {
      Object.keys(data).forEach(key => {
        if (!aggregatedData[key]) {
          aggregatedData[key] = {};
          countData[key] = {};
          minData[key] = {};
          maxData[key] = {};
        }
  
        _parent.jsonData[a_jsonDataKey].attributes.forEach(attr => {
          if (data[key].hasOwnProperty(attr.attributeCode)) {
            if (!aggregatedData[key][attr.attributeCode]) {
              aggregatedData[key][attr.attributeCode] = 0;
              countData[key][attr.attributeCode] = 0;
              minData[key][attr.attributeCode] = Number.POSITIVE_INFINITY; // Initialize minimum with a large value
              maxData[key][attr.attributeCode] = 0;
            }
            aggregatedData[key][attr.attributeCode] += data[key][attr.attributeCode];
            countData[key][attr.attributeCode] += 1;
            if (data[key][attr.attributeCode] < minData[key][attr.attributeCode]) {
              minData[key][attr.attributeCode] = data[key][attr.attributeCode];
            }
            if (data[key][attr.attributeCode] > maxData[key][attr.attributeCode]) {
              maxData[key][attr.attributeCode] = data[key][attr.attributeCode];
            }
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

      // Aggregate the fields in the data object
      if (_data) {
        aggregateFields(_data, a_agFilterOptionsMethod);
      }
    });

    // If the method is "average", divide the aggregated sums by the counts
    if (a_agFilterOptionsMethod === "average") {
      Object.keys(aggregatedData).forEach(key => {
        Object.keys(aggregatedData[key]).forEach(attributeCode => {
          aggregatedData[key][attributeCode] /= countData[key][attributeCode];
        });
      });
    }

    // If the method is "minimum", replace the aggregated data with the minimum data
    if (a_agFilterOptionsMethod === "minimum") {
      aggregatedData = minData;
    }

    // If the method is "minimum", replace the aggregated data with the minimum data
    if (a_agFilterOptionsMethod === "maximum") {
      aggregatedData = maxData;
    }
  
    return aggregatedData;
  }
  
  
}