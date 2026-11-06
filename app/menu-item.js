// Class for Main Menu Item
class MenuItem {
  constructor(data, hideAllLayoutLayers) {
    this.id = this.generateIdFromText(data.menuText) + '-menu'; // use provided id or generate one if not provided
    this.menuText = data.menuText;
    this.menuIconStart = data.menuIconStart;
    this.modelEntities = (data.modelEntities || []).map(item => new ModelEntity(item, this));
    this.hideAllLayoutLayers = hideAllLayoutLayers;
    this.lastSelectedModelEntityText = null;
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
          item2.classList.add('menu-item-selected');
        } else {
          item2.active = false;
          item2.classList.remove('menu-item-selected');
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
      menuItemInstance.selectDefaultModelEntity();
      //menuItemInstance.populateMainContent(menuItemInstance.templateContent);
    });

    return menuItem;

  }

  populateModelEntities() {
    const secondaryNav = document.querySelector('calcite-navigation[slot="navigation-secondary"]');
    const secondaryMenu = secondaryNav.querySelector('calcite-menu[slot="content-start"]');

    // Clear existing menu items
    secondaryMenu.innerHTML = '';

    const availableEntities = this.modelEntities.filter(modelEntity => modelEntity.hasAvailableData());

    // Render each menu item and log (or insert into the DOM), skipping items with no available data
    availableEntities.forEach(modelEntity => {
      secondaryMenu.appendChild(modelEntity.createModelEntityElement());
    });

    // With only one (or zero) entities there's nothing to choose between, so hide the whole
    // bar - selectDefaultModelEntity() still auto-loads that single entity regardless, it just
    // does so without a one-item tab strip to click. Set inline display too, not just hidden -
    // calcite-navigation's own shadow CSS isn't guaranteed to yield to the hidden attribute.
    const hideBar = availableEntities.length <= 1;
    secondaryNav.hidden = hideBar;
    secondaryNav.style.display = hideBar ? 'none' : '';

    // Layout hooks (e.g. vizDashboard's right-sidebar collapse button) are positioned assuming
    // the secondary bar's height is always there - this class lets their CSS pull up when it isn't.
    document.body.classList.toggle('secondary-nav-hidden', hideBar);
  }

  // Re-select whichever model entity the user last viewed in this menu item, or the
  // first available one if this menu item has never been opened before.
  selectDefaultModelEntity() {
    const availableEntities = this.modelEntities.filter(entity => entity.hasAvailableData());
    let entityToSelect = null;
    if (this.lastSelectedModelEntityText) {
      entityToSelect = availableEntities.find(
        entity => entity.submenuText === this.lastSelectedModelEntityText
      );
    }
    if (!entityToSelect) {
      entityToSelect = availableEntities[0];
    }
    if (entityToSelect) {
      entityToSelect.loadModelEntity();
    }
  }

  hideAllMenuItemLayers() {
    this.modelEntities.forEach(modelEntity => {
      modelEntity.hideLayoutLayers();
    });
  }

  async loadMenuItemAndModelEntity(modelEntityText) {
    let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
    mainSidebarItems2.forEach(item2 => {
      if(item2.text === this.menuText) {  // Use the saved instance context here
        item2.active = true;
        item2.classList.add('menu-item-selected');
      } else {
        item2.active = false;
        item2.classList.remove('menu-item-selected');
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
        // Call the function to load the menu item and model entity. Awaited (loadModelEntity
        // is async - it lazy-loads scenario data, see Scenario.ensureDataLoaded) so this
        // function's own callers can rely on the entity being fully loaded once this resolves,
        // instead of racing anything that runs after firing this off, e.g. an aggregator swap.
        await selectedModelEntity.loadModelEntity(modelEntityText);
    } else {
        console.error('Model Entity item with matching subMenuText or load function not found');
    }

  }
  
}