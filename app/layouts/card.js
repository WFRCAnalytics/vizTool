class Card {
  constructor(cardId, parentEl) {
    this.cardId = cardId;
    this.parentEl = parentEl; // might be null at first
    const cfg = configCards[cardId] || {};
    this.title = cfg.title || cardId;
    this.measures = (cfg.cardMeasures || []).map(mId => new Measure(mId, this));
  }

  render() {
    const el = document.createElement('div');
    el.className = 'card';

    const titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = this.title;

    const bodyEl = document.createElement('div');
    this.measures.forEach(m => bodyEl.appendChild(m.renderMeasure()));

    el.append(titleEl, bodyEl);
    this.el = el;

    // Only append if parentEl was given
    if (this.parentEl) this.parentEl.appendChild(el);

    return el; // so VizDashboard can append it itself
  }
}
