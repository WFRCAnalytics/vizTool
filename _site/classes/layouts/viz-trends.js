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
      this.comboSelector = new WijComboboxes(this.id + "_attributecombo", data.aggregators.map(item => ({
        value: item.agCode,
        label: item.agDisplayName,
        options: item.agOptions
      })), data.aggregatorSelected, false, data.aggregatorTitle, this)
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

      var divSidebar = document.getElementById(this.sidebarDiv);
      divSidebar.innerHTML = '';
      divSidebar.appendChild(container);  // Append the new element to the container
    }
    
    afterUpdateSidebar() {
      console.log('afterSidebarUpdate');
      this.updateFilters();
      this.updateChartData();
    }

    afterFilterUpdate() {

    }

    getACode() {
      return this.attributeSelect.selected;
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
      console.log('afterUpdateAggregator');
      //document.getElementById(this.comboSelector.id + '_container').innerHTML = '';
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
      console.log('updateFilters');

      var _filterGroup = [];

      _filterGroup = this.scenarioMain().roadwayTrendData.attributes.find(item => item.aCode === this.getACode()).filterGroup;

      // Select all elements with an 'id' containing '_filter_container'
      const filteredDivs = Array.from(document.querySelectorAll("div[id$='_" + this.id + "_filter_container']"));
    
      if (_filterGroup) {
        // Split the _filterGroup by "_"
        const _filterArray = _filterGroup.split("_");
        
        filteredDivs.forEach(divElement => {
          const containsFilterText = _filterArray.some(filterText => divElement.id.includes(filterText));
          divElement.style.display = containsFilterText ? 'block' : 'none';
        });
      } else {
        console.log('_filterGroup is null or undefined. Hiding all divs.');
        // Hide all divs if _filterGroup is null or undefined
        filteredDivs.forEach(divElement => {
          divElement.style.display = 'none';
        });
      }
    }

    // get the current filter
    getFilter() {

      var _filterGroup = [];

      _filterGroup = this.scenarioMain().roadwayTrendData.attributes.find(item => item.aCode === this.getACode()).filterGroup;

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
      } 

      //This needs to include filter direction, tod, and vehicle type -- not just attribute. Do it here: (copy what bill did in viz-map L#272)

      // Handle other display names if needed
      return null;
    }

    getSegidOptions() {
      const segidOptions = [];
      const filter = this.getFilter();
  
      const scenarioData = this.scenarioMain().roadwayTrendData.data[filter];
      Object.keys(scenarioData).forEach(segId => {
          segidOptions.push(segId);
      });
  
      return segidOptions;
    }

    createLineChart(aCode, labels, chartData) {
      console.log('Creating the chart...');
      console.log("Selected radio button option under 'Display':", aCode);

      const containerElement = document.getElementById('mainTrend');
      containerElement.innerHTML = '';
        
      const title = document.createElement('div');
      title.id = 'charttitle';
      title.innerHTML = '<h1>Salt Lake County Trends</h1>'
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

  
    updateChartData() {
      const aCode = this.getACode();
      const aggCode = this.getSelectedAggregator();
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

      var aggID = 35;
    
      fetch("data/segmentsWithAggFields.geojson")
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Filter features where CO_FIPS is 35
          this.filteredFeatures = data.features.filter(feature => 
            feature.properties.CO_FIPS === aggID
          );

          // Now you have an array of features where CO_FIPS is 35
          console.log(filteredFeatures);

          // You can use filteredFeatures for further processing
        })
        .catch(error => {
          console.error('Error reading the JSON file:', error);
        });

    
      scnGroupYearCombos.forEach(combo => {
        const scnDisplay = combo.scnDisplay;
        const scnGroup = combo.scnGroup;
        const scnYear = combo.scnYear;
        const scenarioData = this.getScenario('v900', scnGroup, scnYear);
        const filter = this.getFilter();

        if (scenarioData) {
    
          if (!chartData[aggID]) {
              chartData[aggID] = {};
          }
          if (!chartData[aggID][scnDisplay]) {
              chartData[aggID][scnDisplay] = {};
          }

          chartData[aggID][scnDisplay][scnYear] = 0;

          const filteredScenario = scenarioData.roadwayTrendData.data[filter];

          this.filteredFeatures.forEach(feature => {

            const segId = feature.properties.SEGID;
            const filterSelectionData = filteredScenario[segId];
    
            if (filterSelectionData) {
              const selectedValue = this.getChartData(aCode, filterSelectionData);

              if (selectedValue !== null) {
                chartData[aggID][scnDisplay][scnYear] += selectedValue;
              }
            }
          })
        }
      });
    


      this.createLineChart(aCode, labels, chartData);
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