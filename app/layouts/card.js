class Card {
  constructor(cardId, parentEl, vizLayout) {
    this.cardId = cardId;
    this.parentEl = parentEl; // might be null at first
    this.vizLayout = vizLayout;
    const cfg = configCards[cardId] || {};
    this.title = cfg.title || cardId;
    this.measures = (cfg.measures || []).map(mId => new Measure(mId, this));
    console.log(`Initialized card ${this.cardId} with measures:`, this.measures);
  }

  render() {
    const el = document.createElement('div');
    el.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.textContent = this.title;

    const body = document.createElement('div');
    body.className = 'card-body';

    // Render each measure row
    this.measures.forEach(m => body.appendChild(m.renderMeasure()));

    el.append(header, body);

    return el;
  }
}
