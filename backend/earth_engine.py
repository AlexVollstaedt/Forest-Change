import ee
import json
import os

def initialize_ee(project_id):
    """Initialize Earth Engine with service account credentials"""
    credentials_json = os.environ.get('EE_CREDENTIALS')

    if credentials_json:
        credentials_dict = json.loads(credentials_json)
        credentials = ee.ServiceAccountCredentials(
            email=credentials_dict['forest-change-ee@eloquent-walker-460311-q0.iam.gserviceaccount.com'],
            key_data=credentials_json
        )
        ee.Initialize(credentials=credentials, project=project_id)
    else:
        # Fall back to local authentication for development
        ee.Initialize(project=project_id)

def analyze_forest_change(bounds, start_year, end_year):
    """
    Analyze forest change for a selected area and time period

    Args:
    :param bounds: dict with 'west', 'north', 'east', 'south' coordinates
    :param start_year: int, starting year
    :param end_year: int, ending year

    :return: dict with analysis results
    """
    # Create geometry from bounds
    geometry = ee.Geometry.Rectangle([
        bounds['west'],
        bounds['south'],
        bounds['east'],
        bounds['north']
    ])

    # Hansen Global Forest Change dataset
    hansen = ee.Image('UMD/hansen/global_forest_change_2024_v1_12')

    # Get tree cover in 2000
    tree_cover_2000 = hansen.select('treecover2000')

    # Get loss year (0 = no loss, 1-24 = year of loss since 2000)
    loss_year = hansen.select('lossyear')

    # Calculate forest area in 2000
    forest_2000 = tree_cover_2000.gte(30)

    # Create mask for loss within time period
    # Convert years to loss year values
    start_loss_year = start_year - 2000
    end_loss_year = end_year - 2000

    # Mask for losses in our time period
    loss_in_period = loss_year.gte(start_loss_year).And(loss_year.lte(end_loss_year))

    # Calculate statistics
    # For forest area in 2000, we need to count pixels where tree cover >= 30%
    forest_area_2000_img = forest_2000.multiply(ee.Image.pixelArea())

    forest_area_2000 = forest_area_2000_img.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geometry,
        scale=30,
        maxPixels=1e9
    ).get('treecover2000')

    # For loss area, multiply the loss mask by pixel area
    loss_area_img = loss_in_period.multiply(forest_2000).multiply(ee.Image.pixelArea())

    loss_area = loss_area_img.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geometry,
        scale=30,
        maxPixels=1e9
    ).get('lossyear')

    # Get values
    forest_area_2000_val = forest_area_2000.getInfo()
    loss_area_val = loss_area.getInfo() if loss_area else 0

    # Convert to hectares
    forest_area_2000_ha = forest_area_2000_val / 10000 if forest_area_2000_val else 0
    loss_area_ha = loss_area_val / 10000 if loss_area_val else 0

    # Calculate percentage
    loss_percentage = (loss_area_ha / forest_area_2000_ha * 100) if forest_area_2000_ha > 0 else 0

    return {
        'forest_area_2000_ha': round(forest_area_2000_ha, 2),
        'loss_area_ha': round(loss_area_ha, 2),
        'loss_percentage': round(loss_percentage, 2),
        'start_year': start_year,
        'end_year': end_year
    }


def get_forest_loss_map(bounds, start_year, end_year):
    """
    Get Earth Engine map tile URL for forest loss visualization

    Args:
        bounds: dict with 'west', 'south', 'east', 'north' coordinates
        start_year: int, starting year
        end_year: int, ending year

    Returns:
        dict with map tile URL and parameters
    """
    # Create geometry from bounds
    geometry = ee.Geometry.Rectangle([
        bounds['west'],
        bounds['south'],
        bounds['east'],
        bounds['north']
    ])

    # Hansen Global Forest Change dataset
    hansen = ee.Image('UMD/hansen/global_forest_change_2024_v1_12')

    # Get tree cover and loss year
    tree_cover_2000 = hansen.select('treecover2000')
    loss_year = hansen.select('lossyear')

    # Forest mask (>30% tree cover in 2000)
    forest_mask = tree_cover_2000.gte(30)

    # Convert years to loss year values
    start_loss_year = start_year - 2000
    end_loss_year = end_year - 2000

    # Mask for losses in our time period
    loss_in_period = loss_year.gte(start_loss_year).And(loss_year.lte(end_loss_year))

    # Create visualization: show forest loss in red
    # Where there was forest AND loss occurred
    loss_viz = loss_in_period.And(forest_mask).selfMask()

    # Clip Loss to selected area only
    loss_viz_clipped = loss_viz.clip(geometry)

    # Get map ID for visualization
    map_id_dict = loss_viz_clipped.getMapId({
        'palette': ['red'],
        'opacity': 0.7
    })

    return {
        'tile_url': map_id_dict['tile_fetcher'].url_format,
        'bounds': bounds
    }


def analyze_forest_change_yearly(bounds, start_year, end_year):
    """
    Analyze forest cover change year by year

    Args:
        bounds: dict with 'west', 'south', 'east', 'north' coordinates
        start_year: int, starting year
        end_year: int, ending year

    Returns:
        dict with yearly breakdown
    """
    # Create geometry from bounds
    geometry = ee.Geometry.Rectangle([
        bounds['west'],
        bounds['south'],
        bounds['east'],
        bounds['north']
    ])

    # Hansen Global Forest Change dataset
    hansen = ee.Image('UMD/hansen/global_forest_change_2024_v1_12')

    # Get tree cover and loss year
    tree_cover_2000 = hansen.select('treecover2000')
    loss_year = hansen.select('lossyear')

    # Forest mask (>30% tree cover in 2000)
    forest_mask = tree_cover_2000.gte(30)

    # Calculate loss for each year
    yearly_data = []

    for year in range(start_year, end_year + 1):
        loss_year_value = year - 2000

        # Mask for this specific year
        loss_this_year = loss_year.eq(loss_year_value).And(forest_mask)

        # Calculate area
        loss_area = loss_this_year.multiply(ee.Image.pixelArea()).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=geometry,
            scale=30,
            maxPixels=1e9
        ).get('lossyear')

        loss_area_val = loss_area.getInfo() if loss_area else 0
        loss_area_ha = loss_area_val / 10000 if loss_area_val else 0

        yearly_data.append({
            'year': year,
            'loss_ha': round(loss_area_ha, 2)
        })

    return {
        'yearly_data': yearly_data,
        'start_year': start_year,
        'end_year': end_year
    }