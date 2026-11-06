// Mirrors the app's current view (menu item, model entity, scenario selections, filters,
// zone-geography aggregator, chart attribute/divider, vizTrends chart controls, map position)
// into the URL query string live, so refreshing or sharing the link reproduces the same view.
//
// Restoring state means re-seeding widget `.selected` (or `.comboSelected`) values before that
// widget's owning sidebar renders - VizSidebar/Filter/WijSelect/WijRadio/WijCheckboxes rebuild
// their DOM from scratch off `.selected` every time `render()` runs (see vizsidebar.js,
// filter.js, app/widgets/*.js), so pre-seeding is enough for anything rendered as part of
// loading the target model entity. A few controls (vizTrends' mode/seriesMode/barGroup/year
// selectors and the scenario-trend checkboxes) are page-global singletons built once up front
// instead, so those are restored by writing directly into their already-mounted DOM too.

let _isProgrammaticMapMove = false;

function restoreWijSelectSelection(wijSelect, value) {
  if (!wijSelect || value === undefined || value === null || value === '') return;
  wijSelect.selected = value;
  const el = document.getElementById(wijSelect.id);
  if (el) el.value = value;
}

function restoreWijRadioSelection(wijRadio, value) {
  if (!wijRadio || value === undefined || value === null || value === '') return;
  wijRadio.selected = value;
  document.querySelectorAll('calcite-radio-button[name="' + wijRadio.id + '"]').forEach(el => {
    el.checked = (el.value === value);
  });
}

function restoreWijCheckboxesSelection(wijCheckboxes, values) {
  if (!wijCheckboxes || !values || !values.length) return;
  // Two things can go wrong restoring straight from the URL's raw (always-string) values:
  // (1) some filters' real option values are numbers (e.g. fModeRoute - see config/filters.json),
  //     so a strict values.includes(option.value) never matches and every checkbox renders
  //     unchecked even though .selected still gets set to a non-empty array - the checkboxes
  //     look empty while data queries still treat it as "N options selected".
  // (2) a URL can also carry a selection left over from a different attribute/view whose
  //     options don't match this one at all.
  // Comparing as strings on both sides fixes (1); building the result from wijCheckboxes.options
  // (keeping each option's own original-typed value) rather than the raw URL strings fixes (2)
  // implicitly, since only values with a real matching option survive.
  const matchedValues = (wijCheckboxes.options || [])
    .map(option => option.value)
    .filter(optionValue => values.includes(String(optionValue)));
  if (!matchedValues.length) return;
  wijCheckboxes.selected = matchedValues;
  (wijCheckboxes.options || []).forEach(option => {
    const el = document.getElementById(wijCheckboxes.id + '-chk-' + option.value);
    if (el) el.checked = matchedValues.includes(option.value);
  });
}

// Filters can be backed by any of the four widget types depending on their configured
// fWidget, so restoring one means dispatching to the matching helper above (or, for
// WijCombobox - which has no post-mount DOM restore path today, see wijcombobox.js - just
// seeding the instance property so a not-yet-rendered filter still comes up right).
function restoreFilterSelection(filter, rawValue) {
  if (!filter || !filter.filterWij || rawValue === undefined || rawValue === null) return;
  const wij = filter.filterWij;
  if (wij instanceof WijCheckboxes) {
    restoreWijCheckboxesSelection(wij, rawValue.split(','));
  } else if (wij instanceof WijCombobox) {
    wij.comboSelected = rawValue.split(',');
  } else if (wij instanceof WijRadio) {
    restoreWijRadioSelection(wij, rawValue);
  } else if (wij instanceof WijSelect) {
    restoreWijSelectSelection(wij, rawValue);
  }
}

// Full-state serializer (not incremental) - always rewrites every param from current app
// state, so it's safe to call from anywhere state might have changed (every layout's
// updateDisplay(), and the map's own pan/zoom watcher). Uses replaceState so rapid filter
// clicks or map drags don't spam browser history - only the URL itself needs to stay live.
function syncUrlState() {
  if (!activeModelEntity || !activeModelEntity.menuItem) return;

  const params = new URLSearchParams();
  params.set('menu', activeModelEntity.menuItem.menuText);
  params.set('entity', activeModelEntity.submenuText);

  if (selectedScenario_Main && selectedScenario_Main.modVersion) {
    params.set('mv', selectedScenario_Main.modVersion);
    params.set('sg', selectedScenario_Main.scnGroup);
    params.set('sy', selectedScenario_Main.scnYear);
  }
  if (selectedScenario_Comp && selectedScenario_Comp.modVersion) {
    params.set('mvC', selectedScenario_Comp.modVersion);
    params.set('sgC', selectedScenario_Comp.scnGroup);
    params.set('syC', selectedScenario_Comp.scnYear);
  }

  const compareEl = document.getElementById('comparisonScenario') || document.getElementById('comparisonScenarioMatrix');
  if (compareEl && compareEl.open) {
    params.set('cmp', '1');
    const compareTypeEl = document.getElementById('selectCompareType') || document.getElementById('selectCompareTypeMatrix');
    if (compareTypeEl && compareTypeEl.value) {
      params.set('cmptype', compareTypeEl.value);
    }
  }

  const sidebar = activeLayout && activeLayout.sidebar;
  if (sidebar) {
    if (sidebar.attributeSelect && sidebar.attributeSelect.selected) {
      params.set('attr', sidebar.attributeSelect.selected);
    }
    if (sidebar.aggregatorSelect && sidebar.aggregatorSelect.selected) {
      params.set('agg', sidebar.aggregatorSelect.selected);
    }
    if (sidebar.dividerSelect && sidebar.dividerSelect.selected && sidebar.dividerSelect.selected !== 'Nothing') {
      params.set('div', sidebar.dividerSelect.selected);
    }
    // Only serialize filters the current attribute actually uses (same filter.isVisible()
    // check getListOfSelectedFilterOptions() already gates the real data query on - see
    // vizsidebar.js). Some concepts (e.g. road segment direction/functional group) have two
    // widgets - an "All"-capable select and a checkbox-only variant - and only one is shown
    // per attribute; without this check every reload/share URL carried both, including the
    // hidden one's untouched config default (never a real selection), which read as if the
    // view had picked a filter value that was actually inert and ignored by the query.
    (sidebar.filters || []).forEach(filter => {
      if (!filter.fCode || !filter.filterWij || !filter.isVisible()) return;
      const wij = filter.filterWij;
      const value = wij.comboSelected !== undefined ? wij.comboSelected : wij.selected;
      if (value === undefined || value === null || value === '') return;
      const serialized = Array.isArray(value) ? value.join(',') : String(value);
      if (serialized) params.set('f_' + filter.fCode, serialized);
    });
  }

  // vizTrends' chart-control bar (mode/seriesMode/barGroup/year, and the trend-group
  // checkboxes) is a set of page-global singletons shared across every vizTrends entity
  // rather than being rebuilt per sidebar - see viztrends.js's constructor.
  if (typeof VizTrends !== 'undefined' && activeLayout instanceof VizTrends) {
    if (activeLayout.seriesSelect && activeLayout.seriesSelect.selected) {
      params.set('series', activeLayout.seriesSelect.selected);
    }
    if (typeof modeSelect !== 'undefined' && modeSelect && modeSelect.selected) {
      params.set('mode', modeSelect.selected);
    }
    if (typeof seriesModeSelect !== 'undefined' && seriesModeSelect && seriesModeSelect.selected) {
      params.set('seriesmode', seriesModeSelect.selected);
    }
    if (typeof barGroupSelect !== 'undefined' && barGroupSelect && barGroupSelect.selected) {
      params.set('bargroup', barGroupSelect.selected);
    }
    if (typeof yearSelect !== 'undefined' && yearSelect && yearSelect.selected) {
      params.set('year', yearSelect.selected);
    }
    if (typeof compareYearSelect !== 'undefined' && compareYearSelect && compareYearSelect.selected) {
      params.set('compareyear', compareYearSelect.selected);
    }
    if (typeof scenarioChecker !== 'undefined' && scenarioChecker && scenarioChecker.selected && scenarioChecker.selected.length) {
      params.set('trendgroups', scenarioChecker.selected.join(','));
    }
  }

  if (mapView && mapView.center) {
    params.set('lat', mapView.center.latitude.toFixed(5));
    params.set('lon', mapView.center.longitude.toFixed(5));
    params.set('z', Math.round(mapView.zoom * 100) / 100);
  }

  history.replaceState(null, '', location.pathname + '?' + params.toString());
}

// Reads the URL (called once at startup) and, if it names a menu item/model entity, restores
// the full view: scenario + compare mode first (so the entity's first render already uses
// them), then filter/aggregator/attribute/divider/vizTrends-control overrides applied directly
// to the target entity's already-constructed-but-not-yet-rendered sidebar/widgets, then the
// normal loadMenuItemAndModelEntity() flow (which renders once, correctly, with everything
// already in place), then the map position. Returns false (and changes nothing) if the URL
// doesn't identify a valid menu item/model entity, so the caller can fall back to the
// config-driven onOpen default.
function restoreAppStateFromUrl() {
  const params = new URLSearchParams(location.search);
  const menuText = params.get('menu');
  const entityText = params.get('entity');
  if (!menuText || !entityText) return false;

  const menuItem = menuItems.find(m => m.menuText === menuText);
  const modelEntity = menuItem ? menuItem.modelEntities.find(e => e.submenuText === entityText) : null;
  if (!menuItem || !modelEntity) return false;

  if (params.has('mv')) {
    selectedScenario_Main = {
      modVersion: params.get('mv'),
      scnGroup: params.get('sg'),
      scnYear: parseInt(params.get('sy'), 10)
    };
  }
  if (params.has('mvC')) {
    selectedScenario_Comp = {
      modVersion: params.get('mvC'),
      scnGroup: params.get('sgC'),
      scnYear: parseInt(params.get('syC'), 10)
    };
  }
  if (typeof populateScenarioSelections === 'function') {
    populateScenarioSelections();
  }

  const cmpOn = params.get('cmp') === '1';
  ['comparisonScenario', 'comparisonScenarioMatrix', 'comparisonScenarioDash'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.open = cmpOn;
  });
  if (params.has('cmptype')) {
    ['selectCompareType', 'selectCompareTypeMatrix', 'selectCompareTypeDash'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = params.get('cmptype');
    });
  }

  const sidebar = modelEntity.vizLayout && modelEntity.vizLayout.sidebar;
  if (sidebar) {
    if (params.has('attr') && sidebar.attributeSelect) {
      restoreWijRadioSelection(sidebar.attributeSelect, params.get('attr'));
    }
    if (params.has('agg') && sidebar.aggregatorSelect) {
      restoreWijSelectSelection(sidebar.aggregatorSelect, params.get('agg'));
      selectedAggregatorCode = params.get('agg');
    }
    if (params.has('div') && sidebar.dividerSelect) {
      restoreWijSelectSelection(sidebar.dividerSelect, params.get('div'));
    }
    (sidebar.filters || []).forEach(filter => {
      if (!filter.fCode) return;
      const raw = params.get('f_' + filter.fCode);
      if (raw === null) return;
      restoreFilterSelection(filter, raw);
    });
  }

  if (typeof VizTrends !== 'undefined' && modelEntity.vizLayout instanceof VizTrends) {
    if (params.has('series')) {
      modelEntity.vizLayout.seriesSelect = { selected: params.get('series') };
    }
    if (params.has('mode')) restoreWijSelectSelection(modeSelect, params.get('mode'));
    if (params.has('seriesmode')) restoreWijSelectSelection(seriesModeSelect, params.get('seriesmode'));
    if (params.has('bargroup')) restoreWijSelectSelection(barGroupSelect, params.get('bargroup'));
    if (params.has('year')) restoreWijSelectSelection(yearSelect, params.get('year'));
    if (params.has('compareyear')) restoreWijSelectSelection(compareYearSelect, params.get('compareyear'));
    if (params.has('trendgroups')) {
      restoreWijCheckboxesSelection(scenarioChecker, params.get('trendgroups').split(','));
    }
  }

  // loadMenuItemAndModelEntity() is async now that scenario data loads lazily (see
  // Scenario.ensureDataLoaded) - it does real awaited work (fetching data, rendering the
  // sidebar) before the entity is actually ready. This function stays synchronous (callers
  // like checkAndHideProgressContainer() need its true/false return immediately), so the
  // load-then-aggregator-swap-then-map-move sequence below runs as a fire-and-forget async
  // tail - but internally it MUST await each step in order, not fire them all at once, or the
  // aggregator swap and the entity's own first render race each other on the same map layers
  // (symptom: polygons render with no color, i.e. two renders partly overwrote each other).
  finishRestoringEntityFromUrl(menuItem, modelEntity, entityText, params);

  return true;
}

async function finishRestoringEntityFromUrl(menuItem, modelEntity, entityText, params) {
  await menuItem.loadMenuItemAndModelEntity(entityText);

  // Picking a non-default aggregator is more than a sidebar value: vizMap swaps in a whole
  // different GeoJSON geometry layer for it, and vizTrends/vizMatrix rebuild their
  // aggregator-scoped "reference map" filter widget (see VizSidebar.afterUpdateAggregator()).
  // Setting `.selected` earlier alone doesn't trigger any of that, so replay the same call a
  // user picking this aggregator by hand would trigger - which is the sidebar's own
  // afterUpdateAggregator() (wired up in wijselect.js's calciteSelectChange handler), not the
  // vizLayout's - calling the vizLayout's directly (as this used to) skips the Filter rebuild,
  // leaving the reference map showing whatever aggregator the sidebar was constructed with
  // instead of the one restored from the URL. VizSidebar.afterUpdateAggregator() calls the
  // vizLayout's own afterUpdateAggregator() itself once it's done, so this still ends up
  // rendering/updating the view exactly as before - only now that loadMenuItemAndModelEntity()
  // above has fully finished (activeLayout/activeModelEntity, which syncUrlState() inside the
  // updateDisplay() this schedules reads, are already this entity, and its own first render is
  // done rather than still in flight).
  if (params.has('agg') && modelEntity.vizLayout && modelEntity.vizLayout.sidebar &&
      typeof modelEntity.vizLayout.sidebar.afterUpdateAggregator === 'function') {
    modelEntity.vizLayout.sidebar.afterUpdateAggregator();
  }

  if (mapView && params.has('lat') && params.has('lon')) {
    const center = [parseFloat(params.get('lon')), parseFloat(params.get('lat'))];
    const zoomVal = params.has('z') ? parseFloat(params.get('z')) : mapView.zoom;
    _isProgrammaticMapMove = true;
    mapView.when(() => {
      mapView.goTo({ center, zoom: zoomVal })
        .catch(error => console.error('Error restoring map position from URL: ', error))
        .then(() => { _isProgrammaticMapMove = false; });
    });
  }
}
