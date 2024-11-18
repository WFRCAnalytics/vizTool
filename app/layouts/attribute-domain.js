class AttributeDomain {
    /**
     * Constructor for the AttributeDomain class
     * @param {Object} data - Configuration options for the domain
     * @param {string} data.title - Title of the domain
     * @param {Object} data.rangeFrom - Configuration for the "from" input (passed to WijInput)
     * @param {Object} data.rangeTo - Configuration for the "to" input (passed to WijInput)
     * @param {Function} data.onRangeChange - Callback function when either range value changes
     */
    constructor(data) {
        this.title = data.title || "Attribute Domain";
        this.onRangeChange = data.onRangeChange || (() => {});

        // Create WijInput instances for rangeFrom and rangeTo
        this.rangeFrom = new WijInput({
            placeholder: "From",
            value: data.rangeFrom?.value || "",
            label: "From",
            onInput: (value) => this.onRangeChange({ from: value, to: this.rangeTo.value }),
        });

        this.rangeTo = new WijInput({
            placeholder: "To",
            value: data.rangeTo?.value || "",
            label: "To",
            onInput: (value) => this.onRangeChange({ from: this.rangeFrom.value, to: value }),
        });
    }

    /**
     * Render the AttributeDomain widget
     * @param {HTMLElement} container - The DOM element to render the widget into
     */
    render(container) {
        if (!container) {
            throw new Error("A valid container element must be provided.");
        }

        // Create the title element
        const titleElement = document.createElement("h3");
        titleElement.innerText = this.title;

        // Create a container for the range inputs
        const rangeContainer = document.createElement("div");
        rangeContainer.style.display = "flex";
        rangeContainer.style.gap = "1rem";

        // Render the rangeFrom and rangeTo inputs into the range container
        this.rangeFrom.render(rangeContainer);
        this.rangeTo.render(rangeContainer);

        // Append the title and range container to the provided container
        container.appendChild(titleElement);
        container.appendChild(rangeContainer);
    }
}

// Usage Example:
const container = document.getElementById("app"); // The container div in your HTML

const attributeDomain = new AttributeDomain({
    title: "Set Range",
    rangeFrom: { value: "0" },
    rangeTo: { value: "100" },
    onRangeChange: ({ from, to }) => console.log(`Range changed: From ${from} to ${to}`),
});

// Render the attribute domain widget
attributeDomain.render(container);