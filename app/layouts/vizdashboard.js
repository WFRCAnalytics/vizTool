// --- Dashboard ---
class VizDashboard {
  constructor(data, modelEntity) {
    console.log('vizdashboard:construct');
    this.data = data;
    this.modelEntity = modelEntity;

    // Reference to the container div in your HTML
    this.divDashboard = document.getElementById("dashboardContent");

    // Create card objects (store them so we can render later)
    this.cards = (data.cards || []).map(cardData => {
      const cardId = typeof cardData === 'string' ? cardData : cardData.cardId;
      return new Card(cardId, null); // parent will be attached in render()
    });
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
}
