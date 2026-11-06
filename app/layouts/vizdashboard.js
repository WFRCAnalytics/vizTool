// --- Dashboard ---
class VizDashboard {
  constructor(data, modelEntity) {
    console.log('vizdashboard:construct');
    this.id = modelEntity.id + '-' + this.generateIdFromText(modelEntity.submenuText); // use provided id or generate one if not provided
    this.data = data;
    this.modelEntity = modelEntity;
    this.title = modelEntity.submenuText;

    // Reference to the container div in your HTML
    this.divDashboard = document.getElementById("dashboardContent");

    // Create card objects (store them so we can render later)
    this.cards = (data.cards || []).map(cardData => {
      const cardId = typeof cardData === 'string' ? cardData : cardData.cardId;
      return new Card(cardId, this, this);
    });
    
    this.geos = [];
    
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

  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Unlike vizMap/vizTrends/vizMatrix (each backed by one this.jsonName, loaded lazily from
  // within their own updateDisplay()), a dashboard fans out across many jsonNames - one per
  // measure across every card. Collect them all so they can be loaded up front.
  getNeededJsonNames() {
    const names = new Set();
    this.cards.forEach(card => {
      card.measures.forEach(m => {
        if (m.jsonName) names.add(m.jsonName);
        if (m.divideJsonName) names.add(m.divideJsonName);
      });
    });
    return Array.from(names);
  }

  // A comparison is "active" only once the Compare panel is open AND a comp scenario is
  // actually resolved - same rule measure.js uses per-measure (see its compareMode there),
  // so the header's "compared to" text always agrees with what the cards themselves show.
  isCompareActive() {
    const comparePanel = document.getElementById('comparisonScenarioDash');
    return !!(comparePanel && comparePanel.open && resolveScenario(selectedScenario_Comp));
  }

  getMainScenarioDisplayName() {
    const _scenario = resolveScenario(selectedScenario_Main);
    if (!_scenario) return '';
    return _scenario.alias || (_scenario.modVersion + ' ' + _scenario.scnGroup + ' ' + _scenario.scnYear);
  }

  getCompScenarioDisplayName() {
    const _scenario = resolveScenario(selectedScenario_Comp);
    if (!_scenario) return '';
    return _scenario.alias || (_scenario.modVersion + ' ' + _scenario.scnGroup + ' ' + _scenario.scnYear);
  }

  // Title (this.title, from the model entity's own submenuText) stays fixed; everything under
  // it is dynamic - which scenario is being shown, what it's compared to, and which summary
  // geography options are selected.
  updateHeader() {
    const headerDiv = document.getElementById('dashboardHeader');
    if (!headerDiv) return;

    let subtitle = this.getMainScenarioDisplayName();
    if (this.isCompareActive()) {
      subtitle += ' compared to ' + this.getCompScenarioDisplayName();
    }

    const geoText = this.sidebar.getSelectedAggregatorFilterText();

    // Performance Measures is still being tuned (measure definitions, calculations, etc.) -
    // flagged so anyone looking at it knows not to treat the numbers as final yet. Scoped to
    // this one entity rather than every vizDashboard page, in case a finished one is added
    // later.
    const underDevBadge = this.title === 'Performance Measures'
      ? '<span class="dashboard-under-dev-badge" title="Measure definitions and calculations are still being finalized.">Under Development</span>'
      : '';

    headerDiv.innerHTML = '<h1>' + this.title + underDevBadge + '</h1>' +
                          '<div class="dashboard-subtitle">' + subtitle + '</div>' +
                          (geoText ? '<div class="dashboard-subtitle-geo">' + geoText + '</div>' : '');
  }

  async ensureCardDataLoaded() {
    const mainScenario = resolveScenario(selectedScenario_Main);
    const compScenario = resolveScenario(selectedScenario_Comp);
    const compareActive = this.isCompareActive();

    const jsonNames = this.getNeededJsonNames();

    showDataLoadingIndicator();
    try {
      await Promise.all(jsonNames.flatMap(jsonName => {
        const loads = [mainScenario ? mainScenario.ensureDataLoaded(jsonName) : Promise.resolve()];
        if (compareActive) loads.push(compScenario.ensureDataLoaded(jsonName));
        return loads;
      }));
    } finally {
      hideDataLoadingIndicator();
    }
  }

  // Renders the header and cards into the dashboardContent div
  async updateDisplay() {
    if (typeof syncUrlState === 'function') syncUrlState();

    await this.ensureCardDataLoaded();

    this.updateHeader();

    // Clear and rebuild just the card grid - dashboardHeader (updated above) is a sibling
    // that has to survive this, not get wiped along with the cards each render.
    let wrapper = this.divDashboard.querySelector('.dashboard');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'dashboard';
      this.divDashboard.appendChild(wrapper);
    }
    wrapper.innerHTML = '';

    // Render each card and append to wrapper
    this.cards.forEach(card => {
      const cardEl = card.render(); // Card.render() returns its DOM element
      wrapper.appendChild(cardEl);
    });
  }

  renderSidebar() {
    this.sidebar.render();
  }
  
  afterUpdateSidebar() {
    console.log('vizdashboard:afterUpdateSidebar');
    this.updateDisplay();
  }

  afterUpdateAggregator() {
    console.log('vizdashboard:afterUpdateAggregator:' + this.id);
    this.sidebar.render();
    this.afterUpdateSidebar();
  }

  getSelectedAggregator() {
    let aggr = null;

    if (this.sidebar && typeof this.sidebar.getSelectedAggregator === "function") {
      aggr = this.sidebar.getSelectedAggregator();
    } else {
      console.warn("getSelectedAggregator does NOT exist on sidebar");
    }
    return aggr;
  }
}
