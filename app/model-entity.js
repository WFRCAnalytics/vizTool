// Resolves a {modVersion, scnGroup, scnYear} reference (selectedScenario_Main/_Comp's shape)
// to its actual Scenario instance in dataScenarios - same lookup every layout's own
// getScenario()/getMain() already does, duplicated here since ModelEntity needs it before a
// layout instance is necessarily the active one.
function resolveScenario(scenarioRef) {
  if (!scenarioRef) return null;
  return dataScenarios.find(s =>
    s.modVersion === scenarioRef.modVersion &&
    s.scnGroup === scenarioRef.scnGroup &&
    s.scnYear === parseInt(scenarioRef.scnYear, 10)
  ) || null;
}

// VizSidebar.render() (called from renderSidebar() below) synchronously reads the main
// scenario's data (via getFilterGroup/getFilterGroupArray), so it must already be cached
// before renderSidebar() runs, not just before updateDisplay().
async function ensureMainScenarioDataLoaded(vizLayout) {
  const mainScenario = resolveScenario(selectedScenario_Main);
  if (!mainScenario) return;
  showDataLoadingIndicator();
  try {
    await mainScenario.ensureDataLoaded(vizLayout.jsonName);
  } finally {
    hideDataLoadingIndicator();
  }
}

class ModelEntity {
  constructor(data, menuItem) {
    console.log('modelentity-construct:' + data.submenuText)
    this.id = menuItem.id + '-' + this.generateIdFromText(data.submenuText) + '-modelentity'; // use provided id or generate one if not provided
    this.submenuText = data.submenuText;
    this.submenuIconStart = data.submenuIconStart;
    this.template = data.template;
    if (data.template=='vizMap') {
      this.vizLayout = new VizMap(data.templateSettings, data.submenuText, this);
    } else if (data.template=='vizTrends') {
      this.vizLayout = new VizTrends(data.templateSettings, this);
    } else if (data.template=='vizMatrix') {
      this.vizLayout = new VizMatrix(data.templateSettings, this);
    } else if (data.template=='vizDashboard') {
      this.vizLayout = new VizDashboard(data.templateSettings, this);
    }
    this.textFile = data.textFile;
    this.pngFile = data.pngFile;
    this.menuItem = menuItem;
  }
  
  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Only show this item if it has no data-driven layout, or at least one scenario has data for it
  hasAvailableData() {
    if (!this.vizLayout || !this.vizLayout.jsonName) {
      return true;
    }
    return !!getFirstScenarioWithTrendData(this.vizLayout.jsonName);
  }

  createModelEntityElement() {
    console.log('model-entity:createModelEntityElement');
    const modelEntity = document.createElement('calcite-menu-item');
    modelEntity.setAttribute('id', this.id);
    modelEntity.setAttribute('text', this.submenuText);
    modelEntity.setAttribute('icon-start', this.submenuIconStart);
    modelEntity.setAttribute('text-enabled', '');


    // Set the disabled attribute to true
    modelEntity.setAttribute('disabled', true);
    modelEntity.setAttribute('draggable', true);
    modelEntity.setAttribute('text-enabled', false);
    
    const modelEntityInstance = this;

    modelEntity.addEventListener('click', async function() {
      let mainSidebarItems = document.querySelectorAll('calcite-menu-item');
      mainSidebarItems.forEach(item => {
        if(item.text === modelEntityInstance.submenuText || item.text === modelEntityInstance.menuItem.menuText) {  // Use the saved instance context here
          item.active = true;
          item.classList.add('menu-item-selected');
        } else {
          item.active = false;
          item.classList.remove('menu-item-selected');
        }
      });
      // Show corresponding template
      const allTemplates = document.querySelectorAll('.template');
      allTemplates.forEach(template => template.hidden = true);
  
      // Show the selected template
      const selectedTemplate = document.getElementById(modelEntityInstance.template + 'Template');
      if (selectedTemplate) {
        selectedTemplate.hidden = false;
        // ... (Any additional specific logic for the template type)
      }

      // set app global model entity to keep track of what is actively being used
      activeModelEntity= modelEntityInstance;
      modelEntityInstance.menuItem.lastSelectedModelEntityText = modelEntityInstance.submenuText;

      modelEntityInstance.menuItem.hideAllLayoutLayers()

      activeLayout = modelEntityInstance.vizLayout;

      await ensureMainScenarioDataLoaded(activeLayout);

      activeLayout.renderSidebar?.();  // Use the saved instance context here as well
      activeLayout.updateScenarioSelector?.();  // Use the saved instance context here as well
      activeLayout.updateDisplay?.();
      //modelEntityInstance.displayJSONData();
    });
    return modelEntity;
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

  hideLayoutLayers() {
    if (this.vizLayout && typeof this.vizLayout.hideLayers === 'function') {
      this.vizLayout.hideLayers();
    }
  }

  async loadModelEntity() {
    let mainSidebarItems = document.querySelectorAll('calcite-menu-item');
    mainSidebarItems.forEach(item => {
      if(item.text === this.submenuText || item.text === this.menuItem.menuText) {  // Use the saved instance context here
        item.active = true;
        item.classList.add('menu-item-selected');
      } else {
        item.active = false;
        item.classList.remove('menu-item-selected');
      }
    });
    // Show corresponding template
    const allTemplates = document.querySelectorAll('.template');
    allTemplates.forEach(template => template.hidden = true);

    // Show the selected template
    const selectedTemplate = document.getElementById(this.template + 'Template');
    if (selectedTemplate) {
      selectedTemplate.hidden = false;
      // ... (Any additional specific logic for the template type)
    }

    // set app global model entity to keep track of what is actively being used
    activeModelEntity= this;
    this.menuItem.lastSelectedModelEntityText = this.submenuText;

    this.menuItem.hideAllLayoutLayers()

    if (activeModelEntity.vizLayout) {
      activeLayout = this.vizLayout;

      await ensureMainScenarioDataLoaded(activeLayout);

      this.vizLayout.renderSidebar?.();  // Use the saved instance context here as well
      this.vizLayout.updateScenarioSelector?.();  // Must run before updateDisplay() - it initializes seriesSelect etc.
      this.vizLayout.updateDisplay?.();
    }

    //this.displayJSONData();

  }

}
