class Card {
  constructor(cardId, parentEl, vizLayout) {
    this.cardId = cardId;
    this.parentEl = parentEl; // might be null at first
    this.vizLayout = vizLayout;
    const cfg = configCards[cardId] || {};
    this.title = cfg.title || cardId;
    this.type = cfg.type || null; // e.g. "pictogram" - anything else renders the default measure-row list
    this.fullWidth = !!cfg.fullWidth; // break out of the dashboard's multi-column masonry (see styles.css .card--full-width)
    this.measures = (cfg.measures || []).map(mId => new Measure(mId, this));
    console.log(`Initialized card ${this.cardId} with measures:`, this.measures);
  }

  render() {
    const el = document.createElement('div');
    el.className = 'card';
    if (this.fullWidth) el.classList.add('card--full-width');

    const header = document.createElement('div');
    header.className = 'card-header';
    header.textContent = this.title;

    const body = document.createElement('div');
    body.className = 'card-body';

    if (this.type === 'pictogram') {
      body.appendChild(this.renderPictogram());
    } else {
      // Render each measure row
      this.measures.forEach(m => body.appendChild(m.renderMeasure()));
    }

    el.append(header, body);

    return el;
  }

  // Renders this card's measures as a 100-icon waffle/isotype grid - each whole icon worth 1% of
  // the total across all of them - instead of a proportional stacked bar. Trips by mode here can
  // be extremely lopsided (region-wide, auto dwarfs transit), so a stacked bar would render as
  // one solid block with an unreadable sliver at the end; discrete icons stay honest about the
  // real scale instead.
  //
  // Compare mode (comparisonScenarioDash panel open + a resolved comp scenario - the same test
  // computeValues()/renderMeasure() already use) renders two full grids, Before/After, each using
  // that scenario's own total for its own largest-remainder rounding (a mode's share of a shrinking
  // total isn't the same number as its share of a growing one, so the two grids can't share one
  // rounding pass) - and the legend's difference line respects the same compare-type toggle
  // (#selectCompareTypeDash) the row-based cards already read, rather than inventing its own format.
  renderPictogram() {
    const wrap = document.createElement('div');
    wrap.className = 'pictogram-wrap';

    const results = this.measures.map(measure => {
      const { mainScenario, compareMode, compareType, valueMain, valueComp } = measure.computeValues();
      return {
        measure,
        mainScenario,
        compareMode,
        compareType,
        valueMain: Number(valueMain) || 0,
        valueComp: Number(valueComp) || 0
      };
    });

    const mainScenario = results.find(r => r.mainScenario)?.mainScenario;
    const totalMain = results.reduce((sum, r) => sum + r.valueMain, 0);

    if (!mainScenario || totalMain <= 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'pictogram-empty';
      emptyEl.textContent = '–';
      wrap.appendChild(emptyEl);
      return wrap;
    }

    const isComparing = results.some(r => r.compareMode === 'compare');
    const totalComp = results.reduce((sum, r) => sum + r.valueComp, 0);

    const makeWholeCell = r => {
      const cell = document.createElement('div');
      cell.className = 'pictogram-cell';
      cell.title = r.measure.pictogramLabel || r.measure.toLabel(r.measure.measureId);

      if (r.measure.faIcon) {
        const icon = document.createElement('i');
        const classes = r.measure.faIcon.trim().split(/\s+/);
        if (!classes.some(c => /^fa-(solid|regular|brands)$/.test(c))) classes.unshift('fa-solid');
        icon.classList.add(...classes);
        icon.style.color = r.measure.pictogramColor || r.measure.iconColor || '#888888';
        cell.appendChild(icon);
      }
      return cell;
    };

    // Largest-remainder rounding: floor each mode's own share (of THIS grid's own total - main or
    // comp, never mixed) to a whole icon, then hand out the few icons that flooring drops (always
    // a whole number: 100 - sum of the floors) to whichever modes had the largest fractional
    // remainder, one icon each. Rounding each mode independently (plain Math.round, or any other
    // per-mode rule - banker's rounding included) can't guarantee the total comes out to exactly
    // 100, since nothing coordinates the rounding across modes; this does, by construction. A mode
    // whose floor AND remainder-share are both small still simply doesn't get an icon - no
    // special-casing needed for "too small to show".
    const buildGrid = (valueKey, total) => {
      const grid = document.createElement('div');
      grid.className = 'pictogram-grid';
      if (total <= 0) return grid;

      const nonZeroIdx = [];
      results.forEach((r, i) => { if (r[valueKey] > 0) nonZeroIdx.push(i); });

      const pcts = nonZeroIdx.map(i => (results[i][valueKey] / total) * 100);
      const floors = pcts.map(p => Math.floor(p));
      const leftover = 100 - floors.reduce((a, b) => a + b, 0);
      const byRemainder = nonZeroIdx
        .map((_, k) => ({ k, frac: pcts[k] - floors[k] }))
        .sort((a, b) => b.frac - a.frac);
      const counts = [...floors];
      for (let n = 0; n < leftover && byRemainder.length; n++) counts[byRemainder[n % byRemainder.length].k]++;

      results.forEach((r, i) => {
        const pos = nonZeroIdx.indexOf(i);
        if (pos === -1) return; // valueMain/valueComp === 0 → no icon for this mode in this grid
        for (let n = 0; n < counts[pos]; n++) grid.appendChild(makeWholeCell(r));
      });

      return grid;
    };

    if (isComparing && totalComp > 0) {
      const beforeLabel = document.createElement('div');
      beforeLabel.className = 'pictogram-scenario-label';
      beforeLabel.textContent = 'Before';
      wrap.append(beforeLabel, buildGrid('valueComp', totalComp));

      const afterLabel = document.createElement('div');
      afterLabel.className = 'pictogram-scenario-label';
      afterLabel.textContent = 'After';
      wrap.append(afterLabel, buildGrid('valueMain', totalMain));
    } else {
      wrap.appendChild(buildGrid('valueMain', totalMain));
    }

    const legend = document.createElement('div');
    legend.className = 'pictogram-legend';

    results.forEach(r => {
      const label = r.measure.pictogramLabel || r.measure.toLabel(r.measure.measureId);
      const color = r.measure.pictogramColor || r.measure.iconColor || '#888888';

      const item = document.createElement('div');
      item.className = 'pictogram-legend-item';

      const swatch = document.createElement('span');
      swatch.className = 'pictogram-legend-swatch';
      swatch.style.backgroundColor = color;

      const text = document.createElement('span');

      if (isComparing) {
        // For a split like this, how a mode's SHARE of the total moved (in percentage points) is
        // the thing worth leading with - a raw trip-count change can grow or shrink just because
        // the total did, without the split itself having moved at all. So this leads with the
        // share swing (independent of the diff/pctdiff toggle the row-based cards use for their
        // own raw-value comparisons - a percentage-point swing isn't ambiguous between those two
        // the way a raw value's own change is), and keeps the raw counts as trailing context.
        const shareComp = totalComp > 0 ? (r.valueComp / totalComp) * 100 : 0;
        const shareMain = totalMain > 0 ? (r.valueMain / totalMain) * 100 : 0;
        const ppDiff = shareMain - shareComp;
        const ppSign = ppDiff > 0 ? '+' : (ppDiff < 0 ? '−' : '');
        const ppText = `${ppSign}${Math.abs(ppDiff).toFixed(1)}pp`;
        text.textContent = `${label}: ${shareComp.toFixed(1)}% → ${shareMain.toFixed(1)}% (Δ ${ppText}) — ${r.measure.formatNumber(r.valueComp)} → ${r.measure.formatNumber(r.valueMain)}`;
      } else {
        const share = r.valueMain / totalMain;
        text.textContent = `${label}: ${r.measure.formatNumber(r.valueMain)} (${(share * 100).toFixed(1)}%)`;
      }

      item.append(swatch, text);
      legend.appendChild(item);
    });

    wrap.appendChild(legend);
    return wrap;
  }
}
