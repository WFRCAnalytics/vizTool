// Resolves a {modVersion, scnGroup, scnYear} reference (selectedScenario_Main/_Comp's shape)
// to its actual Scenario instance in dataScenarios - same lookup every layout's own
// getScenario()/getMain() already does, duplicated here since ModelEntity needs it before a
// layout instance is necessarily the active one.
function resolveScenario(scenarioRef) {
  if (!scenarioRef) return null;
  return dataScenarios.find(s =>
    s.modVersion === scenarioRef.modVersion &&
    s.scnGroup === scenarioRef.scnGroup &&
    s.scnYear === parseInt(scenarioRef.scnYear, 10)
  ) || null;
}

// VizSidebar.render() (called from renderSidebar() below) synchronously reads the main
// scenario's data (via getFilterGroup/getFilterGroupArray), so it must already be cached
// before renderSidebar() runs, not just before updateDisplay().
async function ensureMainScenarioDataLoaded(vizLayout) {
  const mainScenario = resolveScenario(selectedScenario_Main);
  if (!mainScenario) return;
  showDataLoadingIndicator();
  try {
    await mainScenario.ensureDataLoaded(vizLayout.jsonName);
  } finally {
    hideDataLoadingIndicator();
  }
}

// Builds the one vizLayout instance a single view entry needs, given its own
// template/templateSettings - factored out of the ModelEntity constructor so it can be
// called once per entry in a multi-view entity's "views" array instead of just once per entity.
// Hand-drawn single-color line-art icons for entities Calcite/Font Awesome have no good
// glyph for (checked both - neither has a plain "road" or "train tracks" symbol). stroke
// uses currentColor so they tint the same way a calcite-icon would (e.g. .secondary-nav-tab.active).
const SUBMENU_SVG_ICONS = {
  'road-stripe': '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="4" y1="1" x2="1" y2="15"/><line x1="12" y1="1" x2="15" y2="15"/><line x1="8" y1="1" x2="8" y2="15" stroke-dasharray="1 3.2"/></svg>',
  'rail-ties': '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="4.2" y1="4" x2="11.8" y2="4"/><line x1="3.7" y1="7" x2="12.3" y2="7"/><line x1="3.2" y1="10" x2="12.8" y2="10"/><line x1="2.6" y1="13" x2="13.4" y2="13"/><line x1="6.2" y1="1" x2="3.8" y2="15"/><line x1="9.8" y1="1" x2="12.2" y2="15"/></svg>'
};

function buildVizLayoutForView(template, templateSettings, modelEntity) {
  if (template == 'vizMap') {
    return new VizMap(templateSettings, modelEntity.submenuText, modelEntity);
  } else if (template == 'vizTrends') {
    return new VizTrends(templateSettings, modelEntity);
  } else if (template == 'vizMatrix') {
    return new VizMatrix(templateSettings, modelEntity);
  } else if (template == 'vizDashboard') {
    return new VizDashboard(templateSettings, modelEntity);
  }
  return null;
}

class ModelEntity {
  constructor(data, menuItem) {
    console.log('modelentity-construct:' + data.submenuText)
    this.id = menuItem.id + '-' + this.generateIdFromText(data.submenuText) + '-modelentity'; // use provided id or generate one if not provided
    this.submenuText = data.submenuText;
    this.submenuIconStart = data.submenuIconStart;
    this.menuItem = menuItem;
    this.textFile = data.textFile;
    this.pngFile = data.pngFile;

    // A modelEntity normally shows exactly one template (the legacy data.template/
    // templateSettings shape, still supported directly below). Some entities instead define a
    // "views" array - several templates sharing this one nav row, switched between via a small
    // toggle (see populateViewToggle()) instead of each getting its own separate row. Both
    // shapes normalize to the same this.views array so nothing past this constructor needs to
    // know which one a given entity's config used.
    const viewConfigs = data.views || [{ template: data.template, templateSettings: data.templateSettings, viewLabel: data.viewLabel }];
    this.views = viewConfigs.map(v => ({
      template: v.template,
      viewLabel: v.viewLabel || this.defaultViewLabelForTemplate(v.template),
      vizLayout: buildVizLayoutForView(v.template, v.templateSettings, this)
    }));
    this.activeViewIndex = 0;
  }

  defaultViewLabelForTemplate(template) {
    switch (template) {
      case 'vizMap': return 'Map';
      case 'vizTrends': return 'Trends';
      case 'vizMatrix': return 'Matrix';
      case 'vizDashboard': return 'Dashboard';
      default: return template;
    }
  }

  // Delegate to whichever view is currently active, so every pre-existing call site that reads
  // modelEntity.template/.vizLayout (both inside this file and elsewhere - app.js, url-state.js,
  // scenario.js) keeps working unchanged for single-view entities, and reflects "whatever's
  // currently showing" for multi-view ones.
  get template() {
    return this.views[this.activeViewIndex]?.template;
  }

  get vizLayout() {
    return this.views[this.activeViewIndex]?.vizLayout;
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Only show this item if every view has no data-driven layout, or at least one view's
  // scenario data is available - a multi-view entity shouldn't disappear just because one of
  // its views (e.g. the Trends side) is missing data for the current scenario.
  hasAvailableData() {
    return this.views.some((_, i) => this.hasViewAvailableData(i));
  }

  hasViewAvailableData(viewIndex) {
    const view = this.views[viewIndex];
    if (!view || !view.vizLayout || !view.vizLayout.jsonName) {
      return true;
    }
    return !!getFirstScenarioWithTrendData(view.vizLayout.jsonName);
  }

  // The view index to actually land on when entering this entity (tab click or menu
  // navigation) - the page-global preferredViewTemplate (app.js) if this entity has a matching
  // view with data, otherwise this entity's own last-active view (this.activeViewIndex,
  // defaulting to 0). Not used by switchView() itself, which always honors the exact view the
  // toggle was clicked for.
  preferredOrDefaultViewIndex() {
    if (preferredViewTemplate) {
      const idx = this.views.findIndex(v => v.template === preferredViewTemplate);
      if (idx !== -1 && this.hasViewAvailableData(idx)) return idx;
    }
    return this.activeViewIndex;
  }

  // Builds (once) and repopulates the shared Map/Trends/... toggle - a calcite-segmented-control
  // with one item per view, hidden entirely for the common single-view entity. Reusing one
  // shared control (rather than one per entity) matches how vizTrends' own mode/series/year
  // selectors are already page-global singletons rewired per render (see viztrends.js). Lives at
  // the top of whichever view's own sidebar is currently showing (see the
  // #vizMapViewToggleSlot/#vizTrendsViewToggleSlot/#vizMatrixViewToggleSlot markup in
  // app/templates/*.html) rather than inside the nav-bar tab itself - each view's own template
  // is the only one visible at a time (_activateView() below hides the rest), so its slot is
  // naturally the only one showing the toggle too.
  populateViewToggle() {
    let toggle = document.getElementById('entityViewToggle');
    if (!toggle) {
      toggle = document.createElement('calcite-segmented-control');
      toggle.id = 'entityViewToggle';
      toggle.setAttribute('scale', 's');
      toggle.setAttribute('width', 'full'); // stretch to fill .sidebar-view-toggle-slot's own full-column width, each item splitting it evenly
      toggle.addEventListener('calciteSegmentedControlChange', () => {
        const viewIndex = parseInt(toggle.value, 10);
        if (!Number.isNaN(viewIndex) && activeModelEntity && typeof activeModelEntity.switchView === 'function') {
          activeModelEntity.switchView(viewIndex);
        }
      });
    }

    const showToggle = this.views.length > 1;
    const activeView = this.views[this.activeViewIndex];
    const activeSlot = activeView && document.getElementById(activeView.template + 'ViewToggleSlot');
    // Every OTHER view's slot must be cleared/hidden too - otherwise a slot that held the toggle
    // before a view switch would keep showing hidden:false with no toggle inside it (the toggle
    // itself just moved to the new active slot via appendChild below).
    document.querySelectorAll('.sidebar-view-toggle-slot').forEach(slot => {
      if (slot !== activeSlot) slot.hidden = true;
    });

    if (activeSlot) {
      activeSlot.hidden = !showToggle;
      if (showToggle) activeSlot.appendChild(toggle); // appendChild moves an existing node - safe every render
    }

    toggle.hidden = !showToggle;
    toggle.style.display = showToggle ? '' : 'none';
    if (!showToggle) return;

    toggle.innerHTML = '';
    this.views.forEach((view, index) => {
      const item = document.createElement('calcite-segmented-control-item');
      item.scale = 's'; // doesn't reliably inherit from the parent control's own scale="s"
      item.value = String(index);
      item.textContent = view.viewLabel;
      item.title = view.viewLabel;
      if (index === this.activeViewIndex) item.checked = true;
      if (!this.hasViewAvailableData(index)) item.setAttribute('disabled', true);
      toggle.appendChild(item);
    });
  }

  createModelEntityElement() {
    console.log('model-entity:createModelEntityElement');
    const modelEntity = document.createElement('button');
    modelEntity.type = 'button';
    modelEntity.id = this.id;
    modelEntity.className = 'secondary-nav-tab';
    modelEntity.dataset.text = this.submenuText; // BETA-badge CSS hook, see styles.css
    modelEntity.dataset.entityId = this.id;      // how _activateView() finds "the active tab"

    let icon;
    if (SUBMENU_SVG_ICONS[this.submenuIconStart]) {
      icon = document.createElement('span');
      icon.className = 'secondary-nav-tab-svg-icon';
      icon.innerHTML = SUBMENU_SVG_ICONS[this.submenuIconStart];
    } else {
      icon = document.createElement('calcite-icon');
      icon.icon = this.submenuIconStart;
      icon.scale = 's';
    }
    modelEntity.appendChild(icon);
    modelEntity.appendChild(document.createTextNode(this.submenuText));

    const modelEntityInstance = this;

    modelEntity.addEventListener('click', async function() {
      await modelEntityInstance._activateView(modelEntityInstance.preferredOrDefaultViewIndex());
    });
    return modelEntity;
  }


  // Function to create and populate the table
  displayJSONData() {
    const jsonData = {
      "data": [
        [0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123],
        [0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456],
        [0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789],
        [0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321],
        [0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654],
        [0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987],
        [0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135],
        [0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468],
        [0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791],
        [0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123],
        [0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456],
        [0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789],
        [0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321],
        [0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654],
        [0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987],
        [0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135],
        [0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468],
        [0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791],
        [0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123]
      ]
    }

    const table = document.getElementById('matrixTable');
    table.innerHTML = '';
    
    // Create the header row for columns on row 1
    const headerRow = table.insertRow(0); // Insert at row 0
    headerRow.classList.add('header-row');

    // Create an empty cell for the row header column
    headerRow.insertCell();

    // Loop to create column headers with numbers
    for (let col = 0; col < jsonData.data[0].length; col++) {
        const headerCell = headerRow.insertCell();
        headerCell.textContent = `j ${col + 1}`; // Column numbers start from 1
    }

    // Loop through the rows and columns of the JSON data
    for (let rowIndex = 0; rowIndex < jsonData.data.length; rowIndex++) {
        const row = jsonData.data[rowIndex];
        const newRow = table.insertRow();

        // Create the cell in the first column for the row header
        const rowHeaderCell = newRow.insertCell();
        rowHeaderCell.textContent = `i ${rowIndex + 1}`; // Row numbers start from 1
        rowHeaderCell.classList.add('row-header'); // Apply the row header style

        // Loop through the data cells for this row, starting from the second column
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const newCell = newRow.insertCell();
            newCell.textContent = row[colIndex].toFixed(3); // Format the number to show 3 decimal places
        }
    }
  }

  hideLayoutLayers() {
    // Every view's layout, not just the active one - a multi-view entity's inactive view (e.g.
    // its Map side, while the user's been sitting on Trends) can still hold live Esri layers
    // that need clearing when navigating away, same as the active one always did.
    this.views.forEach(view => {
      if (view.vizLayout && typeof view.vizLayout.hideLayers === 'function') {
        view.vizLayout.hideLayers();
      }
    });
  }

  // Shared by createModelEntityElement()'s click handler, loadModelEntity() (menu-level
  // navigation, both landing on whichever view was last active for this entity) and
  // switchView() (the Map/Trends toggle, landing on a specific view instead).
  async _activateView(viewIndex) {
    this.activeViewIndex = viewIndex;
    const view = this.views[viewIndex];

    // Primary bar only now (calcite-menu-item) - secondary tabs are plain buttons, handled below.
    let mainSidebarItems = document.querySelectorAll('calcite-menu-item');
    mainSidebarItems.forEach(item => {
      if (item.text === this.menuItem.menuText) {  // Use the saved instance context here
        item.active = true;
        item.classList.add('menu-item-selected');
      } else {
        item.active = false;
        item.classList.remove('menu-item-selected');
      }
    });
    document.querySelectorAll('.secondary-nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.entityId === this.id);
    });

    // Show corresponding template
    const allTemplates = document.querySelectorAll('.template');
    allTemplates.forEach(template => template.hidden = true);

    // Show the selected template
    const selectedTemplate = document.getElementById(view.template + 'Template');
    if (selectedTemplate) {
      selectedTemplate.hidden = false;
      // ... (Any additional specific logic for the template type)
    }

    // set app global model entity to keep track of what is actively being used
    activeModelEntity = this;
    this.menuItem.lastSelectedModelEntityText = this.submenuText;

    // Keeps the small "where am I" bar (app.js's setupHeaderCollapse()) in sync - only
    // visible while the header itself is collapsed, but updated on every navigation
    // regardless, so it's already correct the moment someone does collapse it.
    if (typeof updateHeaderLocationBar === 'function') updateHeaderLocationBar();

    this.populateViewToggle();

    this.menuItem.hideAllLayoutLayers()

    activeLayout = view.vizLayout;

    if (activeLayout) {
      await ensureMainScenarioDataLoaded(activeLayout);

      activeLayout.renderSidebar?.();  // Use the saved instance context here as well
      activeLayout.updateScenarioSelector?.();  // Must run before updateDisplay() - it initializes seriesSelect etc.
      activeLayout.updateDisplay?.();
    }
  }

  async loadModelEntity() {
    await this._activateView(this.preferredOrDefaultViewIndex());
  }

  // Map/Trends (etc) toggle - switches which view is active within this same nav row, without
  // touching the menu/menuItem selection at all. Also records the chosen template as the
  // page-global preference (app.js's preferredViewTemplate), so every other multi-view entity
  // lands on the same kind of view (if it has one) when next entered.
  async switchView(viewIndex) {
    if (viewIndex === this.activeViewIndex || !this.views[viewIndex]) return;
    this.carryOverFilterSelections(this.activeViewIndex, viewIndex);
    preferredViewTemplate = this.views[viewIndex].template;
    await this._activateView(viewIndex);
  }

  // A filter the user already set on the view they're leaving (e.g. "Time of Day: AM" on Map)
  // should still read that way after toggling to Trends, for every filter code the two views
  // happen to share - rather than each view's sidebar silently keeping its own independent,
  // construction-time default for what's really the same real-world filter. Also carries over
  // whether its card was expanded or collapsed, same reasoning. Must run before
  // _activateView() renders the target view's sidebar (restoreFilterSelection, url-state.js,
  // seeds the widget instance's own .selected/.comboSelected, which render() then reads from -
  // same mechanism url-state.js's own restore-from-URL uses; .collapsed is read directly by
  // filter.js's render() - see there).
  carryOverFilterSelections(fromViewIndex, toViewIndex) {
    const fromSidebar = this.views[fromViewIndex]?.vizLayout?.sidebar;
    const toSidebar = this.views[toViewIndex]?.vizLayout?.sidebar;
    if (!fromSidebar || !toSidebar || typeof restoreFilterSelection !== 'function') return;

    (toSidebar.filters || []).forEach(toFilter => {
      if (!toFilter.fCode) return;
      const fromFilter = (fromSidebar.filters || []).find(f => f.fCode === toFilter.fCode);
      if (!fromFilter || fromFilter === toFilter) return;

      if (fromFilter.filterWij && toFilter.filterWij && fromFilter.filterWij.collapsed !== undefined) {
        toFilter.filterWij.collapsed = fromFilter.filterWij.collapsed;
      }

      const selected = fromFilter.getSelectedOptionsAsList();
      if (!selected || !selected.length) return; // nothing chosen yet on the view being left - keep toFilter's own default

      restoreFilterSelection(toFilter, selected.join(','));
    });
  }

}
