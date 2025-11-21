class Measure {
  constructor(measureId, parentCard) {
    this.measureId = measureId;
    this.parentCard = parentCard;

    const cfg = (configMeasures || {})[measureId] || {};
    this.cmIcon  = cfg.cmIcon;      // Calcite icon name (optional)
    this.faIcon  = cfg.faIcon;      // Font Awesome icon name (optional)
    this.textIcon = cfg.textIcon || null;
    this.iconTitle = cfg.iconTitle || cfg.iconHoverText || null;
    this.jsonName = cfg.jsonName;
    this.attribute = cfg.attribute;
    this.selectedFilters = cfg.selected_filters || {};
    this.divideAttribute = cfg.divide_attribute || null;
    this.divideSelectedFilters = cfg.divide_selected_filters || {};
    this.agFilterOptionsMethod = cfg.agFilterOptionsMethod || "sum";
    
    // optional different jsonName for denominator
    this.divideJsonName = cfg.divide_jsonName || null;

    // decimals from config, default 0
    const dec = cfg.displayDecimals;
    this.displayDecimals = Number.isFinite(dec) ? dec : 0;
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
    const calciteSelectCompare = document.getElementById('dashside-selectCompareType');
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

    // Per-measure decimals (from config)
    const decimals = Number.isFinite(this.displayDecimals)
      ? this.displayDecimals
      : 0;

    const formatNumber = (val) => {
      if (val == null || Number.isNaN(val)) return "–";
      return Number(val)
        .toFixed(decimals)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const formatSignedNumber = (val) => {
      if (val == null || Number.isNaN(val)) return "–";
      const n = Number(val);
      const absStr = Math.abs(n)
        .toFixed(decimals)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const sign = n > 0 ? "+" : (n < 0 ? "−" : "");
      return sign ? `${sign}${absStr}` : absStr;
    };

    // Percent diff always with 1 decimal (independent of displayDecimals)
    const formatPercent = (val) => {
      if (val == null || Number.isNaN(val)) return "–";
      const pct = Number(val) * 100;
      const sign = pct > 0 ? "+" : (pct < 0 ? "−" : "");
      const absStr = Math.abs(pct).toFixed(1);
      return `${sign}${absStr}%`;
    };

    const getCombosForFilters = (filters) => {
      const filterValues = Object.values(filters || {});
      if (filterValues.length === 0) return [''];

      const combine = (arr1, arr2) => {
        const results = [];
        for (const v1 of arr1) {
          for (const v2 of arr2) {
            results.push(`${v1}_${v2}`);
          }
        }
        return results;
      };

      let combos = filterValues[0];
      for (let i = 1; i < filterValues.length; i++) {
        combos = combine(combos, filterValues[i]);
      }
      return combos;
    };

    // --- Compare mode? ---
    const comparePanel = document.getElementById('dashside-comparisonScenario');
    const compScenario = this.getComp();
    const hasComparePanelOpen = comparePanel && comparePanel.open;
    const compareMode = hasComparePanelOpen && compScenario ? 'compare' : 'main';

    let _valueMain = 0;
    let _valueComp = 0;
    let _valueDisp = 0;
    let _textDisp = '';
    let _textMain = '';
    let _textComp = '';

    // --- Numerator values (main / comp) ---
    const numCombos = this._getFilterCombinationsFor(this.selectedFilters);

    if (this.agFilterOptionsMethod === 'sum') {
      // Numerator: MAIN
      const dataMainNum = mainScenario.getDataForFilterOptionsList(
        this.jsonName,
        numCombos,
        this.agFilterOptionsMethod,
        this.attribute
      );
      const mainNum = safeSum(dataMainNum);

      // Numerator: COMP
      let compNum = 0;
      if (compareMode === 'compare') {
        const dataCompNum = compScenario.getDataForFilterOptionsList(
          this.jsonName,
          numCombos,
          this.agFilterOptionsMethod,
          this.attribute
        );
        compNum = safeSum(dataCompNum);
      }

      // --- Optional denominator (divide_attribute / divide_jsonName) ---
      if (this.divideAttribute) {
        const divFilters =
          this.divideSelectedFilters &&
          Object.keys(this.divideSelectedFilters).length > 0
            ? this.divideSelectedFilters
            : this.selectedFilters;

        const divCombos = getCombosForFilters(divFilters);
        const divJsonName = this.divideJsonName || this.jsonName;

        // Denominator: MAIN
        const dataMainDen = mainScenario.getDataForFilterOptionsList(
          divJsonName,
          divCombos,
          this.agFilterOptionsMethod,
          this.divideAttribute
        );
        const mainDen = safeSum(dataMainDen);

        // Denominator: COMP
        let compDen = null;
        if (compareMode === 'compare') {
          const dataCompDen = compScenario.getDataForFilterOptionsList(
            divJsonName,
            divCombos,
            this.agFilterOptionsMethod,
            this.divideAttribute
          );
          compDen = safeSum(dataCompDen);
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
      return i;
    }

    if (this.cmIcon) {
      const icon = document.createElement("calcite-icon");
      icon.icon = this.cmIcon;
      icon.scale = "m";
      return icon;
    }

    if (this.textIcon) {
      const span = document.createElement("span");
      span.className = "measure-text-icon";
      span.textContent = this.textIcon;
      return span;
    }

    return null;
  }


}