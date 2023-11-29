// Class for User
class User {
  constructor(data) {
    this.userType = data.userType;
    this.userLayout = data.userLayout ? new UserLayout(data.userLayout, this) : null;
  }
}