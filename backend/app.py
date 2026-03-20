from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from earth_engine import initialize_ee, analyze_forest_change, get_forest_loss_map, analyze_forest_change_yearly
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='../frontend')
CORS(app)

# Initialize Earth Engine
EE_PROJECT_ID = os.environ.get('EE_PROJECT_ID')
initialize_ee(EE_PROJECT_ID)


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)


@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json

        # Extract parameters
        bounds = data['bounds']
        start_year = int(data['startYear'])
        end_year = int(data['endYear'])

        # Validate input
        if start_year < 2000:
            return jsonify({'error': 'Start year must be 2000 or later'}), 400
        if end_year > 2024:
            return jsonify({'error': 'End year must be 2024 or earlier'}), 400
        if start_year >= end_year:
            return jsonify({'error': 'Start year must be before end year'}), 400

        # Perform analysis
        result = analyze_forest_change(bounds, start_year, end_year)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/visualization', methods=['POST'])
def visualization():
    try:
        data = request.json

        # Extract parameters
        bounds = data['bounds']
        start_year = int(data['startYear'])
        end_year = int(data['endYear'])

        # Get visualization
        result = get_forest_loss_map(bounds, start_year, end_year)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/analyze-yearly', methods=['POST'])
def analyze_yearly():
    try:
        data = request.json

        # Extract parameters
        bounds = data['bounds']
        start_year = int(data['startYear'])
        end_year = int(data['endYear'])

        # Perform yearly analysis
        result = analyze_forest_change_yearly(bounds, start_year, end_year)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)