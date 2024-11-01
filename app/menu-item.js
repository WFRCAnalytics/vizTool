// Class for Main Menu Item
class MenuItem {
  constructor(data, hideAllLayoutLayers) {
    this.id = this.generateIdFromText(data.menuText) + '-menu'; // use provided id or generate one if not provided
    this.menuText = data.menuText;
    this.menuIconStart = data.menuIconStart;
    this.modelEntities = (data.modelEntities || []).map(item => new ModelEntity(item, this));
    this.hideAllLayoutLayers = hideAllLayoutLayers;
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  createMenuItemElement() {
    const menuItem = document.createElement('calcite-menu-item');
    menuItem.setAttribute('id', this.id);
    menuItem.setAttribute('text', this.menuText);
    menuItem.setAttribute('icon-start', this.menuIconStart);
    menuItem.setAttribute('text-enabled', '');

    const menuItemInstance = this;

    menuItem.addEventListener('click', function() {
      let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
      mainSidebarItems2.forEach(item2 => {
        if(item2.text === menuItemInstance.menuText) {  // Use the saved instance context here
          item2.active = true;
        } else {
          item2.active = false;
        }
      });

      // hide all templates
      globalTemplates.forEach(template => {
        const existingDiv = document.getElementById(template.templateType + 'Template');
        if (existingDiv) {
          existingDiv.hidden = true;
        }
      });
      
      menuItemInstance.hideAllLayoutLayers();
      menuItemInstance.populateModelEntities();  // Use the saved instance context here as well
      //menuItemInstance.populateMainContent(menuItemInstance.templateContent);
    });

    return menuItem;

  }

  populateModelEntities() {
    const secondaryMenu = document.querySelector('calcite-navigation[slot="navigation-secondary"] > calcite-menu[slot="content-start"]');

    // Clear existing menu items
    secondaryMenu.innerHTML = '';

    // Render each menu item and log (or insert into the DOM)
    this.modelEntities.forEach(modelEntity => {
      secondaryMenu.appendChild(modelEntity.createModelEntityElement());
    });
  }

  hideAllMenuItemLayers() {
    this.modelEntities.forEach(modelEntity => {
      modelEntity.hideLayoutLayers();
    });
  }

  loadMenuItemAndModelEntity(modelEntityText) {
    let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
    mainSidebarItems2.forEach(item2 => {
      if(item2.text === this.menuText) {  // Use the saved instance context here
        item2.active = true;
      } else {
        item2.active = false;
      }
    });

    // hide all templates
    globalTemplates.forEach(template => {
      const existingDiv = document.getElementById(template.templateType + 'Template');
      if (existingDiv) {
        existingDiv.hidden = true;
      }
    });
    
    this.hideAllLayoutLayers();
    this.populateModelEntities();  // Use the saved instance context here as well

    // Find the model entity item where submenuText matches onOpenMenuItem
    const selectedModelEntity = this.modelEntities.find(entity => entity.submenuText === modelEntityText);

    if (selectedModelEntity && selectedModelEntity.loadModelEntity) {
        // Call the function to load the menu item and model entity
        selectedModelEntity.loadModelEntity(modelEntityText);
    } else {
        console.error('Model Entity item with matching subMenuText or load function not found');
    }

  }
  
}