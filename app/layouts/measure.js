class Measure {
    constructor(measureId, parent) {
      console.log('measure:construct:' + measureId);

      // find measure in configMeasures and get its settings
      const _configMeasure = configMeasures[measureId];
      this.measureId = measureId;
      this.cmIcon = _configMeasure.cmIcon;

    }

    renderMeasure() {
      const row = document.createElement('div');
      row.className = 'measure-row';

      const icon = document.createElement('calcite-icon');
      icon.icon = this.cmIcon;     // <- use measure’s configured icon
      icon.scale = 'm';

      const text = document.createElement('span');
      text.textContent = this.label;

      row.append(icon, text);
      return row;
    }
  
}