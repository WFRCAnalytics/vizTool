// Class for Main Menu Item
class MenuItem {
  constructor(data) {
    this.id = this.generateIdFromText(data.menuText);
    this.menuText = data.menuText;
    this.menuIconStart = data.menuIconStart;
    this.submenuItems = (data.submenuItems || []).map(item => new SubmenuItem(item));
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  render() {
    const container = document.createElement('div');
    container.className = 'menu-item';
    
    if (this.menuText) {
      const menuLabel = document.createElement('calcite-label');
      menuLabel.textContent = `${this.menuText} - ${this.menuIconStart}`;
      container.appendChild(menuLabel);
    }
    
    this.submenuItems.forEach(submenuItem => {
      container.appendChild(submenuItem.render());
    });
    
    return container.outerHTML;
  }
}