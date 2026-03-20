# Forest Change Detection App

An interactive web application for analyzing forest cover changes over time using satellite imagery from Google Earth Engine. Users can select any area on earth, define a time period, and retrieve deforestation statistics derived from the Hansen Global Forest Change dataset.

## Features

* Interactive map with satellite basemap (ESRI World Imagery)
* Area selection by drawing a rectangle directly on the map
* Time period selection via dual-handle slider (2000–2024)
* Location search powered by OpenStreetMap Nominatim
* Forest loss analysis returning total forest area, loss area, and loss percentage
* Year-by-year forest loss breakdown visualized as a bar chart
* Real-time forest loss overlay rendered on the map
* CSV export of yearly analysis results

## Tech Stack

**Backend**

* Python 3
* Flask
* Google Earth Engine Python API (`earthengine-api`)

**Frontend**

* HTML / CSS / JavaScript
* Leaflet.js (interactive map)
* Chart.js (bar chart visualization)

## Data Sources

* **Hansen Global Forest Change v1.12 (2024)** — University of Maryland, accessed via Google Earth Engine. Dataset covers global forest cover and loss from 2000 to 2024 at 30m resolution.

  * [Dataset catalog page](https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2024_v1_12)
* **ESRI World Imagery** — Basemap tiles
* **ESRI World Boundaries and Places** — Label overlay

