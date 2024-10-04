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
    const _scenariochooserdiv = document.getElementById('trendScenarios');

    // Check if the innerHTML is empty and then initialize if it is, otherwise set equal to original
    if (_scenariochooserdiv.innerHTML.trim() === '') {
      scenarioChecker = new WijCheckboxes('scenario-checker', 'Select Trend Groups', dataScenarioTrends.filter(a=>a.displayByDefault==true).map(item => item.scnTrendCode), dataScenarioTrends.map(item => ({ value: item.scnTrendCode, label: item.alias })), this);
      _scenariochooserdiv.appendChild(scenarioChecker.render());
      const firstScnTrendCode = dataScenarioTrends.find(a => a.displayByDefault === true)?.scnTrendCode; 
      scenarioRadioer = new WijRadio('scenario-radioer', 'Select Trend Group', firstScnTrendCode, dataScenarioTrends.map(item => ({ value: item.scnTrendCode, label: item.alias })), this);
      _scenariochooserdiv.appendChild(scenarioRadioer.render());
      const scenarioRadioerwijdiv = document.getElementById('scenario-radioer-wij-container');
      scenarioRadioerwijdiv.style.display = 'none';
    }

    this.modeOptions = [{ value: 'regular'   , label: 'Values'                 , title:''                                 },
                        { value: 'change'    , label: 'Change from Base Year'  , title:' - Change from Base Year'         },
                        { value: 'pct_change', label: '% Change from Base Year', title:' - Percent Change from Base Year' }];

    // add settings in header
    const _trendChange = document.getElementById('trendChange');
    if (_trendChange.innerHTML.trim() === '') {
      modeSelect  = new WijSelect(this.id + "-mode-select",
                                  "Select Chart Mode",
                                  "regular",
                                  this.modeOptions,
                                  this);
      _trendChange.appendChild(modeSelect.render());
    }

    this.lineModeOptions = [{ value: 'scatter'   , label: 'Regular Chart'      , title:''},
                            { value: 'stacked'   , label: 'Stacked Chart'      , title:''},
                            { value: 'stacked100', label: '100% Stacked Chart' , title:''}];

    // add settings in header
    const _seriesMode = document.getElementById('trendSeriesMode');
    if (_seriesMode.innerHTML.trim() === '') {
      seriesModeSelect  = new WijSelect(this.id + "-line-mode-select",
                                  "Select Series Mode",
                                  "scatter",
                                  this.lineModeOptions,
                                  this);
      _seriesMode.appendChild(seriesModeSelect.render());
    }
    this.seriesSelect = {};

    if (Object.keys(yearSelect).length === 0 && yearSelect.constructor === Object) {
      // create years list
      // "All Years" is first
      let _yearList = [{ value: "allYears", label: "All Years" }];

      // sort the years from dataScenarios before appending
      const sortedYears = dataScenarios
        .map(item => ({ value: String(item.scnYear), label: String(item.scnYear) }))
        .sort((a, b) => a.value - b.value); // Sort by year (value)

      // append sorted years to yearList, ensuring no duplicates
      _yearList = _yearList.concat(
        sortedYears.filter((item, index, self) => 
          index === self.findIndex((t) => t.value === item.value) // Remove duplicates
        )
      );
      
      // add settings in header
      const _trendYears = document.getElementById('trendYears');
      if (_trendYears.innerHTML.trim() === '') {
        yearSelect  = new WijSelect("trends-year-select",
                                        "Select Year",
                                        "allYears",
                                        _yearList,
                                        this);
        _trendYears.appendChild(yearSelect.render());
      }
    }

    this.defaultSeries = 'trendGroup'; // default selection

    // Function to copy the table content to the clipboard
    function copyTableToClipboard() {
      const table = document.getElementById('trendTable').innerHTML;

      // Create a temporary textarea to hold the table HTML
      const tempTextArea = document.createElement('textarea');
      tempTextArea.style.position = 'fixed'; // Avoid scrolling to bottom
      tempTextArea.style.opacity = 0; // Make it invisible
      tempTextArea.value = table;

      // Append the textarea to the document
      document.body.appendChild(tempTextArea);

      // Select the content and copy it to clipboard
      tempTextArea.select();
      document.execCommand('copy');

      // Remove the temporary textarea
      document.body.removeChild(tempTextArea);

      // Provide feedback to the user (optional)
      //alert('Table copied to clipboard!');
    }

    // Add event listener to the copy button
    document.getElementById('copyTableBtn').addEventListener('click', copyTableToClipboard);

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
  
  updateScenarioSelector() {
    // create series list
    // scenarios is first
    let _seriesList = [{ value: "trendGroup", label: "Trend Groups" }];
    // aggregator is next
    //_seriesList = _seriesList.concat([{ value: 'aggregator', label: "Summary Geography" }]);

    _seriesList = _seriesList.concat([{ value: '--', label: '------Filters-------'}]);

    // filters are last
    _seriesList = _seriesList.concat(
      this.sidebar.filters
        .filter(filter => filter.isVisible()) // Only keep visible filters
        .map(filter => ({ value: filter.fCode, label: filter.name })) // Map the remaining filters
    );

    // add settings in header
    let _selection = this.seriesSelect.selected;
    if (!_selection) {
      _selection = this.defaultSeries;
    }
    const _trendSeries = document.getElementById('trendSeries');
    _trendSeries.innerHTML = '';
    this.seriesSelect  = new WijSelect(this.id + "-series-select",
                                        "Select Chart Series",
                                        _selection,
                                        _seriesList,
                                        this);
    _trendSeries.appendChild(this.seriesSelect.render());
  }

  afterUpdateScenarioSelector() {
    console.log('viztrends:afterUpdateScenarioSelector:' + this.id);
    this.updateDisplay();
  }

  afterUpdateSidebar() {
    console.log('viztrends:afterSidebarUpdate:' + this.id);
    this.updateScenarioSelector();
    this.updateDisplay();
  }
  
  afterUpdateAggregator() {
    console.log('viztrends:afterUpdateAggregator:' + this.id);
    //document.getElementById(this.comboSelector.id + '-container').innerHTML = '';
    //this.comboSelector.render();
    //this.renderSidebar();
    this.sidebar.render();
    this.updateScenarioSelector();
    this.afterUpdateSidebar();
  }

  afterFilterUpdate() {

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
    const scenarioWithData = getFirstScenarioWithTrendData(this.jsonName);
    if (scenarioWithData) {
      let _baseFilterGroup = scenarioWithData.getFilterGroupForAttribute(this.jsonName, this.getACode());
      let _selectedAttribute = this.sidebar.attributes.find(attribute =>
        attribute.attributeCode == this.getACode()
      ) || null;
      if (_selectedAttribute) {
        if (_selectedAttribute.filterOverride) {
          console.log('There is a filter override');
          // Loop through the filterOverride and replace filterIn with filterOut in the string
          _selectedAttribute.filterOverride.forEach(item => {
            // Use a global replace for each filterOut to filterIn
            _baseFilterGroup = _baseFilterGroup.replace(item.filterOut, item.filterIn);
          });
        }
      }
      return _baseFilterGroup;
    }
  }

  getFilterGroupArray() {
    var _filterGroup = this.getFilterGroup();
  
    if (_filterGroup) {
      // Split the _filterGroup by "_"
      return _filterGroup.split("_");
    }
  }
    
  buildChart(attributeCode, chartData, seriesValues) {
    console.log('viztrends:Creating the chart:' + this.id);
    console.log("Selected radio button option under 'Display':", attributeCode);

    var mode = "";
    if (modeSelect) {
      mode = modeSelect.selected;
    } else {
      mode = 'regular';
    }
      
    const selectedYear = yearSelect.selected; // Get the selected year
    const isAllYears = selectedYear === 'allYears'; // Check if all years are selected
  
    const _aggCode = this.getSelectedAggregator();

    if (seriesModeSelect.selected==='stacked100') {
      // Loop through each agId in chartData
      Object.keys(chartData).forEach(agId => {
        // Loop through each year within the series for the current agId
        const years = Object.keys(chartData[agId][Object.keys(chartData[agId])[0]]); // Get the years from the first series

        years.forEach(year => {
          // Calculate the total value for all series for the current agId and year
          let total = Object.keys(chartData[agId]).reduce((sum, series) => {
            return sum + (chartData[agId][series][year] || 0);
          }, 0);

          // Check if the total is greater than zero to avoid division by zero
          if (total > 0) {
            // Loop through each series again to calculate the percentage
            Object.keys(chartData[agId]).forEach(series => {
              const value = chartData[agId][series][year] || 0;
              chartData[agId][series][year] = (value / total) * 100; // Calculate percentage and update
            });
          } else {
            // If the total is zero, set each percentage to 0 for consistency
            Object.keys(chartData[agId]).forEach(series => {
              chartData[agId][series][year] = 0;
            });
          }
        });
      });
    }

    var _title;

    if (isAllYears) {
      _title = _aggCode.agTitleText + ' ' + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + ' Trends' + this.modeOptions.find(option => option.value===mode).title;
    } else {
      _title = _aggCode.agTitleText + ' ' + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + ' - ' + String(selectedYear) + this.modeOptions.find(option => option.value===mode).title;
    }
    
    
    const _subTitle = this.sidebar.getSelectedOptionsAsLongText();

    // build y-axis title
    var _yaxisTitle = this.sidebar.getADisplayName();

    if (this.sidebar.dividers) {
      if (this.getDCode()!="Nothing") {
        _yaxisTitle += ' divided by ' + this.sidebar.dividers.find(divider => divider.attributeCode === this.getDCode()).alias;
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
  
    const calculateChange = (currentValue, initialValue) => currentValue - initialValue;
  
    const modifyDataForChange = (values, changeType) => {
      const initialValue = values[Object.keys(values)[0]]; // Assuming the first value is the baseline
      return Object.keys(values).map(year => {
        const currentValue = +values[year];
        let change;
        if (changeType === 'pct_change') {
          change = calculatePercentChange(currentValue, +initialValue);
        } else if (changeType === 'change') {
          change = calculateChange(currentValue, +initialValue);
        }
        return { 
          x: parseInt(year, 10), // Ensure the year is a number
          y: change // Calculate change based on the mode
        };
      });
    };
    
  
    const modifyDataForChangeForSingleYear = (values, changeType, year) => {
      const initialValue = values[Object.keys(values)[0]]; // Assuming the first value is the baseline
      const currentValue = values[year]; // Find value for the given year
      let change;
      if (changeType === 'pct_change') {
        change = calculatePercentChange(currentValue, +initialValue);
      } else if (changeType === 'change') {
        change = calculateChange(currentValue, +initialValue);
      }
      return change;
    };
      
    const createChart = () => {
      if (currentChart) {
        // Destroy existing Chart instance
        currentChart.destroy();
      }
  
      if (isAllYears) {
        currentChart = new Chart(ctx, {
          type: (seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100') ? 'line' : 'scatter', 
          data: {
            datasets: agIds.flatMap(agId => {
              return seriesValues.map(series => {
                const code = series.code;
                let values = chartData[agId][code];
                let dataPoints;
                
                if (!values || typeof values !== 'object') {
                  console.error(`Invalid or missing values for aggregator ID ${agId} and scenario ${code}`);
                  return null; 
                }
                
                if (mode === 'pct_change' || mode === 'change') {
                  try {
                    dataPoints = modifyDataForChange(values, mode);
                  } catch (error) {
                    console.error(`Error modifying data for change: ${error.message}`);
                    dataPoints = [];
                  }
                } else {
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
                        x: parseInt(year, 10), 
                        y: yValue 
                      };
                    });
                  } catch (error) {
                    console.error(`Error processing data points: ${error.message}`);
                    dataPoints = [];
                  }
                }
        
                const allYZero = dataPoints.every(point => point.y === 0);
        
                const color = this.getRandomColor(); // Get the random color once

                if (dataPoints && dataPoints.length > 0 && !allYZero) {
                  return {
                    label: this.getAgNameFromAgId(agId) + ':' + series.alias,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: color,
                    borderWidth: 3,
                    showLine: true, 
                    pointRadius: seriesModeSelect.selected === 'scatter' ? 8 : 5,
                    fill: seriesModeSelect.selected === 'stacked100' || seriesModeSelect.selected === 'stacked',
                    stack: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100' ? 'stack1' : undefined,
                  };
                }
                return null;
              }).filter(dataset => dataset !== null);
            })
          },
          options: {
            responsive: true,
            //plugins: {
            //  tooltip: {
            //    mode: 'index',
            //    intersect: false,
            //  },
            //},
            //interaction: {
            //  mode: 'index',
            //  intersect: false,
            //},
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
                beginAtZero: mode !== 'pct_change' && mode !== 'change',
                stacked: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100',
                ticks: {
                  callback: function(value) {
                    let sign = value > 0 ? "+" : "";
                    if (seriesModeSelect.selected === 'stacked100') {
                      return value.toFixed(0) + '%'; 
                    } else if (mode === 'pct_change') {
                      return sign + Number(value).toFixed(0) + '%';
                    } else if (mode === 'change') {
                      return sign + Number(value).toLocaleString(); 
                    } else {
                      return Number(value).toLocaleString(); 
                    }
                  }
                },
                title: {
                  display: true,
                  text: _yaxisTitle, 
                },
                min: seriesModeSelect.selected === 'stacked100' ? 0 : undefined,
                max: seriesModeSelect.selected === 'stacked100' ? 100 : undefined
              }
            }
          }
        });
        
      } else {
        currentChart = new Chart(ctx, {
          type: 'bar', // Grouped bar chart
          data: {
            labels: agIds.map(agId => this.getAgNameFromAgId(agId)), // X-axis labels as agIds
            datasets: seriesValues.map(series => {
              const code = series.code;
        
              // Data points for each agId for the selected year
              const dataPoints = agIds.map(agId => {
                const values = chartData[agId][code];
                var yValue;

                // Error checking: Ensure values exist for the agId and code
                if (!values || typeof values !== 'object') {
                  console.error(`Invalid or missing values for agId: ${agId}, scenario: ${code}`);
                  return null; // Skip this agId if values are invalid
                }
                
                // Process data points based on mode
                if (mode === 'pct_change' || mode === 'change') {
                  try {
                    yValue = modifyDataForChangeForSingleYear(values, mode, selectedYear);
                    if (!isNaN(yValue)) {
                      return yValue; // Return the y-value for the selected year
                    } else {
                      console.error(`Invalid numeric value for year ${selectedYear} in agId: ${agId}, scenario: ${code}`);
                      return null; // Skip this agId if the value is invalid
                    }
                  } catch (error) {
                    console.error(`Error modifying data for change: ${error.message}`);
                    dataPoints = []; // Handle error and set dataPoints to an empty array
                  }
                } else { // mode === 'regular'
                  // Extract data for selectedYear only
                  if (values[selectedYear] !== undefined) {
                    yValue = +values[selectedYear].toPrecision(4);
                    if (!isNaN(yValue)) {
                      return yValue; // Return the y-value for the selected year
                    } else {
                      console.error(`Invalid numeric value for year ${selectedYear} in agId: ${agId}, scenario: ${code}`);
                      return null; // Skip this agId if the value is invalid
                    }
                  } else {
                    console.warn(`No data found for agId: ${agId}, scenario: ${code}, selectedYear: ${selectedYear}`);
                    return null; // Return null if no data found for the selected year
                  }
                }
              });
                      
              // Check if all values in dataPoints are 0
              const allValuesZero = dataPoints.every(value => value === 0);

              if (dataPoints && dataPoints.length > 0 && !allValuesZero) {
                return {
                  label: series.alias, // Label for each scenario group
                  data: dataPoints, // Data points for each agId for the selected year
                  backgroundColor: this.getRandomColor(), // Random color for each scenario group
                  borderColor: this.getRandomColor(), // Random border color
                  borderWidth: 3
                };
              }
              return null;
            }).filter(dataset => dataset !== null) // Filter out any null datasets
          },
          options: {
            scales: {
              x: {
                beginAtZero: true,
                stacked: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100', // Ensure x-axis is also stacked
              },
              y: {
                beginAtZero: true,
                stacked: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100',
                max: seriesModeSelect.selected === 'stacked100' ? 100 : undefined, // Set max to 100 for stacked100 mode
                ticks: {
                  callback: function(value) {
                    let sign = value > 0 ? "+" : ""; // Determine the sign for positive values
                    if (mode === 'pct_change') {
                      return sign + Number(value).toFixed(0) + '%'; // Format as percent for pct_change mode
                    } else if (mode === 'change') {
                      // Format with commas for change mode for better readability
                      return sign + Number(value).toLocaleString(); 
                    } else {
                      // Format with commas for regular mode
                      return Number(value).toLocaleString(); 
                    }
                  }
                }
              }
            },
            plugins: {
              legend: {
                display: true,
                position: 'top'
              }
            }
          }
        });
      }
      this.generateTableFromChart(currentChart);
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
    const _agCode = this.getSelectedAggregator()?.agCode ?? null;

    const seriesIsFilter = this.seriesSelect.selected[0] === 'f'; // Check if the first character is 'f'
    //const trendsIsFilter = this.seriesSelect.selected === 'trendGroup'; // Check if the first character is 'f'

    if (this.sidebar.dividers) {
      var _selectedDivider = this.sidebar.dividers.find(divider => divider.attributeCode === _dCode) || null;
    }

    const _agIds = this.recastArrayIfNumeric(this.sidebar.aggregatorFilter.getSelectedOptionsAsList());
  
    const chartData = {};

    var _data_divide;
    var _geojsondata_divide;  

    var listOfSelectedFilterOptions = [];
    var listOfSelectedFilterOptions_byFilterLock = {};

    if (seriesIsFilter) {

      //seriesModeSelect.show();

      // make scenario selector radio visibile and hide checker
      scenarioChecker.hide();
      scenarioRadioer.show();

      // get list 
      var _filterForSeries = this.sidebar.filters.find(filter => filter.fCode === this.seriesSelect.selected);
      if (_filterForSeries.filterWij instanceof WijSelect) {
        var _selectedFilterOptions = _filterForSeries.filterWij.getSelectedOptionsNotSubTotalsAsList();
      } else if (_filterForSeries.filterWij instanceof WijCheckboxes) {
        var _selectedFilterOptions = _filterForSeries.filterWij.selected;
      }

      // Ensure _selectedFilterOptions is always an array
      if (typeof _selectedFilterOptions === 'string') {
        _selectedFilterOptions = [_selectedFilterOptions]; // Convert string to single-item list
      } else if (!Array.isArray(_selectedFilterOptions)) {
        _selectedFilterOptions = []; // If it's not an array and not a string, set it to an empty array
      }

      for (const _selectedFilter of _selectedFilterOptions) {
        listOfSelectedFilterOptions_byFilterLock[_selectedFilter] = this.sidebar.getListOfSelectedFilterOptionsWithLock(this.seriesSelect.selected, _selectedFilter);
      }

      const dataScenarioTrend_selected = dataScenarioTrends.find(a => a.scnTrendCode===scenarioRadioer.selected);

      dataScenarioTrend_selected.modelruns.forEach(modelrun => {
        
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

            _selectedFilterOptions.forEach(_fCode => {
                
              if (!chartData[agId][_fCode]) {
                chartData[agId][_fCode] = {};
              }

              var _filteredScenario = _scenario.getDataForFilterOptionsList(this.jsonName, listOfSelectedFilterOptions_byFilterLock[_fCode]);

              chartData[agId][_fCode][_scnYear] = 0;

              _filteredFeatures.forEach(feature => {

                const baseId = feature.properties[this.baseGeoJsonId];
                const filterSelectionData = _filteredScenario[baseId];
        
                if (filterSelectionData) {
                  //const selectedValue = this.getChartData(_aCode, filterSelectionData);

                  const selectedValue = filterSelectionData[_aCode];

                  if (selectedValue == null | selectedValue == undefined) {
                    console.log("null data found in here: " + agId + '_' + _fCode + '_' + _scnYear)
                  }

                  if (selectedValue !== null & selectedValue !== undefined) {
                    chartData[agId][_fCode][_scnYear] += selectedValue;
                  }
                }
              })

            });

          });
        }

      });
      
      var _seriesValues = _filterForSeries.options
      .filter(filterOption => _selectedFilterOptions.includes(filterOption.value))
      .map(filterOption => {
        return { code: filterOption.value, alias: filterOption.label };
      });

    } else {

      // hide Series Mode
      //seriesModeSelect.hide();

      scenarioRadioer.hide();
      scenarioChecker.show();

      const dataScenarioTrends_selected = dataScenarioTrends.filter(a => scenarioChecker.selected.includes(a.scnTrendCode));

      listOfSelectedFilterOptions = this.sidebar.getListOfSelectedFilterOptions();

      dataScenarioTrends_selected.forEach(trend => {

        var _scnTrendCode = trend.scnTrendCode;
  
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

            var _filteredScenario = _scenario.getDataForFilterOptionsList(this.jsonName, listOfSelectedFilterOptions);

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
      var _seriesValues = dataScenarioTrends
        .filter(a => scenarioChecker.selected.includes(a.scnTrendCode))
        .map(item => {
          return { code: item.scnTrendCode, alias: item.alias };
        });;
    }
    
    this.buildChart(_aCode, chartData, _seriesValues);
  }

  // Function to format values similar to y-axis tick callback
  formatYValue(value) {
    let sign = value > 0 ? "+" : "";

    var mode = "";
    if (modeSelect) {
      mode = modeSelect.selected;
    } else {
      mode = 'regular';
    }
    
    if (seriesModeSelect.selected === 'stacked100') {
      return value.toFixed(1) + '%'; // Show as percentage
    } else if (mode === 'pct_change') {
      return sign + Number(value).toFixed(1) + '%'; // Show as percentage with change
    } else if (mode === 'change') {
      return sign + Number(value).toLocaleString(); // Comma-separated for large numbers
    } else {
      return Number(value).toLocaleString(); // General number formatting with commas
    }
  }

    // Function to generate an HTML table from chart data
  generateTableFromChart(chartInstance) {
    // Get the chart's data
    const datasets = chartInstance.data.datasets;
    const seriesMode = chartInstance.options.scales.y.stacked100 ? 'stacked100' : chartInstance.options.scales.y.stacked; // Determine the series mode

    // Extract unique x-axis values (years)
    const xValues = [...new Set(datasets.flatMap(dataset => dataset.data.map(point => point.x)))];
    xValues.sort((a, b) => a - b); // Sort by year

    // Create table element
    let tableHTML = '<table class="custom-chart-table"><thead><tr><th></th>';

    // Add column headers for each x-value (year)
    xValues.forEach(xValue => {
      tableHTML += `<th>${xValue}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    // Add rows for each dataset (series)
    datasets.forEach(dataset => {
      // First column: series label, left-aligned
      tableHTML += `<tr><td style="text-align: left;">${dataset.label}</td>`;
      
      // Add y-values for each x-value (year), formatted accordingly and right-aligned
      xValues.forEach(x => {
        const dataPoint = dataset.data.find(point => point.x === x);
        const yValue = dataPoint ? this.formatYValue(dataPoint.y) : ''; // If no y-value, leave blank
        tableHTML += `<td style="text-align: right;">${yValue}</td>`;
      });
      
      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';

    // Append the table to the DOM (or replace existing one)
    document.getElementById('trendTable').innerHTML = tableHTML;
  }


}
