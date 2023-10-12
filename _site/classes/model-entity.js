let legend;
let widget;

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

  class ModelEntity {
    constructor(data) {
      this.id = this.generateIdFromText(data.submenuText);
      this.submenuText = data.submenuText;
      this.submenuIconStart = data.submenuIconStart;
      this.submenuTemplate = data.submenuTemplate;
      this.mapSidebarItems = (data.mapSidebarItems || []).map(item => new MapSidebarItem(item, this));
      this.textFile = data.textFile;
      this.pngFile = data.pngFile;
      this.showLayers = data.showLayers || [];
      
      if (this.submenuTemplate==="vizMap" & this.id==="roadway-segments") {
        this.initListeners();
      }
    }
    
    initListeners() {
      console.log('initListeners');
      
      document.getElementById('selectModMain').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectGrpMain').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectYearMain').addEventListener('change', this.updateMap.bind(this));
      
      document.getElementById('selectModComp').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectGrpComp').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectYearComp').addEventListener('change', this.updateMap.bind(this));

      // Get all radio buttons with the name "rcPcOption"
      var radioButtons = document.querySelectorAll('input[name="rcPcOption"]');

      // Assuming this is inside a class or object with a method named this.updateMap()
      radioButtons.forEach(function(radio) {
        radio.addEventListener('change', (event) => {  // Arrow function here
            console.log(event.target.value);
            this.updateMap();
        });
      });
    }
    
    afterSidebarUpdate() {
      console.log('afterSidebarUpdate');
      this.updateMap();
      this.updateFilters();
      this.updateAggregations();
    }

    generateIdFromText(text) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    createModelEntityElement() {
      console.log('createModelEntityElement');
      const modelEntity = document.createElement('calcite-menu-item');
      modelEntity.setAttribute('id', this.id);
      modelEntity.setAttribute('text', this.submenuText);
      modelEntity.setAttribute('icon-start', this.submenuIconStart);
      modelEntity.setAttribute('text-enabled', '');
  
      const modelEntityInstance = this;
  
      modelEntity.addEventListener('click', function() {
        let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
        mainSidebarItems2.forEach(item2 => {
          if(item2.text === modelEntityInstance.menuText) {  // Use the saved instance context here
            item2.active = true;
          } else {
            item2.active = false;
          }
        });
  
        // Show corresponding template
        const allTemplates = document.querySelectorAll('.template');
        allTemplates.forEach(template => template.hidden = true);
    
        // Show the selected template
        const selectedTemplate = document.getElementById(modelEntityInstance.submenuTemplate + 'Template');
        if (selectedTemplate) {
          selectedTemplate.hidden = false;
          // ... (Any additional specific logic for the template type)
        }
        const sidebarSelect = modelEntityInstance.getSidebarSelector(modelEntityInstance.submenuTemplate)
        modelEntityInstance.populateSidebar(sidebarSelect);  // Use the saved instance context here as well
        modelEntityInstance.populateText();
        modelEntityInstance.populateImage();
        modelEntityInstance.displayJSONData();
        modelEntityInstance.updateLayerVisibility();
        //modelEntityInstance.populateMainContent(modelEntityInstance.templateContent);

      });
      return modelEntity;
    }
    
    updateLayerVisibility() {
      // Loop through each layer in the map
      map.layers.forEach(layer => {
        // Check if the layer's id (or name, or other unique identifier) is in the showLayers list
        if (this.showLayers.includes(layer.title)) {
          // Show the layer if it's in the list
          layer.visible = true;
        } else {
          // Hide the layer if it's not in the list
          layer.visible = false;
        }
      });
    }
  
    populateSidebar(sidebarSelect) {
  
      const container = document.createElement('div');
      
      const titleEl = document.createElement('h2');
      titleEl.textContent = this.title;
  
      const sidebarContainer = document.createElement('div');
      this.mapSidebarItems.forEach(mapSidebarItem => {
        sidebarContainer.appendChild(mapSidebarItem.render());
      });
  
      container.appendChild(titleEl);
      container.appendChild(sidebarContainer);
      
      this.updateMap();
      this.updateFilters();
      this.updateAggregations();

      const sidebar = document.querySelector(sidebarSelect);
      // You might have to modify the next line based on the structure of your SidebarContent class.
      sidebar.innerHTML = ''; // clear existing content
      sidebar.appendChild(container);
      // Set the focus to the sidebar
      sidebar.focus();
  
    }
  
    populateText(){
      
      // Specify the file path
      const filePath = this.textFile;
  
      if (typeof filePath==='undefined') return;
  
      const reader = new FileReader();
      reader.onload = function (e) {
          const fileContents = e.target.result;
          const fileContentsElement = document.getElementById("fileContents");
          if (fileContentsElement) {
              fileContentsElement.textContent = fileContents;
          }
      };
      fetch(filePath)
          .then(response => response.blob())
          .then(blob => {
              reader.readAsText(blob);
          })
          .catch(error => {
              console.error("Error reading file:", error);
          });
    }
  
    populateImage() {
      // Specify the file path
      const imagePath = this.pngFile;
  
      if (typeof imagePath==='undefined') return;
  
      fetch(imagePath)
          .then(response => {
              return response.blob();
          })
          .then(blob => {
              const imageURL = URL.createObjectURL(blob); // Create a URL for the blob
              const imgHTML = `<img src="${imageURL}" alt="Image Placeholder">`;
  
              const imageElement = document.getElementById("imageElement");
              if (imageElement) {
                  imageElement.innerHTML = imgHTML; // Set the HTML content
              }
          })
          .catch(error => {
              console.error("Error fetching or displaying image:", error);
          });
    }
  
    // Function to create and populate the table
    displayJSONData() {
      const jsonData = {
        "data": [
          [0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123],
          [0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456],
          [0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789],
          [0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321],
          [0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654],
          [0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987],
          [0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135],
          [0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468],
          [0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791],
          [0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123],
          [0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456],
          [0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789],
          [0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321],
          [0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654],
          [0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987],
          [0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135],
          [0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468],
          [0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791],
          [0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123, 0.456, 0.789, 0.321, 0.654, 0.987, 0.135, 0.468, 0.791, 0.123]
        ]
      }
  
      const table = document.getElementById('matrixTable');
      table.innerHTML = '';
      
      // Create the header row for columns on row 1
      const headerRow = table.insertRow(0); // Insert at row 0
      headerRow.classList.add('header-row');
  
      // Create an empty cell for the row header column
      headerRow.insertCell();
  
      // Loop to create column headers with numbers
      for (let col = 0; col < jsonData.data[0].length; col++) {
          const headerCell = headerRow.insertCell();
          headerCell.textContent = `j ${col + 1}`; // Column numbers start from 1
      }
  
      // Loop through the rows and columns of the JSON data
      for (let rowIndex = 0; rowIndex < jsonData.data.length; rowIndex++) {
          const row = jsonData.data[rowIndex];
          const newRow = table.insertRow();
  
          // Create the cell in the first column for the row header
          const rowHeaderCell = newRow.insertCell();
          rowHeaderCell.textContent = `i ${rowIndex + 1}`; // Row numbers start from 1
          rowHeaderCell.classList.add('row-header'); // Apply the row header style
  
          // Loop through the data cells for this row, starting from the second column
          for (let colIndex = 0; colIndex < row.length; colIndex++) {
              const newCell = newRow.insertCell();
              newCell.textContent = row[colIndex].toFixed(3); // Format the number to show 3 decimal places
          }
      }
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


      if (document.getElementById('fVeh_container') === null || typeof document.getElementById('fVeh_container') === 'undefined') {
        return;
      }
    
      // MANUALLY SET FILTER -- REPLACE WITH PROGRAMATIC SOLUTION
      if (['aLanes', 'aFt', 'aFtClass', 'aCap1HL', 'aFfSpd'].includes(aCode)) {
        document.getElementById('fDir_container').style.display = 'block';
        document.getElementById('fVeh_container').style.display = 'none';
        document.getElementById('fTod_container').style.display = 'none';
      } else if (aCode === 'aVol') {
        document.getElementById('fDir_container').style.display = 'block';
        document.getElementById('fVeh_container').style.display = 'block';
        document.getElementById('fTod_container').style.display = 'block';
      } else if (['aVc', 'aSpd'].includes(aCode)) {
        document.getElementById('fDir_container').style.display = 'block';
        document.getElementById('fVeh_container').style.display = 'none';
        document.getElementById('fTod_container').style.display = 'block';
      }
    }

    updateAggregations() {
      console.log('updateAggregations');
      
      const aggNumeratorSelect = document.getElementById('aggNumerator');

      if (aggNumeratorSelect === null || typeof aggNumeratorSelect === 'undefined') {
        return;
      }
    

      const selectedOption = aggNumeratorSelect.querySelector('calcite-option[selected]');
      
      var aggNumeratorContent = "";

      if (selectedOption) {
        aggNumeratorContent = selectedOption.textContent || selectedOption.innerText;
        console.log(aggNumeratorContent); // Outputs the text content of the selected option
      } else {
        console.error('No option selected in aggNumerator.');
      }

      const aggDenominatorInput = document.getElementById('aggDenominator');

      // get aggregation numberator
      const aggNumerator = selectedOption.value;
      const aggDenominator = aggDenominatorInput.value;

      // Query the features
      var query = new Query();
      query.where = "1=1"; // Get all features. Adjust if you need a different condition.
      query.returnGeometry = false; // We don't need geometries for aggregation.
      query.outFields = [aggNumerator, "dVal", "DISTANCE"];
  
      layerDisplay.queryFeatures(query).then(function(results) {
        var sumDistXVal  = {};
        var sumDist      = {}; // For storing distances
        var aggDistWtVal = {};
        
        results.features.forEach(function(feature) {
          var agg = feature.attributes[aggNumerator];
          var distxval = feature.attributes.dVal * feature.attributes.DISTANCE;
          var dist = feature.attributes.DISTANCE;
      
          // Check if agg already exists in the objects
          if (sumDistXVal[agg]) {
            sumDistXVal[agg] += distxval;
            sumDist    [agg] += dist;
          } else {
            sumDistXVal[agg] = distxval;
            sumDist    [agg] = dist;
          }
        });
        
        // Calculate aggDistWtVal for each key
        for (var key in sumDistXVal) {
          aggDistWtVal[key] = sumDistXVal[key] / sumDist[key];
        }
        
                        
        // Sort the keys based on their values in aggDistWtVal in descending order
        var sortedKeys = Object.keys(aggDistWtVal).sort(function(a, b) {
          return aggDistWtVal[b] - aggDistWtVal[a];
        });

        // Construct a new object with sorted keys
        var sortedAggDistWtVal = {};
        for (var i = 0; i < sortedKeys.length; i++) {
          sortedAggDistWtVal[sortedKeys[i]] = aggDistWtVal[sortedKeys[i]];
        }

        // Do something with the aggDistWtVal...
        console.log(aggDistWtVal);
        //table.style.fontSize = "0.8em"; // For smaller text

        // Create a new table element
        var table = document.createElement("table");
        
        // Create the table header
        var thead = table.createTHead();
        var headerRow = thead.insertRow();
        var th1 = document.createElement("th");
        th1.textContent = aggNumeratorContent;
        headerRow.appendChild(th1);
        var th2 = document.createElement("th");
        th2.textContent = "";
        //switch(aCode) {
        //  case 'aLanes':
        //    th2.textContent = "Lane Miles";
        //    break;
        //  case 'aFt':
        //    th2.textContent = "FT x Distance";
        //    break;
        //  case 'aFtClass':
        //    th2.textContent = "ERROR";
        //    break;
        //  case 'aCap1HL':
        //    th2.textContent = "Cap x Distance";
        //    break;
        //  case 'aVc' :
        //    th2.textContent = "VC x Distance";
        //    break;
        //  case 'aVol':
        //    th2.textContent = "VMT";
        //    break;
        //  case 'aSpd':
        //  case 'aFfSpd':
        //    th2.textContent = "Spd x Distance";
        //    break;
        //}
        headerRow.appendChild(th2);

        const formatNumber = (num) => {
          return num.toLocaleString('en-US', {
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
          });
        }

        // Populate the table with data
        for (var key in sortedAggDistWtVal) {
          var row = table.insertRow();
          var cell1 = row.insertCell();
          cell1.textContent = key;
          var cell2 = row.insertCell();
          //cell2.style.textAlign = "right"; // Right-justify the text
          cell2.textContent = formatNumber(sortedAggDistWtVal[key]);
        }

        // Append the table to the container div
        var container = document.getElementById("tableContainer");
        container.innerHTML = '';
        container.appendChild(table);

      }).catch(function(error) {
          console.error("There was an error: ", error);
      });

    }

    updateMap() {
      console.log('updateMap');
      
      // Reinitialize the layer with the current features array
      map.remove(layerDisplay);

      var aCode = "";

      if (this.mapSidebarItems && this.mapSidebarItems.length > 0) {
        aCode = this.mapSidebarItems[0].selectedOption;
        console.log(aCode);
      } else {
        console.error('mapSidebarItems is empty or not defined.');
        return;
      }
  
      let _filter;

      var _fDirItem = this.mapSidebarItems.find(item => item.id === "fDir");
      var _fDir = _fDirItem ? _fDirItem.selectedOption : "";

      var _fVehItem = this.mapSidebarItems.find(item => item.id === "fVeh");
      var _fVeh = _fVehItem ? _fVehItem.selectedOption : "";

      var _fTodItem = this.mapSidebarItems.find(item => item.id === "fTod");
      var _fTod = _fTodItem ? _fTodItem.selectedOption : "";

      // MANUALLY SET FILTER -- REPLACE WITH PROGRAMATIC SOLUTION
      if (['aLanes', 'aFt', 'aFtClass', 'aCap1HL', 'aFfSpd'].includes(aCode)) {
        _filter = _fDir;
      } else if (aCode === 'aVol') {
        _filter = _fDir + '_' + _fVeh + '_' + _fTod;
      } else if (['aVc', 'aSpd'].includes(aCode)) {
        _filter = _fDir + '_' + _fTod;
      }

      // Get values from the select widgets
      let modVersionValueMain = document.getElementById('selectModMain').value;
      let scnGroupValueMain = document.getElementById('selectGrpMain').value;
      let scnYearValueMain = parseInt(document.getElementById('selectYearMain').value, 10); // Assuming it's a number

      // Use the obtained values in the find method
      let scenarioMain = dataScenarios.find(scenario => 
        scenario.modVersion === modVersionValueMain && 
        scenario.scnGroup === scnGroupValueMain && 
        scenario.scnYear === scnYearValueMain
      );

      
      if (typeof scenarioMain === 'undefined') {
        return;
      }

      // get segment data give the filter
      const segDataMain = scenarioMain.roadwaySegData.data[_filter]

      // Get values from the select widgets
      let modVersionValueComp = document.getElementById('selectModComp').value;
      let scnGroupValueComp = document.getElementById('selectGrpComp').value;
      let scnYearValueComp = parseInt(document.getElementById('selectYearComp').value, 10); // Assuming it's a number



      // Use the obtained values in the find method
      let scenarioComp = dataScenarios.find(scenario => 
        scenario.modVersion === modVersionValueComp && 
        scenario.scnGroup === scnGroupValueComp && 
        scenario.scnYear === scnYearValueComp
      );


      let mode = 'base'; //default is base

      var segDataComp = [];

      if (typeof scenarioComp !== 'undefined') {
        mode = 'compare';
        segDataComp = scenarioComp.roadwaySegData.data[_filter];
      }

      if (mode==='base' && (modVersionValueComp !== "none" || scnGroupValueComp !== "none" || document.getElementById('selectYearComp').value !== "none")) {
        return;
      }

      let dValFieldType;

      // MANUALLY SET SCENARIO -- REPLACE WITH PROGRAMATIC SOLUTION
      if (aCode === 'aFtClass') {
        dValFieldType = "string";
      } else {
        dValFieldType = "double";  // or "int" based on your requirement
      }

      layerDisplay = new FeatureLayer({
        source: [dummyFeature],
        objectIdField: "SEGID",
        fields: [
          // ... your other fields
          { name: "SEGID"    , type: "oid" },  // Object ID field
          { name: "dVal"     , type: dValFieldType, alias: aCode },
          { name: "SmallArea", type: "string"},
          { name: "DMED_NAME", type: "string"},
          { name: "DLRG_NAME", type: "string"},
          { name: "DISTANCE" , type: "double"}

        ],
        popupTemplate: {
          title: "Segment Details",
          content: [
            {
              type: "text",
              text: "The " + aCode + " is: {expression/formatDisplayValue}"
            }
          ],
          expressionInfos: [
            {
              name: "formatDisplayValue",
              title: "Formatted Display Value",
              expression: "Text(IIF(IsEmpty($feature.dVal), 0, $feature.dVal), '#,###.0')"
            }
          ]
        }
      });
      map.add(layerDisplay);
      
      const setRendererAndLegend = (aCode) => {

        // SETUP COLORS FOR RENDERER AND RENDERERS - NEEDS TO BE MOVED TO JSON

        const sCBertGrad9 = "#Af2944"; //rgb(175,41,68)
        const sCBertGrad8 = "#E5272d"; //rgb(229,39,45)
        const sCBertGrad7 = "#Eb672d"; //rgb(235,103,45)
        const sCBertGrad6 = "#E09d2e"; //rgb(224,157,46)
        const sCBertGrad5 = "#8dc348"; //rgb(141,195,72)
        const sCBertGrad4 = "#6cb74a"; //rgb(108,183,74)
        const sCBertGrad3 = "#00a74e"; //rgb(0,167,78)
        const sCBertGrad2 = "#1ba9e6"; //rgb(27,169,230)
        const sCBertGrad1 = "#31398a"; //rgb(49,57,138)
        const sCBertGrad0 = "#EEEEEE";

        const sCLaneGrad9 = "#000000"; //rgb(175,41,68)
        const sCLaneGrad8 = "#222222"; //rgb(229,39,45)
        const sCLaneGrad7 = "#800000"; //rgb(235,103,45)
        const sCLaneGrad6 = "#FF0000"; //rgb(224,157,46)
        const sCLaneGrad5 = "#66023C"; //rgb(141,195,72)
        const sCLaneGrad4 = "#3c59ff"; //rgb(108,183,74)
        const sCLaneGrad3 = "#86DC3D"; //rgb(0,167,78)
        const sCLaneGrad2 = "#333333"; //rgb(27,169,230)
        const sCLaneGrad1 = "#CCCCCC"; //rgb(49,57,138)

        const laneColorData = [sCLaneGrad1,sCLaneGrad2,sCLaneGrad3,sCLaneGrad4,sCLaneGrad5,sCLaneGrad6,sCLaneGrad7,sCLaneGrad8,sCLaneGrad9];
        const bertColorData = [sCBertGrad1,sCBertGrad2,sCBertGrad3,sCBertGrad4,sCBertGrad5,sCBertGrad6,sCBertGrad7,sCBertGrad8,sCBertGrad9];
        
        //Typical Colors
        const sCLightGrey     = "#EEEEEE";
        const sCDefaultGrey   = "#AAAAAA";
        const sCBlue1         = "#BED2FF";
        const sCBlue2         = "#73B2FF";
        const sCBlue3         = "#0070FF";
        const sCBlue4         = "#005CC4";//"#005CE6";
        const sCBlue5         = "#004DA8";
        const sCRed1          = "#FFBEBE";
        const sCRed2          = "#FF7F7F";
        const sCRed3          = "#E60000";
        const sCRed4          = "#510000";//"#730000";
        const sCGreen1        = "#54ff00";
        const sCGreen2        = "#4ce600";
        const sCWhite         = "#ffffff";
        const sSelectionColor = "#ffff00";//"#FF69B4"; //Hot Pink

        const aCR_Change9  = new Array(sCBlue4,sCBlue3,sCBlue2,sCBlue1,sCDefaultGrey,sCRed1,sCRed2,sCRed3,sCRed4);

        /* Green to Red Gradiant Ramp - 5 Steps with grey as 0 */
        const sCVCGrad0 = "#EEEEEE";
        const sCVCGrad1 = "#00FF00";
        const sCVCGrad2 = "#A9F36A";
        const sCVCGrad3 = "#FFE469";
        const sCVCGrad4 = "#FF0000";
        const sCVCGrad5 = "#730000";

        const aCGrYl = ["#00FF00","#AAED46","#D5E958","#FFE469"];
        const aCReds = ["#FF4D4D","#E64545","#CC3E3E","#B33636","#992E2E","#802727","#661F1F","#4C1717","#330F0F","#1A0808"];//,"000000"]; gradient is 11 red to black, but last black removed.
        const sCBlack = "#000000"


        let rendererFt = new ClassBreaksRenderer({
          field: "dVal",

        });

        let rendererFt_Change = new ClassBreaksRenderer({
          field: "dVal",

        });
        
        let rendererFtClass = new UniqueValueRenderer({
          field: "dVal",
          defaultSymbol: { type: "simple-line", color: "grey", width: 0.5},
          defaultLabel: "Other",
          uniqueValueInfos: [
            { value: "Freeway"           , symbol: new SimpleLineSymbol({ color: bertColorData[8], width:  6.0}), label: "Freeway"           },
            { value: "Expressway"        , symbol: new SimpleLineSymbol({ color: bertColorData[6], width:  4.0}), label: "Expressway"        },
            { value: "Principal Arterial", symbol: new SimpleLineSymbol({ color: bertColorData[4], width:  3.0}), label: "Principal Arterial"},
            { value: "Minor Arterial"    , symbol: new SimpleLineSymbol({ color: bertColorData[3], width:  2.0}), label: "Minor Arterial"    },
            { value: "Collector"         , symbol: new SimpleLineSymbol({ color: bertColorData[1], width:  1.0}), label: "Collector"         },
            { value: "Local"             , symbol: new SimpleLineSymbol({ color: bertColorData[0], width:  0.5}), label: "Local"             },
          ]
        });


        let rendererPercent = new ClassBreaksRenderer({
          field: "dVal",
          classBreakInfos: [
            { minValue: 0.000001, maxValue:       10, symbol: new SimpleLineSymbol({ color:        "#000000", width: 5.50 }), label: "Less than 10%" },
            { minValue:       10, maxValue:       20, symbol: new SimpleLineSymbol({ color: bertColorData[8], width: 5.30 }), label:"10% to 20%"     },
            { minValue:       20, maxValue:       30, symbol: new SimpleLineSymbol({ color: bertColorData[7], width: 4.70 }), label:"20% to 30%"     },
            { minValue:       30, maxValue:       40, symbol: new SimpleLineSymbol({ color: bertColorData[6], width: 4.10 }), label:"30% to 40%"     },
            { minValue:       40, maxValue:       50, symbol: new SimpleLineSymbol({ color: bertColorData[5], width: 3.90 }), label:"40% to 50%"     },
            { minValue:       50, maxValue:       60, symbol: new SimpleLineSymbol({ color: bertColorData[4], width: 3.50 }), label:"50% to 60%"     },
            { minValue:       60, maxValue:       70, symbol: new SimpleLineSymbol({ color: bertColorData[3], width: 2.30 }), label:"60% to 70%"     },
            { minValue:       70, maxValue:       80, symbol: new SimpleLineSymbol({ color: bertColorData[2], width: 1.70 }), label:"70% to 80%"     },
            { minValue:       80, maxValue:       90, symbol: new SimpleLineSymbol({ color: bertColorData[1], width: 1.10 }), label:"80% to 90%"     },
            { minValue:       90, maxValue: Infinity, symbol: new SimpleLineSymbol({ color: bertColorData[0], width: 0.50 }), label:"More than 90%"  }
          ]
        });

        let rendererPercent_Change = getPercentChangeRenderer_Reverse('dVal');

        let rendererPercent_Truck = new ClassBreaksRenderer({
          field: "dVal",
          classBreakInfos: [
            { minValue: 0.000000, maxValue:      7.5, symbol: new SimpleLineSymbol({ color: bertColorData[0], width: 0.50 }), label: "Less than 7.5%" },
            { minValue: 7.500001, maxValue:     10.0, symbol: new SimpleLineSymbol({ color: bertColorData[1], width: 1.10 }), label: "7.5% to 10.0%"  },
            { minValue:10.000001, maxValue:     12.5, symbol: new SimpleLineSymbol({ color: bertColorData[2], width: 1.70 }), label: "10.0% to 12.5%" },
            { minValue:12.500001, maxValue:     15.0, symbol: new SimpleLineSymbol({ color: bertColorData[3], width: 2.30 }), label: "12.5% to 15.0%" },
            { minValue:15.000001, maxValue:     17.5, symbol: new SimpleLineSymbol({ color: bertColorData[4], width: 3.50 }), label: "15.0% to 17.5%" },
            { minValue:17.500001, maxValue:     20.0, symbol: new SimpleLineSymbol({ color: bertColorData[5], width: 3.90 }), label: "17.5% to 20.0%" },
            { minValue:20.000001, maxValue:     22.5, symbol: new SimpleLineSymbol({ color: bertColorData[6], width: 4.10 }), label: "20.0% to 22.5%" },
            { minValue:22.500001, maxValue:     25.0, symbol: new SimpleLineSymbol({ color: bertColorData[7], width: 4.70 }), label: "22.5% to 25.0%" },
            { minValue:25.000001, maxValue:     30.0, symbol: new SimpleLineSymbol({ color: bertColorData[8], width: 5.30 }), label: "25.0% to 30.0%" },
            { minValue:30.000001, maxValue: Infinity, symbol: new SimpleLineSymbol({ color: "#000000"       , width: 5.50 }), label: "More than 30%"  }
          ]
        });

        let rendererPercent_Truck_Change = getPercentChangeRenderer('dVal');

        // Truck Volume Renderers
        const rendererVolTrk = new ClassBreaksRenderer({
          field: 'dVal',
          classBreakInfos: [
            { minValue:        0, maxValue:      599, symbol: new SimpleLineSymbol({ color: bertColorData[0], width: 1.10 }), label: "Less than 600"    },
            { minValue:      600, maxValue:     1799, symbol: new SimpleLineSymbol({ color: bertColorData[1], width: 1.10 }), label: "600 to 1,800"     },
            { minValue:     1800, maxValue:     3599, symbol: new SimpleLineSymbol({ color: bertColorData[2], width: 1.70 }), label: "1,800 to 3,600"   },
            { minValue:     3600, maxValue:     7199, symbol: new SimpleLineSymbol({ color: bertColorData[3], width: 2.30 }), label: "3,600 to 7,200"   },
            { minValue:     7200, maxValue:    11999, symbol: new SimpleLineSymbol({ color: bertColorData[4], width: 3.90 }), label: "7,200 to 12,000"  },
            { minValue:    12000, maxValue:    15999, symbol: new SimpleLineSymbol({ color: bertColorData[5], width: 3.50 }), label: "12,000 to 16,000" },
            { minValue:    16000, maxValue:    19999, symbol: new SimpleLineSymbol({ color: bertColorData[6], width: 4.10 }), label: "16,000 to 20,000" },
            { minValue:    20000, maxValue:    23999, symbol: new SimpleLineSymbol({ color: bertColorData[7], width: 4.70 }), label: "20,000 to 24,000" },
            { minValue:    24000, maxValue: Infinity, symbol: new SimpleLineSymbol({ color: bertColorData[8], width: 5.30 }), label: "More than 24,000" }
          ]
        });
        
        const rendererVolTrk_Change = new ClassBreaksRenderer({
          field: 'dVal',
          classBreakInfos: [
            { minValue: -999999, maxValue:   -10001, symbol: new SimpleLineSymbol({ color:aCR_Change9[0], width: 5.0000 }), label: "Less than -10,000"},
            { minValue:  -10000, maxValue:    -5001, symbol: new SimpleLineSymbol({ color:aCR_Change9[1], width: 2.5000 }), label: "-10,000 to -5,000"},
            { minValue:   -5000, maxValue:    -1501, symbol: new SimpleLineSymbol({ color:aCR_Change9[2], width: 1.2500 }), label: "-5,000 to -1,500" },
            { minValue:   -1500, maxValue:     -501, symbol: new SimpleLineSymbol({ color:aCR_Change9[3], width: 0.6250 }), label: "-1,500 to -500"   },
            { minValue:    -500, maxValue:      499, symbol: new SimpleLineSymbol({ color:aCR_Change9[4], width: 0.3125 }), label: "-500 to +500"     },
            { minValue:     500, maxValue:     1499, symbol: new SimpleLineSymbol({ color:aCR_Change9[5], width: 0.6250 }), label: "+100 to +1,500"   },
            { minValue:    1500, maxValue:     4999, symbol: new SimpleLineSymbol({ color:aCR_Change9[6], width: 1.2500 }), label: "+1,500 to +5,000" },
            { minValue:    5000, maxValue:     9999, symbol: new SimpleLineSymbol({ color:aCR_Change9[7], width: 2.5000 }), label: "+5,000 to +10,000"},
            { minValue:   10000, maxValue: Infinity, symbol: new SimpleLineSymbol({ color:aCR_Change9[8], width: 5.0000 }), label: "More than +10,000"}
          ]
        });
        
        const rendererVolTrkPer_Change = getPercentChangeRenderer('dVal');
        
        function generateValueExpression(featureName) {
          return "var p = $feature." + featureName + ";" +
                 "var ft = $feature.FT;" +
                 "if      ( p< -200              && ft>=20) { return 'class_f1' ; }" +
                 "else if ((p<  -40 && p>= -200) && ft>=20) { return 'class_f2' ; }" +
                 "else if ((p<  -20 && p>=  -40) && ft>=20) { return 'class_f3' ; }" +
                 "else if ((p<   -5 && p>=  -20) && ft>=20) { return 'class_f4' ; }" +
                 "else if ((p<    5 && p>=   -5) && ft>=20) { return 'class_f5' ; }" +
                 "else if ((p<   20 && p>=    5) && ft>=20) { return 'class_f6' ; }" +
                 "else if ((p<   40 && p>=   20) && ft>=20) { return 'class_f7' ; }" +
                 "else if ((p<  100 && p>=   40) && ft>=20) { return 'class_f8' ; }" +
                 "else if ((p<  200 && p>=  100) && ft>=20) { return 'class_f9' ; }" +
                 "else if ((p<  400 && p>=  200) && ft>=20) { return 'class_f10'; }" +
                 "else if ( p>  400              && ft>=20) { return 'class_f11'; }" +
                 "else if ( p< -200              && ft <20) { return 'class_r1' ; }" +
                 "else if ((p<  -40 && p>= -200) && ft< 20) { return 'class_r2' ; }" +
                 "else if ((p<  -20 && p>=  -40) && ft< 20) { return 'class_r3' ; }" +
                 "else if ((p<   -5 && p>=  -20) && ft< 20) { return 'class_r4' ; }" +
                 "else if ((p<    5 && p>=   -5) && ft< 20) { return 'class_r5' ; }" +
                 "else if ((p<   20 && p>=    5) && ft< 20) { return 'class_r6' ; }" +
                 "else if ((p<   40 && p>=   20) && ft< 20) { return 'class_r7' ; }" +
                 "else if ((p<  100 && p>=   40) && ft< 20) { return 'class_r8' ; }" +
                 "else if ((p<  200 && p>=  100) && ft< 20) { return 'class_r9' ; }" +
                 "else if ((p<  400 && p>=  200) && ft< 20) { return 'class_r10'; }" +
                 "else if ( p>  400              && ft< 20) { return 'class_r11'; }"
        }
        
        function getUniqueValueInfos(isReversed = false) {
          let baseColors = isReversed ? ["#000000", "#000000", ...aCR_Change9.slice().reverse()] : aCR_Change9;
          let freewayLabels = [
            "Freeway Less than -200%" ,
            "Freeway -200% to -40%"   ,
            "Freeway -40% to -20%"    ,
            "Freeway -20% to -5%"     ,
            "Freeway -5% to +5%"      ,
            "Freeway +5% to +20%"     ,
            "Freeway +20% to +40%"    ,
            "Freeway +40% to +100%"   ,
            "Freeway +100% to +200%"  ,
            "Freeway +200% to +400%"  ,
            "Freeway More than +400%" ];
          let arterialLabels = [
            "Arterial Less than -200%" ,
            "Arterial -200% to -40%"   ,
            "Arterial -40% to -20%"    ,
            "Arterial -20% to -5%"     ,
            "Arterial -5% to +5%"      ,
            "Arterial +5% to +20%"     ,
            "Arterial +20% to +40%"    ,
            "Arterial +40% to +100%"   ,
            "Arterial +100% to +200%"  ,
            "Arterial +200% to +400%"  ,
            "Arterial More than +400%" ];

          let lineWidths = [6.0000, 5.5000, 4.2500, 3.6250, 2.3125, 2.6250, 3.2500, 4.5000, 5.5000, 6.0000, 7.0000];
        
          let freewayValues = freewayLabels.map((label, index) => {
            return {
              value: "class_f" + (index + 1),
              label: label,
              symbol: new SimpleLineSymbol({color: baseColors[index], width: lineWidths[index]})
            };
          });
        
          let arterialValues = arterialLabels.map((label, index) => {
            return {
              value: "class_r" + (index + 1),
              label: label,
              symbol: new SimpleLineSymbol({color: baseColors[index], width: lineWidths[index] / 3})
            };
          });
        
          return [...freewayValues, ...arterialValues];
        }
        
        function createRenderer(featureName, isReversed = false) {
          return new UniqueValueRenderer({
            valueExpression: generateValueExpression(featureName),
            uniqueValueInfos: getUniqueValueInfos(isReversed)
          });
        }
        
        function getPercentChangeRenderer (featureName) {
          return createRenderer(featureName, false);
        }
        
        function getPercentChangeRenderer_Reverse (featureName) {
          return createRenderer(featureName, true);
        }
        

        // Set a renderer based on the 'dVal' field
        const rendererTemp = new ClassBreaksRenderer({
          field: "dVal",
          classBreakInfos: [
              { minValue:   0.01, maxValue:     5999, symbol: new SimpleLineSymbol({ color: new Color("#31398a"), width: 0.5000 }), label: "Less than 6,000"   },
              { minValue:   6000, maxValue:    17999, symbol: new SimpleLineSymbol({ color: new Color("#1ba9e6"), width: 1.1000 }), label: "6,000 to 18,000"   },
              { minValue:  18000, maxValue:    35999, symbol: new SimpleLineSymbol({ color: new Color("#00a74e"), width: 1.7000 }), label: "18,000 to 36,000"  },
              { minValue:  36000, maxValue:    71999, symbol: new SimpleLineSymbol({ color: new Color("#6cb74a"), width: 2.3000 }), label: "36,000 to 72,000"  },
              { minValue:  72000, maxValue:   119999, symbol: new SimpleLineSymbol({ color: new Color("#8dc348"), width: 3.9000 }), label: "72,000 to 120,000" },
              { minValue: 120000, maxValue:   159999, symbol: new SimpleLineSymbol({ color: new Color("#E09d2e"), width: 3.5000 }), label: "120,000 to 160,000"},
              { minValue: 160000, maxValue:   199999, symbol: new SimpleLineSymbol({ color: new Color("#Eb672d"), width: 4.1000 }), label: "160,000 to 200,000"},
              { minValue: 200000, maxValue:   239999, symbol: new SimpleLineSymbol({ color: new Color("#E5272d"), width: 4.7000 }), label: "200,000 to 240,000"},
              { minValue: 240000, maxValue: Infinity, symbol: new SimpleLineSymbol({ color: new Color("#Af2944"), width: 5.3000 }), label: "More than 240,000" }
          ]
        });

        var renderer;

        if (mode==='base') {
          switch(aCode) {
            case 'aLanes':
              renderer = rendererLanes;
              break;
            case 'aFt':
              renderer = rendererFt;
              break;
            case 'aFtClass':
              renderer = rendererFtClass;
              break;
            case 'aCap1HL':
              renderer = rendererCap;
              break;
            case 'aVc' :
              renderer = rendererVc;
              break;
            case 'aVol':
              renderer = rendererVol;
              break;
            case 'aSpd':
            case 'aFfSpd':
              renderer = rendererSpd;
              break;
            // ... and so on ...
            default:
              renderer = rendererTemp;
              // code to be executed if expression doesn't match any cases
          }
        } else if (mode==='compare') {
          switch(aCode) {
            case 'aLanes':
              renderer = rendererLanes_Change;
              break;
            case 'aFt':
              renderer = rendererFt_Change;
              break;
            case 'aFtClass':
              //renderer = rendererFtClass_Change;
              break;
            case 'aCap1HL':
              renderer = rendererCap_Change;
              break;
            case 'aVc' :
              renderer = rendererVc_Change;
              break;
            case 'aVol':
              renderer = rendererVol_Change;
              break;
            case 'aSpd':
            case 'aFfSpd':
              renderer = rendererSpd_Change;
              break;
            // ... and so on ...
            default:
              renderer = rendererTemp;
              // code to be executed if expression doesn't match any cases
          }
        }


        layerDisplay.renderer = renderer;
        layerDisplay.refresh();

        layerDisplay.visible = true;

        layerDisplay.queryFeatures().then(function(results) {
          console.log("Total number of features in layer:", results.features.length);
        });

        geojsonSegments.visible = false;

        //this.graphicsLayer.renderer = renderer;

        if (legend) {
          view.ui.remove(legend);
        }

        legend = new Legend({
          view: view,
          layerInfos: [{
            layer: layerDisplay,
            title: "Roadway Segments - Filtered by " + _filter
          }]
        });
        view.ui.add(legend, "bottom-right");
      
      };

      

      const modelEntityInstance = this;

      geojsonSegments.when(() => {
        geojsonSegments.queryFeatures().then((result) => {
          let graphicsToAdd = [];  // Temporary array to hold graphics

          result.features.forEach((feature) => {
            // Get SEGID from the feature's attributes
            const _segId = feature.attributes.SEGID;

            var _valueMain = 0;
            var _valueComp = 0;
            var _valueDisp = 0;

            // main value
            if (segDataMain!=='none') {
              if (segDataMain[_segId]!==undefined){
                _valueMain = segDataMain[_segId][aCode]
              }
            }

            // comp value
            if (segDataComp!=='none') {
              if (segDataComp[_segId]!==undefined) {
              _valueComp = segDataComp[_segId][aCode]
              }
            }

            var selectedRadio = document.querySelector('input[name="rcPcOption"]:checked');
            var curPCOption = selectedRadio ? selectedRadio.value : null;

            // calculate final display value based on selection (absolute or change)
            try {
              if (curPCOption=='abs') { // absolute change
              _valueDisp = _valueMain - _valueComp;
              } else if (curPCOption=='pct') { // percent change
                if (_valueComp>0) _valueDisp = ((_valueMain - _valueComp) / _valueComp) * 100;
              }
            } catch(err) {
              _valueDisp = _valueMain;
            }
            
            // If there's a display value for the given SEGID in the segDataMain object, set it
            if (segDataMain[_segId]) {
              let attributes = {
                ...feature.attributes,
                dVal: _valueDisp  // Add the dVal to attributes
              };

              // Create a new graphic with the updated attributes
              var graphic = new Graphic({
                geometry: feature.geometry,
                attributes: attributes
              });

              graphicsToAdd.push(graphic);  // Add graphic to the temporary array
            }
          });


          layerDisplay.on("error", function(event){
            console.log("Layer error: ", event.error);
          });

          // Source modifications will not propagate after layer has been loaded. Please use .applyEdits() instead
          layerDisplay.applyEdits({ addFeatures: graphicsToAdd })
            .then(function(editsResult) {
              if (editsResult.addFeatureResults.length > 0) {
                console.log("Number of features added:", editsResult.addFeatureResults.length);
                // Call this AFTER adding graphics to the feature layer
                setRendererAndLegend(aCode);
                
                // update agg table
                modelEntityInstance.updateFilters();
                modelEntityInstance.updateAggregations();

              } else {
                console.log("No features were added.");
              }
          })
          .catch(function(error) {
            console.log("Error applying edits:", error);
          });
          // Add graphics to the FeatureLayer's source
          //layerDisplay.source.addMany(graphicsToAdd);

        });
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
  window.ModelEntity = ModelEntity;

});







