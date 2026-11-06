let globalTemplates = [];
let dataScenarios = []; // this object contains all the scenarios and their data
let dataScenarioTrends = []; // this object contains all the scneario trends definitions
let dataGeojson = {};
let dataKeys = {};
let map;
let geojsonSegments;
let mapView;
let layerDisplay;
let dummyFeature;
let dataMenu;
let activeModelEntity;
let scenarioChecker; // vizTrends global item
let modeSelect; // vizTrends global item
let selectedScenario_Main = {};
let selectedScenario_Comp = {};
let selectedAggregatorCode = null; // last "Select Zone Geography" choice, shared across every view that has one
let jsonScenario;
let configApp;
let configAttributes;
let configAggregators;
let configDividers;
let configFilters;
let configCards;
let configMeasures;
let menuItems;
let onOpenMenuItem;
let onOpenModelEntity;
let centerMap = [-111.891, 40.7608]; // default value replaced programatically from json value
let zoom = 10; // default value replaced programatically from json value
let yearSelect = {};
let compareYearSelect = {}; // vizTrends global item - baseline year for Change/% Change from Selected Year
let activeLayout = {};
let seriesModeSelect;
let barGroupSelect;

// Global variables to track total files and loaded files across all scenarios
let totalFilesToLoad = 0;
let totalLoadedFiles = 0;

// Global variables to track total files and loaded files across all scenarios
let totalFilesToLoadGeo = 0;
let totalLoadedFilesGeo = 0;

// A single stalled request (e.g. a flaky network share) would otherwise leave a fetch
// pending forever, which permanently freezes the loading progress bars since the counters
// that reveal the app never reach their totals. Aborting after a timeout guarantees every
// load attempt eventually resolves one way or another.
async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Parsing several large geojson/scenario files back-to-back can otherwise block the main
// thread for seconds at a stretch, during which the browser can't dispatch any clicks
// (e.g. on the splash's Continue/close button). A setTimeout(0) is a real macrotask
// boundary, so it lets any input queued during parsing get processed before continuing.
function yieldToMainThread() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Most scenario data now loads on demand (see Scenario.ensureDataLoaded) instead of being
// preloaded at startup, so there's a brief gap the first time a given scenario/view is
// actually opened. These wrap that gap so the UI doesn't look frozen. Reference-counted since
// more than one ensureDataLoaded() can be in flight at once (e.g. main + compare scenario).
let _dataLoadingIndicatorCount = 0;

function showDataLoadingIndicator() {
  _dataLoadingIndicatorCount++;
  const el = document.getElementById('lazy-load-indicator');
  if (el) el.style.display = 'block';
}

function hideDataLoadingIndicator() {
  _dataLoadingIndicatorCount = Math.max(0, _dataLoadingIndicatorCount - 1);
  if (_dataLoadingIndicatorCount === 0) {
    const el = document.getElementById('lazy-load-indicator');
    if (el) el.style.display = 'none';
  }
}

// A view can finish loading and still have nothing to show - e.g. a scenario built with an
// older export pipeline that's simply missing the JSON this attribute needs. Left unannounced,
// that reads as a broken view (map/chart area stays exactly as blank as it was before anything
// loaded). Unlike the lazy-load indicator this isn't reference-counted or transient - it stays
// up until the layout that showed it either finds data or explicitly hides it.
function showNoDataIndicator(message) {
  const el = document.getElementById('no-data-indicator');
  if (!el) return;
  document.getElementById('no-data-message').textContent = message;
  el.style.display = 'block';
}

function hideNoDataIndicator() {
  const el = document.getElementById('no-data-indicator');
  if (el) el.style.display = 'none';
}

// Names the current phase under the two startup progress bars (index.html) - most useful during
// loadMenuAndItems()'s synchronous menu/entity-construction stretch, which is real work (dozens
// of model entities, each building its own sidebar/filters) but moves neither bar, so without
// this the load screen looks stalled for a couple of seconds even though it isn't. See the
// #load-status-spinner comment in styles.css for why the spinner keeps animating through that
// same stretch.
function setLoadStatus(text) {
  const el = document.getElementById('load-status-text');
  if (el) el.textContent = text;
}

// The label toggle button's tooltip reflects the action a click would perform next
// (not the current state), so it reads "Hide Labels" while labels are on. Called from
// vizmap.js too (loaded after this file, same global scope) wherever btn.active changes.
function updateLabelToggleTooltip(btn) {
  const text = btn.active ? 'Hide Labels' : 'Show Labels';
  btn.text = text;
  btn.title = text;
}

require([
  "esri/Map",
  "esri/Basemap",
  "esri/layers/TileLayer",
  "esri/views/MapView",
  "esri/widgets/Expand",
  "esri/widgets/BasemapToggle",
  "esri/widgets/Zoom",
], function (Map, Basemap, TileLayer, MapView, Expand, BasemapToggle, Zoom) {
  // The string basemap IDs ("gray-vector", "arcgis-imagery", ...) resolve through Esri's
  // basemap-styles service, which requires a valid API key - ours expired and Esri's policy
  // now requires a key for those even for anonymous/free use. Built the basemaps below from
  // the classic ArcGIS Online REST tile services instead (server.arcgisonline.com), which are
  // still public with no key needed and render the same Light Gray Canvas look.
  const grayBasemap = new Basemap({
    baseLayers: [
      new TileLayer({ url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer", title: "Light Gray Base" }),
      new TileLayer({ url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer", title: "Light Gray Reference" }),
    ],
    title: "Light Gray",
    id: "gray-classic",
  });
  const imageryBasemap = new Basemap({
    baseLayers: [
      new TileLayer({ url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer", title: "World Imagery" }),
    ],
    title: "Imagery",
    id: "imagery-classic",
  });

  async function fetchConfigApp() {
    console.log("app:fetchConfigApp");
    const response = await fetchWithTimeout("config/app.json");
    const dataConfigApp = await response.json();
    return dataConfigApp;
  }

  // attributes.json stores each attribute's compare_pct/main as a reference to one of a small
  // set of shared templates in the separate config/attribute-templates.json (the color ramps
  // and percent-diff thresholds are identical across dozens of attributes - only the legend
  // text and, for compare_abs/main, the breakpoints actually vary), instead of a fully spelled
  // out classBreakInfos array per attribute - that repetition used to account for two-thirds of
  // attributes.json's size. This expands the references back into the exact classBreakInfos
  // shape RendererCollection already expects, so nothing downstream (attribute.js,
  // renderer-collection.js) needs to know the compact format exists.
  const COMPARE_ABS_SENTINEL = 1e15;

  function formatBreakpointNumber(v, numberFormat) {
    if (numberFormat === 'comma') {
      return Math.round(v).toLocaleString('en-US');
    }
    if (numberFormat === 'plain') {
      return String(Math.round(v));
    }
    if (numberFormat === 'dollar') {
      return '$' + Math.round(v).toLocaleString('en-US');
    }
    const decimals = parseInt(numberFormat.split(':')[1], 10) || 0;
    let s = v.toFixed(decimals);
    if (s.indexOf('.') !== -1) {
      s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return s;
  }

  // Symmetric magnitude bands around zero, e.g. Access to Jobs' breakpoints [5000, 50000,
  // 500000] become "-5,000 to +5,000", "+5,000 to +50,000", "+50,000 to +500,000",
  // "More than +500,000" (mirrored negative too - 2*N+1 bands total for N breakpoints).
  // Boundaries touch (each bucket's max equals the next one's min) rather than using a manual
  // +/-1 offset - ArcGIS's ClassBreaksRenderer resolves a value sitting exactly on a shared
  // boundary to the lower bucket, so this is unambiguous and matches how most of this file's
  // attributes were already authored.
  function buildAbsScaleBounds(breakpoints, unit, numberFormat) {
    const fmt = (v) => formatBreakpointNumber(v, numberFormat);
    const suffix = unit ? ` ${unit}` : '';
    const b0 = breakpoints[0];
    const bounds = [{ minValue: -COMPARE_ABS_SENTINEL, maxValue: -breakpoints[breakpoints.length - 1], label: `More than -${fmt(breakpoints[breakpoints.length - 1])}${suffix}` }];
    for (let i = breakpoints.length - 1; i >= 1; i--) {
      bounds.push({ minValue: -breakpoints[i], maxValue: -breakpoints[i - 1], label: `-${fmt(breakpoints[i])} to -${fmt(breakpoints[i - 1])}${suffix}` });
    }
    bounds.push({ minValue: -b0, maxValue: b0, label: `-${fmt(b0)} to +${fmt(b0)}${suffix}` });
    for (let i = 0; i < breakpoints.length - 1; i++) {
      bounds.push({ minValue: breakpoints[i], maxValue: breakpoints[i + 1], label: `+${fmt(breakpoints[i])} to +${fmt(breakpoints[i + 1])}${suffix}` });
    }
    bounds.push({ minValue: breakpoints[breakpoints.length - 1], maxValue: COMPARE_ABS_SENTINEL, label: `More than +${fmt(breakpoints[breakpoints.length - 1])}${suffix}` });
    return bounds;
  }

  // Discrete integer classes (e.g. a difference of exactly +1 lane, not a range) - used for the
  // handful of attributes whose difference is itself a small whole-number count rather than a
  // continuous magnitude, where a "range" bucket wouldn't mean anything.
  function buildAbsCountBounds(breakpoints, unit, numberFormat) {
    const n = breakpoints[0];
    const fmt = (v) => formatBreakpointNumber(v, numberFormat);
    const suffix = unit ? ` ${unit}` : '';
    const bounds = [{ minValue: -COMPARE_ABS_SENTINEL, maxValue: -n, label: `More than -${fmt(n)}${suffix}` }];
    for (let k = n - 1; k >= 1; k--) {
      bounds.push({ minValue: -k, maxValue: -k, label: `-${fmt(k)}${suffix}` });
    }
    bounds.push({ minValue: 0, maxValue: 0, label: `No Change${suffix}` });
    for (let k = 1; k <= n - 1; k++) {
      bounds.push({ minValue: k, maxValue: k, label: `+${fmt(k)}${suffix}` });
    }
    bounds.push({ minValue: n, maxValue: COMPARE_ABS_SENTINEL, label: `More than +${fmt(n)}${suffix}` });
    return bounds;
  }

  function generateAbsClassBreakInfos(ca, symbols) {
    const bounds = ca.mode === 'count'
      ? buildAbsCountBounds(ca.breakpoints, ca.unit, ca.numberFormat)
      : buildAbsScaleBounds(ca.breakpoints, ca.unit, ca.numberFormat);
    return bounds.map((b, i) => ({ minValue: b.minValue, maxValue: b.maxValue, symbol: symbols[i], label: b.label }));
  }

  // Single-sided ascending scale (the main, non-compare renderer), e.g. Access to Jobs'
  // breakpoints [5000, 25000, ..., 500000] become "Less than 5,000", "5,000 to 25,000", ...,
  // "More than 500,000" (N breakpoints -> N+1 bands, vs compare_abs's mirrored 2*N+1). A tiny
  // epsilon above zero keeps a literal 0 routed to defaultSymbol instead of the first visible
  // band, matching how these attributes were already authored. displayScale handles the
  // attributes that store a raw 0-1 fraction but show it as a 0-100 percent (see aTelPct).
  const MAIN_ASCENDING_EPS = 0.000001;

  // compare_pct's labelExpressionInfo is identical across every attribute that uses the
  // shared classBreakInfos templates, so it's a constant here rather than stored per-attribute.
  const PCT_LABEL_EXPRESSION_INFO = "IIF(IsEmpty($feature.dVal), '', Text($feature.dVal * 100, '#.0') + '%')";
  const TRAILING_PAREN_RE = /\s*\([^)]*\)\s*$/;

  function deriveAbsLegendTitle(mainTitle) {
    return `Difference in ${mainTitle}`;
  }

  function derivePctLegendTitle(mainTitle) {
    return `Percent Difference in ${mainTitle.replace(TRAILING_PAREN_RE, '')}`;
  }

  function buildMainAscendingBounds(breakpoints, unit, numberFormat, displayScale) {
    const scale = displayScale || 1;
    const fmt = (v) => formatBreakpointNumber(v * scale, numberFormat);
    const suffix = unit === '%' ? unit : (unit ? ` ${unit}` : '');
    const bounds = [{ minValue: MAIN_ASCENDING_EPS, maxValue: breakpoints[0], label: `Less than ${fmt(breakpoints[0])}${suffix}` }];
    for (let i = 0; i < breakpoints.length - 1; i++) {
      bounds.push({ minValue: breakpoints[i], maxValue: breakpoints[i + 1], label: `${fmt(breakpoints[i])} to ${fmt(breakpoints[i + 1])}${suffix}` });
    }
    bounds.push({ minValue: breakpoints[breakpoints.length - 1], maxValue: COMPARE_ABS_SENTINEL, label: `More than ${fmt(breakpoints[breakpoints.length - 1])}${suffix}` });
    return bounds;
  }

  function generateMainClassBreakInfos(main, symbols) {
    const bounds = buildMainAscendingBounds(main.breakpoints, main.unit, main.numberFormat, main.displayScale);
    return bounds.map((b, i) => ({ minValue: b.minValue, maxValue: b.maxValue, symbol: symbols[i], label: b.label }));
  }

  function expandAttributesConfig(dataConfigAttributes, templates) {
    if (!templates) return dataConfigAttributes; // no templates file / already-expanded shape

    Object.keys(dataConfigAttributes).forEach((code) => {
      const rc = dataConfigAttributes[code].rendererCollection;
      if (!rc) return;

      const mainR = rc.main;
      if (mainR && mainR.style && templates.main_style) {
        const symbols = templates.main_style[mainR.style];
        mainR.classBreakInfos = generateMainClassBreakInfos(mainR, symbols);
        delete mainR.style;
        delete mainR.breakpoints;
        delete mainR.unit;
        delete mainR.numberFormat;
        delete mainR.displayScale;
      }

      const cp = rc.compare_pct;
      if (cp && cp.template) {
        cp.classBreakInfos = templates.compare_pct[cp.template];
        delete cp.template;
        cp.labelExpressionInfo = PCT_LABEL_EXPRESSION_INFO;
        if (!cp.legendTitle && mainR) cp.legendTitle = derivePctLegendTitle(mainR.legendTitle);
      }
      if (cp && typeof cp.defaultSymbol === 'string' && templates.compare_pct_default_symbol) {
        cp.defaultSymbol = templates.compare_pct_default_symbol[cp.defaultSymbol];
      }

      const ca = rc.compare_abs;
      if (ca && ca.style) {
        const symbols = templates.compare_abs_style[ca.style];
        ca.classBreakInfos = generateAbsClassBreakInfos(ca, symbols);
        delete ca.style;
        delete ca.mode;
        delete ca.breakpoints;
        delete ca.unit;
        delete ca.numberFormat;
        if (templates.compare_abs_lei) ca.labelExpressionInfo = templates.compare_abs_lei[ca.labelExpressionInfo];
      }
      if (ca && !ca.legendTitle && mainR) ca.legendTitle = deriveAbsLegendTitle(mainR.legendTitle);
    });

    return dataConfigAttributes;
  }

  async function fetchConfigAttributeTemplates() {
    console.log("app:fetchConfigAttributeTemplates");
    const response = await fetchWithTimeout("config/attribute-templates.json");
    return await response.json();
  }

  async function fetchConfigAttributes() {
    console.log("app:fetchConfigAttributes");
    const response = await fetchWithTimeout("config/attributes.json");
    const dataConfigAttributes = await response.json();
    const templates = await fetchConfigAttributeTemplates();
    return expandAttributesConfig(dataConfigAttributes, templates);
  }

  async function fetchConfigAggregators() {
    console.log("app:fetchConfigAggregators");
    const response = await fetchWithTimeout("config/aggregators.json");
    const dataConfigAggregators = await response.json();
    return dataConfigAggregators;
  }

  async function fetchConfigFilters() {
    console.log("app:fetchConfigFilters");
    const response = await fetchWithTimeout("config/filters.json");
    const dataConfigFilters = await response.json();
    return dataConfigFilters;
  }

  async function fetchConfigDividers() {
    console.log("app:fetchConfigDividers");
    const response = await fetchWithTimeout("config/dividers.json");
    const dataConfigDividers = await response.json();
    return dataConfigDividers;
  }

  async function fetchScenarioData() {
    console.log("app:fetchScenarioData");
    const response = await fetchWithTimeout("config/scenarios.json");
    const dataScenario = await response.json();
    return dataScenario;
  }

  async function fetchConfigCards() {
    console.log('app:fetchConfigCards');
    const response = await fetch('config/cards.json');
    const dataConfigCards = await response.json();
    return dataConfigCards;
  }

  async function fetchConfigMeasures() {
    console.log('app:fetchConfigMeasures');
    const response = await fetch('config/measures.json');
    const dataConfigMeasures = await response.json();
    return dataConfigMeasures;
  }

  async function loadScenarios() {
    console.log("app:loadScenarios");
    setLoadStatus("Loading scenario list and geo data...");

    // load scenario data
    jsonScenario = await fetchScenarioData();
    dataScenarios = jsonScenario.scenarios.map((item) => new Scenario(item));

    // set the selected scenario to the initial_select in json, if exists, otherwise pick first scenario
    // Set the selected scenario
    if (jsonScenario.initial_select && jsonScenario.initial_select.length > 0) {
      selectedScenario_Main = jsonScenario.initial_select[0];
    } else if (jsonScenario.scenarios && jsonScenario.scenarios.length > 0) {
      selectedScenario_Main = jsonScenario.scenarios[0];
    } else {
      selectedScenario_Main = null; // or handle the case where there is no data appropriately
    }

    // set the selected scenario to the initial_select in json, if exists, otherwise pick first scenario
    // Set the selected scenario
    if (
      jsonScenario.initial_select_compare &&
      jsonScenario.initial_select_compare.length > 0
    ) {
      selectedScenario_Comp = jsonScenario.initial_select_compare[0];
    } else if (jsonScenario.scenarios && jsonScenario.scenarios.length > 1) {
      selectedScenario_Comp = jsonScenario.scenarios[1];
    } else {
      selectedScenario_Comp = null; // or handle the case where there is no data appropriately
    }

    // load scenario trend data
    const scenarioTrends = jsonScenario.trends
      .map((trend) => {
        // Check if scnTrendCode is defined for the trend
        if (!trend.scnTrendCode) {
          return null; // Skip this trend by returning null
        }

        const modelruns = jsonScenario.scenarios
          .filter(
            (scenario) =>
              scenario.scnTrendCodes &&
              scenario.scnTrendCodes.includes(trend.scnTrendCode)
          )
          .map((scenario) => ({
            modVersion: scenario.modVersion,
            scnGroup: scenario.scnGroup,
            scnYear: scenario.scnYear,
          }));

        return {
          scnTrendCode: trend.scnTrendCode,
          alias: trend.alias,
          displayByDefault: trend.displayByDefault,
          modelruns: modelruns,
        };
      })
      .filter((trend) => trend !== null); // Remove any null values from the array

    dataScenarioTrends = scenarioTrends.map((item) => new ScenarioTrend(item));

    dataGeojsons = {};
    dataKeys = {};

    let _geojsonfilenames = new Set();
    let _keysfilenames = new Set();

    for (const model of jsonScenario.models) {
      let _geojsons = Object.values(model.geojsons);
      for (const _geojson of _geojsons) {
        _geojsonfilenames.add(_geojson);
      }
      let _keygroups = Object.values(model.keys);
      for (const _keygroup of _keygroups) {
        let _keys = Object.values(_keygroup);
        for (const _key of _keys) {
          _keysfilenames.add(_key);
        }
      }
    }

    totalFilesToLoadGeo = _geojsonfilenames.size;

    // Progress bar elements
    const progressBarGeo = document.getElementById("progress-geo");
    const progressTextGeo = document.getElementById("progress-text-geo");

    // Function to update progress for GeoJSON files
    const updateProgressGeo = () => {
      // Calculate the progress percentage
      const progressValueGeo =
        (totalLoadedFilesGeo / totalFilesToLoadGeo) * 100;

      // Update the progress bar and text
      const progressBarGeo = document.getElementById("progress-geo");
      const progressTextGeo = document.getElementById("progress-text-geo");

      progressBarGeo.value = progressValueGeo;
      progressTextGeo.textContent = `${Math.floor(progressValueGeo)}%`;

      checkAndHideProgressContainer();
    };

    // Create an array to hold all fetch promises
    let fetchPromises = [];

    // Fetch and store GeoJSON data for each filename
    for (const _geojsonfilename of _geojsonfilenames) {
      let fetchPromise = fetchAndStoreGeoJsonData(
        _geojsonfilename,
        updateProgressGeo
      );
      fetchPromises.push(fetchPromise);
    }

    // Fetch and store GeoJSON data for each filename
    for (const _keysfilename of _keysfilenames) {
      let fetchPromise = fetchAndStoreJsonKeys(
        _keysfilename,
        updateProgressGeo
      );
      fetchPromises.push(fetchPromise);
    }

    // Wait for all GeoJSON data fetching to complete
    await Promise.all(fetchPromises);

    // Now that all GeoJSON data is fetched, you can proceed with the rest
    await populateScenarioSelections();
  }

  // Function to fetch and store data
  async function fetchAndStoreGeoJsonData(fileName, updateProgressGeo) {
    try {
      const response = await fetchWithTimeout(`geo-data/${fileName}`);
      const jsonData = await response.json();
      // Store the processed data in the object with the filename as key
      dataGeojsons[fileName] = jsonData;
      totalLoadedFilesGeo++; // Still increment the loaded files counter
      updateProgressGeo(); // Call the progress update function even if file doesn't exist
    } catch (error) {
      console.error(`Error fetching data from ${fileName}:`, error);
      totalLoadedFilesGeo++; // Still increment the loaded files counter
      updateProgressGeo(); // Call the progress update function even if file doesn't exist
    }
    // Give the browser a chance to process queued input (e.g. splash clicks) between files,
    // since parsing these can be several MB and blocks the main thread while it runs.
    await yieldToMainThread();
  }

  // Function to fetch and store data
  async function fetchAndStoreJsonKeys(fileName) {
    try {
      const response = await fetchWithTimeout(`geo-data/keys/${fileName}`);
      const jsonData = await response.json();
      // Store the processed data in the object with the filename as key
      dataKeys[fileName] = jsonData;
    } catch (error) {
      console.error(`Error fetching data from ${fileName}:`, error);
    }
    await yieldToMainThread();
  }

  async function loadMenuAndItems() {
    console.log("app:loadMenuAndItems");
    setLoadStatus("Loading configuration...");

    configAggregators = await fetchConfigAggregators();
    configAttributes = await fetchConfigAttributes();
    configFilters = await fetchConfigFilters();
    configDividers = await fetchConfigDividers();
    configCards = await fetchConfigCards();
    configMeasures = await fetchConfigMeasures();

    configApp = await fetchConfigApp();

    const infoButton = document.getElementById("infoButton");
    if (infoButton) {
      infoButton.onclick = openSplashOnDemand;
    }

    const calciteMenu = document.querySelector(
      'calcite-menu[slot="content-start"]'
    );

    // Clear existing menu items
    calciteMenu.innerHTML = "";

    // The gap this is meant to fill: everything from here through the probeDataAvailability
    // loop below is synchronous construction of every menu item/model entity/sidebar in the
    // app (dozens of them) - real work, but neither progress bar moves during it, and it can
    // take a couple of seconds on its own.
    setLoadStatus("Building menu...");

    menuItems = configApp.menuItems.map(
      (menuItem) => new MenuItem(menuItem, hideAllLayoutLayers)
    );

    dataMenu = menuItems;

    // Render each menu item and log (or insert into the DOM)
    menuItems.forEach((menuItem) => {
      calciteMenu.appendChild(menuItem.createMenuItemElement());
    });

    // Progress bar elements
    const progressBar = document.getElementById("progress");
    const progressText = document.getElementById("progress-text");

    const updateProgress = () => {
      // Calculate the progress percentage
      const progressValue = (totalLoadedFiles / totalFilesToLoad) * 100;

      // Update the progress bar and text
      const progressBar = document.getElementById("progress");
      const progressText = document.getElementById("progress-text");

      progressBar.value = progressValue;
      progressText.textContent = `${Math.floor(progressValue)}%`;

      checkAndHideProgressContainer();
    };

    // Calculate total number of files to load across all scenarios
    dataScenarios.forEach((scenario) => {
      let jsonFileNames = new Set();

      // Collect unique JSON file names
      dataMenu.forEach((menuItem) => {
        if (menuItem.modelEntities) {
          menuItem.modelEntities.forEach((modelEntity) => {
            if (modelEntity.vizLayout && modelEntity.vizLayout.jsonName) {
              jsonFileNames.add(modelEntity.vizLayout.jsonName);
            }
          });
        }
      });
    });

    // Probe (not load - see Scenario.probeDataAvailability) each scenario's data availability,
    // passing the updateProgress function to be called when each check completes. Actual
    // scenario data is fetched lazily via Scenario.ensureDataLoaded() the first time it's
    // needed, instead of eagerly pulling every scenario's full dataset here.
    setLoadStatus("Checking scenario data availability...");
    for (let scenario of dataScenarios) {
      scenario.probeDataAvailability(dataMenu, updateProgress);
    }

    // Ensure progress reaches 100% when all data is loaded
    if (totalLoadedFiles === totalFilesToLoad) {
      progressBar.value = 100;
      progressText.textContent = "100%";
    }
    setupDashboardSidebar();
  }

  async function toggleCompare(element) {
    console.log(element);
  }

  async function updateScenarioSelectOptions(
    selectElement,
    options,
    selectedValue
  ) {
    console.log("app:updateScenarioSelectOptions");

    if (!selectElement) {
      console.error("Select element not found:", selectElement);
      return;
    }

    // Remove options not in the new list
    Array.from(selectElement.children).forEach((option) => {
      selectElement.removeChild(option);
    });

    // Add new options
    options.forEach((optionValue) => {
      if (
        ![...selectElement.children].some(
          (option) => String(option.value) === String(optionValue)
        )
      ) {
        const option = document.createElement("calcite-option");
        option.value = String(optionValue);
        option.label = String(optionValue);
        if (option.value == String(selectedValue)) {
          option.selected = true;
        } else {
          option.selected = false;
        }
        selectElement.appendChild(option);
      }
    });
  }

  async function populateScenarioSelections() {
    console.log("app:populateScenarioSelections");

    const elements = [
      {
        mod: "modVersion_Main",
        grp: "scnGroup_Main",
        year: "scnYear_Main",
        scenario: "selectedScenario_Main",
      },
      {
        mod: "modVersion_Comp",
        grp: "scnGroup_Comp",
        year: "scnYear_Comp",
        scenario: "selectedScenario_Comp",
      },
      {
        // vizMatrix has no map, so it can't host the scenario selector as a MapView UI
        // widget like vizMap does - it gets its own selects in the sidebar instead, kept
        // in sync with the same selectedScenario_Main used everywhere else.
        mod: "modVersion_MatrixMain",
        grp: "scnGroup_MatrixMain",
        year: "scnYear_MatrixMain",
        scenario: "selectedScenario_Main",
      },
      {
        // Matrix's own "Compare to:" selects, kept in sync with the same selectedScenario_Comp
        // vizMap's compare block uses.
        mod: "modVersion_MatrixComp",
        grp: "scnGroup_MatrixComp",
        year: "scnYear_MatrixComp",
        scenario: "selectedScenario_Comp",
      },
      {
        // vizDashboard has no map either - same reasoning as vizMatrix above, its own
        // selects in the sidebar kept in sync with the same selectedScenario_Main.
        mod: "modVersion_DashMain",
        grp: "scnGroup_DashMain",
        year: "scnYear_DashMain",
        scenario: "selectedScenario_Main",
      },
      {
        mod: "modVersion_DashComp",
        grp: "scnGroup_DashComp",
        year: "scnYear_DashComp",
        scenario: "selectedScenario_Comp",
      },
    ];

    for (let elem of elements) {
      const modElem = document.getElementById(elem.mod);
      const grpElem = document.getElementById(elem.grp);
      const yearElem = document.getElementById(elem.year);

      if (!modElem || !grpElem || !yearElem) {
        // Not every selector set is present on every page (e.g. the matrix selects only
        // exist once vizmatrix.html has loaded) - skip it rather than aborting the whole
        // function and leaving the other selector sets unpopulated.
        console.error(`One or more select elements not found for ${elem.mod}/${elem.grp}/${elem.year}`);
        continue;
      }

      let selectedScenario =
        elem.scenario === "selectedScenario_Main"
          ? selectedScenario_Main
          : selectedScenario_Comp;

      if (!selectedScenario) {
        selectedScenario =
          jsonScenario.initial_select?.[0] || dataScenarios?.[0];
      }

      let matchedScenario = dataScenarios.find(
        (entry) =>
          entry.modVersion === selectedScenario.modVersion &&
          entry.scnGroup === selectedScenario.scnGroup &&
          entry.scnYear === selectedScenario.scnYear
      );

      if (!matchedScenario) {
        let matchedGroupScenario = dataScenarios.find(
          (entry) =>
            entry.modVersion === selectedScenario.modVersion &&
            entry.scnGroup === selectedScenario.scnGroup
        );

        if (matchedGroupScenario) {
          selectedScenario.scnYear = matchedGroupScenario.scnYear;
        } else {
          let firstValidGroup = dataScenarios.find(
            (entry) => entry.modVersion === selectedScenario.modVersion
          );
          selectedScenario.scnGroup = firstValidGroup?.scnGroup;
          let firstValidYear = dataScenarios.find(
            (entry) =>
              entry.modVersion === selectedScenario.modVersion &&
              entry.scnGroup === selectedScenario.scnGroup
          );
          selectedScenario.scnYear = firstValidYear?.scnYear;
        }
      }

      if (selectedScenario) {
        let scenarioModel = new Set();
        let Scenario = new Set();
        let scenarioYear = new Set();

        dataScenarios.forEach((entry) => {
          scenarioModel.add(entry.modVersion);

          if (entry.modVersion === selectedScenario.modVersion) {
            Scenario.add(entry.scnGroup);
            if (entry.scnGroup === selectedScenario.scnGroup) {
              scenarioYear.add(entry.scnYear);
            }
          }
        });

        await updateScenarioSelectOptions(
          modElem,
          scenarioModel,
          selectedScenario.modVersion
        );
        await updateScenarioSelectOptions(
          grpElem,
          Scenario,
          selectedScenario.scnGroup
        );
        await updateScenarioSelectOptions(
          yearElem,
          scenarioYear,
          selectedScenario.scnYear
        );
      }

      if (elem.scenario === "selectedScenario_Main") {
        selectedScenario_Main = selectedScenario;
      } else if (elem.scenario === "selectedScenario_Comp") {
        selectedScenario_Comp = selectedScenario;
      }
    }
  }

  async function updateScenarioSelection(scenarioSelect) {
    console.log("app:updateScenarioSelection");

    // see which selector changed
    const changedSelector = scenarioSelect.target;
    const changedSelectorId = changedSelector.id;
    const selectedValue = changedSelector.value;

    var selectedScenario_x = {};

    // Elements created here in app.js (the map's scenario selector) rely on their id
    // literally being "{variable}_Main"/"{variable}_Comp"; elements declared in a template's
    // static HTML (like vizmatrix.html's sidebar selects) carry explicit data attributes
    // instead, since their ids need to stay unique across the page.
    const _orMainComp = changedSelector.dataset.scenarioTarget || changedSelectorId.slice(-4);
    const _variable = changedSelector.dataset.scenarioVariable || changedSelectorId.slice(0, -5);

    if (_orMainComp === "Main") {
      selectedScenario_x = selectedScenario_Main;
    } else {
      selectedScenario_x = selectedScenario_Comp;
    }

    if (_variable != "scnYear") {
      selectedScenario_x[_variable] = String(selectedValue);
    } else {
      const _year = parseInt(selectedValue, 10);
      selectedScenario_x[_variable] = _year;
    }
    await populateScenarioSelections();
    updateActiveVizMap();
  }

  // Pairs of controls that exist once per view (vizMap's live in the map's UI widget,
  // vizMatrix's and vizDashboard's are each their own sidebar copies) but represent the
  // same single piece of app-wide "what am I comparing against, and how" state, so a change
  // on either side should show up on the other immediately - not just next time that view
  // happens to re-render.
  const syncedComparePairs = [
    { ids: ["comparisonScenario", "comparisonScenarioMatrix", "comparisonScenarioDash"], prop: "open", event: "calciteBlockToggle" },
    { ids: ["selectCompareType", "selectCompareTypeMatrix", "selectCompareTypeDash"], prop: "value", event: "calciteSelectChange" },
  ];

  function setupSyncedCompareControls() {
    syncedComparePairs.forEach(({ ids, prop, event }) => {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        el?.addEventListener(event, (changeEvent) => {
          const newValue = changeEvent.target[prop];
          ids.forEach((otherId) => {
            if (otherId === id) return;
            const other = document.getElementById(otherId);
            if (other && other[prop] !== newValue) {
              other[prop] = newValue;
            }
          });
          updateActiveVizMap();
        });
      });
    });
  }

  // "Select Zone Geography" (the aggregator picker) is a separate VizSidebar/WijSelect
  // instance per model entity rather than a shared DOM element like the scenario selectors,
  // since every view's aggregator dropdown constructs its own option list at load time. So
  // syncing it means walking every already-built sidebar in the app and updating its
  // aggregatorSelect's selected value directly, rather than mirroring one shared control.
  // Called from VizSidebar.afterUpdateAggregator() whenever any one of them changes.
  function syncSelectedZoneGeography(newAgCode, sourceSidebar) {
    selectedAggregatorCode = newAgCode;

    // Sync only within the same template (vizMap views sync with each other, vizTrends with
    // each other, etc.) rather than across all of them - lets e.g. vizTrends sit on one
    // geography while vizMap sits on another, instead of every view being forced to match.
    const sourceTemplate = sourceSidebar?.vizLayout?.modelEntity?.template;

    dataMenu.forEach((menuItem) => {
      menuItem.modelEntities.forEach((modelEntity) => {
        if (modelEntity.template !== sourceTemplate) return;

        const sidebar = modelEntity.vizLayout?.sidebar;
        if (!sidebar || sidebar === sourceSidebar || !sidebar.aggregatorSelect) return;

        // Only apply where the synced code is actually a valid option for this view -
        // e.g. the OD matrix doesn't offer TAZID, so it just keeps its own current choice.
        const matchedAggregator = sidebar.aggregators.find((a) => a.agCode === newAgCode);
        if (!matchedAggregator) return;

        sidebar.aggregatorSelect.selected = newAgCode;

        // vizTrends and vizMatrix both keep a separate "reference map" filter widget built for
        // whichever aggregator is selected (see VizSidebar's constructor) - rebuild it too so
        // it isn't stale the next time this (currently inactive) view is opened. The view the
        // user is actively looking at already does this itself via its own
        // afterUpdateAggregator().
        if (sidebar.usesAggregatorFilter()) {
          sidebar.aggregatorFilter = new Filter(
            null,
            modelEntity.vizLayout,
            sidebar.buildAggregatorFilterData(matchedAggregator.filterData),
            {
              agGeoJsonKey: matchedAggregator.agGeoJsonKey,
              agCode: matchedAggregator.agCode,
              agCodeLabelField: matchedAggregator.agCodeLabelField,
            }
          );
        }
      });
    });
  }

  // This whole block of functions is defined inside the require([...]) callback above, so
  // it's local to that closure - vizsidebar.js (a separate <script>) can't see it by name
  // unqualified. Exposing it on window is what makes VizSidebar.afterUpdateAggregator()'s
  // plain `syncSelectedZoneGeography(...)` call resolve at all.
  window.syncSelectedZoneGeography = syncSelectedZoneGeography;
  // Same reason: url-state.js's restoreAppStateFromUrl() needs to repopulate the scenario
  // <calcite-select>s after setting selectedScenario_Main/_Comp from the URL, same as
  // updateScenarioSelection() does after a user-driven change.
  window.populateScenarioSelections = populateScenarioSelections;

  // Adjust the init function to ensure it waits for loadScenarios to fully complete
  async function init() {
    console.log("app:init");
    // Load and display the disclaimer modal
    await loadAppConfig();
    await loadScenarios();
    await loadMenuAndItems();
    await initVizMapListeners();
  }

  async function loadAppConfig() {
    try {
      const response = await fetchWithTimeout("config/app.json");
      const appConfig = await response.json();

      // Set the title and version in the Esri object
      const logoElement = document.querySelector("calcite-navigation-logo");
      logoElement.setAttribute("heading", appConfig.title || "vizTool");
      logoElement.setAttribute(
        "description",
        appConfig.subtitle || "v24.12.07 beta"
      );

      // Load and display the disclaimer modal if applicable
      await loadAndDisplaySplash(appConfig.splash);
    } catch (error) {
      console.error("Error loading app.json:", error);
    }
  }

  // Simple string hash so a changed disclaimer automatically re-shows even if a user previously dismissed it
  function hashSplashContent(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  // Lets the user reposition a modal by dragging the given handle element.
  // Uses Pointer Capture so drag-end is always delivered to the handle, even if the
  // pointer ends up over an element (like the ArcGIS map) that captures its own events,
  // or leaves the browser window entirely - otherwise a missed mouseup leaves the
  // modal stuck following the cursor forever.
  function makeDraggable(handle, container) {
    let offsetX = 0;
    let offsetY = 0;
    let activePointerId = null;

    const onPointerMove = function (event) {
      if (event.pointerId !== activePointerId) return;
      container.style.left = event.clientX - offsetX + "px";
      container.style.top = event.clientY - offsetY + "px";
    };

    const endDrag = function () {
      if (activePointerId === null) return;
      try {
        handle.releasePointerCapture(activePointerId);
      } catch (error) {
        // pointer capture may already be released; safe to ignore
      }
      activePointerId = null;
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", endDrag);
      handle.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
    };

    handle.addEventListener("pointerdown", function (event) {
      // Let the close button handle its own click normally instead of starting a drag
      if (event.target.closest(".modal-close")) return;

      const rect = container.getBoundingClientRect();
      container.style.position = "fixed";
      container.style.margin = "0";
      container.style.left = rect.left + "px";
      container.style.top = rect.top + "px";
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      activePointerId = event.pointerId;
      handle.setPointerCapture(activePointerId);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
      window.addEventListener("blur", endDrag);
      event.preventDefault();
    });
  }
  // Exposed globally so other files loaded outside this require() callback (e.g.
  // VizSidebar.openDefinitionsPopup() in vizsidebar.js) can reuse it too.
  window.makeDraggable = makeDraggable;

  async function loadAndDisplaySplash(disclaimer) {
    const modal = document.getElementById("infoModal");
    const loadScreen = document.getElementById("load-screen");

    const showLoadScreen = function () {
      modal.style.display = "none";
      loadScreen.style.display = "block";
    };

    // If the disclaimer is off, ensure the modal is not displayed
    if (!disclaimer.on) {
      showLoadScreen();
      return;
    }

    const splashStorageKey = "vizToolSplashDismissed";
    const splashHash = hashSplashContent(disclaimer.title + disclaimer.textHtml);

    let dismissedHash = null;
    try {
      dismissedHash = localStorage.getItem(splashStorageKey);
    } catch (error) {
      console.warn("Unable to read splash dismissal state:", error);
    }

    // Skip the splash if the user previously dismissed this exact disclaimer content
    if (dismissedHash === splashHash) {
      showLoadScreen();
      return;
    }

    displaySplashModal(disclaimer, splashStorageKey, splashHash, showLoadScreen);
  }

  // Reopens the same splash content on demand (e.g. the header's info button) - unlike
  // loadAndDisplaySplash() above, this always shows it regardless of the "don't show again"
  // dismissal state, and closing it just hides the modal instead of revealing #load-screen
  // (that's only meaningful during the real startup sequence, where the app hasn't finished
  // loading yet - reusing it here would incorrectly show a stale "Loading..." progress screen
  // over an already-loaded app).
  function openSplashOnDemand() {
    if (!configApp || !configApp.splash || !configApp.splash.on) return;
    const disclaimer = configApp.splash;
    const splashStorageKey = "vizToolSplashDismissed";
    const splashHash = hashSplashContent(disclaimer.title + disclaimer.textHtml);
    const modal = document.getElementById("infoModal");
    displaySplashModal(disclaimer, splashStorageKey, splashHash, () => {
      modal.style.display = "none";
    });
  }

  // Shared modal-building logic between the startup splash and the on-demand reopen -
  // onClose is what differs between them (see openSplashOnDemand() above).
  function displaySplashModal(disclaimer, splashStorageKey, splashHash, onClose) {
    const modal = document.getElementById("infoModal");
    const modalContent = document.querySelector("#infoModal .modal-content");

    // Reset any position left over from a previous drag
    modalContent.style.position = "";
    modalContent.style.left = "";
    modalContent.style.top = "";
    modalContent.style.margin = "";

    modalContent.innerHTML =
      '<div class="modal-titlebar"><h1>' +
      disclaimer.title +
      '</h1><span id="closeModalX" class="modal-close">&times;</span></div>';
    modalContent.innerHTML += disclaimer.textHtml;

    makeDraggable(modalContent.querySelector(".modal-titlebar"), modalContent);

    const dontShowAgainLabel = document.createElement("label");
    dontShowAgainLabel.id = "dontShowAgainLabel";
    dontShowAgainLabel.innerHTML =
      '<input type="checkbox" id="dontShowAgainCheckbox"> Don\'t show this again';

    // Reflect whether this exact disclaimer content was previously dismissed - otherwise the
    // checkbox always starts unchecked even for a user who already opted out, which reads as
    // if their preference wasn't remembered (most visibly on the on-demand reopen, where
    // loadAndDisplaySplash() skipping the modal entirely means this is the only place that
    // preference is ever shown back to them).
    let previouslyDismissed = false;
    try {
      previouslyDismissed = localStorage.getItem(splashStorageKey) === splashHash;
    } catch (error) {
      console.warn("Unable to read splash dismissal state:", error);
    }
    if (previouslyDismissed) {
      dontShowAgainLabel.querySelector("#dontShowAgainCheckbox").checked = true;
    }

    const okButton = document.getElementById("okButton");
    if (okButton) {
      okButton.parentNode.insertBefore(dontShowAgainLabel, okButton);
    } else {
      modalContent.appendChild(dontShowAgainLabel);
    }

    modal.style.display = "block";

    document.getElementById("info-modal-content").style.display = "block";

    const closeModal = function () {
      const dontShowAgainCheckbox = document.getElementById("dontShowAgainCheckbox");
      if (dontShowAgainCheckbox) {
        try {
          if (dontShowAgainCheckbox.checked) {
            localStorage.setItem(splashStorageKey, splashHash);
          } else {
            // Unchecking (e.g. on a reopen where it started pre-checked) should actually
            // clear the stored preference, not just leave the previous dismissal in place -
            // otherwise the checkbox would show unchecked while the splash still silently
            // skips itself next time.
            localStorage.removeItem(splashStorageKey);
          }
        } catch (error) {
          console.warn("Unable to save splash dismissal state:", error);
        }
      }
      onClose();
      document.removeEventListener("keydown", closeOnEscape);
    };

    const closeOnEscape = function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    if (okButton) {
      okButton.onclick = closeModal;
    }

    document.getElementById("closeModalX").onclick = closeModal;
    document.addEventListener("keydown", closeOnEscape);
  }

  async function updateActiveVizMap() {
    console.log(dataMenu);
    dataMenu.forEach((menuItem) => {
      menuItem.modelEntities.forEach((modelEntity) => {
        if (
          (modelEntity.id == activeModelEntity.id) &
          (modelEntity.template == "vizMap" || modelEntity.template == "vizMatrix" || modelEntity.template == "vizDashboard")
        ) {
          console.log(
            "app:initVizMapListeners:updateActiveVizMap:" + modelEntity.id
          );
          modelEntity.vizLayout.updateDisplay();
        }
      });
    });
  }

  async function initVizMapListeners() {
    console.log("app:initVizMapListeners");

    document
      .getElementById("modVersion_Main")
      .addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnGroup_Main")
      .addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnYear_Main")
      .addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("modVersion_Comp")
      .addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnGroup_Comp")
      .addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnYear_Comp")
      .addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("modVersion_MatrixMain")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnGroup_MatrixMain")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnYear_MatrixMain")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("modVersion_MatrixComp")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnGroup_MatrixComp")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnYear_MatrixComp")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("modVersion_DashMain")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnGroup_DashMain")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnYear_DashMain")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("modVersion_DashComp")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnGroup_DashComp")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    document
      .getElementById("scnYear_DashComp")
      ?.addEventListener(
        "calciteSelectChange",
        updateScenarioSelection.bind(this)
      );
    // "Compare to:" is more than just a scenario pick - whether the panel is open (compare
    // mode on/off at all) and which compare type is chosen live on separate DOM elements per
    // view (vizMap's live inside the map's UI widget, vizMatrix's and vizDashboard's are each
    // their own sidebar controls), same reason the Main/Comp scenario selects needed their own
    // MatrixMain/MatrixComp and DashMain/DashComp copies. Syncing the scenario value alone
    // isn't enough - keep these two pieces of state mirrored across every view that has them too.
    setupSyncedCompareControls();

    document
      .getElementById("vizMapLabelToggle")
      .addEventListener("click", (event) => {
        const btn = event.currentTarget;
        btn.active = !btn.active;
        updateLabelToggleTooltip(btn);
        console.log(dataMenu);
        dataMenu.forEach((menuItem) => {
          menuItem.modelEntities.forEach((modelEntity) => {
            if (
              (modelEntity.id == activeModelEntity.id) &
              (modelEntity.template == "vizMap")
            ) {
              console.log(
                "app:initVizMapListeners:updateActiveVizMap:" + modelEntity.id
              );
              modelEntity.vizLayout.toggleLabels();
            }
          });
        });
      });

    document.getElementById("openbtn").addEventListener("click", function () {
      const sidebar = document.getElementById("mapSidebar");
      const mainMap = document.getElementById("mainMap");

      // Toggle the collapsed class
      sidebar.classList.toggle("collapsed");
      mainMap.classList.toggle("collapsed");
      this.classList.toggle("collapsed");

      // Change button text based on state
      if (sidebar.classList.contains("collapsed")) {
        this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
      } else {
        this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`;
      }
    });

    document
      .getElementById("openbtntrend")
      .addEventListener("click", function () {
        const sidebar = document.getElementById("trendSidebar");
        const main = document.getElementById("trendMain");

        // Toggle the collapsed class
        sidebar.classList.toggle("collapsed");
        main.classList.toggle("collapsed");
        this.classList.toggle("collapsed");

        // Change button text based on state
        if (sidebar.classList.contains("collapsed")) {
          this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
        } else {
          this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`;
        }

        // #trendMain (Chart.js's canvas parent) genuinely does grow/shrink via flex once the
        // sidebar's width transition finishes - confirmed live - but Chart.js's own
        // responsive:true resize observer doesn't pick that up on its own here, leaving the
        // canvas stuck at its old pixel size. Nudge it once the 0.3s CSS transition (see
        // .sidebar's transition: width) has actually finished.
        setTimeout(() => {
          if (activeLayout && activeLayout.currentChart) {
            activeLayout.currentChart.resize();
          }
        }, 350);
      });

    document
      .getElementById("openbtnmatrix")
      .addEventListener("click", function () {
        const sidebar = document.getElementById("matrixSidebar");
        const main = document.getElementById("mainMatrix");

        // Toggle the collapsed class
        sidebar.classList.toggle("collapsed");
        main.classList.toggle("collapsed");
        this.classList.toggle("collapsed");

        // Change button text based on state
        if (sidebar.classList.contains("collapsed")) {
          this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
        } else {
          this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`;
        }
      });

    document
      .getElementById("openbtnmatrixscenario")
      ?.addEventListener("click", function () {
        const sidebar = document.getElementById("matrixScenarioSidebar");

        // Toggle the collapsed class - no need to also toggle #mainMatrix here, it's
        // flex-grow: 1 so it naturally reclaims the space once the sidebar collapses to 0.
        sidebar.classList.toggle("collapsed");
        this.classList.toggle("collapsed");

        // Change button icon based on state (starts expanded, so its icon starts as "collapse")
        if (sidebar.classList.contains("collapsed")) {
          this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`;
        } else {
          this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
        }
      });
  }

  async function populateTemplates() {
    console.log("app:populateTemplates");

    const container = document.getElementById("main");
    const fetchPromises = [];

    globalTemplates.forEach((template) => {
      const div = document.createElement("div");
      div.id = template.templateType + "Template";
      div.classList.add("template");
      div.hidden = true;

      if (template.layoutDivs) {
        div.innerHTML = template.layoutDivs;
        container.appendChild(div);
      } else if (template.layoutHtml) {
        const fetchPromise = fetch(template.layoutHtml)
          .then((response) => response.text())
          .then((data) => {
            div.innerHTML = data;
            container.appendChild(div);
          })
          .catch((error) => console.error("Error loading HTML:", error));

        fetchPromises.push(fetchPromise);
      } else {
        container.appendChild(div);
      }
    });

    Promise.all(fetchPromises).then(() => {
      // All templates are loaded, now add the map
      addMapAndOtherFunctionality();
    });
  }

  function addMapAndOtherFunctionality() {
    console.log("app:addMapAndOtherFunctionality");

    // get templates with maps
    let templatesWithMapView = Object.values(globalTemplates).filter(
      (template) => {
        return template.mapView !== undefined && template.mapView !== null;
      }
    );

    templatesWithMapView.forEach((template) => {
      // add maps
      map = new Map({
        basemap: grayBasemap,
      });

      mapView = new MapView({
        map: map,
        center: centerMap,
        zoom: 10,
        container: template.mapView,
      });

      // add basemap toggle
      const basemapToggle = new BasemapToggle({
        view: mapView,
        nextBasemap: imageryBasemap,
      });

      mapView.ui.add(basemapToggle, "bottom-left");

      // Push pan/zoom into the URL once a user-driven move settles ("stationary" fires once
      // per gesture, not per-frame). Skipped during our own goTo() calls (initial position,
      // URL restore) via _isProgrammaticMapMove (app/url-state.js), since those already end
      // by writing the correct URL state themselves.
      mapView.watch("stationary", (isStationary) => {
        if (isStationary && !_isProgrammaticMapMove && typeof syncUrlState === "function") {
          syncUrlState();
        }
      });

      // CREATE SCENARIO SELECTOR

      // Create a container for the widget content
      const contentContainer = document.createElement("div");
      contentContainer.className = "scenario-selector-container";


      // Add some descriptive text
      const descriptionText = document.createElement("div");
      descriptionText.innerHTML = "<b>Scenario Selector</b>";
      contentContainer.appendChild(descriptionText);

      const lstSelectIds = ["modVersion_Main", "scnGroup_Main", "scnYear_Main"];
      const compSelectIds = [
        "modVersion_Comp",
        "scnGroup_Comp",
        "scnYear_Comp",
      ];

      lstSelectIds.forEach((id) => {
        // Create a flex container for each select and its buttons
        const flexContainer = document.createElement("div");
        flexContainer.style.display = "flex";
        flexContainer.style.alignItems = "center"; // Align items vertically
        flexContainer.style.width = "100%"; // Set container to full width

        // Create a calcite-select element
        const calciteSelect = document.createElement("calcite-select");
        calciteSelect.id = id;
        calciteSelect.style.flexGrow = "1"; // Allow the select element to grow

        if (id.includes("Main") || id.includes("Mod")) {
          calciteSelect.style.display = "flex";
        } else {
          calciteSelect.style.display = "none";
        }

        // Append the calcite-select to the flex container
        flexContainer.appendChild(calciteSelect);

        // Append the flex container to the content container
        contentContainer.appendChild(flexContainer);
      });

      const block = document.createElement("calcite-block");
      block.id = "comparisonScenario";
      block.setAttribute("heading", "Compare to:");
      block.setAttribute("collapsible", true);

      compSelectIds.forEach((id) => {
        // Create a flex container for each select and its buttons
        const flexContainer = document.createElement("div");
        flexContainer.style.display = "flex";
        flexContainer.style.alignItems = "center"; // Align items vertically
        flexContainer.style.width = "100%"; // Set container to full width

        // Create a calcite-select element
        const calciteSelect = document.createElement("calcite-select");
        calciteSelect.id = id;
        calciteSelect.style.flexGrow = "1"; // Allow the select element to grow

        // Append the calcite-select to the flex container
        flexContainer.appendChild(calciteSelect);

        // Append the flex container to the block
        block.appendChild(flexContainer);
      });

      const headingCompare = document.createElement("div");
      headingCompare.innerHTML = "<br/>Compare Type"; // Replace with your desired text
      headingCompare.id = "compare-type-label"; // Replace with your desired text
      block.appendChild(headingCompare);

      // Create a calcite-select element
      const calciteSelectCompare = document.createElement("calcite-select");
      calciteSelectCompare.id = "selectCompareType";
      calciteSelectCompare.value = "diff";

      const optionAbs = document.createElement("calcite-option");
      optionAbs.value = "diff";
      optionAbs.textContent = "Difference";
      calciteSelectCompare.appendChild(optionAbs);

      const optionPc = document.createElement("calcite-option");
      optionPc.value = "pctdiff";
      optionPc.textContent = "Percent Difference";
      calciteSelectCompare.appendChild(optionPc);

      // Append the calcite-select to the block and the block to the content container
      block.appendChild(calciteSelectCompare);
      contentContainer.appendChild(block);

      // Create the Expand widget
      const expandScenario = new Expand({
        view: mapView,
        content: contentContainer,
        expandIcon: "collection",
        expanded: true,
        expandTooltip: "Scenario Selector",
        group: "top-right",
      });

      // Add the Expand widget to the view
      mapView.ui.add(expandScenario, "top-right");

      // ADD LABEL TOGGLE - a single-click icon button (no expand panel): clicking it
      // directly toggles labels on/off, "active" state showing whether labels are on.
      // Same top-right slot the old Expand+checkbox combo used.
      const labelToggleAction = document.createElement("calcite-action");
      labelToggleAction.id = "vizMapLabelToggle";
      labelToggleAction.icon = "label";
      labelToggleAction.scale = "s"; // match the 32x32 size of the adjacent Expand/Zoom buttons
      labelToggleAction.active = true; // labels are on by default
      updateLabelToggleTooltip(labelToggleAction);

      mapView.ui.add(labelToggleAction, "top-right");

      // Remove default zoom controls
      mapView.ui.remove("zoom");

      // Create a new Zoom widget
      const zoomWidget = new Zoom({
        view: mapView,
      });

      // Add the Zoom widget to the top-right corner of the view
      mapView.ui.add(zoomWidget, "top-right");
    });

    init();
  }

  fetch("app/templates/templates.json")
    .then((response) => response.json())
    .then((data) => {
      globalTemplates = data;
      // Optionally, initialize your classes or do other tasks here,
      // once the data is fetched and assigned.
      populateTemplates();
    })
    .catch((error) => {
      console.error("Error fetching templates:", error);
    });

  function hideAllLayoutLayers() {
    hideNoDataIndicator();
    menuItems.forEach((menuItem) => {
      menuItem.hideAllMenuItemLayers();
    });
  }
});

// find the first scenario that has trend data for a given jsonName. Prefers a scenario whose
// data is already loaded (matches pre-lazy-loading behavior exactly, once anything has been
// loaded); before that (e.g. at startup, building menu visibility) nothing is loaded yet, so
// this falls back to the cheap availability probe (see Scenario.probeDataAvailability) instead
// of requiring the full dataset to be fetched just to answer "does this exist anywhere".
function getFirstScenarioWithTrendData(jsonName) {
  console.log("getFirstScenarioWithTrendData");
  return (
    dataScenarios.find((scenario) => scenario.jsonData.hasOwnProperty(jsonName)) ||
    dataScenarios.find((scenario) => scenario.dataAvailable[jsonName] === true)
  );
}

// An attribute's agWeightCode (attributes.json) is normally a single attribute code to weight
// by, but some attributes need weighting by more than one - e.g. a unified "Telecommute %"
// attribute that can show HBW and NHBW together needs to weight by their combined trip volume
// (aAggHbw + aAggNhbw), not just one of them - so agWeightCode may also be an array of codes.
// Sums whichever of them are present on dataRow; returns null (the existing "no usable weight
// for this row" signal both vizmap.js and viztrends.js already check for) if none are.
function getWeightValue(dataRow, wtCode) {
  if (!dataRow || !wtCode) return null;
  const codes = Array.isArray(wtCode) ? wtCode : [wtCode];
  let sum = null;
  codes.forEach(code => {
    const val = dataRow[code];
    if (val != null) sum = (sum ?? 0) + val;
  });
  return sum;
}

// find the first scenario that has trend data for a given jsonName
function getFirstScenarioWithGeoJsonData(geoJsonKey) {
  console.log("getFirstScenarioWithGeoJsonData");
  return dataScenarios.find((scenario) =>
    scenario.geojsons.hasOwnProperty(geoJsonKey)
  );
}

// Function to hide the progress container when both progress bars reach 100%
function checkAndHideProgressContainer() {
  const progressBar = document.getElementById("progress").value;
  const progressBarGeo = document.getElementById("progress-geo").value;

  // Check if both progress bars are at 100%
  if (progressBar === 100 && progressBarGeo === 100) {
    const progressContainer = document.getElementById("progress-container");
    if (progressContainer) {
      // Delay hiding by 1 seconds (1000 milliseconds)
      setTimeout(() => {
        progressContainer.style.display = "none";
        document.getElementById("menu").style.display = "block";

        // If the URL names a menu item/model entity (someone refreshed or opened a shared
        // link), restoreAppStateFromUrl() (app/url-state.js) puts the whole app - scenario,
        // filters, aggregator, map position, etc. - back the way it was and returns true.
        // Otherwise fall back to the config-driven default view, same as before this existed.
        const restoredFromUrl =
          typeof restoreAppStateFromUrl === "function" && restoreAppStateFromUrl();

        if (!restoredFromUrl) {
          onOpenMenuItem = configApp.onOpen.menuItem;
          onOpenModelEntity = configApp.onOpen.modelEntity;

          // Find the menu item where menuText matches onOpenMenuItem
          const selectedMenuItem = menuItems.find(
            (item) => item.menuText === onOpenMenuItem
          );

          if (selectedMenuItem && selectedMenuItem.loadMenuItemAndModelEntity) {
            // Call the function to load the menu item and model entity
            selectedMenuItem.loadMenuItemAndModelEntity(onOpenModelEntity);
          } else {
            console.error(
              "Menu item with matching menuText or load function not found"
            );
          }

          centerMap = [
            configApp.onOpen.centerMap.lon,
            configApp.onOpen.centerMap.lat,
          ];
          zoomMap = configApp.onOpen.zoomMap;

          _isProgrammaticMapMove = true;
          mapView.when(() => {
            mapView
              .goTo({
                center: centerMap, // ArcGIS expects [longitude, latitude]
                zoom: zoomMap, // Optionally set a default zoom level
              })
              .catch(function (error) {
                console.error("Error in recentering the map: ", error);
              })
              .then(() => {
                _isProgrammaticMapMove = false;
              });
          });

          console.log("App: Map recentered");
        }
      }, 1000); // Adjust the time (in milliseconds) as needed
    }
  }
}

  // --- Sidebar integration script ---
async function setupDashboardSidebar() {
  const toggleBtn = document.getElementById('openbtndashboard');
  const shellPanel = document.getElementById('sidebarPanel');

  if (!toggleBtn || !shellPanel) {
    console.warn('Sidebar elements not found in DOM');
    return;
  }

  toggleBtn.addEventListener('click', () => {
    shellPanel.collapsed = !shellPanel.collapsed;
    toggleBtn.classList.toggle('collapsed', shellPanel.collapsed);
    // Starts expanded (icon starts as "collapse"), same convention as vizMatrix's
    // openbtnmatrixscenario.
    toggleBtn.innerHTML = shellPanel.collapsed
      ? `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`
      : `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
  });

  window.openDashboardSidebar = function(open = true) {
    shellPanel.collapsed = !open;
    toggleBtn.classList.toggle('collapsed', shellPanel.collapsed);
    toggleBtn.innerHTML = shellPanel.collapsed
      ? `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`
      : `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
  };
}
