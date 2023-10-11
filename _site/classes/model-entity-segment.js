class ModelEntitySegment extends ModelEntity {
    constructor(data) {
        super(data);  // Call the parent class's constructor
        
        // Additional properties for ModelEntitySegment
        this.segmentProperty = data.segmentProperty || 'default';
        // Add more properties as required
    }

    // Additional methods for ModelEntitySegment
    segmentSpecificMethod() {
        console.log('This method is specific to ModelEntitySegment');
    }

    // You can also override methods from the parent class
    initListeners() {
        super.initListeners();  // Call the parent class's method

        // Add more functionalities for ModelEntitySegment's listeners
    }
}
