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

  class VizMap {
    constructor(data) {
      this.mapViewDiv = data.mapViewDiv;
      this.mapOverlayDiv = data.mapOverlayDiv;
      this.sidebarDiv = data.sidebarDiv;
      this.attributeTitle = data.attributeTitle;
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
      container.id = this.id + "viz-map-sidebar";

      container.appendChild(this.attributeSelect.render());
      this.filters.forEach(filter => {
        container.appendChild(filter.render());
      });

      var divSidebar = document.getElementById(this.sidebarDiv);
      divSidebar.innerHTML = '';
      divSidebar.appendChild(container);  // Append the new element to the container
    }

    // When a different model is selected, update the available groups and years
    updateSelectorModelMain() {
      const model = document.getElementById('selectModMain').value;
      const selectGroup = document.getElementById('selectGrpMain');
      const matchGroup = [];
      
      // loop through the scenarios to find the groups with the selected model
      dataScenarios.forEach(entry=>{
        if(entry.modVersion == model) {
          matchGroup.push(entry.scnGroup);
        }
      });
      let i = 0;
      // Select the first valid group, disable invalid groups
      for (i = selectGroup.length-1; i >= 0; i--) {
        if (matchGroup.includes(selectGroup[i].innerHTML)) {
              selectGroup[i].disabled = false;
              selectGroup[i].selected = true;
        }
        else {
              selectGroup[i].disabled =true;
        }
      }
      this.updateSelectorGroupMain();
    }

    // When a different comparison model is update the groups
    updateSelectorModelCompare() {
      const model = document.getElementById('selectModComp').value;
      const selectGroup = document.getElementById('selectGrpComp');
      const matchGroup = [];

      if(model == 'none'){
        selectGroup[0].selected = true;
        selectGroup.disabled = true;
      }
      else {
        selectGroup.disabled = false;
        dataScenarios.forEach(entry=>{
          if(entry.modVersion == model) {
            matchGroup.push(entry.scnGroup);
          }
        });
        let i = 0;
        for (i = selectGroup.length-1; i >= 0; i--) {
          if (matchGroup.includes(selectGroup[i].innerHTML)) {
                selectGroup[i].disabled = false;
                selectGroup[i].selected = true;
          }
          else {
                selectGroup[i].disabled =true;
          }
        }
      }
      this.updateSelectorGroupCompare();
    }

    // Update the selectable years when the group changes
    updateSelectorGroupMain() {
      const model = document.getElementById('selectModMain').value;
      const group = document.getElementById('selectGrpMain').value;
      const selectYear = document.getElementById('selectYearMain');
      const matchYears = [];

      dataScenarios.forEach(entry=>{
        if(entry.scnGroup == group && entry.modVersion == model) {
          matchYears.push(entry.scnYear);
        }
      });
      let i = 0;
      for (i = selectYear.length-1; i >= 0; i--) {
        if (matchYears.includes(parseInt(selectYear[i].innerHTML))) {
              selectYear[i].disabled = false;
              selectYear[i].selected = true;
        }
        else {
              selectYear[i].disabled =true;
        }
      }
      this.updateMap();
    }

    // Update the selectable comparison years when the group changes
    updateSelectorGroupCompare() {
      const modelSelector = document.getElementById('selectModComp');
      const selectGroup = document.getElementById('selectGrpComp');
      const group = selectGroup.value;
      const selectYear = document.getElementById('selectYearComp');
      const matchYears = [];

      if(group == 'none'){
        selectYear[0].selected = true;
        selectYear.disabled = true;
      }
      else{
        selectYear.disabled = false;
        dataScenarios.forEach(entry=>{
          if(entry.modVersion && entry.scnGroup == group) {
            matchYears.push(entry.scnYear);
          }
        });
        let i = 0;
        for (i = selectYear.length-1; i >= 0; i--) {
          if (matchYears.includes(parseInt(selectYear[i].innerHTML))) {
                selectYear[i].disabled = false;
                selectYear[i].selected = true;
          }
          else {
                selectYear[i].disabled =true;
          }
        }
      }
      this.updateMap();
    }

    initListeners() {
      console.log('initListeners');
      
      document.getElementById('selectModMain').addEventListener('change', this.updateSelectorModelMain.bind(this));
      document.getElementById('selectGrpMain').addEventListener('change', this.updateSelectorGroupMain.bind(this));
      document.getElementById('selectYearMain').addEventListener('change', this.updateMap.bind(this));
      
      document.getElementById('selectModComp').addEventListener('change',  this.updateSelectorModelCompare.bind(this));
      document.getElementById('selectGrpComp').addEventListener('change', this.updateSelectorGroupCompare.bind(this));
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
  window.VizMap = VizMap;

});