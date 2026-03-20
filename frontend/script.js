// Initialize map centered on South Germany
const map = L.map('map', {
    attributionControl: true
}).setView([48.5, 10.5], 8);

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri | Data: <a href="https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2024_v1_12" target="_blank">Hansen GFC via Google Earth Engine</a>',
    maxZoom: 18
});

const labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    pane: 'shadowPane'
});

// Add satellite as default
satelliteLayer.addTo(map);
labelsLayer.addTo(map);

// Location search functionality
const locationInput = document.getElementById('locationSearch');
const clearSearchBtn = document.getElementById('clearSearch');

// Show/hide clear button based on input
locationInput.addEventListener('input', function() {
    if (this.value.trim() !== '') {
        clearSearchBtn.style.display = 'flex';
    } else {
        clearSearchBtn.style.display = 'none';
    }
});

// Clear button click
clearSearchBtn.addEventListener('click', function() {
    locationInput.value = '';
    this.style.display = 'none';
    locationInput.focus();
});

locationInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = this.value;
        if (query.trim() === '') return;

        // Use Nominatim directly via fetch
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    // Zoom to location
                    map.setView([lat, lon], 9);

                } else {
                    alert('Location not found. Try another search term.');
                }
            })
            .catch(error => {
                console.error('Search error:', error);
                alert('Search failed. Please try again.');
            });
    }
});

// Year range slider functionality
const startYearSlider = document.getElementById('startYear');
const endYearSlider = document.getElementById('endYear');
const yearRangeDisplay = document.getElementById('yearRangeDisplay');

function updateYearDisplay(e) {
    const startYear = parseInt(startYearSlider.value);
    const endYear = parseInt(endYearSlider.value);

    // Ensure start year is always before end year
    if (startYear >= endYear) {
        if (e.target === startYearSlider) {
            startYearSlider.value = endYear - 1;
        } else {
            endYearSlider.value = startYear + 1;
        }
    }

    yearRangeDisplay.textContent = `${startYearSlider.value} - ${endYearSlider.value}`;
}

startYearSlider.addEventListener('input', updateYearDisplay);
endYearSlider.addEventListener('input', updateYearDisplay);

// Variables for selection
let selectedBounds = null;
let rectangle = null;
let isSelectionMode = false;
let isDrawing = false;
let startPoint = null;
let visualizationLayer = null;
let yearlyChart = null;
let currentAnalysisData = null;
let currentYearlyData = null;

// Selection mode toggle button
const selectAreaBtn = document.getElementById('selectAreaBtn');

selectAreaBtn.addEventListener('click', function() {
    isSelectionMode = !isSelectionMode;

    if (isSelectionMode) {
        this.textContent = 'Cancel Selection';
        this.classList.add('active');
        map.getContainer().style.cursor = 'crosshair';
    } else {
        this.textContent = 'Select Area on Map';
        this.classList.remove('active');
        map.getContainer().style.cursor = '';
        isDrawing = false;
    }
});

// Mouse events for drawing rectangle
map.on('mousedown', function(e) {
    // Only draw if in selection mode and left mouse button (button 0)
    if (!isSelectionMode || e.originalEvent.button !== 0) return;

    // Prevent map dragging during selection
    map.dragging.disable();

    isDrawing = true;
    startPoint = e.latlng;

    // Remove old rectangle if exists
    if (rectangle) {
        map.removeLayer(rectangle);
    }

    // Create new rectangle
    rectangle = L.rectangle([[e.latlng.lat, e.latlng.lng], [e.latlng.lat, e.latlng.lng]], {
        color: '#8B0000',   //grün #4a7c2c
        weight: 2,
        fillOpacity: 0
    }).addTo(map);
});

map.on('mousemove', function(e) {
    if (!isDrawing) return;

    // Update rectangle bounds
    const bounds = L.latLngBounds(startPoint, e.latlng);
    rectangle.setBounds(bounds);
});

map.on('mouseup', function(e) {
    if (!isDrawing) return;

    isDrawing = false;
    map.dragging.enable();

    // Get final bounds
    const bounds = rectangle.getBounds();
    selectedBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
    };

    console.log('Selected bounds:', selectedBounds);

    // Exit selection mode
    isSelectionMode = false;
    selectAreaBtn.textContent = 'Select Area on Map';
    selectAreaBtn.classList.remove('active');
    map.getContainer().style.cursor = '';

    // Enable analyze button
    document.getElementById('analyzeBtn').disabled = false;
});

// Handle mouse leaving map
map.on('mouseout', function(e) {
    if (isDrawing) {
        isDrawing = false;
        map.dragging.enable();
    }
});

// Analyze button click
document.getElementById('analyzeBtn').addEventListener('click', async function() {
    if (!selectedBounds) {
        showError('Please select an area on the map first');
        return;
    }

    const startYear = parseInt(document.getElementById('startYear').value);
    const endYear = parseInt(document.getElementById('endYear').value);

    if (startYear >= endYear) {
        showError('Start year must be before end year');
        return;
    }

    // Show loading, hide results/error
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    this.disabled = true;

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bounds: selectedBounds,
                startYear: startYear,
                endYear: endYear
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Analysis failed');
        }

        // Display results
        displayResults(data);

        // Re-enable selection mode button
        isSelectionMode = false;
        selectAreaBtn.textContent = 'Select Area on Map';
        selectAreaBtn.classList.remove('active');
        map.getContainer().style.cursor = '';

    } catch (error) {
        showError(error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
        this.disabled = false;
    }
});

async function displayResults(data) {
    currentAnalysisData = data;

    document.getElementById('resultPeriod').textContent =
        `${data.start_year} - ${data.end_year}`;

    document.getElementById('resultForestArea').textContent =
        `${data.forest_area_2000_ha.toLocaleString()} ha`;
    document.getElementById('resultLoss').textContent =
        `${data.loss_area_ha.toLocaleString()} ha`;
    document.getElementById('resultPercentage').textContent =
        `${data.loss_percentage}%`;

    document.getElementById('results').style.display = 'block';

    // Fetch yearly data
    try {
        const yearlyResponse = await fetch('/api/analyze-yearly', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bounds: selectedBounds,
                startYear: data.start_year,
                endYear: data.end_year
            })
        });

        const yearlyData = await yearlyResponse.json();

        if (yearlyResponse.ok) {
            currentYearlyData = yearlyData.yearly_data;
            displayYearlyChart(yearlyData.yearly_data);
        }
    } catch (error) {
        console.error('Yearly data error:', error);
    }

    // Fetch and display visualization
    try {
        const vizResponse = await fetch('/api/visualization', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bounds: selectedBounds,
                startYear: data.start_year,
                endYear: data.end_year
            })
        });

        const vizData = await vizResponse.json();

        if (vizResponse.ok) {
            // Remove old visualization layer if exists
            if (visualizationLayer) {
                map.removeLayer(visualizationLayer);
            }

            // Add new visualization layer
            visualizationLayer = L.tileLayer(vizData.tile_url, {
                opacity: 0.7
            }).addTo(map);
        }
    } catch (error) {
        console.error('Visualization error:', error);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function displayYearlyChart(yearlyData) {
    // Destroy old chart if exists
    if (yearlyChart) {
        yearlyChart.destroy();
        yearlyChart = null;
    }

    // Get canvas element
    const canvas = document.getElementById('yearlyChart');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    // Reset canvas - remove and recreate to clear error state
    const parent = canvas.parentNode;
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'yearlyChart';
    parent.replaceChild(newCanvas, canvas);

    const ctx = newCanvas.getContext('2d');

    const years = yearlyData.map(d => d.year);
    const losses = yearlyData.map(d => d.loss_ha);

    yearlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Forest Loss (ha)',
                data: losses,
                backgroundColor: '#c62828',
                borderColor: '#8b0000',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Loss (ha)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    },
                    ticks: {
                        callback: function(value, index) {
                            const year = this.getLabelForValue(value);
                            // Show every 5th year, or first/last year
                            if (year % 5 === 0 || index === 0 || index === years.length - 1) {
                                return year;
                            }
                            return '';
                        },
                        maxRotation: 0,
                        autoSkip: false
                    }
                }
            }
        }
    });
}

// Info modal functionality
const infoBtn = document.getElementById('infoBtn');
const infoModal = document.getElementById('infoModal');
const closeModalBtn = document.getElementById('closeModal');

infoBtn.addEventListener('click', function() {
    infoModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', function() {
    infoModal.style.display = 'none';
});

// Close modal when clicking outside of it
infoModal.addEventListener('click', function(e) {
    if (e.target === infoModal) {
        infoModal.style.display = 'none';
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && infoModal.style.display === 'flex') {
        infoModal.style.display = 'none';
    }
});

// Download functionality
document.getElementById('downloadCSV').addEventListener('click', function() {
    if (!currentYearlyData || !currentAnalysisData) {
        alert('No data available to download');
        return;
    }

    // Create CSV content
    let csv = 'Year,Forest Loss (ha)\n';
    currentYearlyData.forEach(item => {
        csv += `${parseInt(item.year)},${parseFloat(item.loss_ha)}\n`;
    });

    // Add summary
    csv += '\nSummary\n';
    csv += `Time Period = ${currentAnalysisData.start_year} - ${currentAnalysisData.end_year}\n`;
    csv += `Total Forest Area (2000) = ${currentAnalysisData.forest_area_2000_ha} ha\n`;
    csv += `Total Forest Loss = ${currentAnalysisData.loss_area_ha} ha\n`;
    csv += `Loss Percentage = ${currentAnalysisData.loss_percentage}%\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forest_analysis_${currentAnalysisData.start_year}-${currentAnalysisData.end_year}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
});