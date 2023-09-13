// Class for Submenu Item
class SubmenuItem {
  constructor(data) {
    this.id = this.generateIdFromText(data.submenuText);
    this.submenuText = data.submenuText;
    this.submenuIconStart = data.submenuIconStart;
    this.submenuTemplate = data.submenuTemplate;
    this.sidebarItems = (data.sidebarItems || []).map(item => new SidebarItem(item));
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  render() {
    const container = document.createElement('div');
    container.className = 'submenu-item';
    
    const submenuLabel = document.createElement('calcite-label');
    submenuLabel.textContent = `${this.submenuText} - ${this.submenuIconStart}`;
    container.appendChild(submenuLabel);

    // Iterate over sidebar items and append them
    this.sidebarItems.forEach(sidebarItem => {
        container.appendChild(sidebarItem.render());
    });

    return container;
  }

}