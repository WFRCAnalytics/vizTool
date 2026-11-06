class VizMatrix {
  constructor(data, modelEntity) {
    // Several unrelated entities share the same attributeTitle, so an id derived from it alone
    // would collide across entities - Filter.id (filter.js) is built from this.id, so a
    // collision means two different entities' filter checkboxes/selects end up with the same
    // DOM id/name once both have rendered at least once. modelEntity.submenuText is
    // guaranteed unique (it's what the menu and URL restore already key off of).
    this.id = data.id || this.generateIdFromText(modelEntity.submenuText || data.attributeTitle) + '-vizmatrix'; // use provided id or generate one if not provided
    console.log('vizmatrix:construct:' + this.id);

    // link to parent
    this.modelEntity = modelEntity;

    this.jsonName = data.jsonName;
    this.baseGeoJsonKey = data.baseGeoJsonKey;
    this.baseGeoJsonId = data.baseGeoJsonId;

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
                                  this);

    this.mode = 'main'; // default is main, other option is compare
    this.modeCompare = 'diff'; // default is absolute difference, other option is pctdiff

    // Bumped at the start of every updateDisplay() call so an older, still-loading call can
    // tell it's been superseded and bail out instead of clobbering a newer render.
    this._renderGen = 0;

    const copyButton = document.getElementById('copyTableBtnMatrix');
    if (copyButton) {
      copyButton.addEventListener('click', () => this.copyTableToClipboard());
    }

    // The compare scenario pickers (modVersion/scnGroup/scnYear_MatrixComp), the "Compare
    // to:" block's open state, and the compare-type choice are all wired up centrally in
    // app.js's setupSyncedCompareControls() / initVizMapListeners(), which both refreshes
    // the active view and keeps vizMap's equivalent controls mirrored to these.
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  renderSidebar() {
    this.sidebar.render();
  }

  // no scenario comparison for the matrix view
  updateScenarioSelector() {
  }

  afterUpdateSidebar() {
    console.log('vizmatrix:afterUpdateSidebar:' + this.id);
    this.updateDisplay();
  }

  afterUpdateAggregator() {
    console.log('vizmatrix:afterUpdateAggregator:' + this.id);
    // VizSidebar.afterUpdateAggregator() already rebuilt this.sidebar.aggregatorFilter for the
    // newly selected geography (fresh Filter instance, fresh map/isMapInitialized state) - it
    // has to be re-rendered here too, or the DOM keeps showing the old Filter's "Reference Map"
    // button/popup, which stays on the previous geography since its map was already initialized.
    this.sidebar.render();
    this.afterUpdateSidebar();
  }

  getScenario(_modVersion, _scnGroup, _scnYear) {
    return dataScenarios.find(scenario =>
                              scenario.modVersion === _modVersion &&
                              scenario.scnGroup   === _scnGroup   &&
                              scenario.scnYear    === _scnYear
                              ) || null;
  }

  getScenarioMain() {
    return this.getMain();
  }

  getMain() {
    return this.getScenario(         selectedScenario_Main.modVersion,
                                      selectedScenario_Main.scnGroup,
                            parseInt(selectedScenario_Main.scnYear, 10));
  }

  getMainScenarioDisplayName() {
    const _scenario = this.getMain();
    if (!_scenario) return '';
    if (_scenario.alias) {
      return _scenario.alias;
    }
    return _scenario.modVersion + ' ' + _scenario.scnGroup + ' ' + _scenario.scnYear;
  }

  getScenarioComp() {
    return this.getComp();
  }

  getComp() {
    if (!selectedScenario_Comp) return null;
    return this.getScenario(         selectedScenario_Comp.modVersion,
                                      selectedScenario_Comp.scnGroup,
                            parseInt(selectedScenario_Comp.scnYear, 10));
  }

  getCompScenarioDisplayName() {
    const _scenario = this.getComp();
    if (!_scenario) return '';
    if (_scenario.alias) {
      return _scenario.alias;
    }
    return _scenario.modVersion + ' ' + _scenario.scnGroup + ' ' + _scenario.scnYear;
  }

  // check if comparison scenario is in process of being defined, i.e. some fields are picked but not all
  isScenarioCompIncomplete() {
    if (this.getComp() === null) {
      return !!(selectedScenario_Comp &&
        (selectedScenario_Comp.modVersion !== "none" ||
         selectedScenario_Comp.scnGroup   !== "none" ||
         selectedScenario_Comp.scnYear    !== "none"));
    }
    return false;
  }

  // get the attribute code that is selected
  get aCode() {
    return this.sidebar.getACode();
  }

  getADisplayName() {
    return this.sidebar.getADisplayName();
  }

  getSelectedAggregator() {
    return this.sidebar.getSelectedAggregator();
  }

  getFilterGroup() {
    const _scenario = this.getScenarioMain();
    if (_scenario) {
      let _baseFilterGroup = _scenario.getFilterGroupForAttribute(this.jsonName, this.aCode);
      let _selectedAttribute = this.sidebar.attributes.find(attribute =>
        attribute.attributeCode == this.aCode
      ) || null;
      if (_selectedAttribute && _selectedAttribute.filterOverride) {
        // Loop through the filterOverride and replace filterIn with filterOut in the string
        _selectedAttribute.filterOverride.forEach(item => {
          _baseFilterGroup = _baseFilterGroup.replace(item.filterOut, item.filterIn);
        });
      }
      return _baseFilterGroup;
    }
  }

  getFilterGroupArray() {
    const _filterGroup = this.getFilterGroup();
    if (_filterGroup) {
      return _filterGroup.split("_");
    }
  }

  // Maps an origin/destination code (e.g. a DISTSML or PLANAREA value) to its display label,
  // using the currently selected aggregator's own filter options as the label source. Those
  // options are always built from real geometry/config (see Aggregator, aggregator.js), so a
  // code that isn't in there isn't a real geography - it's the model's "no district assigned"
  // catch-all bucket (e.g. external-station trips get lumped into whatever code is one past
  // the last real district for that scenario - see 18_SumToDistricts_FinalTripTables.s). That
  // catch-all's actual number varies by scenario/geography, so detecting it by "not a known
  // option" rather than hardcoding a value is what makes this keep working if it shifts.
  getAggregatorLabelLookup() {
    const selectedAgCode = this.getSelectedAggregator()?.agCode;
    const aggregator = this.sidebar.aggregators.find(item => item.agCode === selectedAgCode);
    const options = aggregator?.filterData?.fOptions || [];
    const lookup = new Map(options.map(option => [String(option.value), option.label]));
    return (code) => lookup.get(String(code)) ?? 'External';
  }

  getMatrixData() {
    const _scenario = this.getScenarioMain();
    if (_scenario) {
      return this.filterMatrixDataByAggregatorFilter(_scenario.getMatrixDataForFilteredOptionListWithAggregator(
        this.jsonName,
        this.sidebar.getListOfSelectedFilterOptions(),
        this.aCode,
        this.getSelectedAggregator(),
        this.baseGeoJsonKey,
        this.baseGeoJsonId
      ));
    }
  }

  getMatrixDataComp() {
    const _scenario = this.getScenarioComp();
    if (_scenario) {
      return this.filterMatrixDataByAggregatorFilter(_scenario.getMatrixDataForFilteredOptionListWithAggregator(
        this.jsonName,
        this.sidebar.getListOfSelectedFilterOptions(),
        this.aCode,
        this.getSelectedAggregator(),
        this.baseGeoJsonKey,
        this.baseGeoJsonId
      ));
    }
  }

  // Select Zone Geography's own checkbox sub-filter (the "Reference Map"-paired list, e.g.
  // which Plan Areas to include) scopes the PA table to just the checked origin zones - every
  // destination those origins reach still shows, so "select a region" reads as "show me where
  // this region's trips go" rather than a same-zones-only sub-matrix. Strictly follows the
  // checkboxes: nothing checked means nothing shown (the aggregator's own default here is
  // empty, not all-checked - see Aggregator.defaultSelected in aggregator.js - so the table
  // starts blank until at least one zone is checked, same as the checklist itself starts
  // blank). Only bypassed once every option is checked, since "all selected" and "unfiltered"
  // are the same result anyway.
  filterMatrixDataByAggregatorFilter(data) {
    const filter = this.sidebar.aggregatorFilter;
    if (!data || !filter || !filter.userModifiable) return data;

    const allOptionValues = (filter.options || []).map(option => String(option.value));
    const selected = new Set((filter.getSelectedOptionsAsList() || []).map(String));
    if (selected.size >= allOptionValues.length) return data;

    const filtered = {};
    Object.keys(data).forEach(origin => {
      if (selected.has(String(origin))) filtered[origin] = data[origin];
    });
    return filtered;
  }

  // Cell-by-cell main-vs-comp difference over the union of origins/destinations either
  // side has, so a district only one scenario has data for still shows up (against 0).
  combineMatrixDataForCompare(mainData, compData) {
    const combined = {};
    const origins = new Set([...Object.keys(mainData || {}), ...Object.keys(compData || {})]);

    origins.forEach(origin => {
      combined[origin] = {};
      const destinations = new Set([
        ...Object.keys((mainData || {})[origin] || {}),
        ...Object.keys((compData || {})[origin] || {})
      ]);

      destinations.forEach(dest => {
        const mainVal = (mainData || {})[origin]?.[dest] ?? 0;
        const compVal = (compData || {})[origin]?.[dest] ?? 0;

        if (this.modeCompare === 'pctdiff') {
          combined[origin][dest] = compVal !== 0 ? (mainVal - compVal) / compVal : null;
        } else {
          combined[origin][dest] = mainVal - compVal;
        }
      });
    });

    return combined;
  }

  async updateDisplay() {
    console.log('vizmatrix:updateDisplay:' + this.id);

    if (typeof syncUrlState === 'function') syncUrlState();

    const compareBlock = document.getElementById('comparisonScenarioMatrix');
    const compareTypeSelect = document.getElementById('selectCompareTypeMatrix');
    this.modeCompare = compareTypeSelect ? compareTypeSelect.value : 'diff';
    this.mode = (compareBlock?.open && this.getComp() !== null) ? 'compare' : 'main';

    // Scenario data loads lazily (see Scenario.ensureDataLoaded) - make sure whatever this
    // render needs is cached before the rest of this method reads it synchronously below.
    // _renderGen guards against a slower/older call finishing after a newer one already
    // started (e.g. rapid scenario or filter changes) and clobbering its result.
    const _renderGen = ++this._renderGen;
    const _mainScenario = this.getMain();
    const _compScenario = this.mode === 'compare' ? this.getComp() : null;
    showDataLoadingIndicator();
    try {
      await Promise.all([
        _mainScenario ? _mainScenario.ensureDataLoaded(this.jsonName) : Promise.resolve(),
        _compScenario ? _compScenario.ensureDataLoaded(this.jsonName) : Promise.resolve()
      ]);
    } finally {
      hideDataLoadingIndicator();
    }
    if (_renderGen !== this._renderGen) return; // a newer updateDisplay() call has since started

    // if a comparison scenario is only partially selected, wait rather than show stale/wrong data
    if (this.isScenarioCompIncomplete()) {
      return;
    }

    const headerDiv = document.getElementById('matrixHeader');
    if (headerDiv) {
      let titleText;
      if (this.mode === 'compare') {
        const compareLabel = this.modeCompare === 'pctdiff' ? 'Percent Difference' : 'Difference';
        titleText = this.getMainScenarioDisplayName() + ' vs ' + this.getCompScenarioDisplayName() +
                    ' - ' + this.getADisplayName() + ' (' + compareLabel + ')';
      } else {
        titleText = this.getMainScenarioDisplayName() + ' - ' + this.getADisplayName();
      }
      headerDiv.innerHTML = '<h1>' + titleText + '</h1>' +
                            '<div>' + this.sidebar.getSelectedOptionsAsLongText() + '</div>';
    }

    const mainData = this.getMatrixData();
    const container = document.getElementById('matrixTableContainer');

    // Older scenarios can come from a distsmlod pipeline config with a different filter
    // structure (e.g. an extra fPA dimension folded into the data keys), which makes every
    // lookup miss and every origin come back with zero destinations - rather than a
    // confusing table of row labels with no columns, say why there's nothing to show.
    if (!this.matrixDataHasAnyValues(mainData) && container) {
      container.innerHTML = '<p>No Production-Attraction data found for ' +
        this.getMainScenarioDisplayName() + '. This usually means it was built with an ' +
        'older or different data pipeline than the current one expects.</p>';
      return;
    }

    if (this.mode === 'compare') {
      const compData = this.getMatrixDataComp();

      if (!this.matrixDataHasAnyValues(compData) && container) {
        container.innerHTML = '<p>No comparable Production-Attraction data found for ' +
          this.getCompScenarioDisplayName() + '. This usually means it was built with an ' +
          'older or different data pipeline than ' + this.getMainScenarioDisplayName() +
          ', so the two can\'t be compared cell-by-cell.</p>';
        return;
      }

      const combined = this.combineMatrixDataForCompare(mainData, compData);
      this.generateTableFromMatrixData(combined, this.modeCompare === 'pctdiff');
    } else {
      this.generateTableFromMatrixData(mainData, false);
    }
  }

  matrixDataHasAnyValues(matrixData) {
    return Object.values(matrixData || {}).some(destMap => Object.keys(destMap).length > 0);
  }

  generateTableFromMatrixData(data, isPercent = false) {
    const container = document.getElementById('matrixTableContainer');
    if (!container) return;

    if (!data || Object.keys(data).length === 0) {
      container.innerHTML = '<p>No data available for this selection.</p>';
      return;
    }

    const getLabel = this.getAggregatorLabelLookup();
    const aggTitle = this.getSelectedAggregator()?.agTitleText || '';
    const getCellStyle = this.getCellStyler(isPercent);

    const origins = Object.keys(data).sort((a, b) => a - b);
    const destinations = Array.from(
      new Set(origins.flatMap(origin => Object.keys(data[origin])))
    ).sort((a, b) => a - b);

    let tableHTML = '<table class="custom-chart-table"><thead><tr>';
    tableHTML += `<th>Production \\ Attraction (${aggTitle})</th>`;
    destinations.forEach(dest => {
      tableHTML += `<th>${getLabel(dest)}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    origins.forEach(origin => {
      tableHTML += `<tr><td style="text-align:left;"><strong>${getLabel(origin)}</strong></td>`;
      destinations.forEach(dest => {
        const value = data[origin][dest];
        tableHTML += `<td style="${getCellStyle(value)}">${this.formatMatrixValue(value, isPercent)}</td>`;
      });
      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  formatMatrixValue(value, isPercent) {
    if (value === undefined || value === null) return '';
    const sign = value > 0 && this.mode === 'compare' ? '+' : '';
    if (isPercent) {
      return sign + (value * 100).toFixed(1) + '%';
    }
    return sign + Math.round(value).toLocaleString();
  }

  // Reuses the exact class-break color ramp already defined for this attribute's map
  // rendering (config/attributes.json) so the OD matrix's heatmap shading matches the
  // choropleth elsewhere in the app instead of inventing a separate palette. Sequential
  // ramp ("main") for the plain view, diverging red/blue ramp ("compare_abs"/"compare_pct")
  // for Difference/Percent Difference - same convention the map views already use.
  getCellStyler(isPercent) {
    const rendererCollection = configAttributes?.[this.aCode]?.rendererCollection;
    const rendererKey = this.mode === 'compare' ? (isPercent ? 'compare_pct' : 'compare_abs') : 'main';
    const renderer = rendererCollection?.[rendererKey];

    if (!renderer) {
      return () => '';
    }

    const classBreakInfos = renderer.classBreakInfos || [];
    const defaultColor = renderer.defaultSymbol?.color;

    return (value) => {
      if (value === undefined || value === null || isNaN(value)) return '';

      const brk = classBreakInfos.find(b => value >= b.minValue && value < b.maxValue);
      const color = brk ? brk.symbol?.color : defaultColor;
      if (!color) return '';

      const bg = this.colorToCss(color);
      const textColor = this.getContrastTextColor(color);
      return `background-color: ${bg}; color: ${textColor};`;
    };
  }

  colorToCss(color) {
    if (Array.isArray(color)) {
      const [r, g, b, a] = color;
      return `rgba(${r}, ${g}, ${b}, ${a ?? 1})`;
    }
    // Some legacy class breaks give bare hex without the leading '#' (e.g. outline colors) -
    // treat anything that isn't already a valid CSS color function as hex.
    return typeof color === 'string' && !color.startsWith('#') && !color.includes('(')
      ? '#' + color
      : color;
  }

  // Cells sit on a white table background, so a semi-transparent fill (most of these ramps
  // use ~0.75 alpha) needs to be blended toward white before judging light-vs-dark, or a
  // pale color with low alpha would wrongly get white text.
  getContrastTextColor(color) {
    let r, g, b, a = 1;

    if (Array.isArray(color)) {
      [r, g, b, a = 1] = color;
    } else if (typeof color === 'string') {
      const hex = color.startsWith('#') ? color.slice(1) : color;
      if (hex.length < 6) return '#222';
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      return '#222';
    }

    const blend = (channel) => channel * a + 255 * (1 - a);
    const luminance = (0.299 * blend(r) + 0.587 * blend(g) + 0.114 * blend(b)) / 255;
    return luminance > 0.6 ? '#222' : '#fff';
  }

  copyTableToClipboard() {
    const header = document.getElementById('matrixHeader')?.innerHTML || '';
    const table = document.getElementById('matrixTableContainer')?.innerHTML || '';
    const combinedContent = header + '\n\n' + table;

    const tempTextArea = document.createElement('textarea');
    tempTextArea.style.position = 'fixed'; // Avoid scrolling to bottom
    tempTextArea.style.opacity = 0; // Make it invisible
    tempTextArea.value = combinedContent;

    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextArea);
  }

}
