// Class for Scenario
class Scenario {
  constructor(data, dataMenu) {
    this.modVersion = data.modVersion;
    this.scnGroup   = data.scnGroup;
    this.scnYear    = data.scnYear; 
    this.alias      = data.alias || null;
    this.scnFolder  = data.modVersion + '__' + data.scnGroup + '__' + String(data.scnYear);
    this.geojsons   = jsonScenario.models.find(entry => entry.modVersion === this.modVersion).geojsons;
    this.jsonData   = {}; // Loaded/parsed scenario data, keyed by jsonName - populated lazily via ensureDataLoaded()
    this.dataAvailable = {}; // jsonName -> boolean, from the cheap startup HEAD-probe (see probeDataAvailability)
    this.keys       = jsonScenario.models.find(entry => entry.modVersion === this.modVersion).keys;
  }

  // probeDataAvailability has to be called after menuItems is loaded. It's a lightweight
  // existence check (HEAD request, no body) for every jsonName this scenario might ever need -
  // NOT a data load. Actual data is fetched lazily via ensureDataLoaded() the first time
  // something needs it (see model-entity.js/vizmap.js/viztrends.js/vizmatrix.js). This still
  // needs to run for every scenario up front so hasAvailableData()/getFirstScenarioWithTrendData()
  // can keep hiding menu entries for datasets a given scenario genuinely doesn't have (real
  // gaps exist - e.g. older scenarios built with a different export pipeline) without having
  // to download the (large) file itself to find out.
  async probeDataAvailability(dataMenu, updateProgress) {
    let jsonFileNames = new Set();

    // Collect unique JSON file names
    dataMenu.forEach(menuItem => {
      if (!menuItem.modelEntities) return;

      menuItem.modelEntities.forEach(modelEntity => {
        const vizLayout = modelEntity.vizLayout;
        if (!vizLayout) return;

        // 1) Direct jsonName on the vizLayout itself (non-dashboard or simple cases)
        if (vizLayout.jsonName) {
          jsonFileNames.add(vizLayout.jsonName);
        }

        // 2) If vizLayout is a vizDashboard instance, collect jsonNames from its cards' measures
        const isVizDashboard = (typeof VizDashboard !== "undefined" && vizLayout instanceof VizDashboard)

        if (isVizDashboard) {

          vizLayout.cards.forEach(card => {
            const cardConfig = configCards?.[card.cardId];
            if (!cardConfig) return;

            const measureIds = cardConfig.measures || []; // e.g. ["measurePopTotal","measurePopGrowth",...]
            measureIds.forEach(measureId => {
              const measureConfig = configMeasures?.[measureId];
              if (measureConfig && measureConfig.jsonName) {
                jsonFileNames.add(measureConfig.jsonName);
              }
            });
          });
        }
      });
    });

    // Update total files
    totalFilesToLoad += jsonFileNames.size;

    // Check availability, and update progress after each check completes
    const checks = Array.from(jsonFileNames).map(uniqueFileName =>
      this.checkDataAvailable(uniqueFileName).then(() => {
        totalLoadedFiles++;
        updateProgress();
      }).catch(error => {
        console.error(`Error checking availability of ${uniqueFileName}:`, error);
        this.dataAvailable[uniqueFileName] = false;
        totalLoadedFiles++;
        updateProgress();
      })
    );

    await Promise.all(checks);
  }

  async checkDataAvailable(fileName) {
    try {
      const response = await fetchWithTimeout(`scenario-data/${this.scnFolder}/${fileName}.json`, { method: 'HEAD' });
      this.dataAvailable[fileName] = response.ok;
    } catch (error) {
      console.log(`Error checking availability of ${fileName}:`, error);
      this.dataAvailable[fileName] = false;
    }
  }

  // Fetches and caches this scenario's data for jsonName the first time it's actually needed
  // (e.g. opening a model entity, switching to this scenario, checking a trend group that
  // references it) - safe to call repeatedly, later calls just return the cached value.
  async ensureDataLoaded(jsonName) {
    if (!jsonName) return null;
    if (this.jsonData[jsonName]) return this.jsonData[jsonName];
    if (this.dataAvailable[jsonName] === false) return null; // known-missing from the startup probe, skip the fetch
    await this.fetchAndStoreData(jsonName);
    return this.jsonData[jsonName];
  }

  getGeoJsonFileNameFromKey(key) {
    try {
      return this.geojsons[key];
    } catch (error) {
      console.warn('Error fetching GeoJSON file name:', error.message);
      return null;  // or handle it based on your needs, e.g., return a default value
    }
  }

  getKeyFileNameFromGeoJsonKey(basegeometrykey, aggeometrykey) {
    try {
      return this.keys[basegeometrykey][aggeometrykey];
    } catch (error) {
      console.warn('Error fetching key file name:', error.message);
      return null;  // or handle it based on your needs, e.g., return a default value
    }
  }
  
  
  getAggregatorKeyFile(selectedAggregator, _baseKey) {
    if (!selectedAggregator || selectedAggregator.agCode != _baseKey) {
      const agKey = selectedAggregator['agGeoJsonKey'];
      // Ensure both keys are non-empty
      if (_baseKey !== "" && agKey !== "") {
        return dataKeys[this.getKeyFileNameFromGeoJsonKey(_baseKey, selectedAggregator['agGeoJsonKey'])];
      }
    }
  }

  // Function to fetch and store data
  async fetchAndStoreData(fileName) {
    try {
        const response = await fetchWithTimeout(`scenario-data/${this.scnFolder}/${fileName}.json`);

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
    } finally {
        // Give the browser a chance to process queued input between files, since parsing
        // these can block the main thread while it runs.
        await yieldToMainThread();
    }
  }

  getDataForFilter(a_jsonDataKey, a_filter) {
    console.log('getDataForFilter');
    return this.jsonData[a_jsonDataKey].data[String(a_filter).toLowerCase()];
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
  
  // a_attributeCode is OPTIONAL: when provided, only that attribute is aggregated and the
  // result is flattened to { key: value } instead of { key: { attrCode: value, ... } } - used
  // by measure.js's dashboard cards, which only ever want one attribute's value at a time.
  getDataForFilterOptionsList(a_jsonDataKey, a_lstFilters, a_agFilterOptionsMethod = "sum", a_attributeCode = null) {
    let aggregatedData = {}, countData = {}, minData = {}, maxData = {};
    const _parent = this;

    if (typeof a_lstFilters === "string") {
      a_lstFilters = a_lstFilters ? [a_lstFilters] : [""];
    }

    function ensureAttributeInitialized(key, attrCode) {
      if (!aggregatedData[key][attrCode]) {
        aggregatedData[key][attrCode] = 0;
        countData[key][attrCode] = 0;
        minData[key][attrCode] = Number.POSITIVE_INFINITY;
        maxData[key][attrCode] = Number.NEGATIVE_INFINITY;
      }
    }

    function aggregateFields(data, method) {
      Object.keys(data).forEach(key => {
        if (!aggregatedData[key]) {
          aggregatedData[key] = {};
          countData[key] = {};
          minData[key] = {};
          maxData[key] = {};
        }

        _parent.jsonData[a_jsonDataKey].attributes.forEach(attr => {
          const attrCode = attr.attributeCode;
          if (a_attributeCode && attrCode !== a_attributeCode) return;
          if (data[key].hasOwnProperty(attrCode)) {
            ensureAttributeInitialized(key, attrCode);
            const val = data[key][attrCode];
            aggregatedData[key][attrCode] += val;

            switch(method) {
              case "average":
                countData[key][attrCode]++;
                break;
              case "minimum":
                if (val < minData[key][attrCode]) minData[key][attrCode] = val;
                break;
              case "maximum":
                if (val > maxData[key][attrCode]) maxData[key][attrCode] = val;
                break;
            }
          }
        });
      });
    }

    // Build a lookup from normalized key -> actual data key, so filter segment order doesn't matter
    const dataObj = _parent.jsonData[a_jsonDataKey]?.data ?? {};

    const normalizedKeyMap = Object.keys(dataObj).reduce((acc, key) => {
      const normalized = key.toLowerCase().split("_").sort().join("_");
      acc[normalized] = key;
      return acc;
    }, {});

    a_lstFilters.forEach(filter => {
      const normalizedFilter = String(filter).toLowerCase().split("_").sort().join("_");
      // Use hasOwnProperty rather than a truthiness check on matchingKey - unfiltered
      // attributes (e.g. Population) store their totals under the empty-string key, which
      // is a valid match but is falsy, so `if (matchingKey)` alone would wrongly skip it.
      if (Object.prototype.hasOwnProperty.call(normalizedKeyMap, normalizedFilter)) {
        const matchingKey = normalizedKeyMap[normalizedFilter];
        const _data = dataObj[matchingKey];

        if (_data) {
          aggregateFields(_data, a_agFilterOptionsMethod);
        }
      }
    });

    switch (a_agFilterOptionsMethod) {
      case "average":
        Object.keys(aggregatedData).forEach(key => {
          Object.keys(aggregatedData[key]).forEach(attrCode => {
            aggregatedData[key][attrCode] /= countData[key][attrCode];
          });
        });
        break;
      case "minimum":
        aggregatedData = minData;
        break;
      case "maximum":
        aggregatedData = maxData;
        break;
    }

    if (a_attributeCode) {
      const flat = {};
      Object.keys(aggregatedData).forEach(key => {
        if (aggregatedData[key] && a_attributeCode in aggregatedData[key]) {
          flat[key] = aggregatedData[key][a_attributeCode];
        }
      });
      return flat;
    }

    return aggregatedData;
  }

  // OD-style matrix datasets (e.g. j-distsml-od) nest their "long" location filter (the
  // opposite-end zone) as the leading segment of each top-level data key, e.g. data["3_ALL"]
  // is origin zone 3, purpose ALL, holding {destinationId: {attrCode: value}}. This walks
  // every origin found in the data, reuses getDataForFilterOptionsList to resolve the
  // destination-keyed values for that origin, and optionally re-aggregates both the origin
  // and destination axes through an aggregatorKeyFile (same lookup vizmap/viztrends use).
  getMatrixDataForFilteredOptionListWithAggregator(a_jsonDataKey, a_lstFilters, a_attributeCode, a_selectedAggregator, a_baseGeoJsonKey, a_baseGeoJsonId, a_agFilterOptionsMethod = "sum") {
    const originIds = new Set();

    Object.keys(this.jsonData[a_jsonDataKey].data).forEach(key => {
      const match = key.match(/^(\d+)_/);
      if (match) {
        originIds.add(match[1]);
      }
    });

    const sortedOriginIds = Array.from(originIds).sort((a, b) => a - b);

    const combinedData = {};
    sortedOriginIds.forEach(originId => {
      const modifiedFilters = a_lstFilters.map(filter => `${originId}_${filter}`);
      const originData = this.getDataForFilterOptionsList(a_jsonDataKey, modifiedFilters, a_agFilterOptionsMethod);
      combinedData[originId] = this.extractAttribute(originData, a_attributeCode);
    });

    if (!a_selectedAggregator || a_selectedAggregator.agCode === a_baseGeoJsonId) {
      return combinedData;
    }

    const aggregatorKeyFile = this.getAggregatorKeyFile(a_selectedAggregator, a_baseGeoJsonKey);
    if (!aggregatorKeyFile) {
      return combinedData;
    }

    const agCode = a_selectedAggregator.agCode;
    const idToAggCode = new Map(
      aggregatorKeyFile.map(record => [String(record[a_baseGeoJsonId]), record[agCode]])
    );

    const aggregatedData = {};
    Object.keys(combinedData).forEach(originId => {
      const mappedOrigin = idToAggCode.get(originId) ?? originId;
      aggregatedData[mappedOrigin] = aggregatedData[mappedOrigin] || {};

      Object.keys(combinedData[originId]).forEach(destId => {
        const mappedDest = idToAggCode.get(destId) ?? destId;
        aggregatedData[mappedOrigin][mappedDest] = (aggregatedData[mappedOrigin][mappedDest] || 0) + combinedData[originId][destId];
      });
    });

    return aggregatedData;
  }

  extractAttribute(data, a_attributeCode) {
    const result = {};
    Object.keys(data).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(data[key], a_attributeCode)) {
        result[key] = data[key][a_attributeCode];
      }
    });
    return result;
  }

}