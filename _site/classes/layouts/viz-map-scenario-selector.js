class VizMapScenarioSelector {
  constructor(vizMap) {
    this.vizMap = vizMap;
  }

  initListeners() {
    document.getElementById('vizMapLabelToggle').addEventListener('change', (event) => {  // Arrow function here
      this.toggleLabels(); // Replace with the actual function or code to show labels
    });
  }

  getScenario(_modVersion, _scnGroup, _scnYear) {
    return dataScenarios.find(scenario =>
      scenario.modVersion === _modVersion &&
      scenario.scnGroup   === _scnGroup   &&
      scenario.scnYear    === _scnYear
    ) || null;
  }

  getMain() {
    return this.getScenario(         document.getElementById('selectModMain' ).value,
                                     document.getElementById('selectGrpMain' ).value,
                            parseInt(document.getElementById('selectYearMain').value, 10)); // Assuming it's a number
  }

  getComp() {
    return this.getScenario(         document.getElementById('selectModComp' ).value,
                                     document.getElementById('selectGrpComp' ).value,
                            parseInt(document.getElementById('selectYearComp').value, 10)); // Assuming it's a number
  }



  // check if comparison scenario is in process of being defined... i.e. some values are not 'none'
  isScenarioCompIncomplete() {
    if (this.getComp() === null) {
      if ((document.getElementById('selectModComp' ).value !== "none" ||
           document.getElementById('selectGrpComp' ).value !== "none" ||
           document.getElementById('selectYearComp').value !== "none" )) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}
