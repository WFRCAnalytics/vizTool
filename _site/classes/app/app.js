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
    const jsonScenario = await fetchScenarioData();
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
      if (![...selectElement.children].some(option => option.value === String(optionValue))) {
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
    
    const _modMain  = document.getElementById('modVersion_Main');
    const _grpMain  = document.getElementById('scnGroup_Main');
    const _yearMain = document.getElementById('scnYear_Main');
  
    var _scenarioModel_Main = new Set();
    var _scenarioGroup_Main = new Set();
    var _scenarioYear_Main  = new Set();

    if (!_modMain || !_grpMain || !_yearMain) {
      console.error('One or more select elements not found');
      return;
    }
  
    // Set the selected scenario
    if (!selectedScenario_Main) {
      if (jsonScenario.initial_select && jsonScenario.initial_select.length > 0) {
        selectedScenario_Main = jsonScenario.initial_select[0];
      } else if (dataScenarios && dataScenarios.length > 0) {
        selectedScenario_Main = dataScenarios[0];
      }
    }

    // Check if selectedScenario_Main matches a record in dataScenarios for modVersion, scnGroup, and scnYear
    let matchedScenario_Main = dataScenarios.find(entry =>
      entry.modVersion === selectedScenario_Main.modVersion &&
      entry.scnGroup === selectedScenario_Main.scnGroup &&
      entry.scnYear === selectedScenario_Main.scnYear
    );

    if (!matchedScenario_Main) {
      // Check for modVersion and scnGroup match
      let matchedGroupScenario_Main = dataScenarios.find(entry =>
        entry.modVersion === selectedScenario_Main.modVersion &&
        entry.scnGroup === selectedScenario_Main.scnGroup
      );

      if (matchedGroupScenario_Main) {
        selectedScenario_Main.scnYear = matchedGroupScenario_Main.scnYear;
      } else {
        // If no match for modVersion and scnGroup, find the first valid scnGroup
        let firstValidGroup = dataScenarios.find(entry => entry.modVersion === selectedScenario_Main.modVersion);
        selectedScenario_Main.scnGroup = firstValidGroup.scnGroup;
        let firstValidYear = dataScenarios.find(entry =>
          entry.modVersion === selectedScenario_Main.modVersion &&
          entry.scnGroup === selectedScenario_Main.scnGroup
        );
        selectedScenario_Main.scnYear = firstValidYear.scnYear;
      }
    }
  
    if (selectedScenario_Main) {
      // Add entries to scenarioModel
      dataScenarios.forEach(entry => {
        _scenarioModel_Main.add(entry.modVersion);
  
        // Filter _scenarioGroup_Main and scenarioYear
        if (entry.modVersion === selectedScenario_Main.modVersion) {
          _scenarioGroup_Main.add(entry.scnGroup);
          if (entry.scnGroup === selectedScenario_Main.scnGroup) {
            _scenarioYear_Main.add(entry.scnYear);
          }
        }
      });
  
      await updateScenarioSelectOptions(_modMain, _scenarioModel_Main, selectedScenario_Main.modVersion);
      await updateScenarioSelectOptions(_grpMain, _scenarioGroup_Main, selectedScenario_Main.scnGroup);
      await updateScenarioSelectOptions(_yearMain, _scenarioYear_Main, selectedScenario_Main.scnYear);

    }

    const _modComp  = document.getElementById('modVersion_Comp');
    const _grpComp  = document.getElementById('scnGroup_Comp');
    const _yearComp = document.getElementById('scnYear_Comp');
  
    var _scenarioModel_Comp = new Set();
    var _scenarioGroup_Comp = new Set();
    var _scenarioYear_Comp  = new Set();

    if (!_modComp || !_grpComp || !_yearComp) {
      console.error('One or more select elements not found');
      return;
    }
  
    // Set the selected scenario
    if (!selectedScenario_Comp) {
      if (jsonScenario.initial_select && jsonScenario.initial_select.length > 0) {
        selectedScenario_Comp = jsonScenario.initial_select[0];
      } else if (dataScenarios && dataScenarios.length > 0) {
        selectedScenario_Comp = dataScenarios[0];
      }
    }

    // Check if selectedScenario_Comp matches a record in dataScenarios for modVersion, scnGroup, and scnYear
    let matchedScenario_Comp = dataScenarios.find(entry =>
      entry.modVersion === selectedScenario_Comp.modVersion &&
      entry.scnGroup === selectedScenario_Comp.scnGroup &&
      entry.scnYear === selectedScenario_Comp.scnYear
    );

    if (!matchedScenario_Comp) {
      // Check for modVersion and scnGroup match
      let matchedGroupScenario_Comp = dataScenarios.find(entry =>
        entry.modVersion === selectedScenario_Comp.modVersion &&
        entry.scnGroup === selectedScenario_Comp.scnGroup
      );

      if (matchedGroupScenario_Comp) {
        selectedScenario_Comp.scnYear = matchedGroupScenario_Comp.scnYear;
      } else {
        // If no match for modVersion and scnGroup, find the first valid scnGroup
        let firstValidGroup = dataScenarios.find(entry => entry.modVersion === selectedScenario_Comp.modVersion);
        if (firstValidGroup) {
          selectedScenario_Comp.scnGroup = firstValidGroup.scnGroup;
          let firstValidYear = dataScenarios.find(entry =>
            entry.modVersion === selectedScenario_Comp.modVersion &&
            entry.scnGroup === selectedScenario_Comp.scnGroup
          );
          if (firstValidYear) {
            selectedScenario_Comp.scnYear = firstValidYear.scnYear;
          } 
        } 
      }
    }
  
    if (selectedScenario_Comp) {
      // Add entries to scenarioModel

      dataScenarios.forEach(entry => {
        _scenarioModel_Comp.add(entry.modVersion);
  
        // Filter scenarioGroup and scenarioYear
        if (entry.modVersion === selectedScenario_Comp.modVersion) {
          _scenarioGroup_Comp.add(entry.scnGroup);
          if (entry.scnGroup === selectedScenario_Comp.scnGroup) {
            _scenarioYear_Comp.add(entry.scnYear);
          }
        }
      });

      await updateScenarioSelectOptions(_modComp, _scenarioModel_Comp, selectedScenario_Comp.modVersion);
      await updateScenarioSelectOptions(_grpComp, _scenarioGroup_Comp, selectedScenario_Comp.scnGroup);
      await updateScenarioSelectOptions(_yearComp, _scenarioYear_Comp, selectedScenario_Comp.scnYear);

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
    populateScenarioSelections();
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
    document.getElementById('selectCompareType').addEventListener('calciteSelectChange', updateScenarioSelection.bind(this));
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
      optionAbs.textContent = 'Absolute Change';
      calciteSelectCompare.appendChild(optionAbs);

      const optionPc = document.createElement('calcite-option');
      optionPc.value = 'pct';
      optionPc.textContent = 'Percent Change';
      calciteSelectCompare.appendChild(optionPc);

      // Append the calcite-select to the content container
      contentContainer.appendChild(calciteSelectCompare);

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