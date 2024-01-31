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
let scenarioChecker;

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
    console.log('app:fetchScenarioData');
    const response = await fetch('scenario-trends.json');
    const dataScenarioTrend = await response.json();
    return dataScenarioTrend;
  }

  async function loadScenarios() {
    console.log('app:loadScenarios');

    // load scenario data
    const jsonScenario = await fetchScenarioData();
    dataScenarios = jsonScenario.map(item => new Scenario(item));

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

  async function populateScenarioSelections() {

    function addCalciteOption(calciteSelect, value) {
      if (!calciteSelect) return; // Guard clause to prevent errors
      const option = document.createElement('calcite-option');
      option.value = value;
      option.textContent = value;
  
      calciteSelect.appendChild(option);
    };

    console.log('app:populateScenarioSelections');
    const modMain  = document.getElementById('selectModMain');
    const grpMain  = document.getElementById('selectGrpMain');
    const yearMain = document.getElementById('selectYearMain');
    const modComp  = document.getElementById('selectModComp');
    const grpComp  = document.getElementById('selectGrpComp');
    const yearComp = document.getElementById('selectYearComp');
    const scenarioModel = new Set();
    const scenarioGroup = new Set();
    const scenarioYear  = new Set();

    if (!modMain || !grpMain || !yearMain || !modComp || !grpComp || !yearComp) {
      console.error('One or more select elements not found');
      return;
    }

    // Add 'none' option
    addCalciteOption(modComp, 'none');
    addCalciteOption(grpComp, 'none');
    addCalciteOption(yearComp, 'none');

    dataScenarios.forEach(entry => {
      scenarioModel.add(entry.modVersion);
      scenarioGroup.add(entry.scnGroup);
      scenarioYear.add(entry.scnYear);
    });

    // Add options
    scenarioModel.forEach(entry => {
      addCalciteOption(modMain, entry);
      addCalciteOption(modComp, entry);
    });
    scenarioGroup.forEach(entry => {
      addCalciteOption(grpMain, entry);
      addCalciteOption(grpComp, entry);
    });
    scenarioYear.forEach(entry => {
      addCalciteOption(yearMain, entry);
      addCalciteOption(yearComp, entry);
    });

    // Set the first value as selected or 'none' if the set is empty
    modMain .value = scenarioModel.size > 0 ? scenarioModel.values().next().value : 'none';
    grpMain .value = scenarioGroup.size > 0 ? scenarioGroup.values().next().value : 'none';
    yearMain.value = scenarioYear .size > 0 ? scenarioYear .values().next().value : 'none';
    modComp .value = 'none';
    grpComp .value = 'none';
    yearComp.value = 'none';
  }

  async function init() {
    console.log('app:init');
    await loadScenarios();
    await initVizMapListeners();
    const menuStructure = await loadMenuAndItems();
  }

  async function initVizMapListeners() {
    console.log('app:initVizMapListeners');
            
    document.getElementById('selectModMain'    ).addEventListener('calciteSelectChange', updateActiveVizMap);
    document.getElementById('selectGrpMain'    ).addEventListener('calciteSelectChange', updateActiveVizMap);
    document.getElementById('selectYearMain'   ).addEventListener('calciteSelectChange', updateActiveVizMap);
    document.getElementById('selectModComp'    ).addEventListener('calciteSelectChange', updateActiveVizMap);
    document.getElementById('selectGrpComp'    ).addEventListener('calciteSelectChange', updateActiveVizMap);
    document.getElementById('selectYearComp'   ).addEventListener('calciteSelectChange', updateActiveVizMap);
    document.getElementById('selectCompareType').addEventListener('calciteSelectChange', updateActiveVizMap);

    function updateActiveVizMap() {
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

    //document.getElementById('selectYearMain-prev').addEventListener('click', () => selectPrevOption(document.getElementById('selectYearMain')));
    //document.getElementById('selectYearMain-next').addEventListener('click', () => selectNextOption(document.getElementById('selectYearMain')));
    //
    //document.getElementById('selectYearComp-prev').addEventListener('click', () => selectPrevOption(document.getElementById('selectYearComp')));
    //document.getElementById('selectYearComp-next').addEventListener('click', () => selectNextOption(document.getElementById('selectYearComp')));
    //
    //function selectPrevOption(selectElement) {
    //  const options = Array.from(selectElement.querySelectorAll('calcite-option'));
    //  const currentIndex = options.findIndex(option => option.value.toString() === selectElement.value);
    //  if (currentIndex > 0) {
    //    selectElement.value = options[currentIndex - 1].value;
    //    updateActiveVizMap();
    //  }
    //}
    //
    //function selectNextOption(selectElement) {
    //  console.log('app:value:' + selectElement.value)
    //  const options = Array.from(selectElement.querySelectorAll('calcite-option'));
    //  const currentIndex = options.findIndex(option => option.value.toString() === selectElement.value);
    //  if (currentIndex < options.length - 1) {
    //    selectElement.value = options[currentIndex + 1].value;
    //    updateActiveVizMap();
    //  }
    //}
    
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


      lstSelectIds = ['selectModMain','selectGrpMain','selectYearMain','selectModComp','selectGrpComp','selectYearComp']

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

        // Append the calcite-select to the flex container
        flexContainer.appendChild(calciteSelect);

        //// Check if the current select is 'selectYearMain' or 'selectYearComp'
        //if (id === 'selectYearMain' || id === 'selectYearComp') {
        //    // Create and append buttons within the flex container
        //    const buttonPrev = document.createElement('calcite-button');
        //    buttonPrev.id = id + '-prev';
        //    buttonPrev.textContent = '<';
        //    flexContainer.appendChild(buttonPrev);
        //  
        //    const buttonNext = document.createElement('calcite-button');
        //    buttonNext.id = id + '-next';
        //    buttonNext.textContent = '>';
        //    flexContainer.appendChild(buttonNext);
        //}

        // Append the flex container to the content container
        contentContainer.appendChild(flexContainer);

        // Check if we have just appended the last "Main" select
        // and insert the <h1> element before starting with the "Comp" selects
        if (id === 'selectYearMain') {
          const heading = document.createElement('div');
          heading.innerHTML = '<br/><b>Comparison Scenario</b>'; // Replace with your desired text
          contentContainer.appendChild(heading);
        }
      });

      const headingCompare = document.createElement('div');
      headingCompare.innerHTML = '<br/><b>Compare Type</b>'; // Replace with your desired text
      contentContainer.appendChild(headingCompare);

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
      mapView.
      ui.add(expandScenario, "top-right");


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