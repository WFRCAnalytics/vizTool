
class VizTrends {
  constructor(data, modelEntity) {
    // Several unrelated entities share the same attributeTitle (e.g. "Special Trips" and
    // "Special Trip Trends" are both "Trip Gen Attribute"), so an id derived from it alone
    // would collide across entities - Filter.id (filter.js) is built from this.id, so a
    // collision means two different entities' filter checkboxes/selects end up with the same
    // DOM id/name once both have rendered at least once. modelEntity.submenuText is
    // guaranteed unique (it's what the menu and URL restore already key off of).
    this.id = data.id || this.generateIdFromText(modelEntity.submenuText || data.attributeTitle); // use provided id or generate one if not provided
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
      scenarioChecker = new WijCheckboxes('scenario-checker', 'Select Trend Groups', dataScenarioTrends.filter(a=>a.displayByDefault==true).map(item => item.scnTrendCode), dataScenarioTrends.map(item => ({ value: item.scnTrendCode, label: item.alias })), this, false, true);
      const scenarioCheckerEl = scenarioChecker.render();
      scenarioCheckerEl.classList.add('filter-card'); // white card + collapsible, matching the sidebar filters
      _scenariochooserdiv.appendChild(scenarioCheckerEl);
    }

    this.modeOptions = [{ value: 'regular'   , label: 'Values'                        , title:''                              },
                        { value: 'change'    , label: 'Compare to Selected Year'      , title:' - Compare to Selected Year'      },
                        { value: 'pct_change', label: 'Compare to Selected Year (%)'  , title:' - Compare to Selected Year (%)'  }];

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
        // With only one actual year of data, "All Years" would just show that single point on
        // an otherwise-empty trend line - default straight to that year instead so the chart
        // opens showing something useful.
        const _distinctYears = _yearList.slice(1); // exclude the "All Years" entry itself
        const _defaultYearSelected = _distinctYears.length === 1 ? _distinctYears[0].value : "allYears";
        yearSelect  = new WijSelect("trends-year-select",
                                        "Select Year",
                                        _defaultYearSelected,
                                        _yearList,
                                        this);
        _trendYears.appendChild(yearSelect.render());
      }
    }

    if (Object.keys(compareYearSelect).length === 0 && compareYearSelect.constructor === Object) {
      // Same distinct-year list as Select Year, minus "All Years" - the baseline for Change/%
      // Change from Base Year has to be one real year. Only shown once Select Chart Mode picks
      // one of those two modes (see updateAllChartData()'s modeSelect show/hide block) -
      // defaults to the earliest year so it matches the old hardcoded-to-first-year behavior
      // until someone actually changes it.
      const _compareYearOptions = dataScenarios
        .map(item => ({ value: String(item.scnYear), label: String(item.scnYear) }))
        .sort((a, b) => a.value - b.value)
        .filter((item, index, self) => index === self.findIndex((t) => t.value === item.value));

      const _trendCompareYear = document.getElementById('trendCompareYear');
      if (_trendCompareYear.innerHTML.trim() === '') {
        compareYearSelect = new WijSelect(this.id + "-compare-year-select",
                                          "Compare To Year",
                                          _compareYearOptions.length ? _compareYearOptions[0].value : '',
                                          _compareYearOptions,
                                          this);
        _trendCompareYear.appendChild(compareYearSelect.render());
      }
    }
    this.setCompareYearVisible(false);

    this.defaultSeries = 'trendGroup'; // default selection

    // Function to copy the trendHeader and table content to the clipboard
    function copyTableToClipboard() {
      const trendHeader = document.getElementById('trendHeader').innerHTML; // Get trendHeader content

      // Copy a clone of the table with the vs.-baseline delta badges (.ledger-delta) and the
      // "(vs. XXXX)" fallback-baseline notes (.ledger-baseline-note) stripped out - they're
      // useful on screen, but as plain copied text they'd land as extra noise glued onto the
      // cell/label text (e.g. "9,673,000▲ 34.1%") rather than a clean number.
      const tableEl = document.getElementById('trendTable').querySelector('table');
      let table = '';
      if (tableEl) {
        const tableClone = tableEl.cloneNode(true);
        tableClone.querySelectorAll('.ledger-delta, .ledger-baseline-note').forEach(el => el.remove());
        table = tableClone.outerHTML;
      }

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

    // Collapse/expand the chart (not the table) - same chevron-swap pattern WijSelect's
    // collapsible filter cards use (see wijselect.js render()). #trendContent gets its
    // innerHTML wiped and rebuilt on every buildChart() call, but this toggle lives outside
    // it (a static element in viztrends.html) and only ever sets style.display on the existing
    // #trendContent node, so the collapsed/expanded state survives every chart rebuild without
    // needing to be re-applied.
    const chartToggle = document.getElementById('trendChartToggle');
    if (chartToggle && !chartToggle.dataset.wired) {
      chartToggle.dataset.wired = 'true'; // guards against re-adding this listener if a
                                           // VizTrends entity gets constructed more than once
      chartToggle.addEventListener('click', () => {
        const content = document.getElementById('trendContent');
        const icon = chartToggle.querySelector('calcite-icon');
        const collapsed = content.style.display === 'none';
        content.style.display = collapsed ? '' : 'none';
        if (icon) icon.icon = collapsed ? 'chevron-down' : 'chevron-right';
        // Chart.js's own ResizeObserver reads a 0-size canvas while its ancestor is
        // display:none, so re-expanding needs an explicit resize() rather than trusting it to
        // pick the correct size back up on its own. activeLayout (not `this`, which is
        // whichever VizTrends entity happened to construct first and wire this listener) is
        // whichever trend entity is actually on screen right now.
        if (collapsed && activeLayout && activeLayout.currentChart) {
          activeLayout.currentChart.resize();
        }
      });
    }

    this.wijRadioAgId = null;
    this.wijRadioTrendCode = null;

    this.counterColor = 0;
    this.currentChart = null;

    // Bumped at the start of every updateAllChartData() call so an older, still-loading call
    // can tell it's been superseded and bail out instead of clobbering a newer render.
    this._renderGen = 0;

  }

  isSelectedAttributeStackable() {
    const aCode = this.aCode;
    const selectedAttribute = this.sidebar.attributes.find(attr => attr.attributeCode === aCode);
    return selectedAttribute?.stackable === true;
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  renderSidebar() {
    // since shared scenario checker, have to make sure vizLayout is set correctly in checkboxes
    scenarioChecker.vizLayout = this;
    modeSelect.vizLayout = this;
    compareYearSelect.vizLayout = this;
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

  // All scenarios (across every currently-checked trend group) this chart could pull data
  // from. Shared by updateAllChartData() (to know what to lazy-load) and by
  // getFilterGroupArray()'s no-scenario case (to know which scenarios' filter groups to union
  // for the sidebar's filter-visibility check).
  getNeededScenarios() {
    if (typeof scenarioChecker === 'undefined' || !scenarioChecker || typeof dataScenarioTrends === 'undefined') return [];
    const _trendsSelected = dataScenarioTrends.filter(a => scenarioChecker.selected.includes(a.scnTrendCode));
    const _neededScenarios = new Set();
    _trendsSelected.forEach(trend => {
      trend.modelruns.forEach(modelrun => {
        const _scenario = this.getScenario(modelrun.modVersion, modelrun.scnGroup, modelrun.scnYear);
        if (_scenario) _neededScenarios.add(_scenario);
      });
    });
    return Array.from(_neededScenarios);
  }

  // a_scenario lets callers pin this to one specific scenario's schema instead of the
  // arbitrary "first scenario with data" default - see getFilterGroupArray() and its use in
  // updateAllChartData(), where a trend chart spans multiple model versions whose filter
  // groups for the same attribute code can genuinely differ (e.g. a CVM refactor added/renamed
  // a filter dimension), so resolving this once globally for the whole chart is wrong.
  getFilterGroup(a_scenario) {
    const scenarioWithData = a_scenario || getFirstScenarioWithTrendData(this.jsonName);
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

  // With a specific a_scenario (from updateAllChartData()'s per-scenario data lookup), this is
  // just that scenario's own filter group.
  //
  // Without one - the sidebar's filter-visibility check, see vizsidebar.js
  // updateFilterDisplay() - a single reference scenario can't represent every scenario the
  // chart is showing: e.g. WFv10.0-beta.2 added a "fTelTime" dimension to telecommute
  // attributes that WFv9.2/WFv10.0-beta.1 don't have. So a filter is shown if it belongs to
  // ANY scenario currently feeding the chart (getNeededScenarios()), not just whichever one
  // happened to be picked as "the" reference - otherwise a filter that only matters to one
  // model version stays hidden (and stuck at whatever value it defaulted to) even while that
  // version's data is on the chart.
  getFilterGroupArray(a_scenario) {
    if (a_scenario) {
      const _filterGroup = this.getFilterGroup(a_scenario);
      return _filterGroup ? _filterGroup.split("_") : undefined;
    }

    // Only consult scenarios whose data has actually finished loading (see
    // Scenario.ensureDataLoaded) - updateFilterDisplay() runs synchronously as part of
    // sidebar.render(), which can happen before updateAllChartData()'s own await on this same
    // scenario set resolves, so calling getFilterGroupForAttribute() on a not-yet-loaded
    // scenario would just log a spurious "jsonData is undefined" error for nothing: its
    // contribution to the union would come from console noise, not real data, and this whole
    // chart takes another pass through here anyway once loading finishes and re-renders.
    const _scenarios = this.getNeededScenarios().filter(s => s.jsonData?.[this.jsonName]);
    if (!_scenarios.length) {
      // Nothing loaded yet (e.g. very first render, or still awaiting ensureDataLoaded) -
      // fall back to the old single-arbitrary-scenario behavior rather than showing no filters.
      const _filterGroup = this.getFilterGroup();
      return _filterGroup ? _filterGroup.split("_") : undefined;
    }

    const _union = new Set();
    _scenarios.forEach(_scenario => {
      const _filterGroup = this.getFilterGroup(_scenario);
      if (_filterGroup) {
        _filterGroup.split("_").forEach(fCode => { if (fCode) _union.add(fCode); });
      }
    });
    return _union.size ? Array.from(_union) : undefined;
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

    if (!allChartDataFiltered || allChartDataFiltered.length === 0) {
      // Nothing matches this specific combination (pinned geography/trend group, filters,
      // series selection...) - hide the chart area the same way as no trend group being
      // selected at all, instead of drawing empty axes with nothing in them.
      if (this.currentChart) {
        this.currentChart.destroy();
        this.currentChart = null;
      }
      document.getElementById('trendHeader').innerHTML = '';
      document.getElementById('trendContent').innerHTML = '';
      document.getElementById('trendTable').innerHTML = '';
      document.getElementById('copyTableBtn').parentElement.style.display = 'none';
      // #trendChartToggle is the "> Chart" collapse header - it lives outside #trendContent
      // (see the click-listener setup above) so wiping trendContent's innerHTML doesn't touch
      // it. Left alone it kept showing a clickable "Chart" row that expanded to nothing, the
      // only sidebar element still implying there was something to look at.
      document.getElementById('trendChartToggle').style.display = 'none';
      // #trendSelector was already populated by updateAllChartData() (it builds/appends the
      // geography/trend-group pin radios before calling buildChart()) - with nothing to chart,
      // its "— TREND SELECTOR —" label and any radio group titles have nothing left to pin, so
      // hide the whole column instead of leaving orphaned labels with no controls under them.
      // visibility (not display) - #trendSelector is a flex-row sibling of #trendMain/
      // #trendSettings, and display:none would pull it out of flow and shift them over, same
      // as the #trendMain collapse bug fixed earlier.
      document.getElementById('trendSelector').style.visibility = 'hidden';
      return;
    }
    document.getElementById('copyTableBtn').parentElement.style.display = '';
    document.getElementById('trendChartToggle').style.display = '';
    document.getElementById('trendSelector').style.visibility = '';

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

    // Same wording as this.modeOptions' static titles, but naming the actual baseline year
    // (Compare To Year) instead of a generic placeholder - regular Values mode stays blank.
    // Falls back to a generic label rather than an empty/undefined baseline if Compare To
    // Year somehow has no selection yet.
    var _compareYearLabel = compareYearSelect.selected || 'Selected Year';
    var _modeTitleSuffix = "";
    if (mode === 'change') {
      _modeTitleSuffix = ' - Compare to ' + _compareYearLabel;
    } else if (mode === 'pct_change') {
      _modeTitleSuffix = ' - Compare to ' + _compareYearLabel + ' (%)';
    }
    
    if (seriesIsAggregator) {
      _title = selectedTrendTitle + _agg.agTitleText + ' ' + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + selectedYearTitle + _modeTitleSuffix;
    } else if (seriesIsTrend) {
      _title = selectedAgTitle + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + selectedYearTitle + _modeTitleSuffix;
    } else {
      _title = selectedTrendTitle + selectedAgTitle + this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '') + selectedYearTitle + _modeTitleSuffix;
    }

    const _subTitle = this.sidebar.getSelectedOptionsAsLongText();

    // build y-axis title
    var _yaxisTitle = this.sidebar.getADisplayName();

    if (this.sidebar.dividers) {
      if (this.dCode!="Nothing") {
        _yaxisTitle += ' divided by ' + this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode).alias;
      }
    }

    _yaxisTitle += _modeTitleSuffix;

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

    // Chart.js's own defaults are a washed-out grey (#666 tick/label text, rgba(0,0,0,0.1)
    // gridlines/axis borders) - nothing here overrode them before, so the whole chart read as
    // grey rather than crisp. Chart.js is only ever used here (nowhere else in the app), so
    // this is safe to set globally rather than repeating it in every scale config below.
    // A dark color alone wasn't enough at the default 1px width - a hairline still reads as
    // faint - so the axis border width is bumped to 2px below (border.width) alongside this.
    Chart.defaults.color = '#1a1a1a';
    Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.18)';

    const calculatePercentChange = (currentValue, initialValue) => ((currentValue - initialValue) / initialValue) * 100;

    const calculateChange = (currentValue, initialValue) => currentValue - initialValue;

    // See resolveBaselineYear() below - same fallback rule, exposed as a method too since
    // generateTableFromChart() needs it outside this closure.
    const resolveBaselineYear = (values) => this.resolveBaselineYear(values);

    const modifyDataForChange = (values, changeType) => {
      const _baselineYear = resolveBaselineYear(values);
      if (_baselineYear === null) return []; // no data for the selected Compare To Year -
                                              // leave this series out of the chart entirely
                                              // rather than compute against a substitute year
      const initialValue = values[_baselineYear];
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
      const _baselineYear = resolveBaselineYear(values);
      if (_baselineYear === null) return NaN; // no data for the selected Compare To Year -
                                               // caller's isNaN check already treats this as
                                               // "skip this bar" (see its else branch)
      const initialValue = values[_baselineYear];
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

    // Earliest year actually present in the data being charted, rather than a hardcoded base
    // year - used as the x-axis min below so the "All Years" line/scatter chart starts exactly
    // where the data starts instead of assuming every scenario has a 2019 data point.
    const _yearsInChartData = _seriesValues
      .flatMap(series => Object.keys(chartData[series.code] || {}))
      .map(Number)
      .filter(year => !isNaN(year));
    const minChartYear = _yearsInChartData.length > 0 ? Math.min(..._yearsInChartData) : undefined;

    // With only a single year of data, min===max would collapse the x-axis to one point with
    // no sense of scale - give it a future span instead (+30 years, rounded up to the next 5)
    // so a lone point still reads as a point in time on a real timeline.
    const _distinctChartYears = new Set(_yearsInChartData);
    const maxChartYear = _distinctChartYears.size === 1
      ? Math.ceil((minChartYear + 30) / 5) * 5
      : undefined;

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
                  pointRadius: seriesModeSelect.selected === 'scatter' ? 9 : 6,
                  pointBorderColor: '#ffffff', // thin white ring so a dot still reads as its
                                                // own point instead of blending into the line
                                                // (its own or an overlapping series') under it
                  pointBorderWidth: 2,
                  fill: seriesModeSelect.selected === 'stacked100' || seriesModeSelect.selected === 'stacked' ? true : false,
                  stack: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100' ? 'stack1' : undefined,
                  clip: 10, // lets point markers draw fully instead of getting half-clipped at
                            // the chart area edge when a data point sits right on x-axis min
                            // (the earliest year in the data) or the plot's other boundaries
                };
              }
              return null;
            }).filter(dataset => dataset !== null)
          },
          options: {
            animation: false,  // Disable animation
            // A CSS border on a real DOM element gets pixel-snapped by the browser's layout
            // engine, so it always lands crisply on one device pixel row. A <canvas> has no such
            // snapping - Chart.js draws the axis at whatever fractional x/y the computed layout
            // lands on (e.g. chartArea.left has landed on values like 96.4586px here), so a 1px
            // line straddles two pixel columns and gets anti-aliased into a soft grey band
            // instead of one solid line. Rendering the canvas backing store at a higher
            // resolution than the display needs (supersampling) shrinks that blur band relative
            // to what's visible, without changing the line's apparent CSS width the way
            // bumping border.width would.
            devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
            responsive: true,
            scales: {
              x: {
                type: 'linear',
                position: 'bottom',
                min: minChartYear,
                max: maxChartYear,
                border: { color: '#1a1a1a' }, // crisp axis line, distinct from the lighter gridlines
                ticks: {
                  callback: function(value) {
                    return value.toString().replace(/,/g, '');
                  }
                }
              },
              y: {
                beginAtZero: mode !== 'pct_change' && mode !== 'change',
                border: { color: '#1a1a1a' },
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
                  label: series.alias, // Label for each scenario name
                  data: dataPoints, // Data points for each groupId for the selected year
                  backgroundColor: _seriesValues.find(item=>item.code===code).color, // Random color for each scenario name
                  borderColor: _seriesValues.find(item=>item.code===code).color, // Random border color
                  borderWidth: 3
                };
              }
              return null;
            }).filter(dataset => dataset !== null) // Filter out any null datasets
          },
          options: {
            animation: false,  // Disable animation
            // A CSS border on a real DOM element gets pixel-snapped by the browser's layout
            // engine, so it always lands crisply on one device pixel row. A <canvas> has no such
            // snapping - Chart.js draws the axis at whatever fractional x/y the computed layout
            // lands on (e.g. chartArea.left has landed on values like 96.4586px here), so a 1px
            // line straddles two pixel columns and gets anti-aliased into a soft grey band
            // instead of one solid line. Rendering the canvas backing store at a higher
            // resolution than the display needs (supersampling) shrinks that blur band relative
            // to what's visible, without changing the line's apparent CSS width the way
            // bumping border.width would.
            devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
            scales: {
              x: {
                beginAtZero: true,
                border: { color: '#1a1a1a' },
                stacked: seriesModeSelect.selected === 'stacked' || seriesModeSelect.selected === 'stacked100', // Ensure x-axis is also stacked
              },
              y: {
                title: {
                  display: true,
                  text: seriesModeSelect.selected === 'stacked100' ? 'Percent Share' : _yaxisTitle // Set y-axis label dynamically
                },
                beginAtZero: true,
                border: { color: '#1a1a1a' },
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
  
  async updateDisplay() {
    console.log('viztrends:updateDisplay:' + this.id);
    if (typeof syncUrlState === 'function') syncUrlState();
    const trendSelectorDiv = document.getElementById("trendSelector");
    trendSelectorDiv.innerHTML = "";

    await this.updateAllChartData();
  }

  async updateAllChartData() {
    console.log('viztrends:updateAllChartData:' + this.id);

    if (!scenarioChecker.selected || scenarioChecker.selected.length === 0) {
      // No trend group checked - there's nothing to chart, so leave the chart area blank
      // instead of building an empty axes-only chart with no data in it. #trendMain itself
      // stays in the layout (not display:none) - it sits between #trendSelector and
      // #trendSettings, so collapsing it out of flow would shift #trendSettings left into
      // its place instead of leaving an empty middle area.
      if (this.currentChart) {
        this.currentChart.destroy();
        this.currentChart = null;
      }
      this.allChartData = [];
      document.getElementById('trendHeader').innerHTML = '';
      document.getElementById('trendContent').innerHTML = '';
      document.getElementById('trendTable').innerHTML = '';
      document.getElementById('copyTableBtn').parentElement.style.display = 'none';
      // See the matching comment in buildChart()'s no-data branch - #trendChartToggle lives
      // outside #trendContent, so clearing it above doesn't hide this too.
      document.getElementById('trendChartToggle').style.display = 'none';
      return;
    } else {
      document.getElementById('copyTableBtn').parentElement.style.display = '';
      document.getElementById('trendChartToggle').style.display = '';
    }

    const seriesIsFilter     = this.seriesSelect.selected[0] === 'f'; // Check if the first character is 'f'

    if (this.sidebar.dividers) {
      var _selectedDivider = this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode) || null;
    }

    // Some dividers only convert their attribute's units correctly when a particular filter
    // is at its full/default selection - e.g. TRANSIT_RM's aRM is Route-Direction-Miles, so
    // halving it only yields true Route-Miles when every direction is included. Narrow the
    // Direction filter to fewer than all its options and the sum is no longer doubled, so
    // halving it again would undercount instead of correct it.
    let _applyDividerScaling = !!(_selectedDivider && _selectedDivider.divideResultBy);
    if (_applyDividerScaling && _selectedDivider.divideResultByUnlessFilterNarrowed) {
      const _scalingFilter = this.sidebar.filters.find(f => f.fCode === _selectedDivider.divideResultByUnlessFilterNarrowed);
      if (_scalingFilter) {
        _applyDividerScaling = _scalingFilter.getSelectedOptionsAsList().length === _scalingFilter.options.length;
      }
    }

    const _trendsSelected = dataScenarioTrends.filter(a => scenarioChecker.selected.includes(a.scnTrendCode));
    const _aggregatorOptionsSelected = this.recastArrayIfNumeric(this.sidebar.aggregatorFilter.getSelectedOptionsAsList());
    const _selectedAggregator = this.sidebar.getSelectedAggregator();

    // Some attributes (e.g. Area Type - a categorical zone code, not a continuous quantity)
    // don't have a sensible blended value once you're summarizing across more than one zone -
    // not weighted-average, not plain sum - so rather than chart a number that would
    // misrepresent the data, produce no data points at all for them (see below).
    const _selectedAttrConfig = this.sidebar.attributes.find(a => a.attributeCode === this.aCode);
    const _isAggregatable = _selectedAttrConfig?.aggregatable !== false;

    // Scenario data loads lazily (see Scenario.ensureDataLoaded) - a trend chart can span more
    // scenarios than just main/comp (whichever modelruns belong to a checked trend group), so
    // resolve+ensure all of them up front here instead of one at a time inside the loop below.
    // _renderGen guards against a slower/older call finishing after a newer one already started
    // (e.g. rapidly toggling trend-group checkboxes) and clobbering its result.
    const _renderGen = ++this._renderGen;
    const _neededScenarios = this.getNeededScenarios();
    showDataLoadingIndicator();
    try {
      // A divider can point at a jsonName this chart wouldn't otherwise load (e.g. TRANSIT_RM
      // pulls from j-transit-segment-trends while this view's own data is j-transit-stops) - it
      // only worked for the existing TAZ_* dividers by coincidence, since j-zone-se happens to
      // already be loaded by the default landing dashboard. Load it explicitly so any divider
      // works regardless of what the user visited first; ensureDataLoaded is cached, so this is
      // a no-op for a jsonName that's already loaded.
      await Promise.all(_neededScenarios.flatMap(s => [
        s.ensureDataLoaded(this.jsonName),
        _selectedDivider ? s.ensureDataLoaded(_selectedDivider.jsonName) : Promise.resolve()
      ]));
    } finally {
      hideDataLoadingIndicator();
    }
    if (_renderGen !== this._renderGen) return; // a newer updateAllChartData() call has since started

    this.allChartData = [];

    // Which filter codes actually make up this attribute's data key (e.g. "fTelPurp_fTelTime")
    // can differ by model version - a CVM refactor can add, rename, or drop a filter dimension
    // for the same attribute code - so this can't be resolved once globally for the whole
    // chart like it used to be; it has to be resolved fresh per scenario, right before that
    // scenario's data is looked up below (see getFilterGroupArray()'s a_scenario param).
    const selectedFilterOptionsFor = (_scenario) => {
      const _filterGroupArray = this.getFilterGroupArray(_scenario) || [];
      let _options;
      const _lst = [];

      if (seriesIsFilter) {

        //seriesModeSelect.show();

        // get list
        const _filterForSeries = this.sidebar.filters.find(filter => filter.fCode === this.seriesSelect.selected);
        if (_filterForSeries.filterWij instanceof WijSelect) {
          _options = _filterForSeries.filterWij.getSelectedOptionsNotSubTotalsAsList();
        } else if (_filterForSeries.filterWij instanceof WijCheckboxes) {
          _options = _filterForSeries.filterWij.selected;
        }

        // Ensure _options is always an array
        if (typeof _options === 'string') {
          _options = [_options]; // Convert string to single-item list
        } else if (!Array.isArray(_options)) {
          _options = []; // If it's not an array and not a string, set it to an empty array
        }

        for (const _selectedFilter of _options) {
          _lst[_selectedFilter] = this.sidebar.getListOfSelectedFilterOptionsWithLockForGroup(_filterGroupArray, this.seriesSelect.selected, _selectedFilter);
        }

      } else {
        _options = [""];
        _lst[""] = this.sidebar.getListOfSelectedFilterOptionsForGroup(_filterGroupArray);
      }

      return { _selectedFilterOptions: _options, _lstOfSelectedFilterOptions: _lst };
    };

    // A divider's data can be split across filter dimensions this view also filters on (e.g.
    // TRANSIT_RM's route-miles share Route Name/Direction/Mode with this view's own boardings
    // data) - resolve which combos are currently selected for whichever of the divider's own
    // filter dimensions this sidebar actually has, so narrowing those filters shrinks the
    // divider's sum the same way it already shrinks the main attribute's. A divider whose
    // source has no filter dimensions at all (e.g. TAZ_HH, filterGroup "") resolves to the
    // single unfiltered "" combo, same as before.
    const selectedDividerFilterOptionsFor = (_scenario) => {
      if (!_selectedDivider) return [""];
      const _dividerFilterGroup = _scenario.getFilterGroupForAttribute(_selectedDivider.jsonName, _selectedDivider.attributeCode);
      const _dividerFilterGroupArray = _dividerFilterGroup ? _dividerFilterGroup.split("_") : [];
      return this.sidebar.getListOfSelectedFilterOptionsForGroup(_dividerFilterGroupArray);
    };

    _trendsSelected.forEach(trend => {
      const _scnTrendCode = trend.scnTrendCode;

      trend.modelruns.forEach(modelrun => {
        const _scnYear = modelrun.scnYear;
        const _scenario = this.getScenario(modelrun.modVersion, modelrun.scnGroup, _scnYear);

        if (!_scenario) return;

        const { _selectedFilterOptions, _lstOfSelectedFilterOptions } = selectedFilterOptionsFor(_scenario);

        const aggregatorKeyFile = _scenario.getAggregatorKeyFile(_selectedAggregator, this.baseGeoJsonKey);
        const _useDivide = this.dCode !== "Nothing";
        const aggregatorKeyFileDivide = _useDivide
          ? _scenario.getAggregatorKeyFile(_selectedAggregator, _selectedDivider.baseGeoJsonKey)
          : null;
        const _dividerFilterCombos = _useDivide ? selectedDividerFilterOptionsFor(_scenario) : null;

        _selectedFilterOptions.forEach(_fCode => {
          const _dataForFilterOptions = _scenario.getDataForFilterOptionsList(this.jsonName, _lstOfSelectedFilterOptions[_fCode]);
          const _wtCode = this.sidebar.getWeightCode() || "";
          const _hasWeight = Array.isArray(_wtCode) ? _wtCode.length > 0 : _wtCode !== "";
          const _dataForFilterOptionsWeight = _hasWeight
            ? _scenario.getDataForFilterOptionsList(this.jsonName, this.sidebar.getWeightCodeFilter())
            : null;

          _aggregatorOptionsSelected.forEach(_agId => {
            if (!_isAggregatable) return; // no chart point for this attribute - see note above

            let _dataSum = 0;
            let _dataSumWeight = 0;
            let _sumDivide = 0;
            let _dataDivide = {};

            // ------- AGGREGATION -------
            const geoJsonIdSet = aggregatorKeyFile
              ? new Set(
                  aggregatorKeyFile
                    .filter(record => record[_selectedAggregator.agCode] === _agId)
                    .map(record => String(record[this.baseGeoJsonId]))
                )
              : null;

            const relevantKeys = aggregatorKeyFile
              ? Object.keys(_dataForFilterOptions).filter(k => geoJsonIdSet.has(String(k)))
              : (_selectedAggregator.agCode === this.baseGeoJsonId ? Object.keys(_dataForFilterOptions) : []);

            for (const key of relevantKeys) {
              const row = _dataForFilterOptions[key];
              const value = row?.[this.aCode];

              if (value != null) {
                if (_hasWeight) {
                  const weight = getWeightValue(_dataForFilterOptionsWeight?.[key], _wtCode);
                  if (weight != null) {
                    _dataSum += value * weight;
                    _dataSumWeight += weight;
                  }
                } else {
                  _dataSum += value;
                }
              }
            }

            // No rows at all matched this geography+filter combination - as opposed to
            // matching rows whose values legitimately sum to zero - e.g. a filter selection
            // (restored from a URL, or otherwise) that doesn't correspond to any real data for
            // this attribute/scenario. Treat as "no data" (null, skipped below) instead of
            // charting a false zero-value point.
            if (relevantKeys.length === 0) {
              _dataSum = null;
            }

            // Compute weighted average if needed
            if (_hasWeight && _dataSumWeight > 0) {
              _dataSum /= _dataSumWeight;
            } else if (_hasWeight && _dataSumWeight === 0) {
              _dataSum = null;
            }

            // ------- DIVIDE LOGIC -------
            if (_useDivide) {
              const jsonDivider = _scenario.jsonData?.[_selectedDivider.jsonName];
              if (!jsonDivider) return;  // skip this iteration if no divide data

              const geoJsonIdSetDivide = aggregatorKeyFileDivide
                ? new Set(
                    aggregatorKeyFileDivide
                      .filter(record => record[_selectedAggregator.agCode] === _agId)
                      .map(record => String(record[_selectedDivider.baseGeoJsonId]))
                  )
                : null;

              // Merge across only the filter combos currently selected for this divider's own
              // filter dimensions (see selectedDividerFilterOptionsFor above) - e.g. narrowing
              // Route Name/Direction/Mode shrinks the route-miles denominator the same way it
              // already shrinks the boardings numerator, instead of always summing every route
              // in the system regardless of what's filtered.
              _dataDivide = _scenario.getDataForFilterOptionsList(
                _selectedDivider.jsonName,
                _dividerFilterCombos,
                "sum",
                _selectedDivider.attributeCode
              );

              const relevantDivideKeys = geoJsonIdSetDivide
                ? Object.keys(_dataDivide).filter(k => geoJsonIdSetDivide.has(String(k)))
                : (_selectedAggregator.agCode === this.baseGeoJsonId ? Object.keys(_dataDivide) : []);

              for (const key of relevantDivideKeys) {
                const val = _dataDivide[key];
                if (val != null) _sumDivide += val;
              }

              if (_applyDividerScaling) _sumDivide /= _selectedDivider.divideResultBy;

              if (_sumDivide > 0) {
                _dataSum /= _sumDivide;
              } else {
                _dataSum = null;
              }
            }

            // ------- FINAL PUSH -------
            if (_dataSum != null) {
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

    // #trendSelector shows a static "— TREND SELECTOR —" label above these (see styles.css),
    // but each radio still needs its own title: when a filter is the chart series, BOTH
    // wijRadioAgId and wijRadioTrendCode render together to pin one geography and one trend
    // group (so the filter's own values can be plotted unambiguously) - with no label at all
    // that read as a single flat list of options instead of two separate pinned choices.
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
        if (this.isSelectedAttributeStackable()) {
          seriesModeSelect.show();
        } else {
          seriesModeSelect.hide();
          seriesModeSelect.selected = 'scatter'; // Force fallback to valid mode
        }
        this.wijRadioAgId = null;
        this.wijRadioTrendCode = _radioTrend;
      } else if (seriesIsFilter) {
        if (this.isSelectedAttributeStackable()) {
          seriesModeSelect.show();
        } else {
          seriesModeSelect.hide();
          seriesModeSelect.selected = 'scatter'; // Force fallback to valid mode
        }
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
        if (this.isSelectedAttributeStackable()) {
          seriesModeSelect.show();
        } else {
          seriesModeSelect.hide();
          seriesModeSelect.selected = 'scatter'; // Force fallback to valid mode
        }
        barGroupSelect.hide();
        this.wijRadioAgId = null;
        this.wijRadioTrendCode = null;
      } else if (seriesIsFilter) {
        if (this.isSelectedAttributeStackable()) {
          seriesModeSelect.show();
        } else {
          seriesModeSelect.hide();
          seriesModeSelect.selected = 'scatter'; // Force fallback to valid mode
        }
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
      this.setCompareYearVisible(false);
    } else {
      modeSelect.show();
      // Meaningful whenever there's a baseline to compare against: explicitly in Change/%
      // Change from Base Year mode, or implicitly in regular Values mode's All Years table,
      // which now annotates each value with its own vs.-baseline delta (see
      // generateTableFromChart()). Single-year mode has no year axis to compare across, so it
      // stays hidden there regardless of chart mode.
      const modeNeedsBaseline = modeSelect.selected === 'change' || modeSelect.selected === 'pct_change';
      this.setCompareYearVisible(modeNeedsBaseline || (modeSelect.selected === 'regular' && isAllYears));
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
  // Same baseline-resolution rule as buildChart()'s own resolveBaselineYear() (a series without
  // data for the globally-selected Compare To Year falls back to its own earliest year) - kept
  // as a standalone method since generateTableFromChart() needs it too and isn't nested inside
  // buildChart()'s closure.
  // Compare To Year lives in its own "— TABLE DISPLAY SETTINGS —" card (#trendTableOptions,
  // see viztrends.html) below the "— CHART DISPLAY SETTINGS —" card - unlike the other
  // Wij-widgets, hiding just compareYearSelect's own container would leave that whole card
  // visibly empty (its own child mount div, #trendCompareYear, is never itself removed from
  // the DOM), so its card wrapper needs its own show/hide alongside the widget's.
  setCompareYearVisible(visible) {
    if (visible) {
      compareYearSelect.show();
    } else {
      compareYearSelect.hide();
    }
  }

  // Only ever the exact Compare To Year - no more falling back to a series' own earliest year
  // when that year isn't there. A silently-substituted baseline read as the series comparing
  // to a *different* year than every other row without saying so; null here means "nothing to
  // compare" and every caller now leaves that series/cell blank instead of computing against a
  // baseline nobody chose.
  resolveBaselineYear(values) {
    const _compareYear = (typeof compareYearSelect !== 'undefined' && compareYearSelect && compareYearSelect.selected) || '';
    if (_compareYear && Object.prototype.hasOwnProperty.call(values, _compareYear)) {
      return _compareYear;
    }
    return null;
  }

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

    // In plain Values mode (not already charting Change/% Change, and not the single-year
    // grouped-bar table, which has no year axis to compare across) each cell also gets a small
    // vs.-baseline delta - red/up for an increase, blue/down for a decrease, the same
    // non-judgmental color pairing measure.js's dashboard cards use (an increase isn't
    // automatically "good" for a metric like VHT/VMT, so no green/red good-bad coding here).
    const mode = (typeof modeSelect !== 'undefined' && modeSelect) ? modeSelect.selected : 'regular';
    const showDelta = !isGroupedBar && mode === 'regular';

    // Add rows for each dataset (series)
    datasets.forEach(dataset => {
      let _colorRGBA;

      if (_seriesValues) {
        _colorRGBA = _seriesValues.find(item => item.alias === dataset.label).color;
      } else {
        _colorRGBA = undefined;
      }

      // This row's own baseline - null (see resolveBaselineYear()) when this series has no
      // data for the globally-selected Compare To Year, in which case every cell below simply
      // shows its plain value with no delta rather than comparing against a substitute year.
      let _baselineYear = null;
      let _baselineValue = null;
      if (showDelta) {
        const _valuesByYear = {};
        dataset.data.forEach(point => { _valuesByYear[point.x] = point.y; });
        _baselineYear = this.resolveBaselineYear(_valuesByYear);
        if (_baselineYear !== null) _baselineValue = _valuesByYear[_baselineYear];
      }

      // First column: Color square, no header
      tableHTML += `<tr><td style="width: 20px;"><div style="width: 15px; height: 15px; background-color: ${_colorRGBA};"></div></td>`;

      // Second column: series label, left-aligned
      tableHTML += `<td style="text-align: left;">${dataset.label}</td>`;

      // Add y-values for each label (year or group), formatted and right-aligned
      labels.forEach((label, index) => {
        let yValue;
        let dataPoint;
        if (isGroupedBar) {
          // Handle grouped bar chart data
          yValue = dataset.data[index] !== undefined ? this.formatYValue(dataset.data[index]) : ''; // Use the index for grouped bar
        } else {
          // Handle regular chart data
          dataPoint = dataset.data.find(point => point.x === label); // Match year with x-value
          yValue = dataPoint ? this.formatYValue(dataPoint.y) : ''; // If no y-value, leave blank
        }

        let _delta = '';
        if (showDelta && dataPoint && _baselineValue && String(label) !== String(_baselineYear)) {
          const _pctChange = ((dataPoint.y - _baselineValue) / _baselineValue) * 100;
          if (_pctChange > 0) {
            _delta = ` <span class="ledger-delta up">&#9650; ${Math.abs(_pctChange).toFixed(1)}%</span>`;
          } else if (_pctChange < 0) {
            _delta = ` <span class="ledger-delta down">&#9660; ${Math.abs(_pctChange).toFixed(1)}%</span>`;
          }
        }

        tableHTML += `<td style="text-align: right;">${yValue}${_delta}</td>`;
      });

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';

    // Append the table to the DOM (or replace existing one)
    document.getElementById('trendTable').innerHTML = tableHTML;
  }


}
