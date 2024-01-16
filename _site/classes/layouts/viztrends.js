require([
  "esri/Graphic",
  "esri/layers/FeatureLayer",
  "esri/renderers/ClassBreaksRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleLineSymbol",
  "esri/Color",
  "esri/PopupTemplate",
  "esri/widgets/Legend",
  "esri/renderers/UniqueValueRenderer",
  "esri/rest/support/Query"
], function(Graphic, FeatureLayer, ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, SimpleLineSymbol, Color, PopupTemplate, Legend, UniqueValueRenderer, Query) {
  // Now you can use Graphic inside this callback function

  class VizTrends {
    constructor(data) {
      this.id = data.id || this.generateIdFromText(data.attributeTitle); // use provided id or generate one if not provided
      this.mapViewDiv = data.mapViewDiv;
      this.sidebarDiv = data.sidebarDiv;
      this.attributeTitle = data.attributeTitle;
      this.attributes = (data.attributes || []).map(item => new Attribute(item));
      this.attributeSelect = new WijRadio(this.id & "_attributeselect", data.attributes.map(item => ({
        value: item.aCode,
        label: item.aDisplayName
      })), data.attributeSelected,  data.hidden, data.attributeTitle, this);
      this.filters = (data.filters || []).map(item => new Filter(item, this));
      this.aggregators = (data.aggregators || []).map(item => new Aggregator(item));
      // Check if data.aggregator exists before initializing aggregatorSelect
      if (data.aggregators) {
        this.aggregatorSelect = new WijSelect(this.id + "_aggregator-selector", data.aggregators.map(item => ({
          value: item.agCode,
          label: item.agDisplayName
        })), data.aggregatorSelected, false, data.aggregatorTitle, this);
      };
      this.comboSelector = new WijCombobox(this.id + "_attributecombo", data.aggregators.map(item => ({
        value: item.agCode,
        label: item.agDisplayName,
        options: item.agOptions
      })), data.aggregatorSelected, data.comboSelected, false, data.aggregatorTitle, this)
      this.divideByAttributes = (data.divideByAttributes || []).map(item => new Divider(item));
        this.divideByAttributeSelect = new WijSelect(this.id + "_divider-selector", data.divideByAttributes.map(item => ({
          value: item.aCode,
          label: item.aDisplayName
        })), data.divideByAttributeSelected, false, data.divideByAttributeTitle, this);
    }
    
    generateIdFromText(text) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    renderSidebar() {
      const container = document.createElement('div');
      container.id = this.id + "viz-trends-sidebar";

      
      if (this.aggregatorSelect) {
        container.appendChild(this.aggregatorSelect.render());
      }

      if (this.comboSelector) {
        container.appendChild(this.comboSelector.render());
      }

      container.appendChild(this.attributeSelect.render());
      this.filters.forEach(filter => {
        container.appendChild(filter.render());
      });
      container.appendChild(this.divideByAttributeSelect.render());

      var divSidebar = document.getElementById(this.sidebarDiv);
      divSidebar.innerHTML = '';
      divSidebar.appendChild(container);  // Append the new element to the container
    }
    
    afterUpdateSidebar() {
      console.log('viztrends:afterSidebarUpdate');
      this.updateFilters();
      this.updateDisplay();
    }

    afterFilterUpdate() {

    }

    getACode() {
      return this.attributeSelect.selected;
    }

    getDCode() {
      return this.divideByAttributeSelect.selected;
    }

    getComboboxOptions(){
      const comboOptions = Array.isArray(this.comboSelector.comboSelected) ? this.comboSelector.comboSelected : [this.comboSelector.comboSelected];
      if (
        this.comboSelector.selected.agCode === 'CO_FIPS' ||
        this.comboSelector.selected.agCode === 'DISTMED' ||
        this.comboSelector.selected.agCode === 'DISTLRG'
      ) {
        return comboOptions.map(str => parseInt(str,10));
      } else {
        return comboOptions;
      }
    }

    getScenario(_modVersion, _scnGroup, _scnYear) {
      return dataScenarios.find(scenario =>
        scenario.modVersion === _modVersion &&
        scenario.scnGroup   === _scnGroup   &&
        scenario.scnYear    === _scnYear
      ) || null;
    }

    getSelectedAggregator() {
      let foundAggregator = this.aggregators.find(obj => obj.agCode === this.aggregatorSelect.selected);

      if (foundAggregator) {
        return foundAggregator;
      }

      return;
    }

    afterUpdateAggregator() {
      console.log('viztrends:afterUpdateAggregator');
      //document.getElementById(this.comboSelector.id + '-container').innerHTML = '';
      this.comboSelector.render();
      this.renderSidebar();
      this.afterUpdateSidebar();
    }

    scenarioMain() {
      return this.getScenario(document.getElementById('selectModMain' ).value,
                              document.getElementById('selectGrpMain' ).value,
                              parseInt(document.getElementById('selectYearMain').value, 10)); // Assuming it's a number
    }

    updateFilters() {
      console.log('viztrends:updateFilters');

      var _filterGroup = [];

      _filterGroup = this.scenarioMain().jsonData['roadway-trends'].attributes.find(item => item.aCode === this.getACode()).filterGroup;

      // Select all elements with an 'id' containing '-filter-container'
      const filteredDivs = Array.from(document.querySelectorAll("div[id$='_" + this.id + "-filter-container']"));
    
      if (_filterGroup) {
        // Split the _filterGroup by "_"
        const _filterArray = _filterGroup.split("_");
        
        filteredDivs.forEach(divElement => {
          const containsFilterText = _filterArray.some(filterText => divElement.id.includes(filterText));
          divElement.style.display = containsFilterText ? 'block' : 'none';
        });
      } else {
        console.log('viztrends:_filterGroup is null or undefined. Hiding all divs.');
        // Hide all divs if _filterGroup is null or undefined
        filteredDivs.forEach(divElement => {
          divElement.style.display = 'none';
        });
      }
    }

    // get the current filter
    getFilter() {

      var _filterGroup = [];

      _filterGroup = this.scenarioMain().jsonData['roadway-trends'].attributes.find(item => item.aCode === this.getACode()).filterGroup;

      // Check if _filterGroup is not undefined
      if (_filterGroup) {
        // Split the _filterGroup by "_"
        const _filterArray = _filterGroup.split("_");
        
        // Map selected options to an array and join with "_"
        const _filter = _filterArray
          .map(filterItem => {
            var _fItem = this.filters.find(item => item.id === filterItem + '_' + this.id);
            return _fItem ? _fItem.filterWij.selected : "";
          })
          .join("_");
    
        return _filter;
      }
    
      return ""; // Return an empty string or a default value if _filterGroup is undefined
    
    }

    getChartData(aCode, filterSelectionData) {
      if (aCode === 'aVmt') {
          return filterSelectionData.aVmt; // Change this to the appropriate property based on your data structure
      } else if (aCode === 'aVht') {
          return filterSelectionData.aVht; // Change this to the appropriate property based on your data structure
      } else if (aCode === 'aLMl') {
          return filterSelectionData.aLMl;
      } else {
          return 0; // return 0 if nothing is found
      }

      //This needs to include filter direction, tod, and vehicle type -- not just attribute. Do it here: (copy what bill did in vizmap L#272)

      // Handle other display names if needed
      return null;
    }

    getSegidOptions() {
      const segidOptions = [];
      const filter = this.getFilter();
  
      const scenarioData = this.scenarioMain().jsonData['roadway-trends'].data[filter];
      Object.keys(scenarioData).forEach(segId => {
          segidOptions.push(segId);
      });
  
      return segidOptions;
    }

    createLineChart(aCode, labels, chartData, aggIDsString) {
      console.log('viztrends:Creating the chart...');
      console.log("Selected radio button option under 'Display':", aCode);

      const containerElement = document.getElementById('mainTrend');
      containerElement.innerHTML = '';
        
      
      const aggCode = this.getSelectedAggregator();
      const title = document.createElement('div');
      title.id = 'charttitle';
      title.innerHTML = '<h1>' + aggCode.agDisplayName + ' Trends</h1>'
      containerElement.appendChild(title);

      const chartContainer = document.createElement('div');
      chartContainer.id = 'chartContainer';
      containerElement.appendChild(chartContainer);
  
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 200;
      chartContainer.appendChild(canvas);
  
      const ctx = canvas.getContext('2d');
      let currentChart = null;
  
      const aggIds = Object.keys(chartData);
  
      const createChart = () => {
        if (currentChart) {
            // Destroy existing Chart instance
            currentChart.destroy();
        }
        
        const scenarioGroups = [
          {"name": "RTP"},
          {"name": "NoBuild"},
          {"name": "Needs"},
          {"name": "Needs MAG"}
        ];

        currentChart = new Chart(ctx, {
          type: 'scatter', // Use scatter chart type
          data: {
            datasets: aggIds.flatMap(aggId => {
              // For each aggId, create a dataset for each scenario group
              return scenarioGroups.map(scenarioGroup => {
                const name = scenarioGroup.name;
                const values = chartData[aggId][name];
                const dataPoints = Object.keys(values).map(year => {
                  return { 
                    x: parseInt(year, 10), // Ensure the year is a number
                    y: +values[year].toPrecision(4) // Round y values to 4 significant figures
                  };
                });
        
                return {
                  label: `${name}`,
                  data: dataPoints,
                  fill: false,
                  borderColor: this.getRandomColor(),
                  borderWidth: 3,
                  pointRadius: 8,
                  showLine: true // Draw lines between points
                };
              });
            })
          },
          options: {
            scales: {
              x: {
                type: 'linear',
                position: 'bottom',
                min: 2019, 
                ticks: {
                  callback: function(value) {
                    // Convert value to string and remove commas
                    return value.toString().replace(/,/g, '');
                  }
                }
              },
              y: {
                beginAtZero: true
              }
            }
          }
        });
      }
        
      // Initial chart creation
      createChart();
    }
  
    getRandomColor(index) {
      // Generate a random color based on index
      const colors = [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
      ];
  
      return colors[index % colors.length];
    }

  
    updateDisplay() {
      const aCode = this.getACode();
      const dCode = this.getDCode();
      const comboCodes = this.getComboboxOptions();
      const combos = this.comboSelector;
      //const aggCode = this.getSelectedAggregator();
      //const segId = "0006_146.9"; // Change this to your desired SEGID
      //const segOptions = this.getSegidOptions();
    
      const scnGroupYearCombos = [
          { scnDisplay: 'RTP'      , scnGroup: 'Base'     , scnYear: 2019 },
          { scnDisplay: 'RTP'      , scnGroup: 'Base'     , scnYear: 2023 },
          { scnDisplay: 'RTP'      , scnGroup: 'TIP'      , scnYear: 2028 },
          { scnDisplay: 'RTP'      , scnGroup: 'RTP'      , scnYear: 2032 },
          { scnDisplay: 'RTP'      , scnGroup: 'RTP'      , scnYear: 2042 },
          { scnDisplay: 'RTP'      , scnGroup: 'RTP'      , scnYear: 2050 },
          { scnDisplay: 'NoBuild'  , scnGroup: 'Base'     , scnYear: 2019 },
          { scnDisplay: 'NoBuild'  , scnGroup: 'Base'     , scnYear: 2023 },
          { scnDisplay: 'NoBuild'  , scnGroup: 'TIP'      , scnYear: 2028 },
          { scnDisplay: 'NoBuild'  , scnGroup: 'NoBuild'  , scnYear: 2032 },
          { scnDisplay: 'NoBuild'  , scnGroup: 'NoBuild'  , scnYear: 2042 },
          { scnDisplay: 'NoBuild'  , scnGroup: 'NoBuild'  , scnYear: 2050 },
          { scnDisplay: 'Needs'    , scnGroup: 'Base'     , scnYear: 2019 },
          { scnDisplay: 'Needs'    , scnGroup: 'Base'     , scnYear: 2023 },
          { scnDisplay: 'Needs'    , scnGroup: 'TIP'      , scnYear: 2028 },
          { scnDisplay: 'Needs'    , scnGroup: 'Needs'    , scnYear: 2032 },
          { scnDisplay: 'Needs'    , scnGroup: 'Needs'    , scnYear: 2042 },
          { scnDisplay: 'Needs'    , scnGroup: 'Needs'    , scnYear: 2050 },
          { scnDisplay: 'Needs MAG', scnGroup: 'Base'     , scnYear: 2019 },
          { scnDisplay: 'Needs MAG', scnGroup: 'Base'     , scnYear: 2023 },
          { scnDisplay: 'Needs MAG', scnGroup: 'TIP'      , scnYear: 2028 },
          { scnDisplay: 'Needs MAG', scnGroup: 'Needs'    , scnYear: 2032 },
          { scnDisplay: 'Needs MAG', scnGroup: 'Needs'    , scnYear: 2042 },
          { scnDisplay: 'Needs MAG', scnGroup: 'Needs MAG', scnYear: 2050 }
      ];

      const labels = [2019,2023,2028,2032,2042,2050];
      const chartData = {};
      var filteredFeatures = {};

      var aggIDs = comboCodes//[35,49];
      
      let aggIDsString = '';
      if (comboCodes.length > 1) {
          aggIDsString = comboCodes.join('_');
      } else if (comboCodes.length === 1) {
          aggIDsString = comboCodes[0].toString();
      }
      console.log('viztrends:Going to fetch the data now... agIDsString is ' + aggIDs);
      fetch("data/segmentsWithAggFields.geojson")
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Filter features where CO_FIPS is 35
          filteredFeatures = data.features.filter(feature => 
            aggIDs.includes(feature.properties[this.comboSelector.selected.agCode])
        );

          // Now you have an array of features where CO_FIPS is 35
          console.log(filteredFeatures);

          scnGroupYearCombos.forEach(combo => {
            const scnDisplay = combo.scnDisplay;
            const scnGroup = combo.scnGroup;
            const scnYear = combo.scnYear;
            const scenarioData = this.getScenario('v900', scnGroup, scnYear);
            const filter = this.getFilter();
    
            if (scenarioData) {
        
              if (!chartData[aggIDsString]) {
                  chartData[aggIDsString] = {};
              }
              if (!chartData[aggIDsString][scnDisplay]) {
                  chartData[aggIDsString][scnDisplay] = {};
              }
    
              chartData[aggIDsString][scnDisplay][scnYear] = 0;
    
              const filteredScenario = scenarioData.jsonData['roadway-trends'].data[filter];
    
              filteredFeatures.forEach(feature => {
    
                const segId = feature.properties.SEGID;
                const filterSelectionData = filteredScenario[segId];
        
                if (filterSelectionData) {
                  const selectedValue = this.getChartData(aCode, filterSelectionData);

                  if (selectedValue == null | selectedValue == undefined) {
                    //chartData[aggIDsString][scnDisplay][scnYear] += 0;
                    console.log("null data found in here: " + aggIDsString + '_' + scnDisplay + '_' + scnYear)
                  }

                  if (selectedValue !== null & selectedValue !== undefined) {
                    chartData[aggIDsString][scnDisplay][scnYear] += selectedValue;
                  }
                }
              })
            }
          });

        })
        .catch(error => {
          console.error('Error reading the JSON file:', error);
        });
      
      var filteredTazes = {};
      var filteredTazSeData = {};
      console.log('viztrends:Going to fetch the data now... agIDsString is ' + aggIDs);
      fetch("data/tazWithAggFields.geojson")
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Filter features where CO_FIPS is 35
          filteredTazes = data.features.filter(feature => 
            aggIDs.includes(feature.properties[this.comboSelector.selected.agCode])
        );

        var filteredTazList = [];
        // Loop through filteredTazes and extract TAZID values
        filteredTazes.forEach((taz) => {
          // Assuming TAZID is always present in the properties object
          if (taz.properties && taz.properties.TAZID) {
            // Check if TAZID is not already in the array
            if (!filteredTazList.includes(taz.properties.TAZID)) {
              filteredTazList.push(taz.properties.TAZID);
            }
          }
        });

        //read in the zonesSeData
        var sumAttribute = 0;
        scnGroupYearCombos.forEach(combo => {
          const scnDisplay = combo.scnDisplay;
          const scnGroup = combo.scnGroup;
          const scnYear = combo.scnYear;
          const scenarioData = this.getScenario('v900', scnGroup, scnYear);
          const filter = this.getFilter();
  
          if (scenarioData) {

            const tazSeData = scenarioData.zoneSeData.data[""];
            
            //filter the zonesSeData to only those zones that are within filteredTazList
            filteredTazSeData = Object.keys(tazSeData)
            .filter((key) => filteredTazList.includes(parseInt(key)))
            .reduce((result, key) => {
              result[key] = tazSeData[key];
              return result;
            }, {});




          }
          //sum up all the "selected divide by attribute"'s  value within the filtered zonesSeData list to get a sum total
          for (const key in filteredTazSeData) {
            if (filteredTazSeData[key][dCode] !== undefined) {
              sumAttribute += filteredTazSeData[key][dCode];
            }
          }
          console.log(sumAttribute);
        });
        
        //loop through the chartData and divide all the values by the sum just calculated
        for (const key1 in chartData) {
          for (const key2 in chartData[key1]) {
            for (const key3 in chartData[key1][key2]) {
              chartData[key1][key2][key3] /= sumAttribute;
            }
          }
        }
        
        this.createLineChart(aCode, labels, chartData, aggIDsString);

        })
        .catch(error => {
          console.error('Error reading the JSON file:', error);
        });
  
      }

    getSidebarSelector(submenuTemplate) {
      if (submenuTemplate === 'vizLog') {
        return '#logSidebarContent';
      } else if (submenuTemplate === 'vizMap') {
        return '#sidebarContent';
      } else if (submenuTemplate === 'vizTrends') {
        return '#trendSidebarContent'
      } else if(submenuTemplate === 'vizMatrix') {
        return '#matrixSidebarContent'
      }
    }
  }

    // Export ModelEntity to the global scope
    // Exporting to Global Scope (Not recommended but works): If you want to make the ModelEntity class globally accessible (not a good practice but will solve the immediate issue):
    window.VizTrends = VizTrends;

});