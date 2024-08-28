class VizTrends {
  constructor(data, modelEntity) {
    this.id = data.id || this.generateIdFromText(data.attributeTitle); // use provided id or generate one if not provided
    console.log('viztrends:construct:' + this.id);

    this.baseGeoJsonKey = data.baseGeoJsonKey;
    this.baseGeoJsonId = data.baseGeoJsonId;
    this.jsonName = data.jsonName;
     
    // link to parent
    this.modelEntity = modelEntity;

    this.sidebar = new VizSidebar(data.attributes,
                                  data.attributeSelected,
                                  data.attributeTitle,
                                  data.attributeInfoTextHtml,
                                  data.filters,
                                  data.aggregators,
                                  data.aggregatorSelected,
                                  data.aggregatorTitle,
                                  data.dividers,
                                  data.dividerSelected,
                                  data.dividerTitle,
                                  this)
    
    // set up scenario checker
    const _scenariocheckerdiv = document.getElementById('trendScenarios');

    // Check if the innerHTML is empty and then initialize if it is, otherwise set equal to original
    if (_scenariocheckerdiv.innerHTML.trim() === '') {
      scenarioChecker = new WijCheckboxes('scenario-checker', 'Select Scenarios', dataScenarioTrends.filter(a=>a.displayByDefault==true).map(item => item.scnTrendCode), dataScenarioTrends.map(item => ({ value: item.scnTrendCode, label: item.displayName })), this);
      _scenariocheckerdiv.appendChild(scenarioChecker.render());
    }

    this.modeOptions = [{ value: 'regular'   , label: 'Values'         , title:''                  },
                        { value: 'pct_change', label: 'Percent Change' , title:' - Percent Change from Base Year' },
                        { value: 'abs_change', label: 'Absolute Change', title:' - Absolute Change from Base Year'}];

    // add settings in header
    const _header = document.getElementById('trendChange');
    if (_header.innerHTML.trim() === '') {
      modeSelect  = new WijSelect(this.id + "-mode-select",
                                      "Select Chart Mode",
                                      "regular",
                                      this.modeOptions,
                                      this);
      _header.appendChild(modeSelect.render());
    }
  }
  
  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  renderSidebar() {
    // since shared scenario checker, have to make sure vizLayout is set correctly in checkboxes
    scenarioChecker.vizLayout = this;
    modeSelect.vizLayout = this;

    this.sidebar.render();
  }

  afterUpdateSidebar() {
    console.log('viztrends:afterSidebarUpdate:' + this.id);
    this.updateDisplay();
  }
  
  afterUpdateAggregator() {
    console.log('viztrends:afterUpdateAggregator:' + this.id);
    //document.getElementById(this.comboSelector.id + '-container').innerHTML = '';
    //this.comboSelector.render();
    //this.renderSidebar();
    this.sidebar.render();
    this.afterUpdateSidebar();
  }

  afterFilterUpdate() {

  }

  getScenarioMain() {
    return this.getScenario(         selectedScenario_Main.modVersion,
                                     selectedScenario_Main.scnGroup,
                            parseInt(selectedScenario_Main.scnYear, 10)); // Assuming it's a number
  }

  getScenario(_modVersion, _scnGroup, _scnYear) {
    return dataScenarios.find(scenario =>
                              scenario.modVersion === _modVersion &&
                              scenario.scnGroup   === _scnGroup   &&
                              scenario.scnYear    === _scnYear
                              ) || null;
  }
  
  // get the attribute code that is selected
  getACode() {
    return this.sidebar.getACode();
  }

  // get the divider code that is selected
  getDCode() {
    return this.sidebar.getDCode();
  }

  getSelectedAggregator() {
    return this.sidebar.getSelectedAggregator();
  }
  
  getAgNameFromAgId(id) {
    if (this.sidebar.aggregators) {
      return this.getSelectedAggregator().filterData.fOptions.find(a => a.value === String(id)).label || '';
    }
  }

  getFilterGroup() {
    return this.getScenarioMain().getFilterGroupForAttribute(this.jsonName, this.getACode());
  }

  getFilterGroupArray() {
    var _filterGroup = this.getFilterGroup();
  
    if (_filterGroup) {
      // Split the _filterGroup by "_"
      return _filterGroup.split("_");
    }
  }

//  getChartData(attributeCode, filterSelectionData) {
//    if (attributeCode === 'aVmt') {
//        return filterSelectionData.aVmt; // Change this to the appropriate property based on your data structure
//    } else if (attributeCode === 'aVht') {
//        return filterSelectionData.aVht; // Change this to the appropriate property based on your data structure
//    } else if (attributeCode === 'aLMl') {
//        return filterSelectionData.aLMl;
//    } else {
//        return 0; // return 0 if nothing is found
//    }
//
//    //This needs to include filter direction, tod, and vehicle type -- not just attribute. Do it here: (copy what bill did in vizmap L#272)
//
//    // Handle other display names if needed
//    return null;
//  }

  getSegidOptions() {
    const segidOptions = [];
    const filter = this.getFilterGroup();

    const scenarioData = this.getScenarioMain().jsonData['roadway-trends'].data[filter];
    Object.keys(scenarioData).forEach(segId => {
        segidOptions.push(segId);
    });

    return segidOptions;
  }
    
  createLineChart(attributeCode, labels, chartData, agIdsString) {
    console.log('viztrends:Creating the chart:' + this.id);
    console.log("Selected radio button option under 'Display':", attributeCode);

    var mode = "";
    if (modeSelect) {
      mode = modeSelect.selected;
    } else {
      mode = 'regular';
    }
    
    const _aggCode = this.getSelectedAggregator();
    const _title = _aggCode.agTitleText + ' ' + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + ' Trends' + this.modeOptions.find(option => option.value===mode).title;

    const _subTitle = this.sidebar.getSelectedOptionsAsLongText();

    // build y-axis title
    var _yaxisTitle = this.sidebar.getADisplayName();

    if (this.sidebar.dividers) {
      if (this.getDCode()!="Nothing") {
        _yaxisTitle += ' divided by ' + this.sidebar.dividers.find(divider => divider.attributeCode === this.getDCode()).aDisplayName;
      }
    }

    _yaxisTitle += this.modeOptions.find(option => option.value===mode).title;

    const containerHeaderElement = document.getElementById('trendHeader');
    containerHeaderElement.innerHTML = '';
    
    const _titleDiv = document.createElement('div');
    _titleDiv.id = 'charttitle';
    _titleDiv.innerHTML = '<h1>' + _title + '</h1>';
    containerHeaderElement.appendChild(_titleDiv);

    const _subTitleDiv = document.createElement('div');
    _subTitleDiv.id = 'chartsubtitle';
    _subTitleDiv.innerHTML = _subTitle;
    containerHeaderElement.appendChild(_subTitleDiv);
  
    const containerElement = document.getElementById('trendContent');
    containerElement.innerHTML = '';

    const chartContainer = document.createElement('div');
    chartContainer.id = 'chartContainer';
    containerElement.appendChild(chartContainer);
  
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
  
    const ctx = canvas.getContext('2d');
    let currentChart = null;
  
    const agIds = this.recastArrayIfNumeric(Object.keys(chartData));
  
    const calculatePercentChange = (currentValue, initialValue) => ((currentValue - initialValue) / initialValue) * 100;
  
    const calculateAbsoluteChange = (currentValue, initialValue) => currentValue - initialValue;
  
    const modifyDataForChange = (values, changeType) => {
      const initialValue = values[Object.keys(values)[0]]; // Assuming the first value is the baseline
      return Object.keys(values).map(year => {
        const currentValue = +values[year];
        let change;
        if (changeType === 'pct_change') {
          change = calculatePercentChange(currentValue, +initialValue);
        } else if (changeType === 'abs_change') {
          change = calculateAbsoluteChange(currentValue, +initialValue);
        }
        return { 
          x: parseInt(year, 10), // Ensure the year is a number
          y: change // Calculate change based on the mode
        };
      });
    };
      
    const createChart = () => {
      if (currentChart) {
        // Destroy existing Chart instance
        currentChart.destroy();
      }
  
      const scenarioGroups = dataScenarioTrends.filter(a => scenarioChecker.selected.includes(a.scnTrendCode)).map(item => {
        return { name: item.scnTrendCode };
      });
  
      currentChart = new Chart(ctx, {
        type: 'scatter', // Use scatter chart type
        data: {
          datasets: agIds.flatMap(agId => {
            // For each agId, create a dataset for each scenario group
            return scenarioGroups.map(scenarioGroup => {
              const name = scenarioGroup.name;
            
              // Error checking: Ensure name exists and is a valid string
              if (!name || typeof name !== 'string') {
                console.error('Invalid scenario group name:', name);
                return null; // Skip this scenario group if name is invalid
              }
            
              let values = chartData[agId][name];
              let dataPoints;
            
              // Error checking: Ensure values exist and are of expected type (object)
              if (!values || typeof values !== 'object') {
                console.error(`Invalid or missing values for aggregator ID ${agId} and scenario ${name}`);
                return null; // Skip this scenario if values are invalid
              }
            
              // Process data points based on mode
              if (mode === 'pct_change' || mode === 'abs_change') {
                try {
                  dataPoints = modifyDataForChange(values, mode);
                } catch (error) {
                  console.error(`Error modifying data for change: ${error.message}`);
                  dataPoints = []; // Handle error and set dataPoints to an empty array
                }
              } else { // mode === 'regular'
                try {
                  dataPoints = Object.keys(values).map(year => {
                    if (isNaN(year)) {
                      throw new Error(`Invalid year value: ${year}`);
                    }
            
                    const yValue = +values[year].toPrecision(4);
                    if (isNaN(yValue)) {
                      throw new Error(`Invalid numeric value for year ${year}: ${values[year]}`);
                    }
            
                    return { 
                      x: parseInt(year, 10), // Ensure the year is a number
                      y: yValue // Round y values to 4 significant figures
                    };
                  });
                } catch (error) {
                  console.error(`Error processing data points: ${error.message}`);
                  dataPoints = []; // Handle error and set dataPoints to an empty array
                }
              }
            
              return {
                label: this.getAgNameFromAgId(agId) + ':' + name,
                data: dataPoints,
                fill: false,
                borderColor: this.getRandomColor(),
                borderWidth: 3,
                pointRadius: 8,
                showLine: true // Draw lines between points
              };
            }).filter(dataset => dataset !== null); // Filter out any null datasets
            
          })
        },
        options: {
          scales: {
            x: {
              type: 'linear',
              position: 'bottom',
              min: 2019,
              ticks: {
                callback: function(value) {
                  return value.toString().replace(/,/g, '');
                }
              }
            },
            y: {
              beginAtZero: mode !== 'pct_change' && mode !== 'abs_change',
              ticks: {
                callback: function(value) {
                  let sign = value > 0 ? "+" : ""; // Determine the sign for positive values
                  if (mode === 'pct_change') {
                    return sign + Number(value).toFixed(0) + '%'; // Format as percent for pct_change mode
                  } else if (mode === 'abs_change') {
                    // Format with commas for abs_change mode for better readability
                    return sign + Number(value).toLocaleString(); 
                  } else {
                    // Format with commas for regular mode
                    return Number(value).toLocaleString(); 
                  }
                }
              },
              title: {
                display: true,
                text: _yaxisTitle, // Replace with your actual label text
              }
            }
          }
        }
      });
    };
  
    // Initial chart creation
    createChart();
  }
  

  getRandomColor(index) {
    // Generate a random color based on index
    const colors = [
        'rgba( 75, 192, 192, 1)',
        'rgba(255,  99, 132, 1)',
        'rgba(255, 206,  86, 1)',
        'rgba( 54, 162, 235, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159,  64, 1)'
    ];

    return colors[index % colors.length];
  }

  recastArrayIfNumeric(arr) {
    // Check if every item in the array is a numeric string
    const allNumeric = arr.every(item => !isNaN(item) && typeof item === 'string');

    // If all items are numeric strings, convert them to integers
    if (allNumeric) {
      return arr.map(item => parseInt(item, 10));
    } else {
      // Return the original array if not all items are numeric strings
      return arr;
    }
  }

  updateDisplay() {
    console.log('viztrends:updateDisplay:' + this.id);

    const _aCode = this.getACode();
    const _dCode = this.getDCode();
    const _agCode =  this.getSelectedAggregator().agCode;

    var _selectedDivider;

    if (this.sidebar.dividers) {
      _selectedDivider = this.sidebar.dividers.find(divider => divider.attributeCode === _dCode) || null;
    }

    const _agIds = this.recastArrayIfNumeric(this.sidebar.aggregatorFilter.getSelectedOptionsAsList());
  
    const labels = [2019,2023,2028,2032,2042,2050];
    const chartData = {};

    var _data_divide;
    var _geojsondata_divide;  

    const dataScenarioTrends_selected = dataScenarioTrends.filter(a => scenarioChecker.selected.includes(a.scnTrendCode));

    dataScenarioTrends_selected.forEach(trend => {

      const _scnTrendCode = trend.scnTrendCode;

      trend.modelruns.forEach(modelrun => {
        
        const _scnYear    = modelrun.scnYear;
        const _modVersion = modelrun.modVersion;
        const _scnGroup   = modelrun.scnGroup;
        const _scenario   = this.getScenario(_modVersion, _scnGroup, _scnYear);
        
        if (_scenario) {
        
          // get geojson key data
          const _geojsondata = dataGeojsons[_scenario.geojsons[this.baseGeoJsonKey]];

          if (!_geojsondata) {
            return;
          }

          _data_divide = {};
          _geojsondata_divide = {};

          if (_dCode!="Nothing") {
            _data_divide = _scenario.jsonData[_selectedDivider.jsonName].data[_selectedDivider.filter];
            _geojsondata_divide = dataGeojsons[_scenario.geojsons[_selectedDivider.baseGeoJsonKey]];
          }

          _agIds.forEach(agId => {
            
            const _filteredFeatures = _geojsondata.features.filter(feature => 
              feature.properties[_agCode]==agId
            );

            if (_dCode!="Nothing") {

              var _sumDivide = 0;

              // get divide features with the same agId
              const filteredFeatures_divide = _geojsondata_divide.features.filter(feature => 
                feature.properties[_agCode]==agId
              );

              // loop through divide features and baseGeoJsonIds
              var filteredFeatures_divide_set = new Set();
              filteredFeatures_divide.forEach((feature) => {
                if (feature.properties && feature.properties[_selectedDivider.baseGeoJsonId]) {
                  filteredFeatures_divide_set.add(feature.properties[_selectedDivider.baseGeoJsonId]);
                }
              });

              const _filteredFeatures_divide_list = [...filteredFeatures_divide_set];

              //filter the zonesSeData to only those zones that are within filteredTazList
              const filtered_geojsondata_divide = Object.keys(_geojsondata_divide)
                .filter((key) => _filteredFeatures_divide_list.includes(parseInt(key)))
                .reduce((result, key) => {
                  result[key] = _geojsondata_divide[key];
                  return result;
              }, {});

              //sum up all the "selected divide by attribute"'s  value within the filtered zonesSeData list to get a sum total
              for (const key in _filteredFeatures_divide_list) {
                if (_data_divide[_filteredFeatures_divide_list[key]][_dCode] !== undefined) {
                  _sumDivide += _data_divide[_filteredFeatures_divide_list[key]][_dCode];
                }
              }
            }

            if (!chartData[agId]) {
              chartData[agId] = {};
            }
            if (!chartData[agId][_scnTrendCode]) {
              chartData[agId][_scnTrendCode] = {};
            }

            chartData[agId][_scnTrendCode][_scnYear] = 0;

            const _filteredScenario = _scenario.getDataForFilterOptionsList(this.jsonName, this.sidebar.getListOfSelectedFilterOptions());

            _filteredFeatures.forEach(feature => {

              const baseId = feature.properties[this.baseGeoJsonId];
              const filterSelectionData = _filteredScenario[baseId];
      
              if (filterSelectionData) {
                //const selectedValue = this.getChartData(_aCode, filterSelectionData);

                const selectedValue = filterSelectionData[_aCode];

                if (selectedValue == null | selectedValue == undefined) {
                  console.log("null data found in here: " + agId + '_' + _scnTrendCode + '_' + _scnYear)
                }

                if (selectedValue !== null & selectedValue !== undefined) {
                  chartData[agId][_scnTrendCode][_scnYear] += selectedValue;
                }
              }
            })

            if (_dCode!="Nothing") {
              chartData[agId][_scnTrendCode][_scnYear] /= _sumDivide;
            }
          });
        }
      });
    });

    this.createLineChart(_aCode, labels, chartData, _agIds);
    /*
    var filteredTaz = {};
    var filteredTazSeData = {};
    console.log('viztrends:Going to fetch the data now... agIDsString is ' + _agIds);
    fetch("data/tazWithAggFields.geojson")
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Filter features where CO_FIPS is 35
        filteredTaz = data.features.filter(feature => 
          _agIds.includes(feature.properties[this.sidebar.aggregatorSelect.selected])
        );

        var filteredTazList = [];
        // Loop through filteredTaz and extract TAZID values
        filteredTaz.forEach((taz) => {
          // Assuming TAZID is always present in the properties object
          if (taz.properties && taz.properties['TAZID']) {
            // Check if TAZID is not already in the array
            if (!filteredTazList.includes(taz.properties['TAZID'])) {
              filteredTazList.push(taz.properties['TAZID']);
            }
          }
        });

        //read in the zonesSeData
        var sumAttribute = 0;
        scnGroupYearCombos.forEach(combo => {
          const _scnDisplay = combo.scnDisplay;
          const _scnYear = combo.scnYear;
          const _modVersion = combo.modVersion;
          const _scnGroup = combo.scnGroup;
          const _scenarioDivideBy = this.getScenario(_modVersion, _scnGroup, _scnYear);

          if (_scenarioDivideBy) {

            const tazSeData = _scenarioDivideBy.jsonData['zones-se-vizmap'].data[""];
            
            //filter the zonesSeData to only those zones that are within filteredTazList
            filteredTazSeData = Object.keys(tazSeData)
            .filter((key) => filteredTazList.includes(parseInt(key)))
            .reduce((result, key) => {
              result[key] = tazSeData[key];
              return result;
            }, {});

          }
          //sum up all the "selected divide by attribute"'s  value within the filtered zonesSeData list to get a sum total
          for (const key in filteredTazSeData) {
            if (filteredTazSeData[key][_dCode] !== undefined) {
              sumAttribute += filteredTazSeData[key][_dCode];
            }
          }
          console.log(sumAttribute);
        });
        
        if (sumAttribute>0) {
          //loop through the chartData and divide all the values by the sum just calculated
          for (const key1 in chartData) {
            for (const key2 in chartData[key1]) {
              for (const key3 in chartData[key1][key2]) {
                chartData[key1][key2][key3] /= sumAttribute;
              }
            }
          }
        }
        
        this.createLineChart(_aCode, labels, chartData, _agIdsString);

      })
      .catch(error => {
        console.error('Error reading the JSON file:', error);
      });
*/
    }

}
