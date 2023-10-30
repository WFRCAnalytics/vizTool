let globalTemplates = [];
let dataScenarios = [];
let map;
let geojsonSegments;
let view;
let layerDisplay;
let dummyFeature;

require(["esri/config"
        ],
function(esriConfig) {

  esriConfig.apiKey = "AAPK5f27bfeca6bb49728b7e12a3bfb8f423zlKckukFK95EWyRa-ie_X31rRIrqzGNoqBH3t3Chvz2aUbTKiDvCPyhvMJumf7Wk";

  async function fetchConfig() {
    const response = await fetch('config.json');
    const dataConfig = await response.json();
    return dataConfig;
  }

  async function fetchScenarioData() {
    const response = await fetch('scenarios.json');
    const dataScenario = await response.json();
    return dataScenario;
  }

  async function loadScenarios() {
    const jsonScenario = await fetchScenarioData();
    dataScenarios = jsonScenario.map(item => new Scenario(item));
  }

  async function loadMenuAndItems() {
    const jsonConfig = await fetchConfig();

    const userElement = document.querySelector('calcite-navigation-user[slot="user"]');
    const username = userElement.getAttribute('username');

    const dataApp = jsonConfig['users'].map(item => new User(item));
    const dataMenu = dataApp.filter(item => item.userType === username)[0].userLayout.menuItems;
    const calciteMenu = document.querySelector('calcite-menu[slot="content-start"]');

    // Clear existing menu items
    calciteMenu.innerHTML = '';

    // Render each menu item and log (or insert into the DOM)
    dataMenu.forEach(menuItem => {
      calciteMenu.appendChild(menuItem.createMenuItemElement());
    });
  }

  async function populateScenarioSelections (){
    const modMain = document.getElementById('selectModMain');
    const grpMain = document.getElementById('selectGrpMain');
    const yearMain = document.getElementById('selectYearMain');
    const modComp = document.getElementById('selectModComp');
    const grpComp = document.getElementById('selectGrpComp');
    const yearComp = document.getElementById('selectYearComp');
    const scenarioModel = new Set();
    const scenarioGroup = new Set();
    const scenarioYear = new Set();

    dataScenarios.forEach(entry=> {
      scenarioModel.add(entry.modVersion);
      scenarioGroup.add(entry.scnGroup);
      scenarioYear.add(entry.scnYear);
    });
    scenarioModel.forEach(entry=>modMain.add(new Option(entry)));
    scenarioGroup.forEach(entry=>grpMain.add(new Option(entry)));
    scenarioYear.forEach(entry=>yearMain.add(new Option(entry)));
    modComp.add(new Option("none"));
    grpComp.add(new Option("none"));
    yearComp.add(new Option("none"));
    scenarioModel.forEach(entry=>modComp.add(new Option(entry)));
    scenarioGroup.forEach(entry=>grpComp.add(new Option(entry)));
    scenarioYear.forEach(entry=>yearComp.add(new Option(entry)));
  }

  async function init() {
    const menuStructure = await loadMenuAndItems();
    await loadScenarios();
    await populateScenarioSelections();
  }

  function populateTemplates() {
    const container = document.getElementById('main'); // Assuming your templates will be children of a div with the id "main".

    globalTemplates.forEach(template => {
        const div = document.createElement('div');
        div.id = template.templateType + 'Template'; 
        div.classList.add('template');
        div.hidden = true;
        div.innerHTML = template.layoutDivs;
        container.appendChild(div);
    });

    document.getElementById('toggleOverlay').addEventListener('click', function() {
      var overlay = document.getElementById('overlay');
      if (overlay.classList.contains('collapsed')) {
        overlay.classList.remove('collapsed');
        this.innerText = 'Collapse';
      } else {
        overlay.classList.add('collapsed');
        this.innerText = 'Expand';
      }
    });

    init();
  }

  fetch('templates.json')
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