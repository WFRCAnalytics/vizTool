// Class for User
class UserLayout {
    constructor(data) {
        this.menuItems = (data.menuItems || []).map(item => new MenuItem(item));
    }
}