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
    this.selected            = _configAggregator.agDefaultSelected ? _configAggregator.agDefaultSelected : [];

    let _options      = [];
    let _optionsAg    = [];
    let _optionsSubAg = [];

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
  
      // sub aggregator

      if (_configAggregator.subAgCode) {
        this.baseAgCode = _configAggregator.baseAgCode;
        this.subAgCode  = _configAggregator.subAgCode ;
  
        const _configBaseAg = configAggregators[this.baseAgCode];
        const _configSubAg  = configAggregators[this.subAgCode ];
  
        // Step 1: Collect all unique filenames for base ag
        let filenamesSetAg = new Set();
        for (let scenario of dataScenarios) {
          let geojson_filename = scenario.geojsons[_configBaseAg.agGeoJsonKey];
          filenamesSetAg.add(geojson_filename);
        }
  
        
        // Step 2: Iterate through the unique filenames
        for (let filenameAg of filenamesSetAg) {
          if (dataGeojsons[filenameAg]) {
            _optionsAg = _optionsAg.concat(
              dataGeojsons[filenameAg].features.map(feature => ({
                value: feature.properties[this.agCode], // Assuming these are under `properties`
                subag: feature.properties[this.subAgCode]  // Adjust if they are located elsewhere
              }))
            );
          }
        }
      
        // Remove duplicates
        let uniqueOptionsAg = [];
        let seenAg = new Set();
        
        for (let option of _optionsAg) {
            // Convert the object to a JSON string for comparison
            let optionKey = JSON.stringify(option);
        
            if (!seenAg.has(optionKey)) {
                seenAg.add(optionKey);
                uniqueOptionsAg.push(option);
            }
        }
  
        let combinedRecords = {};
  
        // Group records by 'value' field
        for (let record of uniqueOptionsAg) {
          if (!combinedRecords[record.value]) {
            let option = _options.find(option => String((option.value)) === String((record.value)));
    
            combinedRecords[record.value] = {
              value: String(record.value),
              label: option ? option.label : 'Unknown Label',  // Handle error by setting a default label
              subag: []
            };
          }
          combinedRecords[record.value].subag.push(String(record.subag));
        }
  
        // Add 'All' option to each 'subag' array
        for (let key in combinedRecords) {
          if (combinedRecords.hasOwnProperty(key)) {
              combinedRecords[key].subag.unshift('All');
          }
        }

        // Convert grouped object back to array
        _optionsAg = Object.values(combinedRecords);
  
        if(_optionsAg) {
          // Sort by label with error checking
          _optionsAg.sort((a, b) => {
            const labelA = a.label ? String(a.label) : '';
            const labelB = b.label ? String(b.label) : '';
            return labelA.localeCompare(labelB);
          });
          _options = _optionsAg;
        }

        // get subag options
        // Step 1: Collect all unique filenames for base ag
        let filenamesSetSubAg = new Set();
        for (let scenario of dataScenarios) {
          let geojson_filename = scenario.geojsons[_configSubAg.agGeoJsonKey];
          filenamesSetSubAg.add(geojson_filename);
        }

          
        // Step 2: Iterate through the unique filenames
        for (let filenameSubAg of filenamesSetSubAg) {
          if (dataGeojsons[filenameSubAg]) {
            _optionsSubAg = _optionsSubAg.concat(
              dataGeojsons[filenameSubAg].features.map(feature => ({
                value: String(feature.properties[this.subAgCode]), // Assuming these are under `properties`
                label: feature.properties[configAggregators[this.subAgCode].agCodeLabelField]  // Adjust if they are located elsewhere
              }))
            );
          }
        }
      
        // Remove duplicates
        let uniqueOptionsSubAg = [];
        let seenSubAg = new Set();
        for (let option of _optionsSubAg) {
          if (!seenSubAg.has(option.value)) {
            seenSubAg.add(option.value);
            uniqueOptionsSubAg.push(option);
          }
        }
      
        // Sort by label with error checking
        uniqueOptionsSubAg.sort((a, b) => {
          const labelA = a.label ? String(a.label) : '';
          const labelB = b.label ? String(b.label) : '';
          return labelA.localeCompare(labelB);
        });

        const _all = { value: "All", label: "All" };


        _optionsSubAg = [_all, ...uniqueOptionsSubAg];

      }
    } else {
      _options = this.agOptions;
    }

    this.filterData = {
      fCode           : this.agCode                       ,
      fName           : this.agTitleText                  ,
      fWidget         : "checkboxes"                      ,
      fOptions        : _options                          ,
      fSelected       : this.selected                     ,
      subAgDisplayName: _configAggregator.subAgDisplayName,
      subAgSelected   : _configAggregator.subAgSelected   ,
      subAgOptions    : _optionsSubAg
    }
  }
}