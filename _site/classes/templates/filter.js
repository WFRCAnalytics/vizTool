class Filter {
    constructor(data) {
        this.id = data.id;

        if (data.type==="select") {
            this.filterSelect = new wijSelect(this.id & "_container", data.attributes.map({
                value: item.aCode,
                label: item.aDisplayName
              }), data.selected);
        } else if (data.type==="radio") {
            this.filterSelect = new wijRadio(this.id & "_container", data.attributes.map({
                value: item.aCode,
                label: item.aDisplayName
              }), data.selected);

        } else if (data.type==="checkbox") {

        }
        
    }
}