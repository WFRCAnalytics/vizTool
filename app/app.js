let globalTemplates = [];
let dataScenarios = []; // this object contains all the scenarios and their data
let dataScenarioTrends = []; // this object contains all the scneario trends definitions
let dataGeojson = {};
let dataKeys = {};
let map;
let geojsonSegments;
let mapView;
let mapComp; // second Map/MapView pair for side-by-side compare (ensureCompMapView()) - null until first used
let mapViewComp;
// Scenario-alias corner labels shown only in "sidebyside"/"swipe" compare view - vizmap.js's
// setCompRendererAndShow()/teardownCompareExtras() set their text and show/hide them.
let mapScenarioLabelMain;
let mapScenarioLabelComp;
// Overlay-mode diff/pct-diff color key - vizmap.js's setRendererAndLegend() sets its text and
// show/hide (see updateMapCompareColorHint() below).
let mapCompareColorHint;
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
//function setLoadStatus(text) {
//  const el = document.getElementById('load-status-text');
//  if (el) el.textContent = text;
//}

// The label toggle button's tooltip reflects the action a click would perform next
// (not the current state), so it reads "Hide Labels" while labels are on. Called from
// vizmap.js too (loaded after this file, same global scope) wherever btn.active changes.
function updateLabelToggleTooltip(btn) {
  const text = btn.active ? 'Labels On' : 'Labels Off';
  btn.text = text;
  btn.title = text;
}

// Same state-describing text/tooltip pattern as updateLabelToggleTooltip() above, for the
// "Map Title" sidebar toggle (app.js's "ADD MAP TITLE TOGGLE") - called both at setup and on
// every click, since .text doesn't update itself just because .active changed.
function updateMapTitleToggleLabel(btn) {
  const text = btn.active ? 'Map Title On' : 'Map Title Off';
  btn.text = text;
  btn.title = text;
}

// Keeps the two side-by-side compare MapViews' center/zoom/rotation identical as the user
// pans or zooms EITHER one - called once (addMapAndOtherFunctionality()) after both views
// exist. Only propagates a view's viewpoint while THAT view's own `interacting` is true (the
// user is actively dragging/scrolling it) - a programmatic viewpoint assignment (the mirror
// itself) never sets `interacting`, so the other view's own watcher sees its mirrored change
// but takes no action, which is what actually breaks the ping-pong (a boolean "currently
// syncing" flag doesn't: ArcGIS's "viewpoint" notifications are debounced to the view's render
// frame, not synchronous with the assignment, so the flag would already be cleared again by
// the time the echo fires).
function setupMapCompareSync(viewA, viewB) {
  function mirror(source, target) {
    source.watch("viewpoint", (vp) => {
      if (!vp || !source.interacting) return;
      target.viewpoint = vp.clone();
    });
  }
  mirror(viewA, viewB);
  mirror(viewB, viewA);
}

// Shows/hides the #mapViewComp panel and #mapDivider splitter, and resets #mapView back to
// full width when side-by-side compare isn't active. Called from vizmap.js's initializeLayer()
// (knows whether the current render is actually in swipe/compare mode) and hideLayers()/
// teardownCompareSplit() (leaving that view entirely). #mapViewComp (not #mapView) is the one
// given an explicit width - it comes first in source order (vizmap.html), so it's the "left"
// panel being sized from the row's left edge; #mapView fills whatever's left over.
function setMapCompareSplitVisible(visible) {
  const row = document.getElementById("mapViewRow");
  const divider = document.getElementById("mapDivider");
  const compView = document.getElementById("mapViewComp");
  if (!row || !divider || !compView) return;

  row.classList.toggle("split", visible);
  divider.style.display = visible ? "" : "none";
  compView.style.display = visible ? "" : "none";
  if (!visible) {
    compView.style.width = ""; // let .split's width rule take back over next time
  } else {
    if (!compView.style.width) {
      compView.style.width = "50%"; // first time entering split - start at an even 50/50
    }
    // setupMapCompareSync() only mirrors a view the user is actively dragging/scrolling - it
    // doesn't cover programmatic navigation (initial centerMap/zoom, URL restore) that may have
    // moved mapView while mapViewComp sat hidden, so catch it up explicitly on every entry.
    if (mapView && mapViewComp && mapView.viewpoint) {
      mapViewComp.viewpoint = mapView.viewpoint.clone();
    }
  }
}

// Builds/refreshes one alias <calcite-select>'s option list from dataScenarios - the "Use
// Aliases" toggle's alternative to picking modVersion/scnGroup/scnYear one at a time. Options are
// keyed by "modVersion|scnGroup|scnYear" so the change handler can look the full scenario back
// up again; the visible text reuses the same alias-or-fallback logic as
// VizMap.getMainScenarioDisplayName()/getCompScenarioDisplayName().
function populateAliasSelectOptions(selectElem) {
  if (!selectElem) return;
  selectElem.innerHTML = "";
  dataScenarios.forEach((scenario) => {
    const option = document.createElement("calcite-option");
    option.value = `${scenario.modVersion}|${scenario.scnGroup}|${scenario.scnYear}`;
    option.textContent =
      scenario.alias ||
      `${scenario.modVersion} ${scenario.scnGroup} ${scenario.scnYear}`;
    selectElem.appendChild(option);
  });
}

// Shows/updates (or hides) the scenario-alias corner label(s) - called from vizmap.js's
// setCompRendererAndShow() (mode === 'sidebyside'/'swipe', with both alias strings),
// initializeLayer() and the applyEdits() callback (mode === 'overlay', main alias only, for
// every non-two-layer-compare render - i.e. every map, not just while comparing), and
// teardownCompareExtras() (mode === null/no args, to hide both, only when this view is going
// fully inactive - see hideLayers()).
// "sidebyside" labels each of the two independent MapViews in its own top-left corner.
// "swipe" has only one visible MapView (mapViewComp stays hidden - see setMapCompareSplitVisible()),
// so instead of hiding one side's label (previously dropped the Main/right side entirely), it
// shows ONE combined label there - same "(left) vs. (right)" wording as the legend title.
function setMapCompareScenarioLabels(mode, mainText, compText) {
  if (!mapScenarioLabelMain || !mapScenarioLabelComp || !mapView || !mapViewComp) return;

  if (mode === "sidebyside") {
    mapScenarioLabelMain.textContent = mainText;
    mapScenarioLabelMain.dataset.logicalShow = "true";
    mapView.ui.add(mapScenarioLabelMain, "top-left");

    mapScenarioLabelComp.textContent = compText;
    mapScenarioLabelComp.dataset.logicalShow = "true";
    mapViewComp.ui.add(mapScenarioLabelComp, "top-left");
  } else if (mode === "swipe") {
    mapScenarioLabelMain.dataset.logicalShow = "false";

    mapScenarioLabelComp.textContent = `${compText} (left) vs. ${mainText} (right)`;
    mapScenarioLabelComp.dataset.logicalShow = "true";
    mapView.ui.add(mapScenarioLabelComp, "top-left");
  } else if (mode === "overlay") {
    // compText is only passed while actually in compare mode (see vizmap.js's two 'overlay'
    // callers) - plain single-scenario view (this.mode === 'main') passes null/undefined and
    // just gets its own name alone, same as before this label also had to carry the compare case.
    mapScenarioLabelMain.textContent = compText ? `${mainText} vs. ${compText}` : mainText;
    mapScenarioLabelMain.dataset.logicalShow = "true";
    mapView.ui.add(mapScenarioLabelMain, "top-left");
    // Esri's ui.add() re-appends an already-present widget to the end of its corner container
    // rather than leaving it in place - re-anchor the color hint (updateMapCompareColorHint()
    // below) right after it every time this runs, not just once, or a later call here (this
    // fires more than once per render - see vizmap.js's two 'overlay' callers) silently pushes
    // the label past the hint instead of the other way around.
    if (mapCompareColorHint) mapScenarioLabelMain.insertAdjacentElement("afterend", mapCompareColorHint);

    mapScenarioLabelComp.dataset.logicalShow = "false";
  } else {
    mapScenarioLabelMain.dataset.logicalShow = "false";
    mapScenarioLabelComp.dataset.logicalShow = "false";
  }

  applyMapTitleVisibility();
}

// The "Map Title" sidebar toggle (app.js's "ADD MAP TITLE TOGGLE" below) is a manual override
// on top of whatever mode-driven logic above decides should show - each element's own "would
// this mode show me at all" verdict lives in its dataset.logicalShow, set above (and in
// updateMapCompareColorHint() below) instead of touching style.display directly, so toggling the
// override never has to know or guess what the current mode last wanted.
let mapTitleHidden = false;
function applyMapTitleVisibility() {
  [mapScenarioLabelMain, mapScenarioLabelComp, mapCompareColorHint].forEach((el) => {
    if (!el) return;
    const logicalShow = el.dataset.logicalShow === "true";
    el.style.display = (logicalShow && !mapTitleHidden) ? "" : "none";
  });
}

// Lets #mapSidebarRightLegend (vizmap.html) pop out into its own small draggable window and dock
// back again - #mapSidebarRightLegend itself is never rebuilt (vizmap.js's setRendererAndLegend()
// only destroys/recreates the Legend widget's own inner container each render, see its comment),
// so moving this whole node in and out of the sidebar via plain DOM appendChild (which MOVES an
// existing node, not clones it) carries the live widget along with it safely either way. Called
// once; safe to call again (no-ops) since nothing else ever rebuilds #mapSidebarRightLegend.
function setupLegendPopout() {
  const legendContainer = document.getElementById("mapSidebarRightLegend");
  if (!legendContainer || legendContainer.dataset.popoutSetup) return;
  legendContainer.dataset.popoutSetup = "true";

  const headerRow = document.createElement("div");
  headerRow.className = "map-legend-header-row";

  const label = document.createElement("span");
  label.className = "map-legend-header-label";
  label.textContent = "— LEGEND —";
  headerRow.appendChild(label);

  const toggleBtn = document.createElement("calcite-action");
  toggleBtn.scale = "s";
  toggleBtn.icon = "launch";
  toggleBtn.title = "Pop out legend";
  headerRow.appendChild(toggleBtn);

  legendContainer.insertBefore(headerRow, legendContainer.firstChild);

  // Built once, reused every pop-out (shown/hidden + repositioned, never recreated).
  const floatWindow = document.createElement("div");
  floatWindow.id = "mapLegendFloatWindow";
  floatWindow.style.display = "none";

  const floatHeader = document.createElement("div");
  floatHeader.className = "map-legend-float-header";
  const floatTitle = document.createElement("span");
  floatTitle.textContent = "Legend";
  floatHeader.appendChild(floatTitle);

  // Docks back from here instead of the traveling header row above (hidden while popped out,
  // below - this floating window's own title already says "Legend", so showing the sidebar's
  // "— LEGEND —" label again inside it would just be the same thing twice).
  const dockBtn = document.createElement("calcite-action");
  dockBtn.scale = "s";
  dockBtn.icon = "minimize";
  dockBtn.title = "Dock legend";
  dockBtn.appearance = "transparent";
  floatHeader.appendChild(dockBtn);

  floatWindow.appendChild(floatHeader);

  const floatContent = document.createElement("div");
  floatContent.className = "map-legend-float-content";
  floatWindow.appendChild(floatContent);

  document.body.appendChild(floatWindow);

  // Classic "drag by the title bar" pattern - clamped loosely to stay reachable even if dragged
  // toward an edge, not a full windowing library (nothing else in the app needs to float free
  // of both the map and the sidebar like this).
  let _dragging = false;
  let _dragOffsetX = 0;
  let _dragOffsetY = 0;
  floatHeader.addEventListener("mousedown", (e) => {
    _dragging = true;
    const rect = floatWindow.getBoundingClientRect();
    _dragOffsetX = e.clientX - rect.left;
    _dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!_dragging) return;
    const maxLeft = window.innerWidth - 60;
    const maxTop = window.innerHeight - 40;
    floatWindow.style.left = Math.min(maxLeft, Math.max(0, e.clientX - _dragOffsetX)) + "px";
    floatWindow.style.top = Math.min(maxTop, Math.max(0, e.clientY - _dragOffsetY)) + "px";
  });
  document.addEventListener("mouseup", () => { _dragging = false; });

  const popOut = () => {
    const sidebarRect = legendContainer.getBoundingClientRect();
    floatWindow.style.left = Math.max(0, sidebarRect.left - 320) + "px";
    floatWindow.style.top = sidebarRect.top + "px";
    headerRow.style.display = "none"; // see dockBtn's own comment above for why
    floatContent.appendChild(legendContainer);
    floatWindow.style.display = "block";
  };
  const dockBack = () => {
    headerRow.style.display = "";
    // Always the last section in the sidebar's own .panel-col-body (setupColumnCollapse(),
    // above) - Scenario Selector/label toggles come first and never move, so appending here
    // always lands it back in the right spot regardless of where it popped out from.
    const sidebarBody = document.querySelector("#mapSidebarRight .panel-col-body") || document.getElementById("mapSidebarRight");
    sidebarBody.appendChild(legendContainer);
    floatWindow.style.display = "none";
  };

  // headerRow (and so toggleBtn) only ever shows while docked, dockBtn only while popped out -
  // each button only ever needs to do the one thing.
  toggleBtn.addEventListener("click", popOut);
  dockBtn.addEventListener("click", dockBack);
}

// Reads the actual colors out of the current diff/pct-diff renderer (rather than hardcoding
// "red"/"blue") so the hint stays correct even for the handful of attributes whose
// compare_abs_style/compare_pct template reverses the usual ramp (e.g. absStyleI puts dark red
// on the most-negative band instead of dark blue) - see attribute-templates.json. Every
// template's bands run most-negative-first (see buildAbsScaleBounds/buildAbsCountBounds, app.js,
// and the compare_pct templates in config/attribute-templates.json), so classBreakInfos[0] is
// always the "Comp higher" end and the last entry is always the "Main higher" end, regardless of
// which actual colors a given template assigns there. renderer null (main mode, or
// sidebyside/swipe's natural per-scenario renderer) just hides it.
// Only updates content/visibility - setMapCompareScenarioLabels()'s 'overlay' branch above owns
// this element's actual position (right after mapScenarioLabelMain), since that's the one place
// that reliably runs every time the label itself might have moved.
function updateMapCompareColorHint(renderer, mainLabel) {
  if (!mapCompareColorHint) return;
  const breaks = renderer && renderer.classBreakInfos;
  if (!breaks || breaks.length < 2) {
    mapCompareColorHint.dataset.logicalShow = "false";
    applyMapTitleVisibility();
    return;
  }
  const toCssColor = (c) => Array.isArray(c) ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] !== undefined ? c[3] : 1})` : c;
  const compHigherColor = toCssColor(breaks[0].symbol.color);
  const mainHigherColor = toCssColor(breaks[breaks.length - 1].symbol.color);
  mapCompareColorHint.innerHTML =
    `<span class="compare-color-swatch" style="background:${mainHigherColor}"></span>${mainLabel} higher` +
    `<span class="compare-color-swatch" style="background:${compHigherColor}"></span>${mainLabel} lower`;
  mapCompareColorHint.dataset.logicalShow = "true";
  applyMapTitleVisibility();
}

// "Display"/"Filters" being collapsed is one shared preference across vizMap/vizTrends/
// vizMatrix's own separate copies of those columns, not independent per-view state - same
// reasoning as setupSyncedCompareControls()'s "Compare to:"/Compare Type. Keyed by the
// syncGroup name setupColumnCollapse() is called with (e.g. "display", "filters"); each
// entry is that column's own applyCollapsedState() (below), called directly (not via a
// simulated click) so syncing one never re-triggers another's own click handler/chart-resize
// nudge/etc.
const panelSyncGroups = {};

// Gives one column its own independent collapse control - a small sticky header (title +
// chevron) at the top, replacing the old single whole-sidebar collapse button (openbtn/
// openbtntrend/openbtnmatrix). Collapsing shrinks just that column to a slim ~30px rail (not 0
// width), so its own header - and the chevron to reopen it - stays in place instead of needing
// to float somewhere else. Shared by setupPanelColumnCollapse() (.colAttributes/.colFilters,
// found by querying a sidebar) and viztrends' standalone #trendSelector column. syncGroup (e.g.
// "display"/"filters") mirrors this column's collapsed state onto every other column set up
// with the same group name - omit it (as #trendSelector's own caller does) for a column with
// no cross-view counterpart to sync with. flipChevron reverses which direction means "collapse"
// vs. "expand" - every other caller collapses a LEFT-edge column, where chevron-left reads as
// "collapse/slide away to the left" and chevron-right as "expand back out"; #mapSidebarRight
// (vizmap.html) sits on the right edge instead, where collapsing slides it away to the right,
// so its own chevrons need to point the opposite way to still read correctly.
function setupColumnCollapse(el, title, syncGroup, flipChevron) {
  // A dedicated flag, not just "does the header already exist" - the header/body wrapper this
  // builds below are themselves ordinary DOM nodes some other code could end up clearing (e.g.
  // a careless el.innerHTML = '' instead of targeting .panel-col-body). If that ever happened,
  // re-deriving "original" padding from getComputedStyle(el) a second time would just capture
  // the 0 this function itself left behind the first time, baking the lost padding in for good
  // instead of only losing it until the next real re-render.
  if (!el || el.dataset.columnCollapseSetup) return;
  el.dataset.columnCollapseSetup = "true";

  // Move the column's own padding/gap (if any - .colAttributes has some, for its bordered
  // .rowGeography boxes; .colFilters/#trendSelector have none or their own) onto a new wrapper
  // around its existing content, and zero it on the column itself. A sticky header needs to
  // sit flush at the column's own top/left/right edges, and a negative margin meant to cancel
  // that padding doesn't reliably escape it on a position:sticky element in every browser -
  // tested and confirmed in Chrome here.
  const elStyle = getComputedStyle(el);
  const body = document.createElement("div");
  body.className = "panel-col-body";
  body.style.padding = elStyle.padding;
  body.style.display = elStyle.display === "flex" ? "flex" : "block";
  body.style.flexDirection = elStyle.flexDirection;
  body.style.gap = elStyle.gap;
  body.style.boxSizing = "border-box";
  while (el.firstChild) body.appendChild(el.firstChild);
  el.appendChild(body);
  el.style.padding = "0";
  el.style.gap = "0";

  const header = document.createElement("div");
  header.className = "panel-col-header";

  const titleSpan = document.createElement("span");
  titleSpan.className = "panel-col-title";
  titleSpan.textContent = title;
  header.appendChild(titleSpan);

  const icon = document.createElement("calcite-icon");
  icon.icon = flipChevron ? "chevron-right" : "chevron-left";
  icon.scale = "s";
  header.appendChild(icon);

  el.insertBefore(header, body);

  // Applies a given collapsed/expanded state to just this one column (no further propagation) -
  // the click handler below calls this for itself, then (if syncGroup is set) calls every other
  // column sharing that group's own copy of this same function to mirror it onto them too.
  const applyCollapsedState = (collapsed) => {
    el.classList.toggle("panel-collapsed", collapsed);
    icon.icon = collapsed === flipChevron ? "chevron-left" : "chevron-right";
  };

  if (syncGroup) {
    if (!panelSyncGroups[syncGroup]) panelSyncGroups[syncGroup] = [];
    panelSyncGroups[syncGroup].push(applyCollapsedState);
  }

  header.addEventListener("click", () => {
    const collapsed = !el.classList.contains("panel-collapsed");
    applyCollapsedState(collapsed);
    if (syncGroup) {
      panelSyncGroups[syncGroup].forEach((apply) => {
        if (apply !== applyCollapsedState) apply(collapsed);
      });
    }

    // #trendMain's Chart.js canvas (viztrends.js) doesn't pick up its own flex-driven resize
    // on its own - nudge it once the column's width transition has actually finished, same
    // as the old openbtntrend handler did.
    setTimeout(() => {
      if (activeLayout && activeLayout.currentChart) {
        activeLayout.currentChart.resize();
      }
    }, 250);
  });
}

// Only called for sidebars that pair "Attributes"/"Filters" this way (vizMap/vizTrends/
// vizMatrix's left sidebar) - vizMatrix's own separate scenario sidebar reuses the same
// .colAttributes class for an unrelated single-column panel and keeps its own existing
// whole-sidebar toggle (openbtnmatrixscenario) untouched. vizDashboard's own scenario sidebar
// (vizdashboard.html) gets setupColumnCollapse() called on it directly instead (see below) -
// a standalone column like #trendSelector/#mapSidebarRight, not paired with anything.
function setupPanelColumnCollapse(sidebarId) {
  const sidebar = document.getElementById(sidebarId);
  if (!sidebar) return;

  // "Display" (not "Attributes") - this panel also holds Normalization/Aggregation, each with
  // their own small grey subheader label, so naming the panel itself "Attributes" too read as
  // if it were just another one of those rather than the title for the whole column.
  // syncGroup names ("display"/"filters") mirror collapsed/expanded state across this same
  // call's three callers (mapSidebar/trendSidebar/matrixSidebar, below) - one shared preference,
  // not independent per-view state.
  setupColumnCollapse(sidebar.querySelector(":scope > .colAttributes"), "Display", "display");
  setupColumnCollapse(sidebar.querySelector(":scope > .colFilters"), "Filters", "filters");
}

// Collapses the whole header (#menu - both the primary nav bar and its nested secondary
// submenu bar) with one control, instead of needing a separate toggle for each. #menu itself
// goes to display:none and the "header-collapsed" class on <body> reclaims the viewport height
// every sidebar/content column normally subtracts for it (styles.css). #headerCollapseToggle -
// a small floating tab pinned to the top center, always visible regardless of this state - is
// the only way back, so collapsing it is never a dead end.
function setupHeaderCollapse() {
  if (document.getElementById("headerCollapseToggle")) return; // already set up

  const toggle = document.createElement("button");
  toggle.id = "headerCollapseToggle";
  toggle.type = "button";
  toggle.title = "Collapse header";
  toggle.innerHTML = '<calcite-icon icon="chevron-up" scale="s"></calcite-icon>';
  // This runs well before #menu itself is actually revealed (checkAndHideProgressContainer()'s
  // menu.style.display = "block", once the load screen's progress bars hit 100%) - stay hidden
  // until then too, so there's nothing to "collapse" showing up over a still-loading page.
  toggle.style.display = "none";

  toggle.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("header-collapsed");
    // #menu starts as inline style="display:none" (index.html) until data's loaded, then gets
    // revealed via menu.style.display = "block" (see that line in app.js) - an inline style
    // always outranks a stylesheet rule regardless of selector specificity, so
    // body.header-collapsed #menu's own {display:none} (styles.css) can never actually hide it;
    // this has to set the same inline property directly instead.
    document.getElementById("menu").style.display = collapsed ? "none" : "block";
    toggle.title = collapsed ? "Expand header" : "Collapse header";
    toggle.querySelector("calcite-icon").icon = collapsed ? "chevron-down" : "chevron-up";

    // vizTrends' Chart.js canvas doesn't reliably pick up its own responsive:true resize
    // observer on its own here - same reasoning as setupColumnCollapse()'s own post-toggle
    // nudge. Esri's MapView, unlike Chart.js, already resizes itself off a native
    // ResizeObserver on its container, so it needs no equivalent nudge here.
    setTimeout(() => {
      if (activeLayout && activeLayout.currentChart) {
        activeLayout.currentChart.resize();
      }
    }, 250);
  });

  document.body.appendChild(toggle);

  // "Where am I" strip - only shown while the header (and with it, the primary/secondary nav's
  // own "which tab is active" styling) is hidden, so collapsing it doesn't also lose all sense
  // of current location. updateHeaderLocationBar() (below) keeps its text current; called here
  // too so it already has today's location the first time someone collapses the header.
  const locationBar = document.createElement("div");
  locationBar.id = "headerLocationBar";
  document.body.appendChild(locationBar);
  updateHeaderLocationBar();
}

// Keeps #headerCollapseToggle's companion "where am I" strip current - called once up front
// (setupHeaderCollapse()) and again on every navigation (model-entity.js's click handler), so
// it's already correct whenever the header next gets collapsed, not just from then on.
function updateHeaderLocationBar() {
  const bar = document.getElementById("headerLocationBar");
  if (!bar) return;
  const primaryText = activeModelEntity?.menuItem?.menuText;
  const secondaryText = activeModelEntity?.submenuText;
  bar.textContent = [primaryText, secondaryText].filter(Boolean).join(" › "); // "Trips › Trip Ends by Mode"
}

require([
  "esri/Map",
  "esri/Basemap",
  "esri/layers/TileLayer",
  "esri/views/MapView",
  "esri/widgets/Zoom",
], function (Map, Basemap, TileLayer, MapView, Zoom) {
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
    //setLoadStatus("Loading scenario list and geo data...");

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
    //setLoadStatus("Loading configuration...");

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
    //setLoadStatus("Building menu...");

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
    //setLoadStatus("Checking scenario data availability...");
    for (let scenario of dataScenarios) {
      scenario.probeDataAvailability(dataMenu, updateProgress);
    }

    // Ensure progress reaches 100% when all data is loaded
    if (totalLoadedFiles === totalFilesToLoad) {
      progressBar.value = 100;
      progressText.textContent = "100%";
    }
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

    // Keep the "Use Aliases" selects (vizMap's and vizDashboard's own Scenario Selectors) populated
    // and showing the current pick too, since they're a parallel view onto the same
    // selectedScenario_Main/_Comp state - populated here (not at element-creation time) since
    // dataScenarios is guaranteed loaded by the time this runs, which isn't true yet when either
    // panel is first built. Not every id exists on every page (same reasoning as the `elements`
    // loop above) - skipped rather than erroring.
    const aliasElements = [
      { id: "aliasScenario_Main", scenario: () => selectedScenario_Main },
      { id: "aliasScenario_Comp", scenario: () => selectedScenario_Comp },
      { id: "aliasScenario_DashMain", scenario: () => selectedScenario_Main },
      { id: "aliasScenario_DashComp", scenario: () => selectedScenario_Comp },
    ];
    aliasElements.forEach(({ id, scenario }) => {
      const el = document.getElementById(id);
      const selectedScenario = scenario();
      if (el && selectedScenario) {
        if (!el.children.length) populateAliasSelectOptions(el);
        el.value = `${selectedScenario.modVersion}|${selectedScenario.scnGroup}|${selectedScenario.scnYear}`;
      }
    });
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

  // Applies an alias <calcite-select>'s current pick to selectedScenario_Main/_Comp and
  // re-renders - the same end effect as updateScenarioSelection() above, just setting all
  // three fields from one choice instead of one field at a time.
  async function applyAliasScenarioSelection(selectElem, which) {
    const [modVersion, scnGroup, scnYearStr] = selectElem.value.split("|");
    const scenario = { modVersion, scnGroup, scnYear: parseInt(scnYearStr, 10) };
    if (which === "Main") {
      selectedScenario_Main = scenario;
    } else {
      selectedScenario_Comp = scenario;
    }
    await populateScenarioSelections();
    updateActiveVizMap();
  }

  // Swaps selectedScenario_Main/_Comp (not just whichever selects currently display them - the
  // underlying state everything else, map labels/alias selects/vizDashboard's own copies
  // included, is driven from). Shared by every view's own swap button (vizMap's lives in its
  // Scenario Selector panel, vizDashboard's in its own sidebar) rather than each duplicating
  // this same handful of lines.
  async function swapScenarios() {
    const swappedMain = { ...selectedScenario_Comp };
    selectedScenario_Comp = { ...selectedScenario_Main };
    selectedScenario_Main = swappedMain;
    await populateScenarioSelections();
    updateActiveVizMap();
  }

  // Pairs of controls that exist once per view (vizMap's live in the map's UI widget,
  // vizMatrix's and vizDashboard's are each their own sidebar copies) but represent the
  // same single piece of app-wide "what am I comparing against, and how" state, so a change
  // on either side should show up on the other immediately - not just next time that view
  // happens to re-render.
  const syncedComparePairs = [
    { ids: ["comparisonScenario", "comparisonScenarioMatrix", "comparisonScenarioDash"], prop: "open", events: ["calciteBlockToggle"] },
    // selectCompareType/selectCompareTypeDash (vizMap/vizDashboard) are calcite-segmented-control
    // now - selectCompareTypeMatrix is still calcite-select, so this listens for both event names
    // on every id. Each element only ever actually fires the one matching its own real component
    // type, so the "wrong" listener on any given id is just never triggered, not harmful.
    { ids: ["selectCompareType", "selectCompareTypeMatrix", "selectCompareTypeDash"], prop: "value", events: ["calciteSelectChange", "calciteSegmentedControlChange"] },
  ];

  function setupSyncedCompareControls() {
    syncedComparePairs.forEach(({ ids, prop, events }) => {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        events.forEach((event) => {
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

    // vizDashboard's own "Use Aliases" toggle/alias selects/swap button - same controls and
    // behavior as vizMap's Scenario Selector (see its "CREATE SCENARIO SELECTOR" block below),
    // just against vizdashboard.html's static markup instead of being built fresh in JS.
    const aliasScenarioDashMain = document.getElementById("aliasScenario_DashMain");
    const aliasScenarioDashComp = document.getElementById("aliasScenario_DashComp");
    aliasScenarioDashMain?.addEventListener("calciteSelectChange", () =>
      applyAliasScenarioSelection(aliasScenarioDashMain, "Main")
    );
    aliasScenarioDashComp?.addEventListener("calciteSelectChange", () =>
      applyAliasScenarioSelection(aliasScenarioDashComp, "Comp")
    );
    document.getElementById("swapScenariosDash")?.addEventListener("click", swapScenarios);

    const useAliasToggleDash = document.getElementById("useAliasToggleDash");
    useAliasToggleDash?.addEventListener("calciteSwitchChange", () => {
      const useAlias = useAliasToggleDash.checked;
      document.querySelectorAll(".dash-main-select-row").forEach((row) => { row.style.display = useAlias ? "none" : "flex"; });
      document.querySelectorAll(".dash-comp-select-row").forEach((row) => { row.style.display = useAlias ? "none" : "flex"; });
      const aliasRowDashMain = document.getElementById("aliasRowDashMain");
      const aliasRowDashComp = document.getElementById("aliasRowDashComp");
      if (aliasRowDashMain) aliasRowDashMain.style.display = useAlias ? "block" : "none";
      if (aliasRowDashComp) aliasRowDashComp.style.display = useAlias ? "flex" : "none";
    });

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

    // "Compare Type" (diff/pct-diff) only applies to the "Single Map" overlay view - hide it
    // whenever "Side-by-Side (Two Maps)" or "Swipe (Single Map)" is picked instead, since both
    // show each scenario's own natural value rather than a computed difference.
    const compareViewSelect = document.getElementById("selectCompareView");
    const toggleCompareTypeVisibility = () => {
      const isOverlay = compareViewSelect.value === "overlay";
      const compareTypeSelect = document.getElementById("selectCompareType");
      const compareTypeLabel = document.getElementById("compare-type-label");
      if (compareTypeSelect) compareTypeSelect.style.display = isOverlay ? "" : "none";
      if (compareTypeLabel) compareTypeLabel.style.display = isOverlay ? "" : "none";
    };
    // calcite-segmented-control's own change event (not calciteSelectChange - it's not a
    // calcite-select, unlike selectCompareType).
    compareViewSelect.addEventListener("calciteSegmentedControlChange", () => {
      toggleCompareTypeVisibility();
      updateActiveVizMap();
    });
    toggleCompareTypeVisibility();

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

      // Push pan/zoom into the URL once a user-driven move settles ("stationary" fires once
      // per gesture, not per-frame). Skipped during our own goTo() calls (initial position,
      // URL restore) via _isProgrammaticMapMove (app/url-state.js), since those already end
      // by writing the correct URL state themselves.
      mapView.watch("stationary", (isStationary) => {
        if (isStationary && !_isProgrammaticMapMove && typeof syncUrlState === "function") {
          syncUrlState();
        }
      });

      // SECOND MAP/VIEW FOR SIDE-BY-SIDE COMPARE
      // Built eagerly alongside the primary one (not lazily on first use) to keep the sync
      // wiring and the forEach's one-shot setup simple - vizmap.js's VizMap only ever adds a
      // layer to it while "Side-by-Side (Slider)" is actually selected (see
      // setCompRendererAndShow()), so an unused mapComp otherwise just sits idle. See
      // vizmap.html's #mapViewRow comment for why this is two views instead of one view with
      // Esri's Swipe widget.
      mapComp = new Map({
        basemap: grayBasemap,
      });

      mapViewComp = new MapView({
        map: mapComp,
        center: centerMap,
        zoom: 10,
        container: "mapViewComp",
        ui: { components: [] }, // bare - no zoom/attribution chrome duplicating the main view's
      });

      setupMapCompareSync(mapView, mapViewComp);

      // Scenario-alias corner labels - hidden until vizmap.js's setCompRendererAndShow() shows
      // and fills them in for "sidebyside"/"swipe" compare view (see the globals' declaration).
      mapScenarioLabelMain = document.createElement("div");
      mapScenarioLabelMain.className = "map-scenario-label";
      mapScenarioLabelMain.style.display = "none";
      mapView.ui.add(mapScenarioLabelMain, "top-left");

      mapScenarioLabelComp = document.createElement("div");
      mapScenarioLabelComp.className = "map-scenario-label";
      mapScenarioLabelComp.style.display = "none";
      mapViewComp.ui.add(mapScenarioLabelComp, "top-left");

      // Overlay-mode diff/pct-diff color key - lives in #mapFooter under #mapTitle (vizmap.js's
      // title-building code builds that fresh every render), not mapView's own UI, so it reads
      // as part of the map's title rather than a floating corner badge. Hidden/positioned by
      // updateMapCompareColorHint() below, which re-inserts it since #mapFooter gets wiped
      // (innerHTML = '') on every render.
      mapCompareColorHint = document.createElement("div");
      mapCompareColorHint.className = "map-compare-color-hint";
      mapCompareColorHint.style.display = "none";

      // CREATE SCENARIO SELECTOR

      // Create a container for the widget content
      const contentContainer = document.createElement("div");
      contentContainer.className = "scenario-selector-container";


      // "Scenario Selector" title and the "Use Aliases" toggle share one header row, title on the
      // left and the toggle on the right. The toggle swaps the three modVersion/scnGroup/
      // scnYear selects (Main, and Comp inside "Compare to:") for one alias-named select each,
      // for scenarios whose config gives them a human-friendly alias (Scenario.alias -
      // populateAliasSelectOptions() falls back to "modVersion scnGroup scnYear" for any
      // scenario without one). On by default; can be switched back to the three-select view
      // any time.
      const headerRow = document.createElement("div");
      headerRow.style.display = "flex";
      headerRow.style.alignItems = "center";
      headerRow.style.justifyContent = "space-between";
      headerRow.style.width = "100%";

      const descriptionText = document.createElement("div");
      descriptionText.innerHTML = "<b>Scenario Selector</b>";
      headerRow.appendChild(descriptionText);

      const useAliasLabel = document.createElement("calcite-label");
      useAliasLabel.setAttribute("layout", "inline");
      useAliasLabel.style.margin = "0";
      useAliasLabel.style.fontSize = "0.50em";
      const useAliasSwitch = document.createElement("calcite-switch");
      useAliasSwitch.id = "useAliasToggle";
      useAliasSwitch.scale = "s";
      useAliasSwitch.checked = true;
      useAliasLabel.appendChild(useAliasSwitch);
      useAliasLabel.appendChild(document.createTextNode("Use Aliases"));
      headerRow.appendChild(useAliasLabel);

      contentContainer.appendChild(headerRow);

      const lstSelectIds = ["modVersion_Main", "scnGroup_Main", "scnYear_Main"];
      const compSelectIds = [
        "modVersion_Comp",
        "scnGroup_Comp",
        "scnYear_Comp",
      ];
      const mainSelectRows = [];
      const compSelectRows = [];

      lstSelectIds.forEach((id) => {
        // Create a flex container for each select and its buttons
        const flexContainer = document.createElement("div");
        flexContainer.style.display = useAliasSwitch.checked ? "none" : "flex";
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
        mainSelectRows.push(flexContainer);
        contentContainer.appendChild(flexContainer);
      });

      // Alias alternative to the three Main selects above - same selectedScenario_Main state,
      // just picked in one step (applyAliasScenarioSelection()) instead of one field at a time.
      const aliasRowMain = document.createElement("div");
      aliasRowMain.style.width = "100%";
      aliasRowMain.style.display = useAliasSwitch.checked ? "block" : "none";
      const aliasSelectMain = document.createElement("calcite-select");
      aliasSelectMain.id = "aliasScenario_Main";
      aliasSelectMain.style.width = "100%";
      // Not populated here - dataScenarios isn't guaranteed loaded yet at this point (this
      // whole panel can get built before loadScenarios() resolves). populateScenarioSelections()
      // (called later, once dataScenarios is definitely ready) fills both alias selects' options
      // the same way it fills modVersion/scnGroup/scnYear's.
      aliasRowMain.appendChild(aliasSelectMain);
      contentContainer.appendChild(aliasRowMain);

      const block = document.createElement("calcite-block");
      block.id = "comparisonScenario";
      block.setAttribute("heading", "Compare to:");
      block.setAttribute("collapsible", true);

      // Swaps selectedScenario_Main/_Comp (not just the two selects' own displayed values -
      // the underlying state everything else, map labels/alias selects included, is driven
      // from). Icon-only (arrow-up-down - "exchange" used here before was silently a 404
      // against this Calcite version's icon set, rendering nothing), sitting at the right edge
      // of whichever "compare to" select row is currently visible - the alias select's own row
      // when alias mode is on, the last of the three plain selects (scnYear_Comp) otherwise -
      // rather than its own labeled row, since this version's calcite-block also has no
      // header-actions slot to put it next to the collapse chevron instead (tried that first,
      // rendered into nothing, silently unslotted). swapScenarios() itself is shared (defined
      // above, near applyAliasScenarioSelection()) - vizDashboard's own swap button uses it too.
      const makeSwapButton = () => {
        const swapButton = document.createElement("calcite-button");
        swapButton.appearance = "transparent";
        swapButton.scale = "s";
        swapButton.iconStart = "arrow-up-down";
        swapButton.title = "Swap Main ↔ Compare";
        swapButton.setAttribute("aria-label", "Swap Main and Compare scenarios");
        swapButton.addEventListener("click", swapScenarios);
        return swapButton;
      };

      compSelectIds.forEach((id) => {
        // Create a flex container for each select and its buttons
        const flexContainer = document.createElement("div");
        flexContainer.style.display = useAliasSwitch.checked ? "none" : "flex";
        flexContainer.style.alignItems = "center"; // Align items vertically
        flexContainer.style.width = "100%"; // Set container to full width

        // Create a calcite-select element
        const calciteSelect = document.createElement("calcite-select");
        calciteSelect.id = id;
        calciteSelect.style.flexGrow = "1"; // Allow the select element to grow

        // Append the calcite-select to the flex container
        flexContainer.appendChild(calciteSelect);

        // Append the flex container to the block
        compSelectRows.push(flexContainer);
        block.appendChild(flexContainer);
      });

      // Alias alternative to the three Comp selects above - same pairing as aliasRowMain/
      // aliasSelectMain, for selectedScenario_Comp instead.
      const aliasRowComp = document.createElement("div");
      aliasRowComp.style.width = "100%";
      aliasRowComp.style.display = useAliasSwitch.checked ? "flex" : "none";
      aliasRowComp.style.alignItems = "center";
      const aliasSelectComp = document.createElement("calcite-select");
      aliasSelectComp.id = "aliasScenario_Comp";
      aliasSelectComp.style.flexGrow = "1";
      // See aliasSelectMain above - populateScenarioSelections() fills this one's options too.
      aliasRowComp.appendChild(aliasSelectComp);
      aliasRowComp.appendChild(makeSwapButton());
      block.appendChild(aliasRowComp);

      useAliasSwitch.addEventListener("calciteSwitchChange", () => {
        const useAlias = useAliasSwitch.checked;
        mainSelectRows.forEach((row) => { row.style.display = useAlias ? "none" : "flex"; });
        aliasRowMain.style.display = useAlias ? "block" : "none";
        compSelectRows.forEach((row) => { row.style.display = useAlias ? "none" : "flex"; });
        aliasRowComp.style.display = useAlias ? "flex" : "none";
      });

      // Same button as aliasRowComp's own (see makeSwapButton above) - compSelectRows' last row
      // (scnYear_Comp) is the one left visible when alias mode is off.
      if (compSelectRows.length > 0) {
        compSelectRows[compSelectRows.length - 1].appendChild(makeSwapButton());
      }
      aliasSelectMain.addEventListener("calciteSelectChange", () =>
        applyAliasScenarioSelection(aliasSelectMain, "Main")
      );
      aliasSelectComp.addEventListener("calciteSelectChange", () =>
        applyAliasScenarioSelection(aliasSelectComp, "Comp")
      );

      // "Compare View" picks how the two scenarios get shown once "Compare to:" is open:
      // - "overlay": a single diff/pct-diff map (the original behavior, "Compare Type" below
      //   picks which).
      // - "sidebyside": two independent, synced MapViews with a draggable splitter between
      //   them (app.js's setMapCompareSplitVisible()/setupMapCompareSync()) - each view labels
      //   itself normally since neither competes with the other.
      // - "swipe": the classic single-map reveal, one MapView with Esri's Swipe widget
      //   clipping leadingLayers/trailingLayers (VizMap.setCompRendererAndShow()). Esri's Swipe
      //   widget has a confirmed bug where its trailingLayers suppresses the other layer's
      //   labels (see https://community.esri.com/t5/arcgis-javascript-maps-sdk-questions/swipe-widget-label-issue/m-p/1379227) -
      //   kept as an option anyway since some users want the familiar single-map swipe feel
      //   more than complete labels, with "sidebyside" as the alternative when labels matter.
      // "Compare Type" only means anything for the overlay option, so its own row gets hidden
      // below whenever either compare-view option is selected (toggleCompareTypeVisibility()).
      // A calcite-segmented-control (not calcite-select, unlike Compare Type below) - three
      // options read fine as one row of buttons instead of needing a dropdown to see them, and
      // this panel's narrow enough that they need their own row (not sharing one with a label
      // the way Compare Type's select does) to fit three at once without wrapping. Short labels
      // (full names in each button's title tooltip instead) for the same reason.
      const headingCompareView = document.createElement("div");
      headingCompareView.className = "compare-inline-label";
      headingCompareView.textContent = "Compare View";
      headingCompareView.id = "compare-view-label";
      headingCompareView.style.marginTop = "8px";
      block.appendChild(headingCompareView);

      const calciteSelectCompareView = document.createElement("calcite-segmented-control");
      calciteSelectCompareView.id = "selectCompareView";
      calciteSelectCompareView.width = "full";
      calciteSelectCompareView.scale = "s";

      const optionOverlay = document.createElement("calcite-segmented-control-item");
      optionOverlay.value = "overlay";
      optionOverlay.textContent = "Single";
      optionOverlay.title = "Single Map";
      optionOverlay.checked = true;
      calciteSelectCompareView.appendChild(optionOverlay);

      const optionSideBySide = document.createElement("calcite-segmented-control-item");
      optionSideBySide.value = "sidebyside";
      optionSideBySide.textContent = "Split";
      optionSideBySide.title = "Side-by-Side (Two Maps)";
      calciteSelectCompareView.appendChild(optionSideBySide);

      const optionSwipe = document.createElement("calcite-segmented-control-item");
      optionSwipe.value = "swipe";
      optionSwipe.textContent = "Swipe";
      optionSwipe.title = "Swipe (Single Map)";
      calciteSelectCompareView.appendChild(optionSwipe);

      block.appendChild(calciteSelectCompareView);

      // Same calcite-segmented-control treatment as Compare View above - two options read fine
      // as one row of buttons, and "% Difference" (not "Percent Difference") comfortably fits
      // both buttons in this same narrow panel; the full name is still in its title tooltip.
      const rowCompareType = document.createElement("div");
      rowCompareType.id = "compare-type-row";
      const headingCompare = document.createElement("div");
      headingCompare.className = "compare-inline-label";
      headingCompare.textContent = "Compare Type";
      headingCompare.id = "compare-type-label";
      headingCompare.style.marginTop = "8px";
      rowCompareType.appendChild(headingCompare);

      const calciteSelectCompare = document.createElement("calcite-segmented-control");
      calciteSelectCompare.id = "selectCompareType";
      calciteSelectCompare.width = "full";
      calciteSelectCompare.scale = "s";

      const optionAbs = document.createElement("calcite-segmented-control-item");
      optionAbs.value = "diff";
      optionAbs.textContent = "Difference";
      optionAbs.checked = true;
      calciteSelectCompare.appendChild(optionAbs);

      const optionPc = document.createElement("calcite-segmented-control-item");
      optionPc.value = "pctdiff";
      optionPc.textContent = "% Difference";
      optionPc.title = "Percent Difference";
      calciteSelectCompare.appendChild(optionPc);

      rowCompareType.appendChild(calciteSelectCompare);
      block.appendChild(rowCompareType);

      contentContainer.appendChild(block);

      // Lives in the right sidebar now (#mapSidebarRightScenario, vizmap.html) - always visible
      // there, not a floating Expand panel over the map, so no "auto" full-screen-mask-below-a-
      // width-threshold concern (that was specifically about side-by-side compare halving
      // #mapView's own width, which doesn't affect the sidebar's fixed width at all).
      document.getElementById("mapSidebarRightScenario").appendChild(contentContainer);

      // ADD LABEL TOGGLE - a single-click icon button: clicking it directly toggles labels
      // on/off, "active" state showing whether labels are on. Lives right under the Scenario
      // Selector in the sidebar (textEnabled so it reads as a labeled row there, not just a
      // bare icon the way it had to as a floating corner button).
      const labelToggleAction = document.createElement("calcite-action");
      labelToggleAction.id = "vizMapLabelToggle";
      labelToggleAction.icon = "label";
      labelToggleAction.scale = "s";
      labelToggleAction.text = "Labels";
      labelToggleAction.textEnabled = true;
      labelToggleAction.active = true; // labels are on by default
      updateLabelToggleTooltip(labelToggleAction);

      document.getElementById("mapSidebarRightLabelToggle").appendChild(labelToggleAction);

      // ADD MAP TITLE TOGGLE - same single-click pattern as Labels above, sitting next to it.
      // Hides/shows mapScenarioLabelMain/Comp and the compare color hint together (see
      // applyMapTitleVisibility() above) - a manual override layered on top of whatever the
      // current mode would otherwise show, not a replacement for that mode logic.
      const mapTitleToggleAction = document.createElement("calcite-action");
      mapTitleToggleAction.id = "vizMapTitleToggle";
      mapTitleToggleAction.icon = "title";
      mapTitleToggleAction.scale = "s";
      mapTitleToggleAction.textEnabled = true;
      mapTitleToggleAction.active = true; // shown by default
      updateMapTitleToggleLabel(mapTitleToggleAction);
      mapTitleToggleAction.addEventListener("click", (event) => {
        const btn = event.currentTarget;
        btn.active = !btn.active;
        mapTitleHidden = !btn.active;
        updateMapTitleToggleLabel(btn);
        applyMapTitleVisibility();
      });

      document.getElementById("mapSidebarRightLabelToggle").appendChild(mapTitleToggleAction);

      // ADD LAYER OPACITY SLIDER - controls the active vizMap's own feature layer(s) opacity
      // live while dragging. On its own full-width row under Labels/Map Title (same
      // flex-basis:100% trick #mapSidebarRightLabelToggle's own ::before heading uses to force
      // itself onto its own line in that flex row) - a slider needs more width than an icon
      // button gets sharing a row. The value itself lives on the active VizMap instance
      // (this.layerOpacity, vizmap.js), reapplied there every render since initializeLayer()
      // rebuilds layerDisplay/layerDisplayComp from scratch each time - this handler only needs
      // to update whichever instance is active right now, not persist anything on its own.
      // Same small grey section-label convention as "— MAP ELEMENT VISIBILITY —" above and
      // "— LEGEND —" below (.map-legend-header-label, shared) - not .compare-inline-label (the
      // plain "Compare View"/"Compare Type" style), per explicit request to match those two.
      const headingOpacity = document.createElement("div");
      headingOpacity.className = "map-legend-header-label";
      headingOpacity.textContent = "— LAYER OPACITY —";
      headingOpacity.style.flexBasis = "100%";
      headingOpacity.style.textAlign = "center";
      headingOpacity.style.marginTop = "8px";
      document.getElementById("mapSidebarRightLabelToggle").appendChild(headingOpacity);

      const opacityRow = document.createElement("div");
      opacityRow.id = "mapOpacityRow";
      opacityRow.style.flexBasis = "100%";
      opacityRow.style.display = "flex";
      opacityRow.style.alignItems = "center";

      const opacitySlider = document.createElement("calcite-slider");
      opacitySlider.id = "vizMapOpacitySlider";
      opacitySlider.min = 0;
      opacitySlider.max = 1;
      opacitySlider.step = 0.05;
      opacitySlider.value = 1;
      opacitySlider.labelHandles = false;
      opacitySlider.style.flex = "1 1 auto";
      opacityRow.appendChild(opacitySlider);

      opacitySlider.addEventListener("calciteSliderInput", (event) => {
        const value = event.target.value;
        if (activeLayout) {
          activeLayout.layerOpacity = value;
          if (activeLayout.layerDisplay) activeLayout.layerDisplay.opacity = value;
          if (activeLayout.layerDisplayComp) activeLayout.layerDisplayComp.opacity = value;
        }
      });

      document.getElementById("mapSidebarRightLabelToggle").appendChild(opacityRow);

      // ADD BASEMAP TOGGLE - a plain icon button (replaces Esri's BasemapToggle widget, which
      // only ever controlled mapView's own basemap) toggling map.basemap AND mapComp.basemap
      // together in one handler, so the side-by-side compare view's map always matches the
      // main one instead of possibly showing a different basemap. Stays a floating map widget
      // (unlike Scenario Selector/labels/legend above) - bottom-right, the corner the legend
      // used to float in before it also moved to the sidebar.
      const basemapToggleAction = document.createElement("calcite-action");
      basemapToggleAction.id = "vizMapBasemapToggle";
      basemapToggleAction.icon = "basemap";
      basemapToggleAction.scale = "s";
      basemapToggleAction.text = "Toggle basemap";
      basemapToggleAction.textEnabled = false;
      basemapToggleAction.title = "Switch to imagery basemap";
      basemapToggleAction.addEventListener("click", (event) => {
        const btn = event.currentTarget;
        btn.active = !btn.active;
        const nextBasemap = btn.active ? imageryBasemap : grayBasemap;
        map.basemap = nextBasemap;
        if (mapComp) mapComp.basemap = nextBasemap;
        btn.title = btn.active ? "Switch to gray basemap" : "Switch to imagery basemap";
      });
      mapView.ui.add(basemapToggleAction, "bottom-right");

      // Remove default zoom controls
      mapView.ui.remove("zoom");

      // Create a new Zoom widget
      const zoomWidget = new Zoom({
        view: mapView,
      });

      // Add the Zoom widget to the top-right corner of the view
      mapView.ui.add(zoomWidget, "top-right");
    });

    // Give each left sidebar's "Attributes"/"Filters" columns their own independent collapse
    // control (replaces the old single whole-sidebar openbtn/openbtntrend/openbtnmatrix
    // buttons) - see setupPanelColumnCollapse()'s own comment. vizMatrix's separate scenario
    // sidebar reuses .colAttributes for an unrelated single-column panel and keeps its own
    // existing openbtnmatrixscenario toggle untouched.
    setupPanelColumnCollapse("mapSidebar");
    setupPanelColumnCollapse("trendSidebar");
    setupPanelColumnCollapse("matrixSidebar");

    // #trendSelector (viztrends.html) is its own standalone column, not paired inside a
    // sidebar like Attributes/Filters - same collapse treatment, called directly.
    setupColumnCollapse(document.getElementById("trendSelector"), "Trend Selector");

    // vizMap's right sidebar (Scenario Selector/labels/Legend - vizmap.html) - another
    // standalone column, same treatment. Safe to call before its own content (Scenario
    // Selector/label toggles/Legend) exists yet - this only moves #mapSidebarRight's current
    // children (the three empty sub-containers already in the static template) into the new
    // .panel-col-body wrapper, and everything that later fills them does so by ID, not by
    // assuming a particular parent.
    setupColumnCollapse(document.getElementById("mapSidebarRight"), "Scenario / Legend", undefined, true);
    setupLegendPopout();

    // vizDashboard's own right sidebar (vizdashboard.html) - same standalone column/right-edge
    // treatment as vizMap's above (replaces the old calcite-shell-panel/openbtndashboard
    // whole-sidebar hide, which couldn't shrink to a slim rail the way this can).
    setupColumnCollapse(document.getElementById("dashboardSidebarRight"), "Scenario / Summary Geography", undefined, true);

    setupHeaderCollapse();

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
        // See setupHeaderCollapse()'s matching comment - kept hidden until #menu itself is,
        // so it doesn't show up over the still-loading page.
        const headerCollapseToggle = document.getElementById("headerCollapseToggle");
        if (headerCollapseToggle) headerCollapseToggle.style.display = "";

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

