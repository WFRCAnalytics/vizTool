
class VizTrends {
  constructor(data, modelEntity) {
    this.id = data.id || this.generateIdFromText(data.attributeTitle); // use provided id or generate one if not provided
    console.log('viztrends:construct:' + this.id);

    this.baseGeoJsonKey = data.baseGeoJsonKey;
    this.baseGeoJsonId = data.baseGeoJsonId;
    this.jsonName = data.jsonName;
    this.allChartData = [];

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
    }

    this.modeOptions = [{ value: 'regular'   , label: 'Values'                 , title:''                           },
                        { value: 'change'    , label: 'Change from Base Year'  , title:' - Change from Base Year'   },
                        { value: 'pct_change', label: '% Change from Base Year', title:' - % Change from Base Year' }];

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
    seriesModeSelect.hide();

    // add bar group settings
    this.barGroupOptions = [{ value: 'trendGroup', label: 'Trend Group'     , title:''},
                            { value: 'aggregator', label: 'Summary Geograpy', title:''}]

    const _barGroups = document.getElementById('trendBarGroups');

    if (_barGroups.innerHTML.trim() === '') {
      barGroupSelect  = new WijSelect(this.id + "-bar-group-select",
                                      "Select Bar Group",
                                      "trendGroup",
                                      this.barGroupOptions,
                                      this);
      _barGroups.appendChild(barGroupSelect.render());
    }
    barGroupSelect.hide();

    // initialize and fill programatically later
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

    // Function to copy the trendHeader and table content to the clipboard 
    function copyTableToClipboard() {
      const trendHeader = document.getElementById('trendHeader').innerHTML; // Get trendHeader content
      const table = document.getElementById('trendTable').innerHTML; // Get table content

      // Combine trendHeader and table content
      const combinedContent = trendHeader + '\n\n' + table;

      // Create a temporary textarea to hold the combined content
      const tempTextArea = document.createElement('textarea');
      tempTextArea.style.position = 'fixed'; // Avoid scrolling to bottom
      tempTextArea.style.opacity = 0; // Make it invisible
      tempTextArea.value = combinedContent;

      // Append the textarea to the document
      document.body.appendChild(tempTextArea);

      // Select the content and copy it to clipboard
      tempTextArea.select();
      document.execCommand('copy');

      // Remove the temporary textarea
      document.body.removeChild(tempTextArea);

      // Provide feedback to the user (optional)
      // alert('Header and table copied to clipboard!');
    }

    // Add event listener to the copy button
    document.getElementById('copyTableBtn').addEventListener('click', copyTableToClipboard);

    this.wijRadioAgId = null;
    this.wijRadioTrendCode = null;

    this.counterColor = 0;
    this.currentChart = null;

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
    _seriesList = _seriesList.concat([{ value: 'aggregator', label: "Summary Geography" }]);
    // finally filters
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
  get aCode() {
    return this.sidebar.getACode();
  }

  // get the divider code that is selected
  get dCode() {
    return this.sidebar.getDCode();
  }

  get agCode() {
    return this.getSelectedAggregator()?.agCode ?? null;
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
      let _baseFilterGroup = scenarioWithData.getFilterGroupForAttribute(this.jsonName, this.aCode);
      let _selectedAttribute = this.sidebar.attributes.find(attribute =>
        attribute.attributeCode == this.aCode
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
  
  afterUpdateTrendSelector() {
    this.buildChart();
  };

  getColor = (() => {
    const colors = [
      'rgba( 75, 210, 192, 1)', // Teal
      'rgba( 54, 162, 225, 1)', // Blue
      'rgba(255,  99, 132, 1)', // Pink/Red
      'rgba(255, 216,  96, 1)', // Yellow
      'rgba(153, 102, 255, 1)', // Purple
      'rgba(255, 159,  64, 1)', // Orange
      'rgba(  0, 128, 128, 1)', // Dark Teal
      'rgba(128,   0, 128, 1)', // Dark Purple
      'rgba(255,  69,   0, 1)', // Red-Orange
      'rgba(  0, 128,   0, 1)', // Green
      'rgba(  0,   0, 128, 1)', // Navy Blue
      'rgba(128, 128,   0, 1)', // Olive
      'rgba(128,   0,   0, 1)', // Maroon
      'rgba(  0, 255, 127, 1)', // Spring Green
      'rgba( 70, 130, 180, 1)', // Steel Blue
      'rgba(255, 215,   0, 1)', // Gold
      'rgba(255, 140,   0, 1)', // Dark Orange
      'rgba(123, 104, 238, 1)', // Medium Slate Blue
      'rgba( 34, 139,  34, 1)', // Forest Green
      'rgba(220,  20,  60, 1)'  // Crimson
    ];
  
    return () => {
      const color = colors[this.counterColor % colors.length];
      this.counterColor++;
      // Reset this.counterColor to 0 when it reaches the max value
      if (this.counterColor >= colors.length) {
        this.counterColor = 0;
      }
      return color;
    };
  })();
  

  buildChart() {

    let chartData = {};
    let allChartDataFiltered;
    let _seriesValues;
    let groupIds;
    let groupLabels;

    if (this.currentChart) {
      // Destroy existing Chart instance
      this.currentChart.destroy();
    }

    // color this.counterColor, so always same order of colors
    this.counterColor = 0;

    console.log('viztrends:Creating the chart:' + this.id);
    document.getElementById('trendTable').innerHTML = "";

    var mode = "";
    if (modeSelect) {
      mode = modeSelect.selected;
    } else {
      mode = 'regular';
    }

    const seriesIsTrend      = this.seriesSelect.selected    === 'trendGroup';
    const seriesIsAggregator = this.seriesSelect.selected    === 'aggregator';
    const seriesIsFilter     = this.seriesSelect.selected[0] === 'f'; // Check if the first character is 'f'
    const selectedYear = yearSelect.selected; // Get the selected year
    const isAllYears = selectedYear === 'allYears'; // Check if all years are selected
  
    const _agg = this.getSelectedAggregator();

    function roundUpToTwoSignificantFigures(value) {
      if (value === 0) return 0; // Special case for zero
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value)))); // Find the magnitude of the value
      return Math.ceil(value / (magnitude / 10)) * (magnitude / 10); // Adjust to round up to two significant figures
    }

    function roundUpToSingleSignificantDigit(value) {
      if (value === 0) return 0; // Special case for zero
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value)))); // Find the magnitude of the value
      return Math.ceil(value / magnitude) * magnitude; // Round up to the nearest significant digit
    }
    
    let maxValue = -Infinity;  // Initialize max value
    
    for (const item of this.allChartData) {
      const { value } = item;
      
      if (typeof value === 'number') {
        const roundedValue = roundUpToSingleSignificantDigit(value); // Round up to a single significant digit
        maxValue = Math.max(maxValue, roundedValue);  // Update maxValue if the current rounded value is larger
      }
    }

    const uniqueValues = {
      scnTrendCodes: new Set(),
      fCodes: new Set(),
      agIds: new Set(),
    };
    
    // Loop through this.allChartData to populate uniqueValues
    this.allChartData.forEach(data => {
      uniqueValues.scnTrendCodes.add(String(data._scnTrendCode));
      uniqueValues.fCodes.add(String(data._fCode));
      uniqueValues.agIds.add(String(data._agId));
    });

    // set up chart data based on what type of series is selected
    if (isAllYears) {
      if (seriesIsTrend) {

        // series is trend, so only use one agId as defined by radio button
        allChartDataFiltered = this.allChartData.filter(item => String(item._agId) === String(this.wijRadioAgId.selected));
        
        for (const item of allChartDataFiltered) {
          const { _scnTrendCode, _scnYear, value } = item;
          
          chartData[_scnTrendCode] = chartData[_scnTrendCode] || {}; // Ensure the trendCode exists in chartData
          chartData[_scnTrendCode][_scnYear] = value; // Assign the year-level value
        }
      
        _seriesValues = dataScenarioTrends
          .filter(a => scenarioChecker.selected.includes(a.scnTrendCode))
          .map(item => {
            return { code: item.scnTrendCode, alias: item.alias, color: this.getColor() };
          });
  
      } else if (seriesIsAggregator) {
        // series is aggregator, so only use one trendCode as defined by radio button
        allChartDataFiltered = this.allChartData.filter(item => String(item._scnTrendCode) === String(this.wijRadioTrendCode.selected));
        
        for (const item of allChartDataFiltered) {
          const { _agId, _scnYear, value } = item;
          
          chartData[_agId] = chartData[_agId] || {}; // Ensure the agId exists in chartData
          chartData[_agId][_scnYear] = value; // Assign the year-level value
        }  
  
        _seriesValues = this.sidebar.aggregatorFilter.options
          .filter(a => this.sidebar.aggregatorFilter.getSelectedOptionsAsList().includes(a.value))
          .map(item => {
            return { code: item.value, alias: item.label, color: this.getColor() };
          });
      
      } else {
  
        // All others use only one of each (both agId and trendCode defined by radio buttons)
        allChartDataFiltered = this.allChartData.filter(item => 
          String(item._scnTrendCode) === String(this.wijRadioTrendCode.selected) && String(item._agId) === String(this.wijRadioAgId.selected)
        );
        
        for (const item of allChartDataFiltered) {
          const { _fCode, _scnYear, value } = item;
          
          chartData[_fCode] = chartData[_fCode] || {}; // Ensure the fCode exists in chartData
          chartData[_fCode][_scnYear] = value; // Assign the year-level value
        }
        
        // get list of filters
        var _filterForSeries = this.sidebar.filters.find(filter => filter.fCode === this.seriesSelect.selected);
        if (_filterForSeries.filterWij instanceof WijSelect) {
          var _selectedFilterOptions = _filterForSeries.filterWij.getSelectedOptionsNotSubTotalsAsList();
        } else if (_filterForSeries.filterWij instanceof WijCheckboxes) {
          var _selectedFilterOptions = _filterForSeries.filterWij.selected;
        }
  
        _seriesValues = _filterForSeries.options
        .filter(filterOption => _selectedFilterOptions.includes(filterOption.value))
        .map(filterOption => {
          return { code: filterOption.value, alias: filterOption.label , color: this.getColor()};
        });
  
      }

    // not isAllYears - single year - so grouped bar chart
    } else {
      if (seriesIsAggregator) {
        // series is aggregator, so only use one trendCode as defined by radio button
        allChartDataFiltered = this.allChartData;
        
        for (const item of allChartDataFiltered) {
          const { _scnTrendCode, _agId, _scnYear, value } = item;
          
          chartData[_scnTrendCode] = chartData[_scnTrendCode] || {};
          chartData[_scnTrendCode][_agId] = chartData[_scnTrendCode][_agId] || {}; // Ensure the agId exists in chartData
          chartData[_scnTrendCode][_agId][_scnYear] = value; // Assign the year-level value
        }  
  
        _seriesValues = this.sidebar.aggregatorFilter.options
          .filter(a => this.sidebar.aggregatorFilter.getSelectedOptionsAsList().includes(a.value))
          .map(item => {
            return { code: item.value, alias: item.label, color: this.getColor() };
          });
        
        // bar chart is grouped by scnTrendCodes
        // Ensure groupIds is an array
        groupIds = uniqueValues.scnTrendCodes;

        // Use filter instead of find, and map to get the labels
        groupLabels = scenarioChecker.options
          .filter(item => groupIds.has(item.value)) // Filter items where value is in groupIds
          .map(item => item.label); // Map to get labels

      } else if (seriesIsFilter) {
  
        // aggregator is grouped, so only trend series is optional
        if (barGroupSelect.selected=='aggregator') {

          // All others use only one of each (both agId and trendCode defined by radio buttons)
          allChartDataFiltered = this.allChartData.filter(item => 
            item._scnTrendCode === this.wijRadioTrendCode.selected
          );
          
          for (const item of allChartDataFiltered) {
            const { _agId, _fCode, _scnYear, value } = item;

            chartData[_agId] = chartData[_agId] || {};
            chartData[_agId][_fCode] = chartData[_agId][_fCode] || {}; // Ensure the agId exists in chartData
            chartData[_agId][_fCode][_scnYear] = value; // Assign the year-level value
          }
          
          // get list of filters
          var _filterForSeries = this.sidebar.filters.find(filter => filter.fCode === this.seriesSelect.selected);
          if (_filterForSeries.filterWij instanceof WijSelect) {
            var _selectedFilterOptions = _filterForSeries.filterWij.getSelectedOptionsNotSubTotalsAsList();
          } else if (_filterForSeries.filterWij instanceof WijCheckboxes) {
            var _selectedFilterOptions = _filterForSeries.filterWij.selected;
          }
    
          _seriesValues = _filterForSeries.options
          .filter(filterOption => _selectedFilterOptions.includes(filterOption.value))
          .map(filterOption => {
            return { code: filterOption.value, alias: filterOption.label , color: this.getColor()};
          });
    
          // bar chart is grouped by agIds
          // Ensure groupIds is an array
          groupIds = uniqueValues.agIds;
          groupLabels = this.sidebar.aggregatorFilter.options
            .filter(item=>groupIds.has(item.value))
            .map(item => item.label);
        
        // trend goup is grouped, so only aggregator is optional
        } else if (barGroupSelect.selected=='trendGroup') {

          // All others use only one of each (both agId and trendCode defined by radio buttons)
          allChartDataFiltered = this.allChartData.filter(item => String(item._agId) === String(this.wijRadioAgId.selected));
          
          for (const item of allChartDataFiltered) {
            const { _scnTrendCode, _fCode, _scnYear, value } = item;

            chartData[_scnTrendCode] = chartData[_scnTrendCode] || {};
            chartData[_scnTrendCode][_fCode] = chartData[_scnTrendCode][_fCode] || {}; // Ensure the agId exists in chartData
            chartData[_scnTrendCode][_fCode][_scnYear] = value; // Assign the year-level value
          }
          
          // get list of filters
          var _filterForSeries = this.sidebar.filters.find(filter => filter.fCode === this.seriesSelect.selected);
          if (_filterForSeries.filterWij instanceof WijSelect) {
            var _selectedFilterOptions = _filterForSeries.filterWij.getSelectedOptionsNotSubTotalsAsList();
          } else if (_filterForSeries.filterWij instanceof WijCheckboxes) {
            var _selectedFilterOptions = _filterForSeries.filterWij.selected;
          }
    
          _seriesValues = _filterForSeries.options
          .filter(filterOption => _selectedFilterOptions.includes(filterOption.value))
          .map(filterOption => {
            return { code: filterOption.value, alias: filterOption.label , color: this.getColor()};
          });
    
          // bar chart is grouped by scnTrendCodes
          // Ensure groupIds is an array
          groupIds = uniqueValues.scnTrendCodes;

          // Use filter instead of find, and map to get the labels
          groupLabels = scenarioChecker.options
            .filter(item => groupIds.has(item.value)) // Filter items where value is in groupIds
            .map(item => item.label); // Map to get labels
        }
      }
    }

    if (seriesModeSelect.selected === 'stacked100') {
      if (isAllYears) {
        // Case when isAllYears = true, simple structure chartData[currentSeries][year]
        Object.keys(chartData).forEach(series => {
          const years = Object.keys(chartData[series]);
    
          years.forEach(year => {
            // Calculate the total value for all series for the current year
            let total = Object.keys(chartData).reduce((sum, currentSeries) => {
              return sum + (chartData[currentSeries][year] || 0);
            }, 0);
    
            // Check if the total is greater than zero to avoid division by zero
            if (total > 0) {
              Object.keys(chartData).forEach(currentSeries => {
                const value = chartData[currentSeries][year] || 0;
                chartData[currentSeries][year] = (value / total) * 100; // Calculate percentage and update
              });
            } else {
              Object.keys(chartData).forEach(currentSeries => {
                chartData[currentSeries][year] = 0;
              });
            }
          });
        });
      } else {
        // Case when isAllYears = false, complex structure chartData[grouped][currentSeries][year]
        Object.keys(chartData).forEach(grouped => {
          Object.keys(chartData[grouped]).forEach(series => {
            const years = Object.keys(chartData[grouped][series]);
    
            years.forEach(year => {
              // Calculate the total value for all series for the current year
              let total = Object.keys(chartData[grouped]).reduce((sum, currentSeries) => {
                return sum + (chartData[grouped][currentSeries][year] || 0);
              }, 0);
    
              // Check if the total is greater than zero to avoid division by zero
              if (total > 0) {
                Object.keys(chartData[grouped]).forEach(currentSeries => {
                  const value = chartData[grouped][currentSeries][year] || 0;
                  chartData[grouped][currentSeries][year] = (value / total) * 100; // Calculate percentage and update
                });
              } else {
                Object.keys(chartData[grouped]).forEach(currentSeries => {
                  chartData[grouped][currentSeries][year] = 0;
                });
              }
            });
          });
        });
      }
    }

    // Prepare title of chart
    var _title = "";
    var selectedTrendTitle = "";
    var selectedAgTitle = "";
    var selectedYearTitle = "";

    if (!isAllYears) {
      selectedYearTitle = ' ' + selectedYear + ' ';
    } else {
      selectedYearTitle = ' Trends';
    }

    if (this.wijRadioTrendCode) {
      const selectedTrend = this.wijRadioTrendCode.options.find(item => item.value === this.wijRadioTrendCode.selected);
      selectedTrendTitle = selectedTrend ? selectedTrend.label + ' ' : '';
    }

    if (this.wijRadioAgId) {
      const selectedAg = this.wijRadioAgId.options.find(item => item.value === this.wijRadioAgId.selected);
      selectedAgTitle = selectedAg ? selectedAg.label + ' ' : ''
    }
    
    if (seriesIsAggregator) {
      _title = selectedTrendTitle + _agg.agTitleText + ' ' + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + selectedYearTitle + this.modeOptions.find(option => option.value===mode).title;
    } else if (seriesIsTrend) {
      _title = selectedAgTitle + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + selectedYearTitle + this.modeOptions.find(option => option.value===mode).title;
    } else {
      _title = selectedTrendTitle + selectedAgTitle + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + selectedYearTitle + this.modeOptions.find(option => option.value===mode).title;
    }

    const _subTitle = this.sidebar.getSelectedOptionsAsLongText();

    // build y-axis title
    var _yaxisTitle = this.sidebar.getADisplayName();

    if (this.sidebar.dividers) {
      if (this.dCode!="Nothing") {
        _yaxisTitle += ' divided by ' + this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode).alias;
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
    chartContainer.style="width: 95%;";
    containerElement.appendChild(chartContainer);
  
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
  
    const ctx = canvas.getContext('2d');
    
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


    let max;

    if (seriesModeSelect.selected === 'stacked100') {
      max = 100;
    } else if (seriesModeSelect.selected === 'scatter' & mode === 'regular') {
      max = maxValue; // Ensure maxValue is available and round it
    } else {
      max = undefined;
    }

    if (this.currentChart) {
      console.log('destroy chart');
      // Destroy existing Chart instance
      this.currentChart.destroy();
    }

    const createChart=()=>{

      // all years is always a line or stacked line chart
      if (isAllYears) {
        this.currentChart = new Chart(ctx, {
          type: (seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100') ? 'line' : 'scatter', 
          data: {
            datasets: _seriesValues.flatMap(series => {
              const code = series.code;
              let values = chartData[code];
              let dataPoints;
              
              if (!values || typeof values !== 'object') {
                console.error(`Invalid or missing values for scenario ${code}`);
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
      
              if (dataPoints && dataPoints.length > 0 && !allYZero) {
                return {
                  label: series.alias,
                  data: dataPoints,
                  borderColor: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100' ? 'rgba(255,255,255,1)' : _seriesValues.find(item=>item.code===code).color,
                  backgroundColor: _seriesValues.find(item=>item.code===code).color,
                  borderWidth: 3,
                  showLine: true, 
                  pointRadius: seriesModeSelect.selected === 'scatter' ? 8 : 5,
                  fill: seriesModeSelect.selected === 'stacked100' || seriesModeSelect.selected === 'stacked' ? true : false,
                  stack: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100' ? 'stack1' : undefined,
                };
              }
              return null;
            }).filter(dataset => dataset !== null)
          },
          options: {
            animation: false,  // Disable animation
            responsive: true,
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
                  callback: (value) => {
                    return this.formatYValue(value);
                  }
                },
                title: {
                  display: true,
                  text: _yaxisTitle, 
                },
                min: seriesModeSelect.selected === 'stacked100' ? 0 : undefined,
                max: max
              }
            },
            plugins: {
              legend: {
                display: false,
                position: 'top'
              },
              tooltip: {
                callbacks: {
                  label: function(tooltipItem) {
                    // Extract the formatted value
                    let formattedValue = tooltipItem.formattedValue;
            
                    // Use a regular expression to find the first number between '(' and ','
                    let match = /\((\d{1,3}(?:,\d{3})*)/.exec(formattedValue);
            
                    // If a match is found, remove commas from the matched number and replace it in the formattedValue
                    if (match && match[1]) {
                      let numberWithoutCommas = match[1].replace(/,/g, '');
                      // Replace the original matched number with the number without commas
                      return tooltipItem.dataset.label + ': ' + formattedValue.replace(match[1], numberWithoutCommas);
                    } else {
                      return tooltipItem.dataset.label + ': ' + formattedValue; // If no match, return the original formattedValue
                    }
                  }
                }
              }
            }
          }
        });
        this.generateTableFromChart(this.currentChart, _seriesValues);

      // single year is always a bar chart
      } else {

        this.currentChart = new Chart(ctx, {
          type: 'bar', // Grouped bar chart
          data: {
            labels: groupLabels,
            datasets: _seriesValues.map(series => {
              const code = series.code;
        
              // Data points for each groupId for the selected year
              const dataPoints = Array.from(groupIds).map(groupId => {
                const values = chartData[groupId][code];
                var yValue;

                // Error checking: Ensure values exist for the groupId and code
                if (!values || typeof values !== 'object') {
                  console.error(`Invalid or missing values for groupId: ${groupId}, scenario: ${code}`);
                  return null; // Skip this groupId if values are invalid
                }
                
                // Process data points based on mode
                if (mode === 'pct_change' || mode === 'change') {
                  try {
                    yValue = modifyDataForChangeForSingleYear(values, mode, selectedYear);
                    if (!isNaN(yValue)) {
                      return yValue; // Return the y-value for the selected year
                    } else {
                      console.error(`Invalid numeric value for year ${selectedYear} in groupId: ${groupId}, scenario: ${code}`);
                      return null; // Skip this groupId if the value is invalid
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
                      console.error(`Invalid numeric value for year ${selectedYear} in groupId: ${groupId}, scenario: ${code}`);
                      return null; // Skip this groupId if the value is invalid
                    }
                  } else {
                    console.warn(`No data found for groupId: ${groupId}, scenario: ${code}, selectedYear: ${selectedYear}`);
                    return null; // Return null if no data found for the selected year
                  }
                }
              });
                      
              // Check if all values in dataPoints are 0
              const allValuesZero = dataPoints.every(value => value === 0);

              if (dataPoints && dataPoints.length > 0 && !allValuesZero) {
                return {
                  label: series.alias, // Label for each scenario group
                  data: dataPoints, // Data points for each groupId for the selected year
                  backgroundColor: _seriesValues.find(item=>item.code===code).color, // Random color for each scenario group
                  borderColor: _seriesValues.find(item=>item.code===code).color, // Random border color
                  borderWidth: 3
                };
              }
              return null;
            }).filter(dataset => dataset !== null) // Filter out any null datasets
          },
          options: {
            animation: false,  // Disable animation
            scales: {
              x: {
                beginAtZero: true,
                stacked: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100', // Ensure x-axis is also stacked
              },
              y: {
                title: {
                  display: true,
                  text: seriesModeSelect.selected === 'stacked100' ? 'Percent Share' : _yaxisTitle // Set y-axis label dynamically
                },
                beginAtZero: true,
                stacked: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100',
                max: seriesModeSelect.selected === 'stacked100' ? 100 : undefined, // Set max to 100 for stacked100 mode
                ticks: {
                  callback: (value) => {
                    return this.formatYValue(value);
                  }
                }
              }
            },
            plugins: {
              legend: {
                display: false,
                position: 'top'
              }
            }
          }
        });
        this.generateTableFromChart(this.currentChart, _seriesValues, true);
      }
    };
  
    // Initial chart creation
    createChart();
  }

  recastArrayIfNumeric(arr) {
    // Check if every item in the array is numeric (either a number or a numeric string)
    const allNumeric = arr.every(item => !isNaN(item) && item !== null && item !== '' && isFinite(item));
  
    // If all items are numeric, convert them to integers (or numbers)
    if (allNumeric) {
      return arr.map(item => Number(item)); // Using Number() to handle numeric strings and numbers
    } else {
      // Return the original array if not all items are numeric
      return arr;
    }
  }
  
  updateDisplay() {
    console.log('viztrends:updateDisplay:' + this.id);
    const trendSelectorDiv = document.getElementById("trendSelector");
    trendSelectorDiv.innerHTML = "";

    this.updateAllChartData();
  }
  
  updateAllChartData() {
    console.log('viztrends:updateAllChartData:' + this.id);
    
    const seriesIsFilter     = this.seriesSelect.selected[0] === 'f'; // Check if the first character is 'f'

    if (this.sidebar.dividers) {
      var _selectedDivider = this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode) || null;
    }

    const _trendsSelected = dataScenarioTrends.filter(a => scenarioChecker.selected.includes(a.scnTrendCode));
    const _aggregatorOptionsSelected = this.recastArrayIfNumeric(this.sidebar.aggregatorFilter.getSelectedOptionsAsList());
    const _selectedAggregator = this.sidebar.getSelectedAggregator();

    var _selectedFilterOptions = [];
    var _lstOfSelectedFilterOptions = [];

    this.allChartData = [];

    if (seriesIsFilter) {

      //seriesModeSelect.show();

      // get list
      var _filterForSeries = this.sidebar.filters.find(filter => filter.fCode === this.seriesSelect.selected);
      if (_filterForSeries.filterWij instanceof WijSelect) {
        _selectedFilterOptions = _filterForSeries.filterWij.getSelectedOptionsNotSubTotalsAsList();
      } else if (_filterForSeries.filterWij instanceof WijCheckboxes) {
        _selectedFilterOptions = _filterForSeries.filterWij.selected;
      }

      // Ensure _selectedFilterOptions is always an array
      if (typeof _selectedFilterOptions === 'string') {
        _selectedFilterOptions = [_selectedFilterOptions]; // Convert string to single-item list
      } else if (!Array.isArray(_selectedFilterOptions)) {
        _selectedFilterOptions = []; // If it's not an array and not a string, set it to an empty array
      }

      for (const _selectedFilter of _selectedFilterOptions) {
        _lstOfSelectedFilterOptions[_selectedFilter] = this.sidebar.getListOfSelectedFilterOptionsWithLock(this.seriesSelect.selected, _selectedFilter);
      }

    } else {
      _selectedFilterOptions = [""];
      _lstOfSelectedFilterOptions[""] = this.sidebar.getListOfSelectedFilterOptions();
    }

    // Loop through each trendCode and all scenarios
    _trendsSelected.forEach(trend => {

      var _scnTrendCode = trend.scnTrendCode;

      trend.modelruns.forEach(modelrun => {
        
        var _bNoDivideData = false;
        const _scnYear     = modelrun.scnYear;
        const _scenario    = this.getScenario(modelrun.modVersion, modelrun.scnGroup, _scnYear);
        
        if (_scenario) {

          // Call this.getAggregatorKeyFile() once and store the result
          const aggregatorKeyFile = _scenario.getAggregatorKeyFile(_selectedAggregator, this.baseGeoJsonKey);

          if (this.dCode!="Nothing") {
            // Call this.getAggregatorKeyFile() once and store the result
            const aggregatorKeyFile_divide = _scenario.getAggregatorKeyFile(_selectedAggregator, _selectedDivider.baseGeoJsonKey);
          }

          _selectedFilterOptions.forEach(_fCode => {

            const _dataForFilterOptions = _scenario.getDataForFilterOptionsList(this.jsonName, _lstOfSelectedFilterOptions[_fCode]);

            _aggregatorOptionsSelected.forEach(_agId => {
              
              let _dataSum = 0;
              var _data_divide = {};
              var _sumDivide = 0;

              if (aggregatorKeyFile) {

                // Create a Set directly from the filtered aggregatorKeyFile
                const geoJsonIdSet = new Set(
                  aggregatorKeyFile
                    .filter(record => record[_selectedAggregator.agCode] === _agId)
                    .map(record => String(record[this.baseGeoJsonId]))
                );

                Object.keys(_dataForFilterOptions)
                  .filter(key => geoJsonIdSet.has(String(key)))  // Filter based on set membership
                  .forEach(key => {
                    const selectedValue = _dataForFilterOptions[key][this.aCode];
                    if (selectedValue !== null && selectedValue !== undefined) {
                      _dataSum += selectedValue; // Sum directly if valid
                    }
                  });
              } else if (_selectedAggregator.agCode == this.baseGeoJsonId) {
                Object.keys(_dataForFilterOptions)
                  .forEach(key => {
                    const selectedValue = _dataForFilterOptions[key][this.aCode];
                    if (selectedValue !== null && selectedValue !== undefined) {
                      _dataSum += selectedValue; // Sum directly if valid
                    }
                  });

              }
            
              if (this.dCode!="Nothing") {
                  
                if (_scenario.jsonData[_selectedDivider.jsonName]) {
                  _data_divide = _scenario.jsonData[_selectedDivider.jsonName].data[_selectedDivider.filter];
                } else {
                  _bNoDivideData = true;
                }

                if (aggregatorKeyFile_divide) {

                    // Create a Set directly from the filtered aggregatorKeyFile
                  const geoJsonIdSetDivide = new Set(
                    aggregatorKeyFile_divide
                      .filter(record => record[_selectedAggregator.agCode] === _agId)
                      .map(record => String(record[_selectedDivider.baseGeoJsonId]))
                  );
  
                  // Filter the _data_divide object based on matching keys (assuming keys represent the this.baseGeoJsonId)
                  Object.keys(_data_divide)
                  .filter(key => geoJsonIdSetDivide.has(String(key)))  // Filter based on set membership
                  .forEach(key => {
                    const selectedValue = _data_divide[key][_selectedDivider.attributeCode];
                    if (selectedValue !== null && selectedValue !== undefined) {
                      _sumDivide += selectedValue; // Sum directly if valid
                    }
                  });
                } else if (_selectedAggregator.agCode == this.baseGeoJsonId) {
  
                  // Filter the _data_divide object based on matching keys (assuming keys represent the this.baseGeoJsonId)
                  Object.keys(_data_divide)
                  .forEach(key => {
                    const selectedValue = _data_divide[key][_selectedDivider.attributeCode];
                    if (selectedValue !== null && selectedValue !== undefined) {
                      _sumDivide += selectedValue; // Sum directly if valid
                    }
                  });
                }
                  
              }

              if (this.dCode!="Nothing" & _sumDivide>0) {
                _dataSum /= _sumDivide;
              } else if (this.dCode!="Nothing" & _sumDivide==0) {
                _dataSum = null;
              }

              // Push the resulting data to allChartData as an object
              if (_dataSum) {
                this.allChartData.push({
                  _scnTrendCode,
                  _scnYear,
                  _fCode,
                  _agId,
                  value: _dataSum
                });
              }
            });
          });
        }
      });
    });

    const uniqueValues = {
      scnTrendCodes: new Set(),
      scnYears: new Set(),
      fCodes: new Set(),
      agIds: new Set(),
    };
    
    // Loop through this.allChartData to populate uniqueValues
    this.allChartData.forEach(data => {
      uniqueValues.scnTrendCodes.add(String(data._scnTrendCode));
      uniqueValues.scnYears.add(String(data._scnYear));
      uniqueValues.fCodes.add(String(data._fCode));
      uniqueValues.agIds.add(String(data._agId));
    });
    
    // Convert sets to arrays for further usage
    uniqueValues.scnTrendCodes = Array.from(uniqueValues.scnTrendCodes).sort();
    uniqueValues.scnYears = Array.from(uniqueValues.scnYears).sort();
    uniqueValues.fCodes = Array.from(uniqueValues.fCodes).sort();
    uniqueValues.agIds = Array.from(uniqueValues.agIds).sort();

    // Prepare chart filters based on series selection
    var seriesIsTrend = this.seriesSelect.selected === 'trendGroup';
    var seriesIsAggregator = this.seriesSelect.selected === 'aggregator';

    var selectedYear = yearSelect.selected; // Get the selected year
    var isAllYears = selectedYear === 'allYears'; // Check if all years are selected

    var selectedFilterAgId = this.wijRadioAgId ? this.wijRadioAgId.selected : null;
    var selectedFilterTrendCode = this.wijRadioTrendCode ? this.wijRadioTrendCode.selected : null;

    const filteredOptions = this.sidebar.aggregatorFilter.options
      .filter(item => uniqueValues.agIds.includes(item.value))
      .map(item => ({ value: item.value, label: item.label }));

    const isSelectedInOptions = filteredOptions.some(option => option.value === selectedFilterAgId);

    // Fallback for missing selectedFilterAgId
    if (!selectedFilterAgId || !isSelectedInOptions) {
      if (configApp && configApp.trendsDefaults && this.sidebar.aggregatorSelect.selected in configApp.trendsDefaults) {
        selectedFilterAgId = String(configApp.trendsDefaults[this.sidebar.aggregatorSelect.selected]);
      }
    }

    const createRadioFilter = (id, label, options, selected) =>
      new WijRadio(id, label, selected, options, this);
    
    const _seriesMode = document.getElementById('trendSeriesMode');
    
    const _radioTrend = this.wijRadioTrendCode = createRadioFilter(
      'chart-filter-scntrendcodes', 
      'Trend Group', 
      scenarioChecker.options.filter(item => uniqueValues.scnTrendCodes.includes(item.value))
        .map(item => ({ value: item.value, label: item.label })), 
      selectedFilterTrendCode
    );
    const _radioAg = createRadioFilter(
      'chart-filter-agids', 
      'Summary Geography', 
      this.sidebar.aggregatorFilter.options.filter(item => uniqueValues.agIds.includes(item.value))
        .map(item => ({ value: item.value, label: item.label })), 
      selectedFilterAgId
    );

    if (isAllYears) {

      const originalSelected = this.seriesSelect.selected;

      this.seriesSelect.addOptionIfNotExistsToBeginning("trendGroup", "Trend Group"); // Add the option if not already there

      this.seriesSelect.selected = originalSelected;

      if (seriesIsTrend) {
        seriesModeSelect.hide()
        seriesModeSelect.selected = 'scatter';
        this.wijRadioAgId = _radioAg
        this.wijRadioTrendCode = null;
      } else if (seriesIsAggregator) {
        seriesModeSelect.show();
        this.wijRadioAgId = null;
        this.wijRadioTrendCode = _radioTrend;
      } else if (seriesIsFilter) {
        seriesModeSelect.show();
        this.wijRadioAgId = _radioAg
        this.wijRadioTrendCode = _radioTrend;
      }
    } else {

      const originalSelected = this.seriesSelect.selected;

      this.seriesSelect.removeOptionByValue("trendGroup"); // Remove the option with value "trendGroup"

      // selecte aggregator if trend Group was selected
      if (originalSelected=="trendGroup") {
        this.seriesSelect.selected = 'aggregator';
        seriesIsTrend = false;
        seriesIsAggregator = true;
      }

      if (seriesIsTrend) {
        seriesModeSelect.hide()
        seriesModeSelect.selected = 'scatter';
        barGroupSelect.hide();
        this.wijRadioAgId = null;
        this.wijRadioTrendCode = null;
      } else if (seriesIsAggregator) {
        seriesModeSelect.show();
        barGroupSelect.hide();
        this.wijRadioAgId = null;
        this.wijRadioTrendCode = null;
      } else if (seriesIsFilter) {
        seriesModeSelect.show();
        barGroupSelect.show();
        if (barGroupSelect.selected=='trendGroup') {
          this.wijRadioAgId = _radioAg;
          this.wijRadioTrendCode = null;
        } else if (barGroupSelect.selected=='aggregator') {
          this.wijRadioAgId = null;
          this.wijRadioTrendCode = _radioTrend;
        }
      }
    }

    if (this.wijRadioAgId || this.wijRadioTrendCode) {
      this.sidebar.showTrendSelector();
    } else {
      this.sidebar.hideTrendSelector()
    }

    if (seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100') {
      modeSelect.selected = 'regular';
      modeSelect.hide();
    } else {
      modeSelect.show();
    }

    // Step 3: Update DOM elements with the rendered filters
    const trendSelectorDiv = document.getElementById("trendSelector");
    trendSelectorDiv.innerHTML = "";

    if (this.wijRadioAgId) {
      trendSelectorDiv.append(this.wijRadioAgId.render());
    }
    if (this.wijRadioTrendCode) {
      trendSelectorDiv.append(this.wijRadioTrendCode.render());
    }
    this.buildChart();
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
      return Number(value).toFixed(1) + '%'; // Show as percentage
    } else if (mode === 'pct_change') {
      return sign + Number(value).toFixed(1) + '%'; // Show as percentage with change
    } else if (mode === 'change') {
      return sign + Number(value).toLocaleString(); // Comma-separated for large numbers
    } else {
      if (value > 0 && value < 0.04) {
        // Round small numbers to 3 significant figure
        return Number(value.toPrecision(3));
      } else {
        return Number(value).toLocaleString(); 
      }
    }
  }

  // Function to generate an HTML table from chart data (regular or grouped bar)
  generateTableFromChart(chartInstance, _seriesValues, isGroupedBar = false) {

    const seriesIsFilter     = this.seriesSelect.selected[0] === 'f'; // Check if the first character is 'f'
    const seriesIsTrend      = this.seriesSelect.selected    === 'trendGroup';
    const seriesIsAggregator = this.seriesSelect.selected    === 'aggregator';
    const selectedYear       = yearSelect.selected; // Get the selected year
    const isAllYears         = selectedYear === 'allYears'; // Check if all years are selected

    let _title = "";

    if (seriesIsAggregator) {
      _title = this.getSelectedAggregator().agTitleText;
    } else if (seriesIsTrend) {
      _title = "Trend Group";
    } else if (seriesIsFilter) {
      const selectedItem = this.seriesSelect.options.find(item => item.value === this.seriesSelect.selected);
      _title = selectedItem ? selectedItem.label : '';
    }


    // Get the chart's datasets (the series in the chart)
    const datasets = chartInstance.data.datasets;
    let labels;

    // Use groupLabels for grouped bar charts, otherwise use x-axis (years) labels
    if (isGroupedBar) {
      labels = chartInstance.data.labels; // Group labels (columns)
    } else {
      // Extract unique x-axis values (years)
      labels = [...new Set(datasets.flatMap(dataset => dataset.data.map(point => point.x)))];
      labels.sort((a, b) => a - b); // Sort by year
    }

    // Create table element
    let tableHTML = '<table class="custom-chart-table"><thead><tr><th></th><th>' + _title + '</th>';

    // Add column headers (years or groupLabels)
    labels.forEach(label => {
      tableHTML += `<th>${label}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    // Add rows for each dataset (series)
    datasets.forEach(dataset => {
      let _colorRGBA;

      if (_seriesValues) {
        _colorRGBA = _seriesValues.find(item => item.alias === dataset.label).color;
      } else {
        _colorRGBA = undefined;
      }

      // First column: Color square, no header
      tableHTML += `<tr><td style="width: 20px;"><div style="width: 15px; height: 15px; background-color: ${_colorRGBA};"></div></td>`;

      // Second column: series label, left-aligned
      tableHTML += `<td style="text-align: left;">${dataset.label}</td>`;

      // Add y-values for each label (year or group), formatted and right-aligned
      labels.forEach((label, index) => {
        let yValue;
        if (isGroupedBar) {
          // Handle grouped bar chart data
          yValue = dataset.data[index] !== undefined ? this.formatYValue(dataset.data[index]) : ''; // Use the index for grouped bar
        } else {
          // Handle regular chart data
          const dataPoint = dataset.data.find(point => point.x === label); // Match year with x-value
          yValue = dataPoint ? this.formatYValue(dataPoint.y) : ''; // If no y-value, leave blank
        }
        tableHTML += `<td style="text-align: right;">${yValue}</td>`;
      });

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';

    // Append the table to the DOM (or replace existing one)
    document.getElementById('trendTable').innerHTML = tableHTML;
  }


}
