// --- Dashboard ---
class VizDashboard {
  constructor(data, modelEntity) {
    console.log('vizdashboard:construct');
    this.id = modelEntity.id + '-' + this.generateIdFromText(modelEntity.submenuText); // use provided id or generate one if not provided
    this.data = data;
    this.modelEntity = modelEntity;
    this.templateType = 'vizDashboard';
    this.title = modelEntity.submenuText;
    // Optional, config-driven (templateSettings.disclaimerText) - a methodology caveat that
    // applies to the whole dashboard rather than any one card/measure (e.g. "VMT here is
    // facility-based"). Unlike vizMap/vizTrends' own per-jsonName disclaimer (disclaimers.js,
    // shown in their Definitions popup), a dashboard fans out across many jsonNames at once
    // (getNeededJsonNames() below) with no single Definitions popup of its own, so this is a
    // plain opt-in string instead of being derived from jsonName.
    this.disclaimerText = data.disclaimerText || null;

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
    const compareHintDiv = document.getElementById('dashboardCompareHint');
    if (!headerDiv) return;

    let subtitle = this.getMainScenarioDisplayName();
    const _compareActive = this.isCompareActive();
    if (_compareActive) {
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

    // Lives below #dashboardHeader's own border-bottom (vizdashboard.html's #dashboardCompareHint,
    // a sibling, not nested inside the header) rather than inside its bordered box, same
    // "underneath the title area, not squeezed into it" placement vizMap's own hint uses (just
    // under its floating scenario-name label there instead of a page title here). Same red/Main-
    // higher, blue/Main-lower convention each card's own arrow/value coloring uses (measure.js) -
    // hardcoded to the exact same hsl() hues used there (not read off a renderer the way vizMap's
    // equivalent hint is, since there's no Esri renderer here to read colors from) rather than
    // guessed to match.
    if (compareHintDiv) {
      compareHintDiv.innerHTML = _compareActive
        ? '<div class="dashboard-compare-hint">' +
          this.getMainScenarioDisplayName() + ' is ' +
          '<span style="color:hsl(0, 70%, 50%); font-weight:bold;">higher</span> / ' +
          '<span style="color:hsl(215, 70%, 50%); font-weight:bold;">lower</span>' +
          ' than ' + this.getCompScenarioDisplayName() +
          '</div>'
        : '';
    }
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

    // Config-driven methodology caveat (templateSettings.disclaimerText) - rendered once below
    // every card rather than up in the header, so it reads as a footnote on the numbers above it
    // instead of a warning before anyone's looked at them. Kept as its own sibling (not rebuilt
    // along with wrapper's innerHTML above) purely so re-renders don't recreate the element for
    // no reason; its content still gets refreshed every time in case disclaimerText ever becomes
    // scenario-dependent.
    if (this.disclaimerText) {
      let footerDiv = this.divDashboard.querySelector('.dashboard-disclaimer-footer');
      if (!footerDiv) {
        footerDiv = document.createElement('div');
        footerDiv.className = 'dashboard-disclaimer-footer';
        this.divDashboard.appendChild(footerDiv);
      }
      footerDiv.innerHTML = '<div class="vmt-disclaimer-note dashboard-disclaimer-note"><p><span class="disclaimer-important-tag">Important</span> ' + this.disclaimerText + '</p></div>';
    }
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
