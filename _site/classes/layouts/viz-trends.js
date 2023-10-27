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
      this.mapViewDiv = data.mapViewDiv;
      this.sidebarDiv = data.sidebarDiv;
      this.attributes = (data.attributes || []).map(item => new Attribute(item));
      this.attributeSelect = new WijRadio(this.id & "_container", data.attributes.map(item => ({
        value: item.aCode,
        label: item.aDisplayName
      })), data.attributeSelected);
      this.filters = (data.filters || []).map(item => new Filter(item, this));
      
      this.initListeners();
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

    initListeners() {
      console.log('initListeners');
      
      //document.getElementById('selectModMain').addEventListener('change', this.updateMap.bind(this));
      //document.getElementById('selectGrpMain').addEventListener('change', this.updateMap.bind(this));
      //document.getElementById('selectYearMain').addEventListener('change', this.updateMap.bind(this));
      //
      //document.getElementById('selectModComp').addEventListener('change', this.updateMap.bind(this));
      //document.getElementById('selectGrpComp').addEventListener('change', this.updateMap.bind(this));
      //document.getElementById('selectYearComp').addEventListener('change', this.updateMap.bind(this));

      // Get all radio buttons with the name "rcPcOption"
      var radioButtons = document.querySelectorAll('input[name="rcPcOption"]');

      // Assuming this is inside a class or object with a method named this.updateMap()
      radioButtons.forEach(function(radio) {
        radio.addEventListener('change', (event) => {  // Arrow function here
            console.log(event.target.value);
            //this.updateMap();
        });
      });
    }
    
    afterSidebarUpdate() {
      console.log('afterSidebarUpdate');
      //this.updateMap();
      this.updateFilters();
    }

    afterFilterUpdate() {

    }

    updateFilters() {
      console.log('updateFilters');

      var aCode = "";

      if (this.mapSidebarItems && this.mapSidebarItems.length > 0) {
        aCode = this.mapSidebarItems[0].selectedOption;
        console.log(aCode);
      } else {
        console.error('mapSidebarItems is empty or not defined.');
        return;
      }


      if (document.getElementById('fVeh_container2') === null || typeof document.getElementById('fVeh_container2') === 'undefined') {
        return;
      }
    
      // MANUALLY SET FILTER -- REPLACE WITH PROGRAMATIC SOLUTION
      if (['aLanes', 'aFt', 'aFtClass', 'aCap1HL', 'aFfSpd'].includes(aCode)) {
        document.getElementById('fDir_container2').style.display = 'block';
        document.getElementById('fVeh_container2').style.display = 'none';
        document.getElementById('fTod_container2').style.display = 'none';
      } else if (aCode === 'aVol') {
        document.getElementById('fDir_container2').style.display = 'block';
        document.getElementById('fVeh_container2').style.display = 'block';
        document.getElementById('fTod_container2').style.display = 'block';
      } else if (['aVc', 'aSpd'].includes(aCode)) {
        document.getElementById('fDir_container2').style.display = 'block';
        document.getElementById('fVeh_container2').style.display = 'none';
        document.getElementById('fTod_container2').style.display = 'block';
      }
    }

    // FIX THIS TO RELOAD WHEN SIDEBAR ELEMENT IS SELECTED -- RIGHT NOW ONLY UPDATES WHEN MENU OPTION CHANGES
    updateChartData() {
      var displayName = this.attributeSelect.selected;
      // Get values from the select widgets
      let modVersionValueMain = document.getElementById('selectModMain').value;
      let scnGroupValueMain = document.getElementById('selectGrpMain').value;
      let scnYearValueMain = parseInt(document.getElementById('selectYearMain').value, 10); // Assuming it's a number

      // Specify the file path
      const chartDataPath = `data/scnData/${modVersionValueMain}__${scnGroupValueMain}__${scnYearValueMain}/roadway-seg-summary.json`;
  
      if (typeof chartDataPath === 'undefined') {
          console.error('Invalid chart data path:', chartDataPath);
          return;
      }
  
      fetch(chartDataPath)
          .then(response => {
              if (!response.ok) {
                  throw new Error('Network response was not ok');
              }
              return response.json();
          })
          .then(data => {
              if (!data.data || !data.data.D1) {
                  throw new Error('Invalid JSON data format');
              }
  
              const labels = [];
              const chartData = [];
  
              // Access the segment data using data.D1
              Object.keys(data.data.D1).forEach(segId => {
                  const selectedValue = this.getChartData(displayName, data.data.D1[segId]);
                  if (selectedValue !== null) {
                      labels.push(segId);
                      chartData.push(selectedValue);
                  }
              });
  
              // Call your createAvmtChart function here with labels and chartData
              this.createAvmtChart(displayName, labels, chartData);
          })
          .catch(error => {
              console.error('Error fetching or updating chart data:', error);
          });
  }

  getChartData(displayName, filterSelectionData) {
    if (displayName === 'aCap1HL') {
        return filterSelectionData.aCap1HL; // Change this to the appropriate property based on your data structure
    } else if (displayName === 'aFfSpd') {
        return filterSelectionData.aFfSpd; // Change this to the appropriate property based on your data structure
    } else if (displayName === 'aFt') {
        return filterSelectionData.aFt;
    } else if (displayName === 'aVol') {
        return filterSelectionData.aVol;
    } else if (displayName === 'aSpeed') {
        return filterSelectionData.aSpeed;
    } else if (displayName === 'aLanes') {
        return filterSelectionData.aLanes;
    }

    //This needs to include filter direction, tod, and vehicle type -- not just attribute. Do it here: (copy what bill did in viz-map L#272)




    // Handle other display names if needed
    return null;
}

  createAvmtChart(displayName, labels, chartData) {
    console.log('Creating the chart...');
    console.log("Selected radio button option under 'Display':", displayName);

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
          label: displayName + ' Data',
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