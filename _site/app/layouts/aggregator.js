class Aggregator {
  constructor(agCode) {
    
    this.agCode = agCode;

    console.log('aggregator:' + agCode)

    const _configAggregator = configAggregators[this.agCode];

    if (_configAggregator === undefined) {
      return; // Exit the constructor if _configAggregator is undefined
    }

    this.agTitleText         = _configAggregator.agTitleText;
    this.agCodeLabelField    = _configAggregator.agCodeLabelField;
    this.agOptions           = _configAggregator.agOptions;
    this.agGeoJsonKey        = _configAggregator.agGeoJsonKey;
    this.agCodeLabelField    = _configAggregator.agCodeLabelField,
    this.selected            = _configAggregator.agSelected ? _configAggregator.agSelected : [];

    let _options= [];

    // only run if it is vizTrends and has an agGeoJson defined
    if (this.agGeoJsonKey) {
      
      // Step 1: Collect all unique filenames
      let filenamesSet = new Set();
      for (let scenario of dataScenarios) {
        let geojson_filename = scenario.geojsons[this.agGeoJsonKey];
        filenamesSet.add(geojson_filename);
      }

      // Step 2: Iterate through the unique filenames
      for (let filename of filenamesSet) {
        if (dataGeojsons[filename]) {
          _options = _options.concat(
            dataGeojsons[filename].features.map(feature => ({
              value: String(feature.properties[this.agCode]), // Assuming these are under `properties`
              label: feature.properties[this.agCodeLabelField]  // Adjust if they are located elsewhere
            }))
          );
        }
      }
    
      // Remove duplicates
      let uniqueOptions = [];
      let seen = new Set();
      for (let option of _options) {
        if (!seen.has(option.value)) {
          seen.add(option.value);
          uniqueOptions.push(option);
        }
      }
    
      // Sort by label with error checking
      uniqueOptions.sort((a, b) => {
        const labelA = a.label ? String(a.label) : '';
        const labelB = b.label ? String(b.label) : '';
        return labelA.localeCompare(labelB);
      });
      _options = uniqueOptions;
    } else {
      _options = this.agOptions;
    }

    this.filterData = {
      fCode           : this.agCode                       ,
      fName           : this.agTitleText                ,
      fWidget         : "checkboxes"                      ,
      fOptions        : _options                          ,
      fSelected       : this.selected                     ,
      subAgDisplayName: _configAggregator.subAgDisplayName,
      subAgSelected   : _configAggregator.subAgSelected   ,
      subAgOptions    : _configAggregator.subAgOptions
    }
  }
}