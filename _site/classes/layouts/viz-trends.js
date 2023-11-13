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
    }
    
    generateIdFromText(text) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    renderSidebar() {
      const container = document.createElement('div');
      container.id = this.id + "viz-trends-sidebar";

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

    scenarioMain() {
      return this.getScenario(         document.getElementById('selectModMain' ).value,
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

    updateChartData() {
      var aCode = this.attributeSelect.selected;
      console.log('updateChartData');

      let _filter = this.getFilter();
      
      // get segment data give the filter
      const segDataMain = this.scenarioMain().roadwayTrendData.data[_filter]

      const labels = [];
      const chartData = [];

      // Access the segment data using data.D1
      Object.keys(segDataMain).forEach(segId => {
          const selectedValue = this.getChartData(aCode, segDataMain[segId]);
          if (selectedValue !== null) {
              labels.push(segId);
              chartData.push(selectedValue);
          }
      });
      this.createAvmtChart(aCode, labels, chartData);
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

    createAvmtChart(aCode, labels, chartData) {
      console.log('Creating the chart...');
      console.log("Selected radio button option under 'Display':", aCode);

        // Clear existing chart container
        const chartElement = document.getElementById('mainTrend');
        chartElement.innerHTML = '';

      // Create chart container dynamically
      const chartContainer = document.createElement('div');
      chartContainer.id = 'chartContainer'; // Set the id for the chart container

      // Create canvas and chart
      const canvas = document.createElement('canvas');
      canvas.width = 400; // Set the width of the canvas
      canvas.height = 200; // Set the height of the canvas
      chartContainer.appendChild(canvas); // Append canvas to chart container

      // Append the chart container to the specified element in HTML
      chartElement.appendChild(chartContainer);

      // Create Chart.js chart
      const ctx = canvas.getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: aCode + ' Data',
            data: chartData,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
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