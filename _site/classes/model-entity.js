// Class for modEnt Item
class modelEntity {
  constructor(data) {
    this.id = this.generateIdFromText(data.submenuText);
    this.submenuText = data.submenuText;
    this.submenuIconStart = data.submenuIconStart;
    this.submenuTemplate = data.submenuTemplate;
    this.mapSidebarItems = (data.mapSidebarItems || []).map(item => new MapSidebarItem(item));
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  createModelEntityElement() {
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
      modelEntityInstance.populateSidebar();  // Use the saved instance context here as well
      //modelEntityInstance.populateMainContent(modelEntityInstance.templateContent);
    });
    return modelEntity;
  }
  
  populateSidebar() {

    const container = document.createElement('div');
    
    const titleEl = document.createElement('h2');
    titleEl.textContent = this.title;

    const sidebarContainer = document.createElement('div');
    this.mapSidebarItems.forEach(mapSidebarItem => {
      sidebarContainer.appendChild(mapSidebarItem.render());
    });

    container.appendChild(titleEl);
    container.appendChild(sidebarContainer);
    
    const sidebar = document.querySelector('#sidebarContent');
    // You might have to modify the next line based on the structure of your SidebarContent class.
    sidebar.innerHTML = ''; // clear existing content
    sidebar.appendChild(container);
    // Set the focus to the sidebar
    sidebar.focus();

  }

}