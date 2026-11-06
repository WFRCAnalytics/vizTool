// --- Dashboard ---
class VizDashboard {
  constructor(data, modelEntity) {
    console.log('vizdashboard:construct');
    this.id = modelEntity.id + '-' + this.generateIdFromText(modelEntity.submenuText); // use provided id or generate one if not provided
    this.data = data;
    this.modelEntity = modelEntity;

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
                                  data.attributeInfoTextHtml,
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

  // Renders the cards into the dashboardContent div
  updateDisplay() {
    
    // Clear existing content
    this.divDashboard.innerHTML = '';

    // Create a wrapper div for layout
    const wrapper = document.createElement('div');
    wrapper.className = 'dashboard';

    // Render each card and append to wrapper
    this.cards.forEach(card => {
      const cardEl = card.render(); // Card.render() returns its DOM element
      wrapper.appendChild(cardEl);
    });

    // Finally, attach wrapper to the dashboardContent div
    this.divDashboard.appendChild(wrapper);
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
