class VizMapScenarioSelector {
  constructor() {

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

  getDataMain() {
    console.log('dataMain');
    if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
      return this.getMain().roadwaySegData.data[this.getFilter()]
    } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
      return this.getMain().zoneModeData.data[this.getFilter()]
    } else if (this.attributeTitle=="Transit Segment Attribute") {          // for transit
      //return this.scenarioMain().transitSegData.data[this.getFilter()]

      // loop through attributes and get every single combination...
      
      // for each filter, add all options to list of options
      const listOfOptions = this.filters.map(filter => filter.getSelectedOptionsAsList());

      // Initialize an object to hold the aggregated sums
      let aggregatedSums = {};

      const _parent = this;

      // Modified sumFields function to handle the summing of specific attributes for each key
      function sumFields(data) {
        Object.keys(data).forEach(key => {
          if (!aggregatedSums[key]) {
            aggregatedSums[key] = {};
          }

          _parent.attributes.forEach(attr => {
            if (data[key].hasOwnProperty(attr.aCode)) {
              if (!aggregatedSums[key][attr.aCode]) {
                aggregatedSums[key][attr.aCode] = 0;
              }
              aggregatedSums[key][attr.aCode] += data[key][attr.aCode];
            }
          });
        });
      }

      // Loop through each combination of filters
      this.findAllCombinationsOfFilters(listOfOptions).forEach(function(combo) {
        let data = _parent.getMain().transitSegData.data[combo];

        // Sum the fields in the data object
        if (data) {
          sumFields(data);
        }
      });

      return aggregatedSums;
    }
  }

  getDataComp() {
    console.log('dataComp');
    if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
      return this.getComp().roadwaySegData.data[this.getFilter()]
    } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
      return this.getComp().zoneModeData.data[this.getFilter()]
    }  else if (this.attributeTitle=="Transit Segment Attribute") {          // for transit
      //return this.scenarioMain().transitSegData.data[this.getFilter()]

      // loop through attributes and get every single combination...
      
      // for each filter, add all options to list of options
      const listOfOptions = this.filters.map(filter => filter.getSelectedOptionsAsList());

      // Initialize an object to hold the aggregated sums
      let aggregatedSums = {};

      const _parent = this;

      // Modified sumFields function to handle the summing of specific attributes for each key
      function sumFields(data) {
        Object.keys(data).forEach(key => {
          if (!aggregatedSums[key]) {
            aggregatedSums[key] = {};
          }

          _parent.attributes.forEach(attr => {
            if (data[key].hasOwnProperty(attr.aCode)) {
              if (!aggregatedSums[key][attr.aCode]) {
                aggregatedSums[key][attr.aCode] = 0;
              }
              aggregatedSums[key][attr.aCode] += data[key][attr.aCode];
            }
          });
        });
      }

      // Loop through each combination of filters
      this.findAllCombinationsOfFilters(listOfOptions).forEach(function(combo) {
        let data = _parent.getComp().transitSegData.data[combo];

        // Sum the fields in the data object
        if (data) {
          sumFields(data);
        }
      });

      return aggregatedSums;
    }
  }

  // check if comparison scenario is in process of being defined... i.e. some values are not 'none'
  checkIncompleteScenarioComp() {
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
