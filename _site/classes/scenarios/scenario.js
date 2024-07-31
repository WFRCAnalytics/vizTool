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

  getGeoJsonFileNameFromKey(key) {
    return this.geojsons[key];
  }

  // Function to fetch and store data
  fetchAndStoreData(fileName) {
    fetch(`data/scenario-data/${this.scnFolder}/${fileName}.json`)
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

    if (agg_geojsonsKey='') {
      _dataGeo    = this.geojsons[data_geojsonsKey]
      _dataAggGeo = this.geojsons[ agg_geojsonsKey];
    }
    if (wt_jsonDataKey!='') {
      _dataWt = getDataForFilterOptionsList(wt_jsonDataKey, wt_lstFilters);
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
    return this.jsonData[a_jsonDataKey].attributes.find(item => item.aCode === a_aCode)?.filterGroup ?? "";
  }
  
  getDataForFilterOptionsList(a_jsonDataKey, a_lstFilters) {
    //console.log('getDataForFilterOptionsList:' + a_lstFilters);

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