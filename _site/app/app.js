let globalTemplates = [];
let dataScenarios = []; // this object contains all the scenarios and their data
let dataScenarioTrends = []; // this object contains all the scneario trends definitions
let dataGeojson = {};
let dataKeys = {};
let map;
let geojsonSegments;
let mapView;
let layerDisplay;
let dummyFeature;
let dataMenu;
let activeModelEntity;
let scenarioChecker; // vizTrends global item
let scenarioRadioer; // vizTrends global item
let modeSelect; // vizTrends global item
let selectedScenario_Main = {};
let selectedScenario_Comp = {};
let jsonScenario;
let configApp;
let configAttributes;
let configAggregators;
let configDividers;
let configFilters;
let menuItems;
let onOpenMenuItem;
let onOpenModelEntity;
let centerMap = [-111.8910, 40.7608]; // default value replaced programatically from json value
let zoom = 10; // default value replaced programatically from json value
let yearSelect = {};
let activeLayout = {};
let seriesModeSelect;

// Global variables to track total files and loaded files across all scenarios
let totalFilesToLoad = 0;
let totalLoadedFiles = 0;

// Global variables to track total files and loaded files across all scenarios
let totalFilesToLoadGeo = 0;
let totalLoadedFilesGeo = 0;

require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/Expand",
  "esri/widgets/BasemapToggle",
  "esri/widgets/Zoom"
],
function(esriConfig, Map, MapView, Expand, BasemapToggle, Zoom) {

  // TODO: LOOK FOR WAYS TO HIDE KEY OR USE OTHER SOURCE
  esriConfig.apiKey = "AAPK5f27bfeca6bb49728b7e12a3bfb8f423zlKckukFK95EWyRa-ie_X31rRIrqzGNoqBH3t3Chvz2aUbTKiDvCPyhvMJumf7Wk";

  async function fetchConfigApp() {
    console.log('app:fetchConfigApp');
    const response = await fetch('config/app.json');
    const dataConfigApp = await response.json();
    return dataConfigApp;
  }

  async function fetchConfigAttributes() {
    console.log('app:fetchConfigAttributes');
    const response = await fetch('config/attributes.json');
    const dataConfigAttributes = await response.json();
    return dataConfigAttributes;
  }

  async function fetchConfigAggregators() {
    console.log('app:fetchConfigAggregators');
    const response = await fetch('config/aggregators.json');
    const dataConfigAggregators = await response.json();
    return dataConfigAggregators;
  }

  async function fetchConfigFilters() {
    console.log('app:fetchConfigFilters');
    const response = await fetch('config/filters.json');
    const dataConfigFilters = await response.json();
    return dataConfigFilters;
  }

  async function fetchConfigDividers() {
    console.log('app:fetchConfigDividers');
    const response = await fetch('config/dividers.json');
    const dataConfigDividers = await response.json();
    return dataConfigDividers;
  }

  async function fetchScenarioData() {
    console.log('app:fetchScenarioData');
    const response = await fetch('config/scenarios.json');
    const dataScenario = await response.json();
    return dataScenario;
  }

  async function loadScenarios() {
    console.log('app:loadScenarios');

    // load scenario data
    jsonScenario = await fetchScenarioData();
    dataScenarios = jsonScenario.scenarios.map(item => new Scenario(item));

    // set the selected scenario to the initial_select in json, if exists, otherwise pick first scenario
    // Set the selected scenario
    if (jsonScenario.initial_select && jsonScenario.initial_select.length > 0) {
      selectedScenario_Main = jsonScenario.initial_select[0];
    } else if (jsonScenario.scenarios && jsonScenario.scenarios.length > 0) {
      selectedScenario_Main = jsonScenario.scenarios[0];
    } else {
      selectedScenario_Main = null; // or handle the case where there is no data appropriately
    }

    // set the selected scenario to the initial_select in json, if exists, otherwise pick first scenario
    // Set the selected scenario
    if (jsonScenario.initial_select_compare && jsonScenario.initial_select_compare.length > 0) {
      selectedScenario_Comp = jsonScenario.initial_select_compare[0];
    } else if (jsonScenario.scenarios && jsonScenario.scenarios.length > 1) {
      selectedScenario_Comp = jsonScenario.scenarios[1];
    } else {
      selectedScenario_Comp = null; // or handle the case where there is no data appropriately
    }

    // load scenario trend data
    const scenarioTrends = jsonScenario.trends.map(trend => {
      // Check if scnTrendCode is defined for the trend
      if (!trend.scnTrendCode) {
        return null; // Skip this trend by returning null
      }
    
      const modelruns = jsonScenario.scenarios
        .filter(scenario => 
          scenario.scnTrendCodes && scenario.scnTrendCodes.includes(trend.scnTrendCode)
        )
        .map(scenario => ({
          modVersion: scenario.modVersion,
          scnGroup: scenario.scnGroup,
          scnYear: scenario.scnYear
        }));
      
      return {
        scnTrendCode: trend.scnTrendCode,
        alias: trend.alias,
        displayByDefault: trend.displayByDefault,
        modelruns: modelruns
      };
    }).filter(trend => trend !== null); // Remove any null values from the array
    
    dataScenarioTrends = scenarioTrends.map(item => new ScenarioTrend(item));
  
    dataGeojsons = {};
    dataKeys     = {};

    let _geojsonfilenames = new Set();
    let _keysfilenames    = new Set();

    for (const model of jsonScenario.models) {
      let _geojsons = Object.values(model.geojsons);
      for (const _geojson of _geojsons) {
        _geojsonfilenames.add(_geojson);
      }
      let _keygroups = Object.values(model.keys);
      for (const _keygroup of _keygroups) {
        let _keys = Object.values(_keygroup);
        for (const _key of _keys) {
          _keysfilenames.add(_key);
        }
      }
    }

    totalFilesToLoadGeo = _geojsonfilenames.size;

    // Progress bar elements
    const progressBarGeo = document.getElementById('progress-geo');
    const progressTextGeo = document.getElementById('progress-text-geo');

    // Function to update progress for GeoJSON files
    const updateProgressGeo = () => {
      // Calculate the progress percentage
      const progressValueGeo = (totalLoadedFilesGeo / totalFilesToLoadGeo) * 100;
  
      // Update the progress bar and text
      const progressBarGeo = document.getElementById('progress-geo');
      const progressTextGeo = document.getElementById('progress-text-geo');
  
      progressBarGeo.value = progressValueGeo;
      progressTextGeo.textContent = `${Math.floor(progressValueGeo)}%`;
      
      checkAndHideProgressContainer();
    };

    // Create an array to hold all fetch promises
    let fetchPromises = [];

    // Fetch and store GeoJSON data for each filename
    for (const _geojsonfilename of _geojsonfilenames) {
        let fetchPromise = fetchAndStoreGeoJsonData(_geojsonfilename, updateProgressGeo);
        fetchPromises.push(fetchPromise);
    }

    // Fetch and store GeoJSON data for each filename
    for (const _keysfilename of _keysfilenames) {
      let fetchPromise = fetchAndStoreJsonKeys(_keysfilename, updateProgressGeo);
      fetchPromises.push(fetchPromise);
    }

    // Wait for all GeoJSON data fetching to complete
    await Promise.all(fetchPromises);

    // Now that all GeoJSON data is fetched, you can proceed with the rest
    await populateScenarioSelections();
    
  }

  // Function to fetch and store data
  async function fetchAndStoreGeoJsonData(fileName, updateProgressGeo) {
    try {
      const response = await fetch(`geo-data/${fileName}`);
      const jsonData = await response.json();
      // Store the processed data in the object with the filename as key
      dataGeojsons[fileName] = jsonData;
      totalLoadedFilesGeo++;  // Still increment the loaded files counter
      updateProgressGeo();  // Call the progress update function even if file doesn't exist
    } catch (error) {
      console.error(`Error fetching data from ${fileName}:`, error);
      totalLoadedFilesGeo++;  // Still increment the loaded files counter
      updateProgressGeo();  // Call the progress update function even if file doesn't exist
    }
  }

  // Function to fetch and store data
  async function fetchAndStoreJsonKeys(fileName) {
    try {
      const response = await fetch(`geo-data/keys/${fileName}`);
      const jsonData = await response.json();
      // Store the processed data in the object with the filename as key
      dataKeys[fileName] = jsonData;
    } catch (error) {
      console.error(`Error fetching data from ${fileName}:`, error);
    }
  }

  async function loadMenuAndItems() {
    console.log('app:loadMenuAndItems');

    configAggregators = await fetchConfigAggregators();
    configAttributes  = await fetchConfigAttributes ();
    configFilters     = await fetchConfigFilters();
    configDividers    = await fetchConfigDividers();

    configApp = await fetchConfigApp();
    const calciteMenu = document.querySelector('calcite-menu[slot="content-start"]');

    // Clear existing menu items
    calciteMenu.innerHTML = '';

    menuItems = configApp.menuItems.map(menuItem => new MenuItem(menuItem, hideAllLayoutLayers));

    dataMenu = menuItems;

    // Render each menu item and log (or insert into the DOM)
    menuItems.forEach(menuItem => {
      calciteMenu.appendChild(menuItem.createMenuItemElement());
    });

    // Progress bar elements
    const progressBar = document.getElementById('progress');
    const progressText = document.getElementById('progress-text');

    const updateProgress = () => {
      // Calculate the progress percentage
      const progressValue = (totalLoadedFiles / totalFilesToLoad) * 100;
  
      // Update the progress bar and text
      const progressBar = document.getElementById('progress');
      const progressText = document.getElementById('progress-text');
  
      progressBar.value = progressValue;
      progressText.textContent = `${Math.floor(progressValue)}%`;

      checkAndHideProgressContainer();
    };

    // Calculate total number of files to load across all scenarios
    dataScenarios.forEach(scenario => {
        let jsonFileNames = new Set();
        
        // Collect unique JSON file names
        dataMenu.forEach(menuItem => {
          if (menuItem.modelEntities) {
            menuItem.modelEntities.forEach(modelEntity => {
              if (modelEntity.vizLayout && modelEntity.vizLayout.jsonName) {
                jsonFileNames.add(modelEntity.vizLayout.jsonName);
              }
            });
          }
        });
    });

    // Load data for each scenario, passing the updateProgress function to be called when each file is loaded
    for (let scenario of dataScenarios) {
        scenario.loadData(dataMenu, updateProgress);
    }

    // Ensure progress reaches 100% when all data is loaded
    if (totalLoadedFiles === totalFilesToLoad) {
        progressBar.value = 100;
        progressText.textContent = '100%';
    }

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
    
  // Adjust the init function to ensure it waits for loadScenarios to fully complete
  async function init() {
    console.log('app:init');
    // Load and display the disclaimer modal
    await loadAppConfig();
    await loadScenarios();
    await loadMenuAndItems();
    await initVizMapListeners();
  }

  async function loadAppConfig() {
    try {
      const response = await fetch('config/app.json');
      const appConfig = await response.json();
  
      // Set the title and version in the Esri object
      const logoElement = document.querySelector('calcite-navigation-logo');
      logoElement.setAttribute('heading', appConfig.title || "vizTool");
      logoElement.setAttribute('description', appConfig.subtitle || "v24.8.14 beta");
  
      // Load and display the disclaimer modal if applicable
      await loadAndDisplaySplash(appConfig.splash);
    } catch (error) {
      console.error('Error loading app.json:', error);
    }
  }
  
  async function loadAndDisplaySplash(disclaimer) {
    // Check if the disclaimer should be shown
    if (disclaimer.on) {
      const modalContent = document.querySelector('#infoModal .modal-content');
      modalContent.innerHTML = "<h1>" + disclaimer.title + "</h1>";
      modalContent.innerHTML += disclaimer.textHtml;

      const modal = document.getElementById('infoModal');
      const loadScreen = document.getElementById('load-screen')

      modal.style.display = 'block';

      document.getElementById('info-modal-content').style.display = 'block';
      
      const okButton = document.getElementById('okButton');
      okButton.onclick = function() {
        modal.style.display = 'none';
        loadScreen.style.display = 'block';
      };
    } else {
      // If the disclaimer is off, ensure the modal is not displayed
      const modal = document.getElementById('infoModal');
      modal.style.display = 'none';
      loadScreen.style.display = 'block';
    }
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

    document.getElementById("openbtn").addEventListener("click", function() {
      const sidebar = document.getElementById("mapSidebar");
      const mainMap = document.getElementById("mainMap");
    
      // Toggle the collapsed class
      sidebar.classList.toggle("collapsed");
      mainMap.classList.toggle("collapsed");
      this.classList.toggle("collapsed");
    
      // Change button text based on state
      if (sidebar.classList.contains("collapsed")) {
        this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
      } else {
        this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`;
      }
      
    });
    
    document.getElementById("openbtntrend").addEventListener("click", function() {
      const sidebar = document.getElementById("trendSidebar");
      const main = document.getElementById("trendMain");
    
      // Toggle the collapsed class
      sidebar.classList.toggle("collapsed");
      main.classList.toggle("collapsed");
      this.classList.toggle("collapsed");
    
      // Change button text based on state
      if (sidebar.classList.contains("collapsed")) {
        this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-collapse"></span>`;
      } else {
        this.innerHTML = `<span aria-hidden="true" class="esri-collapse__icon esri-expand__icon--expanded esri-icon-expand"></span>`;
      }
      
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
        center: centerMap,
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
      calciteSelectCompare.value = 'diff';

      const optionAbs = document.createElement('calcite-option');
      optionAbs.value = 'diff';
      optionAbs.textContent = 'Difference';
      calciteSelectCompare.appendChild(optionAbs);

      const optionPc = document.createElement('calcite-option');
      optionPc.value = 'pctdiff';
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
        
      // Remove default zoom controls
      mapView.ui.remove("zoom");

      // Create a new Zoom widget
      const zoomWidget = new Zoom({
          view: mapView
      });

          
      // Add the Zoom widget to the top-right corner of the view
      mapView.ui.add(zoomWidget, "top-right");

    });

    init();
  }

  fetch('app/templates/templates.json')
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

  function hideAllLayoutLayers() {
    menuItems.forEach(menuItem => {
      menuItem.hideAllMenuItemLayers();
    });
  };

});

// find the first scenario that has trend data for a given jsonName
function getFirstScenarioWithTrendData(jsonName) {
  console.log('getFirstScenarioWithTrendData');
  return dataScenarios.find(scenario => scenario.jsonData.hasOwnProperty(jsonName));
}

// Function to hide the progress container when both progress bars reach 100%
function checkAndHideProgressContainer() {
  const progressBar = document.getElementById('progress').value;
  const progressBarGeo = document.getElementById('progress-geo').value;
  
  // Check if both progress bars are at 100%
  if (progressBar === 100 && progressBarGeo === 100) {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
      // Delay hiding by 1 seconds (1000 milliseconds)
      setTimeout(() => {

        onOpenMenuItem = configApp.onOpen.menuItem;
        onOpenModelEntity = configApp.onOpen.modelEntity;

        progressContainer.style.display = 'none';
        document.getElementById('menu').style.display = 'block';

        // Find the menu item where menuText matches onOpenMenuItem
        const selectedMenuItem = menuItems.find(item => item.menuText === onOpenMenuItem);

        if (selectedMenuItem && selectedMenuItem.loadMenuItemAndModelEntity) {
            // Call the function to load the menu item and model entity
            selectedMenuItem.loadMenuItemAndModelEntity(onOpenModelEntity);
        } else {
            console.error('Menu item with matching menuText or load function not found');
        }
        
        centerMap = [configApp.onOpen.centerMap.lon, configApp.onOpen.centerMap.lat];
        zoomMap = configApp.onOpen.zoomMap;

        mapView.when(() => {
          mapView.goTo({
            center: centerMap,  // ArcGIS expects [longitude, latitude]
            zoom: zoomMap // Optionally set a default zoom level
          }).catch(function(error) {
            console.error("Error in recentering the map: ", error);
          });
        });
        
        console.log('App: Map recentered')

      }, 1000); // Adjust the time (in milliseconds) as needed
    }
  }
}