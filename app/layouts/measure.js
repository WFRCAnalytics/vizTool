class Measure {
  constructor(measureId, parentCard) {
    this.measureId = measureId;
    this.parentCard = parentCard;

    const cfg = (configMeasures || {})[measureId] || {};
    this.cmIcon  = cfg.cmIcon;      // Calcite icon name (optional)
    this.faIcon  = cfg.faIcon;      // Font Awesome icon name (optional)
    this.textIcon = cfg.textIcon || null;
    this.iconColor = cfg.iconColor || null;
    this.iconBadge = cfg.iconBadge || null; // short text overlaid on the icon, e.g. "BRT" - for
                                             // measures that would otherwise share one generic
                                             // icon (all the bus submodes use fa-bus alike)
    this.iconTitle = cfg.iconTitle || cfg.iconHoverText || null;
    this.jsonName = cfg.jsonName;
    this.attribute = cfg.attribute;
    this.selectedFilters = cfg.selected_filters || {};
    this.divideAttribute = cfg.divide_attribute || null;
    this.divideSelectedFilters = cfg.divide_selected_filters || {};
    this.agFilterOptionsMethod = cfg.agFilterOptionsMethod || "sum";
    this.baseGeoJsonKey = cfg.baseGeoJsonKey || null;
    this.divideBaseGeoJsonKey = cfg.divide_baseGeoJsonKey || null;
    this.baseGeoJsonId = cfg.baseGeoJsonId || null;
    this.divideBaseGeoJsonId = cfg.divide_baseGeoJsonId || null;

    // optional different jsonName for denominator
    this.divideJsonName = cfg.divide_jsonName || null;

    //// decimals from config, default 0
    //const dec = cfg.displayDecimals;
    //this.displayDecimals = Number.isFinite(dec) ? dec : 0;

    this.displayFormat = cfg.displayFormat || "#,##0.00";

  }

  toLabel(id) { return id.replace(/^m/, "").replace(/([A-Z])/g, " $1").trim(); }

  // --- Scenario helpers ---
  getMain() {
    return this._getFromSelected(selectedScenario_Main);
  }

  getComp() {
    return this._getFromSelected(selectedScenario_Comp);
  }

  _getFromSelected(sel) {
    if (!sel) return null;
    const year = Number.parseInt(sel.scnYear, 10);
    return this.getScenario(sel.modVersion, sel.scnGroup, Number.isFinite(year) ? year : sel.scnYear);
  }


  getScenario(_modVersion, _scnGroup, _scnYear) {
    return dataScenarios.find(scenario =>
                              scenario.modVersion === _modVersion &&
                              scenario.scnGroup   === _scnGroup   &&
                              scenario.scnYear    === _scnYear
                              ) || null;
  }

  _getCompareTypeOption() {
    const calciteSelectCompare = document.getElementById('selectCompareTypeDash');
    if (!calciteSelectCompare) return null;
    return calciteSelectCompare.value;
  }
  
  _getFilterCombinationsFor(filters) {
    const filterValues = Object.values(filters || {});

    if (filterValues.length === 0) return [''];

    const combine = (arr1, arr2) => {
      const results = [];
      for (const v1 of arr1) for (const v2 of arr2) results.push(`${v1}_${v2}`);
      return results;
    };

    let combos = filterValues[0];
    for (let i = 1; i < filterValues.length; i++) {
      combos = combine(combos, filterValues[i]);
    }
    return combos;
  }

  _combineLists(lists) {
    if (lists.length === 0) return [''];
    const combine = (arr1, arr2) => {
      const results = [];
      for (const v1 of arr1) for (const v2 of arr2) results.push(`${v1}_${v2}`);
      return results;
    };
    let combos = lists[0];
    for (let i = 1; i < lists.length; i++) {
      combos = combine(combos, lists[i]);
    }
    return combos;
  }

  // Builds the combo key list for one attribute the same way getDataForFilterOptionsList
  // needs them, but resolved against THIS scenario's own filterGroup for that attribute
  // instead of blindly trusting selectedFilters to already list every dimension. A data
  // pipeline upgrade can add a filter dimension to an attribute without measures.json ever
  // being updated for it (e.g. Auto Trips gaining an fModeAuto breakdown) - when that
  // happens the configured filters no longer cover every segment the real data key needs,
  // so nothing matches and the sum comes back as 0/null even though the data exists.
  // Any dimension that's part of the attribute's filterGroup but missing from
  // selectedFilters gets every value that dimension has *in this scenario* substituted in
  // (summing across all of them), instead of silently matching nothing. Different scenarios
  // (e.g. comparing an older and newer model version) can have different filterGroups for
  // the same attribute, so this has to be called per-scenario rather than once and reused.
  _buildFilterGroupCombos(scenario, jsonName, attributeCode, selectedFilters) {
    const filterGroup = scenario && attributeCode
      ? scenario.getFilterGroupForAttribute(jsonName, attributeCode)
      : '';

    if (!filterGroup) {
      // No filterGroup metadata for this attribute/jsonName (or attribute not found) -
      // fall back to the plain configured filter list, same as before this existed.
      return this._getFilterCombinationsFor(selectedFilters);
    }

    const dimensions = filterGroup.split('_').filter(Boolean);
    const scenarioFilters = scenario.jsonData?.[jsonName]?.filters || [];

    const listsPerDimension = dimensions.map(dim => {
      const configured = selectedFilters ? selectedFilters[dim] : null;
      if (Array.isArray(configured) && configured.length) return configured;

      const meta = scenarioFilters.find(f => f.fCode === dim);
      return (meta && Array.isArray(meta.fOptions) && meta.fOptions.length) ? meta.fOptions : [''];
    });

    return this._combineLists(listsPerDimension);
  }


  // --- Measure row renderer ---
  renderMeasure() {

    const row = document.createElement('div');
    row.className = 'measure-row';

    // Icon wrapper with fixed width
    const iconWrap = document.createElement('div');
    iconWrap.className = 'measure-icon';

    if (this.iconTitle) {
      iconWrap.title = this.iconTitle;
      iconWrap.setAttribute('aria-label', this.iconTitle); // (nice for accessibility)
    }

    const iconEl = this.renderIcon();
    if (iconEl) iconWrap.appendChild(iconEl);
    row.append(iconWrap);

    const mainScenario = this.getMain();
    if (!mainScenario) {
      // Graceful fallback if main scenario missing
      const valueEl = document.createElement('span');
      valueEl.className = 'measure-value';
      valueEl.textContent = "–";
      row.append(valueEl);
      return row;
    }

        // --- Helpers ---
    const safeSum = (obj) => {
      if (!obj || typeof obj !== "object") return 0;
      let sum = 0;
      for (const key in obj) {
        if (!Object.hasOwn(obj, key)) continue;
        const n = Number(obj[key]);
        if (!Number.isNaN(n)) sum += n;
      }
      return sum;
    };

    // Build a lookup set: which TAZIDs have DISTLRG == 1?
    const buildFilterSet = (lookupArray, field = "DISTLRG", matchValue = 1) => {
      return new Set(
        lookupArray
          .filter(r => r[field] === matchValue)
          .map(r => String(r.TAZID)) // make keys match object keys
      );
    };

    function normalizeKey(k) {
      // Convert numeric strings to numbers; leave others as strings
      return (!isNaN(k) && k !== "" && k !== null) ? Number(k) : k;
    }

    // Filtered summation
    const filteredSafeSum = (obj, allowedset) => {
      if (!obj || typeof obj !== "object") return 0;

      let sum = 0;

      // Normalize allowedset once (convert all numeric strings → numbers)
      const normalizedAllowed = new Set(
        Array.from(allowedset, normalizeKey)
      );

      for (const key in obj) {
        if (!Object.hasOwn(obj, key)) continue;

        const normalizedKey = normalizeKey(key);

        if (!normalizedAllowed.has(normalizedKey)) continue;

        const n = Number(obj[key]);
        if (!Number.isNaN(n)) sum += n;
      }

      return sum;
    };

    // Filtered weighted average: sum(value*weight)/sum(weight) over the allowed geo set.
    // Mirrors vizMap's own zone-to-summary-geography aggregation (vizmap.js's _wtCode handling)
    // for an attribute that configures an agWeightCode - an index like Access to Jobs is
    // meaningless just summed across a whole region, but a household-weighted average of it
    // means something. Falls back to a plain sum if no weight data is available for a zone.
    const filteredWeightedAverage = (valObj, weightObj, allowedset) => {
      if (!valObj || typeof valObj !== "object") return 0;
      if (!weightObj || typeof weightObj !== "object") return filteredSafeSum(valObj, allowedset);

      const normalizedAllowed = new Set(Array.from(allowedset, normalizeKey));

      let sumValWt = 0;
      let sumWt = 0;
      for (const key in valObj) {
        if (!Object.hasOwn(valObj, key)) continue;
        const normalizedKey = normalizeKey(key);
        if (!normalizedAllowed.has(normalizedKey)) continue;

        const val = Number(valObj[key]);
        const wt = Number(weightObj[key]);
        if (Number.isNaN(val) || Number.isNaN(wt) || !wt) continue;

        sumValWt += val * wt;
        sumWt += wt;
      }

      return sumWt > 0 ? sumValWt / sumWt : 0;
    };

    // Arcade-style number formatter
    const applyArcadeFormat = (value, format) => {
      let num = Number(value);
      if (!Number.isFinite(num)) return "–";

      // Percent handling
      const isPercent = format.includes("%");
      if (isPercent) num *= 100;

      // Decimal places from format (e.g. 0.00 → 2)
      const decimalMatch = format.match(/\.(0+)/);
      const decimals = decimalMatch ? decimalMatch[1].length : 0;

      // Format base number
      let formatted = num.toFixed(decimals);

      // Thousands separator
      if (format.includes(",")) {
        formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }

      // Inject into format string
      return format
        .replace(/[#0,.]+/, formatted)
        .replace("%", isPercent ? "%" : "");
    };

    const formatNumber = (val) => {
      if (val == null || Number.isNaN(val)) return "–";

      const num = Number(val);
      // A literal zero here almost always means "no matching data for this geography/filter",
      // not "the model computed an actual zero" - same dash as the null case above, rather
      // than a bare "0" or "0.0%" that reads as real data.
      if (num === 0) return "–";

      // If displayFormat is provided, use it
      if (typeof this.displayFormat === "string" && this.displayFormat.length) {
        return applyArcadeFormat(num, this.displayFormat);
      }

    };

    const formatSignedNumber = (val) => {
      if (val == null || Number.isNaN(val)) return "–";
      const n = Number(val);
      if (!Number.isFinite(n)) return "–";

      const sign = n > 0 ? "+" : (n < 0 ? "−" : "");
      const abs = Math.abs(n);

      // Use same displayFormat as everything else
      const absText =
        (typeof this.displayFormat === "string" && this.displayFormat.length)
          ? applyArcadeFormat(abs, this.displayFormat)
          : String(abs);

      return sign ? `${sign}${absText}` : absText;
    };

    // Percent diff always with 1 decimal (independent of displayDecimals)
    const formatPercent = (val) => {
      if (val == null || Number.isNaN(val)) return "–";
      const pct = Number(val) * 100;
      const sign = pct > 0 ? "+" : (pct < 0 ? "−" : "");
      const absStr = Math.abs(pct).toFixed(1);
      return `${sign}${absStr}%`;
    };

    // --- Compare mode? ---
    const comparePanel = document.getElementById('comparisonScenarioDash');
    const compScenario = this.getComp();
    const hasComparePanelOpen = comparePanel && comparePanel.open;
    const compareMode = hasComparePanelOpen && compScenario ? 'compare' : 'main';

    let _valueMain = 0;
    let _valueComp = 0;
    let _valueDisp = 0;
    let _textDisp = '';
    let _textMain = '';
    let _textComp = '';

    //agCodeLabelField : "PLANAREA"
    //agGeoJsonKey : "planarea"
    
    // get summary geography

    const _selectedAggregator = this.parentCard.vizLayout.getSelectedAggregator();

    function normalizeValue(v) {
      // Convert numeric strings to numbers, otherwise return original
      return (!isNaN(v) && v !== '' && v !== null) ? Number(v) : v;
    }

    // Builds the set of geo IDs (in whichever ID space geoJsonKey/geoJsonId use) that fall
    // inside the currently selected Summary Geography, for filteredSafeSum() to restrict to.
    // Numerator and denominator can live at different geography levels (e.g. VMT/HH sums
    // VMT over roadway segments but Households over TAZs) - each needs its own geo set in
    // its own ID space rather than sharing one blindly, or the denominator's sum silently
    // matches nothing (every roadway SEGID is foreign to the household data's TAZID keys).
    const buildGeosFor = (geoJsonKey, geoJsonId) => {
      if (!_selectedAggregator || !geoJsonKey || !geoJsonId) return [];

      const aggregatorKeyFile = mainScenario.getAggregatorKeyFile(_selectedAggregator, geoJsonKey);
      if (!aggregatorKeyFile) return [];

      const selectedOptions = this.parentCard.vizLayout.sidebar
        .aggregatorFilter
        .getSelectedOptionsAsList()
        .map(normalizeValue);

      const agRecords = aggregatorKeyFile.filter(record => {
        const recVal = normalizeValue(record[_selectedAggregator.agCode]);
        return selectedOptions.includes(recVal);
      });

      return new Set(agRecords.map(r => r[geoJsonId]));
    };

    const _geos = buildGeosFor(this.baseGeoJsonKey, this.baseGeoJsonId);

    // Combines an attribute's per-zone values across a summary geography. Each scenario
    // resolves its own filter combos from its own filterGroup metadata (see
    // _buildFilterGroupCombos) - main and comp can be different model versions whose data
    // pipeline added/renamed a filter dimension for this attribute between them, so sharing
    // one combo list between them could silently match nothing on whichever side's data
    // doesn't have that shape.
    // If the attribute configures an agWeightCode (attributes.json), aggregate the same way
    // vizMap does for it (vizmap.js's _wtCode handling) - a household-weighted average instead
    // of a plain sum, since an index like Access to Jobs isn't meaningful just summed across a
    // whole region. No existing dashboard measure's attribute sets one today, so this only
    // changes behavior for a measure that actually opts into it via its attribute config.
    const aggregateAcrossGeos = (scenario, jsonName, attributeCode, selectedFilters, geos) => {
      const combos = this._buildFilterGroupCombos(scenario, jsonName, attributeCode, selectedFilters);
      const data = scenario.getDataForFilterOptionsList(jsonName, combos, this.agFilterOptionsMethod, attributeCode);

      const weightCode = (configAttributes[attributeCode] || {}).agWeightCode || null;
      if (!weightCode) {
        return filteredSafeSum(data, geos);
      }

      const weightCombos = this._buildFilterGroupCombos(scenario, jsonName, weightCode, {});
      const weightData = scenario.getDataForFilterOptionsList(jsonName, weightCombos, "sum", weightCode);
      return filteredWeightedAverage(data, weightData, geos);
    };

    if (this.agFilterOptionsMethod === 'sum') {
      // --- Numerator values (main / comp) ---
      const mainNum = aggregateAcrossGeos(mainScenario, this.jsonName, this.attribute, this.selectedFilters, _geos);

      let compNum = 0;
      if (compareMode === 'compare') {
        compNum = aggregateAcrossGeos(compScenario, this.jsonName, this.attribute, this.selectedFilters, _geos);
      }

      // --- Optional denominator (divide_attribute / divide_jsonName) ---
      if (this.divideAttribute) {
        const divJsonName = this.divideJsonName || this.jsonName;

        const divGeoJsonKey = this.divideBaseGeoJsonKey || this.baseGeoJsonKey;
        const divGeoJsonId = this.divideBaseGeoJsonId || this.baseGeoJsonId;
        const _geosDen = (divGeoJsonKey === this.baseGeoJsonKey && divGeoJsonId === this.baseGeoJsonId)
          ? _geos
          : buildGeosFor(divGeoJsonKey, divGeoJsonId);

        const mainDen = aggregateAcrossGeos(mainScenario, divJsonName, this.divideAttribute, this.divideSelectedFilters, _geosDen);

        let compDen = null;
        if (compareMode === 'compare') {
          compDen = aggregateAcrossGeos(compScenario, divJsonName, this.divideAttribute, this.divideSelectedFilters, _geosDen);
        }

        _valueMain = mainDen ? mainNum / mainDen : null;
        _valueComp =
          compareMode === 'compare'
            ? (compDen ? compNum / compDen : null)
            : 0;
      } else {
        // No divide → just raw sums
        _valueMain = mainNum;
        _valueComp = compNum;
      }
    } else {
      // Only sum supported here; just show nothing meaningful
      const valueEl = document.createElement('span');
      valueEl.className = 'measure-value';
      valueEl.textContent = "–";
      row.append(valueEl);
      return row;
    }

    // --- Display value (main vs diff / pctdiff) ---
    const compareType = this._getCompareTypeOption();

    try {
      if (compareMode === 'compare' && compareType) {
        if (compareType === 'diff') {
          _valueDisp = _valueMain - _valueComp;
          _textDisp = formatSignedNumber(_valueDisp);
        } else if (compareType === 'pctdiff') {
          if (_valueComp !== 0 && _valueComp != null) {
            _valueDisp = (_valueMain - _valueComp) / _valueComp;
            _textDisp = formatPercent(_valueDisp);
          } else {
            _valueDisp = null;
            _textDisp = "–";
          }
        } else {
          // Unknown compare type → fallback to main
          _valueDisp = _valueMain;
          _textDisp = formatNumber(_valueDisp);
        }
      } else {
        // No compare → just show main
        _valueDisp = _valueMain;
        _textDisp = formatNumber(_valueDisp);
      }

      // Absolute values for stacked display
      _textMain = formatNumber(_valueMain);
      _textComp = compareMode === 'compare' ? formatNumber(_valueComp) : "";
    } catch (err) {
      // Fallback: show main
      _valueDisp = _valueMain;
      _textDisp = formatNumber(_valueDisp);
      _textMain = formatNumber(_valueMain);
      _textComp = compareMode === 'compare' ? formatNumber(_valueComp) : "";
    }

    // --- Direction arrow badge ---
    const arrowWrap = document.createElement("div");
    arrowWrap.className = "measure-arrow";

    let arrow = "";
    let intensity = 0;

    if (compareMode === "compare" && !Number.isNaN(_valueDisp)) {

      // NORMAL ARROWS (NOT reversed)
      if (_valueDisp > 0) arrow = "▲";
      else if (_valueDisp < 0) arrow = "▼";
      else arrow = "";

      // --- INTENSITY CALC ---
      // For diff: use absolute diff relative to main value
      // For pctdiff: use absolute % difference directly
      let base = compareType === "pctdiff"
        ? Math.abs(_valueDisp)          // already normalized (0–1+)
        : Math.abs(_valueDisp) / (_valueMain || 1);

      // Clamp between 0 and 1
      intensity = Math.min(base, 1);

      // Convert intensity → 20–100% lightness
      // Lower diff → light red/blue
      // Higher diff → deep red/blue
      let lightness = 80 - intensity * 50; // 80% → 30%

      if (_valueDisp > 0) {
        arrowWrap.style.backgroundColor = `hsl(0, 70%, ${lightness}%)`;   // red tones
      } else if (_valueDisp < 0) {
        arrowWrap.style.backgroundColor = `hsl(215, 70%, ${lightness}%)`; // blue tones
      } else {
        arrowWrap.style.backgroundColor = `hsl(0, 0%, 70%)`;              // neutral gray
      }

    } else {
      // No compare
      arrow = "";
      arrowWrap.style.backgroundColor = `hsl(0, 0%, 70%)`;
    }

    arrowWrap.textContent = arrow;

    // Only show arrow if compare is enabled AND comp scenario exists
    if (compareMode === "compare" && !Number.isNaN(_valueDisp)) {
      row.append(arrowWrap);
    }

    // --- Middle: main / diff / pctdiff value ---
    const valueEl = document.createElement('span');
    valueEl.className = 'measure-value';
    valueEl.textContent = _textDisp;


    // --- Apply intensity-based color to the main measure value ---
    if (compareMode === "compare" && !Number.isNaN(_valueDisp)) {

      // Use same intensity we computed earlier
      let base = compareType === "pctdiff"
        ? Math.abs(_valueDisp)
        : Math.abs(_valueDisp) / (_valueComp || 1);

      let intensity = Math.min(base, 1);       // clamp 0–1
      let lightness = 80 - intensity * 50;     // 80% → 30%

      if (_valueDisp > 0) {
        valueEl.style.color = `hsl(0, 70%, ${lightness}%)`;      // red gradient
      } else if (_valueDisp < 0) {
        valueEl.style.color = `hsl(215, 70%, ${lightness}%)`;    // blue gradient
      } else {
        valueEl.style.color = `hsl(0, 0%, 35%)`;                 // neutral / gray
      }
    }

    row.append(valueEl);

    // --- Right side: table-style main / comp values in compare mode ---
    if (compareMode === 'compare') {

      // NEW container that pushes to far right
      const rightWrap = document.createElement('div');
      rightWrap.className = 'measure-compare-right';

      const table = document.createElement('div');
      table.className = 'measure-compare-table';

      // BEFORE
      const rowBefore = document.createElement('div');
      rowBefore.className = 'measure-compare-row';

      const labelBefore = document.createElement('div');
      labelBefore.className = 'measure-compare-label';
      labelBefore.textContent = "Before";

      const valueBefore = document.createElement('div');
      valueBefore.className = 'measure-comp-value';
      valueBefore.textContent = _textComp;

      rowBefore.append(labelBefore, valueBefore);

      // AFTER
      const rowAfter = document.createElement('div');
      rowAfter.className = 'measure-compare-row';

      const labelAfter = document.createElement('div');
      labelAfter.className = 'measure-compare-label';
      labelAfter.textContent = "After";

      const valueAfter = document.createElement('div');
      valueAfter.className = 'measure-main-value';
      valueAfter.textContent = _textMain;

      rowAfter.append(labelAfter, valueAfter);


      table.append(rowBefore, rowAfter);
      rightWrap.append(table);
      row.append(rightWrap);
    }
    
    return row;
  }


  renderIcon() {
    if (this.faIcon) {
      const i = document.createElement("i");
      const classes = this.faIcon.trim().split(/\s+/);
      if (!classes.some(c => /^fa-(solid|regular|brands)$/.test(c))) {
        classes.unshift("fa-solid");
      }
      i.classList.add(...classes);
      i.style.fontSize = "1.2em";
      if (this.iconColor) i.style.color = this.iconColor;

      if (!this.iconBadge) return i;

      const wrap = document.createElement("span");
      wrap.className = "measure-icon-badge-wrap";
      const badge = document.createElement("span");
      badge.className = "measure-icon-badge";
      badge.textContent = this.iconBadge;
      wrap.appendChild(i);
      wrap.appendChild(badge);
      return wrap;
    }

    if (this.cmIcon) {
      const icon = document.createElement("calcite-icon");
      icon.icon = this.cmIcon;
      icon.scale = "m";
      if (this.iconColor) icon.style.color = this.iconColor;
      return icon;
    }

    if (this.textIcon) {
      const span = document.createElement("span");
      span.className = "measure-text-icon";
      span.textContent = this.textIcon;
      if (this.iconColor) span.style.color = this.iconColor;
      return span;
    }

    return null;
  }


}