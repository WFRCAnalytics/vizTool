let globalTemplates = [];
let dataScenarios = []; // this object contains all the scenarios and their data
let dataScenarioTrends = []; // this object contains all the scneario trends definitions
let dataGeojsons = {}; // this object contains 
let map;
let geojsonSegments;
let mapView;
let layerDisplay;
let dummyFeature;
let dataMenu;
let activeModelEntity;
let scenarioChecker; // vizTrends global item
let modeSelect; // vizTrends global item
let selectedScenario_Main = {};
let selectedScenario_Comp = {};
let jsonScenario;

require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/Expand",
  "esri/widgets/BasemapToggle"
],
function(esriConfig, Map, MapView, Expand, BasemapToggle,) {

  // TODO: LOOK FOR WAYS TO HIDE KEY OR USE OTHER SOURCE
  esriConfig.apiKey = "AAPK5f27bfeca6bb49728b7e12a3bfb8f423zlKckukFK95EWyRa-ie_X31rRIrqzGNoqBH3t3Chvz2aUbTKiDvCPyhvMJumf7Wk";

  async function fetchConfig() {
    console.log('app:fetchConfig');
    const response = await fetch('config.json');
    const dataConfig = await response.json();
    return dataConfig;
  }

  async function fetchScenarioData() {
    console.log('app:fetchScenarioData');
    const response = await fetch('scenarios.json');
    const dataScenario = await response.json();
    return dataScenario;
  }

  async function fetchScenarioTrendData() {
    console.log('app:fetchScenarioTrendData');
    const response = await fetch('scenario-trends.json');
    const dataScenarioTrend = await response.json();
    return dataScenarioTrend;
  }

  async function loadScenarios() {
    console.log('app:loadScenarios');

    // load scenario data
    jsonScenario = await fetchScenarioData();
    dataScenarios = jsonScenario.data.map(item => new Scenario(item));

    // set the selected scenario to the initial_select in json, if exists, otherwise pick first scenario
    // Set the selected scenario
    if (jsonScenario.initial_select && jsonScenario.initial_select.length > 0) {
      selectedScenario_Main = jsonScenario.initial_select[0];
      selectedScenario_Comp = jsonScenario.data[0];
    } else if (jsonScenario.data && jsonScenario.data.length > 0) {
      selectedScenario_Main = jsonScenario.data[0];
      selectedScenario_Comp = jsonScenario.data[0];
    } else {
      selectedScenario_Main = null; // or handle the case where there is no data appropriately
      selectedScenario_Comp = null; // or handle the case where there is no data appropriately
    }

    // load scenario trend data
    const jsonScenarioTrend = await fetchScenarioTrendData();
    dataScenarioTrends = jsonScenarioTrend.map(item => new ScenarioTrend(item));
  
    dataGeojsons = {};

    const _geojsonfilenames = new Set();

    dataScenarios.forEach(scenario => {
      let _geojsons = Object.values(scenario.geojsons);

      _geojsons.forEach((_geojson) => {
        _geojsonfilenames.add(_geojson);
      });
    });

    _geojsonfilenames.forEach(_geojsonfilename => {
      fetchAndStoreGeoJsonData(_geojsonfilename);
    });

    await populateScenarioSelections();
    
  }

  // Function to fetch and store data
  function fetchAndStoreGeoJsonData(fileName) {
    fetch(`data/${fileName}`)
      .then(response => response.json())
      .then(jsonData => {
        // Store the processed data in the object with the filename as key
        dataGeojsons[fileName] = jsonData;
      })
      .catch(error => console.error(`Error fetching data from ${fileName}:`, error));
  }

  async function loadMenuAndItems() {
    console.log('app:loadMenuAndItems');
    const jsonConfig = await fetchConfig();

    const userElement = document.querySelector('calcite-navigation-user[slot="user"]');
    const username = userElement.getAttribute('username');

    const dataApp = jsonConfig['users'].map(item => new User(item));
    dataMenu = dataApp.filter(item => item.userType === username)[0].userLayout.menuItems;
    const calciteMenu = document.querySelector('calcite-menu[slot="content-start"]');

    // Clear existing menu items
    calciteMenu.innerHTML = '';

    // Render each menu item and log (or insert into the DOM)
    dataMenu.forEach(menuItem => {
      calciteMenu.appendChild(menuItem.createMenuItemElement());
    });

    // populate jsons for scenarios
    dataScenarios.forEach(scenario => {
      scenario.loadData(dataMenu);
    });
  }

  async function toggleCompare(element) {
    console.log(element);
  }

  async function updateScenarioSelectOptions(selectElement, options, selectedValue) {
    console.log('app:updateScenarioSelectOptions');
  
    if (!selectElement) {
      console.error('Select element not found:', selectElement);
      return;
    }

    // Remove options not in the new list
    Array.from(selectElement.children).forEach(option => {
        selectElement.removeChild(option);
    });
  
    // Add new options
    options.forEach(optionValue => {
      if (![...selectElement.children].some(option => String(option.value) === String(optionValue))) {
        const option = document.createElement('calcite-option');
        option.value = String(optionValue);
        option.label = String(optionValue);
        if (option.value==String(selectedValue)) {
          option.selected = true;
        } else {
          option.selected = false;
        }
        selectElement.appendChild(option);
      }
    });

  }

  async function populateScenarioSelections() {
    console.log('app:populateScenarioSelections');
    
    const elements = [
      { mod: 'modVersion_Main', grp: 'scnGroup_Main', year: 'scnYear_Main', scenario: 'selectedScenario_Main' },
      { mod: 'modVersion_Comp', grp: 'scnGroup_Comp', year: 'scnYear_Comp', scenario: 'selectedScenario_Comp' }
    ];
  
    for (let elem of elements) {
      const modElem = document.getElementById(elem.mod);
      const grpElem = document.getElementById(elem.grp);
      const yearElem = document.getElementById(elem.year);
    
      if (!modElem || !grpElem || !yearElem) {
        console.error('One or more select elements not found');
        return;
      }
  
      let selectedScenario = elem.scenario === 'selectedScenario_Main' ? selectedScenario_Main : selectedScenario_Comp;
  
      if (!selectedScenario) {
        selectedScenario = jsonScenario.initial_select?.[0] || dataScenarios?.[0];
      }
      
      let matchedScenario = dataScenarios.find(entry =>
        entry.modVersion === selectedScenario.modVersion &&
        entry.scnGroup === selectedScenario.scnGroup &&
        entry.scnYear === selectedScenario.scnYear
      );
  
      if (!matchedScenario) {
        let matchedGroupScenario = dataScenarios.find(entry =>
          entry.modVersion === selectedScenario.modVersion &&
          entry.scnGroup === selectedScenario.scnGroup
        );
  
        if (matchedGroupScenario) {
          selectedScenario.scnYear = matchedGroupScenario.scnYear;
        } else {
          let firstValidGroup = dataScenarios.find(entry => entry.modVersion === selectedScenario.modVersion);
          selectedScenario.scnGroup = firstValidGroup?.scnGroup;
          let firstValidYear = dataScenarios.find(entry =>
            entry.modVersion === selectedScenario.modVersion &&
            entry.scnGroup === selectedScenario.scnGroup
          );
          selectedScenario.scnYear = firstValidYear?.scnYear;
        }
      }
      
      if (selectedScenario) {
        let scenarioModel = new Set();
        let scenarioGroup = new Set();
        let scenarioYear = new Set();
  
        dataScenarios.forEach(entry => {
          scenarioModel.add(entry.modVersion);
    
          if (entry.modVersion === selectedScenario.modVersion) {
            scenarioGroup.add(entry.scnGroup);
            if (entry.scnGroup === selectedScenario.scnGroup) {
              scenarioYear.add(entry.scnYear);
            }
          }
        });
  
        await updateScenarioSelectOptions(modElem, scenarioModel, selectedScenario.modVersion);
        await updateScenarioSelectOptions(grpElem, scenarioGroup, selectedScenario.scnGroup);
        await updateScenarioSelectOptions(yearElem, scenarioYear, selectedScenario.scnYear);
      }
        
      if (elem.scenario === 'selectedScenario_Main') {
        selectedScenario_Main = selectedScenario;
      } else if (elem.scenario === 'selectedScenario_Comp') {
        selectedScenario_Comp = selectedScenario;
      }
    }
  }
    
  async function updateScenarioSelection(scenarioSelect) {
    console.log("app:updateScenarioSelection");

    // see which selector changed
    const changedSelectorId = scenarioSelect.target.id;
    const selectedValue = scenarioSelect.target.value;

    var selectedScenario_x = {};

    // get last four characters: Main or Comp
    const _orMainComp = changedSelectorId.slice(-4);

    if (_orMainComp === 'Main') {
      selectedScenario_x = selectedScenario_Main;
    } else {
      selectedScenario_x = selectedScenario_Comp;
    }

    // remove last five characters
    const _variable = changedSelectorId.slice(0, -5);

    if (_variable!='scnYear') {
      selectedScenario_x[_variable] = String(selectedValue);
    } else {
      const _year = parseInt(selectedValue, 10);
      selectedScenario_x[_variable] = _year;
    }
    await populateScenarioSelections();
    updateActiveVizMap();
  }
    
  async function init() {
    console.log('app:init');
    await loadScenarios();
    await initVizMapListeners();
    const menuStructure = await loadMenuAndItems();
  }

  async function updateActiveVizMap() {
    console.log(dataMenu);
    dataMenu.forEach(menuItem => {
      menuItem.modelEntities.forEach(modelEntity => {
        if (modelEntity.id == activeModelEntity.id & modelEntity.template=='vizMap') {
          console.log('app:initVizMapListeners:updateActiveVizMap:' + modelEntity.id);
          modelEntity.vizLayout.updateDisplay();
        }
      });
    });
  }

  async function initVizMapListeners() {
    console.log('app:initVizMapListeners');
            
    document.getElementById('modVersion_Main'  ).addEventListener('calciteSelectChange', updateScenarioSelection.bind(this));
    document.getElementById('scnGroup_Main'    ).addEventListener('calciteSelectChange', updateScenarioSelection.bind(this));
    document.getElementById('scnYear_Main'     ).addEventListener('calciteSelectChange', updateScenarioSelection.bind(this));
    document.getElementById('modVersion_Comp'  ).addEventListener('calciteSelectChange', updateScenarioSelection.bind(this));
    document.getElementById('scnGroup_Comp'    ).addEventListener('calciteSelectChange', updateScenarioSelection.bind(this));
    document.getElementById('scnYear_Comp'     ).addEventListener('calciteSelectChange', updateScenarioSelection.bind(this));
    document.getElementById('selectCompareType').addEventListener('calciteSelectChange', updateActiveVizMap);
    document.getElementById('comparisonScenario').addEventListener('calciteBlockToggle', updateActiveVizMap);
    

    document.getElementById('vizMapLabelToggle').addEventListener('calciteCheckboxChange', (event) => {  // Arrow function here
      console.log(dataMenu);
      dataMenu.forEach(menuItem => {
        menuItem.modelEntities.forEach(modelEntity => {
          if (modelEntity.id == activeModelEntity.id & modelEntity.template=='vizMap') {
            console.log('app:initVizMapListeners:updateActiveVizMap:' + modelEntity.id);
            modelEntity.vizLayout.toggleLabels();
          }
        });
      });
    });
  }

  async function populateTemplates() {
    console.log('app:populateTemplates');

    const container = document.getElementById('main');
    const fetchPromises = [];
  
    globalTemplates.forEach(template => {
      const div = document.createElement('div');
      div.id = template.templateType + 'Template';
      div.classList.add('template');
      div.hidden = true;
  
      if (template.layoutDivs) {
        div.innerHTML = template.layoutDivs;
        container.appendChild(div);
      } else if (template.layoutHtml) {
        const fetchPromise = fetch(template.layoutHtml)
          .then(response => response.text())
          .then(data => {
            div.innerHTML = data;
            container.appendChild(div);
          })
          .catch(error => console.error('Error loading HTML:', error));
  
        fetchPromises.push(fetchPromise);
      } else {
        container.appendChild(div);
      }
    });
  
    Promise.all(fetchPromises).then(() => {
      // All templates are loaded, now add the map
      addMapAndOtherFunctionality();
    });
  }
  
  function addMapAndOtherFunctionality() {
    console.log('app:addMapAndOtherFunctionality');
    
    // get templates with maps
    let templatesWithMapView = Object.values(globalTemplates).filter(template => {
      return template.mapView !== undefined && template.mapView !== null;
    });

    templatesWithMapView.forEach(template=> {

      // add maps
      map = new Map({
        basemap: "gray-vector"
      });
      
      mapView = new MapView({
        map: map,
        center: [-111.8910, 40.7608],
        zoom: 10,
        container: template.mapView
      });
    
      // add basemap toggle
      const basemapToggle = new BasemapToggle({
        view: mapView,
        nextBasemap: "arcgis-imagery"
      });
      
      mapView.ui.add(basemapToggle,"bottom-left");

      // CREATE SCENARIO SELECTOR

      // Create a container for the widget content
      const contentContainer = document.createElement('div');
      contentContainer.className = 'scenario-selector-container';
      
      // Add some descriptive text
      const descriptionText = document.createElement('div');
      descriptionText.innerHTML = '<b>Scenario Selector<b>';
      contentContainer.appendChild(descriptionText);

      const lstSelectIds = ['modVersion_Main','scnGroup_Main','scnYear_Main'];
      const compSelectIds = ['modVersion_Comp','scnGroup_Comp','scnYear_Comp'];

      lstSelectIds.forEach(id => {
        // Create a flex container for each select and its buttons
        const flexContainer = document.createElement('div');
        flexContainer.style.display = 'flex';
        flexContainer.style.alignItems = 'center'; // Align items vertically
        flexContainer.style.width = '100%'; // Set container to full width

        // Create a calcite-select element
        const calciteSelect = document.createElement('calcite-select');
        calciteSelect.id = id;
        calciteSelect.style.flexGrow = '1'; // Allow the select element to grow

        if (id.includes('Main') || id.includes('Mod') ) {
          calciteSelect.style.display = 'flex';
        } else {
          calciteSelect.style.display = 'none';
        }
    
        // Append the calcite-select to the flex container
        flexContainer.appendChild(calciteSelect);

        // Append the flex container to the content container
        contentContainer.appendChild(flexContainer);
      });

      const block = document.createElement('calcite-block');
      block.id = 'comparisonScenario';
      block.setAttribute('heading', 'Compare to:');
      block.setAttribute('collapsible', true);

      compSelectIds.forEach(id => {
        // Create a flex container for each select and its buttons
        const flexContainer = document.createElement('div');
        flexContainer.style.display = 'flex';
        flexContainer.style.alignItems = 'center'; // Align items vertically
        flexContainer.style.width = '100%'; // Set container to full width

        // Create a calcite-select element
        const calciteSelect = document.createElement('calcite-select');
        calciteSelect.id = id;
        calciteSelect.style.flexGrow = '1'; // Allow the select element to grow

        // Append the calcite-select to the flex container
        flexContainer.appendChild(calciteSelect);

        // Append the flex container to the block
        block.appendChild(flexContainer);
      });

      const headingCompare = document.createElement('div');
      headingCompare.innerHTML = '<br/>Compare Type'; // Replace with your desired text
      headingCompare.id = 'compare-type-label'; // Replace with your desired text
      block.appendChild(headingCompare);

      // Create a calcite-select element
      const calciteSelectCompare = document.createElement('calcite-select');
      calciteSelectCompare.id = 'selectCompareType';
      calciteSelectCompare.value = 'abs';

      const optionAbs = document.createElement('calcite-option');
      optionAbs.value = 'abs';
      optionAbs.textContent = 'Absolute Difference';
      calciteSelectCompare.appendChild(optionAbs);

      const optionPc = document.createElement('calcite-option');
      optionPc.value = 'pct';
      optionPc.textContent = 'Percent Difference';
      calciteSelectCompare.appendChild(optionPc);

      // Append the calcite-select to the block and the block to the content container
      block.appendChild(calciteSelectCompare);
      contentContainer.appendChild(block);

      // Create the Expand widget
      const expandScenario = new Expand({
        view: mapView,
        content: contentContainer,
        expandIcon: "collection",
        expanded: true,
        expandTooltip: 'Scenario Selector',
        group: "top-right"
      });

      // Add the Expand widget to the view
      mapView.ui.add(expandScenario, "top-right");

      // ADD LABEL TOGGLE

      // Create a container for the widget content
      const contentContainerLabelToggle = document.createElement('div');
      contentContainerLabelToggle.className = 'label-toggle-container';

      var checkboxLabel = document.createElement("calcite-label");
      checkboxLabel.setAttribute('layout', 'inline');
      checkboxLabel.classList.add('pointer-cursor');

      var calciteCheckbox = document.createElement("calcite-checkbox");
      calciteCheckbox.id = 'vizMapLabelToggle'; // Set an ID for the checkbox
      calciteCheckbox.checked = true;
      
      checkboxLabel.appendChild(calciteCheckbox);
      checkboxLabel.appendChild(document.createTextNode('Show Labels'));

      // Append the calcite-checkbox and the label to a container element in your DOM
      contentContainerLabelToggle.appendChild(checkboxLabel);

      // Create the Expand widget
      const expandLabelToggle = new Expand({
        view: mapView,
        content: contentContainerLabelToggle,
        expandIcon: "label",
        expandTooltip: 'Labels',
        group: "top-right"
      });

      // Add the Expand widget to the view
      mapView.ui.add(expandLabelToggle, "top-right");

    });

    init();
  }

  fetch('templates/templates.json')
  .then(response => response.json())
  .then(data => {
    globalTemplates = data;
    // Optionally, initialize your classes or do other tasks here, 
    // once the data is fetched and assigned.
    populateTemplates();
  })
  .catch(error => {
    console.error("Error fetching templates:", error);
  });

});