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
  }

  // loadData has to be called after menuItems is loaded
  loadData(dataMenu) {

    let jsonFileNames = new Set();
    
    dataMenu.forEach(menuItem => {
      if (menuItem.modelEntities) {
        menuItem.modelEntities.forEach(modelEntity => {
          if (modelEntity.vizLayout && modelEntity.vizLayout.jsonName) {
            jsonFileNames.add(modelEntity.vizLayout.jsonName);
          }
        });
      }
    });

    jsonFileNames.forEach(uniqueFileName => {
      this.fetchAndStoreData(uniqueFileName);
    });
    
  }

  getGeoJsonFileNameFromKey(key) {
    return this.geojsons[key];
  }

  // Function to fetch and store data
  fetchAndStoreData(fileName) {
    fetch(`scenario-data/${this.scnFolder}/${fileName}.json`)
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
  
    const attribute = jsonDataForKey.attributes.find(item => item.aCode === a_aCode);
    if (!attribute) {
      console.error(`Error: No attribute found with aCode "${a_aCode}" in jsonData key "${a_jsonDataKey}"`);
      return "";
    }
  
    return attribute.filterGroup ?? "";
  }
  
  getDataForFilterOptionsList(a_jsonDataKey, a_lstFilters, a_agFilterOptionsMethod = "sum") {
    // Initialize objects to hold the aggregated sums, counts, and minimums
    let aggregatedData = {};
    let countData = {}; // To keep track of counts for averaging
    let minData = {}; // To track minimum values
  
    const _parent = this;
  
    // Modified function to handle the summing, averaging, and minimum of specific attributes for each key
    function aggregateFields(data, method) {
      Object.keys(data).forEach(key => {
        if (!aggregatedData[key]) {
          aggregatedData[key] = {};
          countData[key] = {};
          minData[key] = {};
        }
  
        _parent.jsonData[a_jsonDataKey].attributes.forEach(attr => {
          if (data[key].hasOwnProperty(attr.aCode)) {
            if (!aggregatedData[key][attr.aCode]) {
              aggregatedData[key][attr.aCode] = 0;
              countData[key][attr.aCode] = 0;
              minData[key][attr.aCode] = Number.POSITIVE_INFINITY; // Initialize minimum with a large value
            }
            aggregatedData[key][attr.aCode] += data[key][attr.aCode];
            countData[key][attr.aCode] += 1;
            if (data[key][attr.aCode] < minData[key][attr.aCode]) {
              minData[key][attr.aCode] = data[key][attr.aCode];
            }
          }
        });
      });
    }
  
    if (a_agFilterOptionsMethod === "sum" || a_agFilterOptionsMethod === "average" || a_agFilterOptionsMethod === "minimum") {
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
          Object.keys(aggregatedData[key]).forEach(attrCode => {
            aggregatedData[key][attrCode] /= countData[key][attrCode];
          });
        });
      }
  
      // If the method is "minimum", replace the aggregated data with the minimum data
      if (a_agFilterOptionsMethod === "minimum") {
        aggregatedData = minData;
      }
    }
  
    return aggregatedData;
  }
  
  
}