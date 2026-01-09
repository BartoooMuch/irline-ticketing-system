"""
ML Price Prediction Service
Flask application for predicting flight prices using Machine Learning
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from datetime import datetime
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Model and encoders storage
model = None
encoders = {}

# Airport distance mapping (approximate distances in km)
AIRPORT_DISTANCES = {
    ('IST', 'SAW'): 50,
    ('IST', 'ESB'): 350,
    ('IST', 'ADB'): 330,
    ('IST', 'AYT'): 480,
    ('IST', 'BJV'): 520,
    ('IST', 'DLM'): 600,
    ('IST', 'TZX'): 880,
    ('IST', 'GZT'): 850,
    ('IST', 'VAN'): 1200,
    ('IST', 'JFK'): 8000,
    ('IST', 'LAX'): 11000,
    ('IST', 'LHR'): 2500,
    ('IST', 'CDG'): 2200,
    ('IST', 'FRA'): 1800,
    ('IST', 'AMS'): 2200,
    ('IST', 'DXB'): 3000,
    ('ADB', 'SAW'): 290,
    ('ADB', 'ESB'): 450,
    ('ESB', 'AYT'): 350,
    ('AYT', 'SAW'): 400,
}


def get_distance(from_airport, to_airport):
    """Get distance between two airports"""
    key = (from_airport, to_airport)
    reverse_key = (to_airport, from_airport)
    
    if key in AIRPORT_DISTANCES:
        return AIRPORT_DISTANCES[key]
    elif reverse_key in AIRPORT_DISTANCES:
        return AIRPORT_DISTANCES[reverse_key]
    else:
        # Default distance for unknown routes
        return 500


def extract_features(data):
    """Extract features from input data for prediction"""
    from_airport = data.get('fromAirport', 'IST')
    to_airport = data.get('toAirport', 'SAW')
    departure_date = data.get('departureDate', datetime.now().strftime('%Y-%m-%d'))
    duration_minutes = data.get('durationMinutes', 90)
    
    # Parse date
    try:
        date_obj = datetime.strptime(departure_date, '%Y-%m-%d')
    except:
        date_obj = datetime.now()
    
    # Extract date features
    month = date_obj.month
    day_of_week = date_obj.weekday()
    day_of_month = date_obj.day
    
    # Days until departure
    days_until = (date_obj - datetime.now()).days
    if days_until < 0:
        days_until = 0
    
    # Is weekend
    is_weekend = 1 if day_of_week >= 5 else 0
    
    # Is peak season (June-August, December)
    is_peak_season = 1 if month in [6, 7, 8, 12] else 0
    
    # Distance
    distance = get_distance(from_airport, to_airport)
    
    # Is international
    domestic_airports = ['IST', 'SAW', 'ESB', 'ADB', 'AYT', 'BJV', 'DLM', 'TZX', 'GZT', 'VAN']
    is_international = 0 if (from_airport in domestic_airports and to_airport in domestic_airports) else 1
    
    features = {
        'duration_minutes': duration_minutes,
        'month': month,
        'day_of_week': day_of_week,
        'day_of_month': day_of_month,
        'days_until_departure': days_until,
        'is_weekend': is_weekend,
        'is_peak_season': is_peak_season,
        'distance': distance,
        'is_international': is_international,
    }
    
    return features


def train_model():
    """Train or load the price prediction model"""
    global model, encoders
    
    model_path = 'model/flight_price_model.joblib'
    
    # Check if model exists
    if os.path.exists(model_path):
        try:
            model = joblib.load(model_path)
            logger.info("Model loaded from file")
            return
        except Exception as e:
            logger.warning(f"Failed to load model: {e}")
    
    # Generate synthetic training data
    logger.info("Training new model with synthetic data...")
    
    np.random.seed(42)
    n_samples = 10000
    
    # Generate features
    durations = np.random.randint(30, 720, n_samples)  # 30 mins to 12 hours
    months = np.random.randint(1, 13, n_samples)
    day_of_weeks = np.random.randint(0, 7, n_samples)
    day_of_months = np.random.randint(1, 29, n_samples)
    days_until = np.random.randint(0, 90, n_samples)
    is_weekends = (day_of_weeks >= 5).astype(int)
    is_peak_seasons = np.isin(months, [6, 7, 8, 12]).astype(int)
    distances = np.random.randint(100, 12000, n_samples)
    is_internationals = (distances > 1500).astype(int)
    
    # Generate prices based on features (with some noise)
    # Domestic flights base price
    domestic_base = 40
    international_base = 150
    
    base_prices = np.where(is_internationals == 1, international_base, domestic_base)
    
    prices = (
        base_prices +
        durations * 0.15 +  # Duration factor (reduced for domestic)
        is_peak_seasons * np.where(is_internationals == 1, 80, 25) +  # Peak season premium
        is_weekends * np.where(is_internationals == 1, 30, 15) +  # Weekend premium
        np.maximum(0, 30 - days_until) * 2 +  # Last-minute premium
        distances * np.where(is_internationals == 1, 0.03, 0.005) +  # Distance factor (much lower for domestic)
        np.random.normal(0, np.where(is_internationals == 1, 40, 15), n_samples)  # Random noise (lower for domestic)
    )
    prices = np.maximum(prices, np.where(is_internationals == 1, 100, 35))  # Minimum price
    
    # Create training data
    X = pd.DataFrame({
        'duration_minutes': durations,
        'month': months,
        'day_of_week': day_of_weeks,
        'day_of_month': day_of_months,
        'days_until_departure': days_until,
        'is_weekend': is_weekends,
        'is_peak_season': is_peak_seasons,
        'distance': distances,
        'is_international': is_internationals,
    })
    y = prices
    
    # Train model
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X, y)
    
    # Save model
    os.makedirs('model', exist_ok=True)
    joblib.dump(model, model_path)
    logger.info("Model trained and saved")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'ml-service',
        'version': '1.0.0',
        'model_loaded': model is not None
    })


@app.route('/predict', methods=['POST'])
def predict():
    """Predict flight price"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Extract features
        features = extract_features(data)
        
        # Create feature vector
        X = pd.DataFrame([features])
        
        # Make prediction
        if model is None:
            train_model()
        
        predicted_price = model.predict(X)[0]
        
        # Adjust for domestic flights (manual override for better pricing)
        from_airport = data.get('fromAirport', '').upper()
        to_airport = data.get('toAirport', '').upper()
        domestic_airports = ['IST', 'SAW', 'ESB', 'ADB', 'AYT', 'BJV', 'DLM', 'TZX', 'GZT', 'VAN']
        is_domestic = (from_airport in domestic_airports and to_airport in domestic_airports)
        
        # If model prediction is too high for domestic, apply adjustment
        if is_domestic and predicted_price > 80:
            # For domestic flights, cap at reasonable price
            distance = features['distance']
            duration = features['duration_minutes']
            # Base formula: 40 + (distance * 0.005) + (duration * 0.1) + season/weekend adjustments
            adjusted_base = 40
            adjusted_price = adjusted_base + (distance * 0.005) + (duration * 0.1)
            
            if features['is_peak_season']:
                adjusted_price += 20
            if features['is_weekend']:
                adjusted_price += 10
            if features['days_until_departure'] < 7:
                adjusted_price += (7 - features['days_until_departure']) * 2
            
            # Use the lower of model prediction or adjusted price, but cap at 85 for domestic
            predicted_price = min(predicted_price, max(adjusted_price, 35))
            predicted_price = min(predicted_price, 85)  # Max 85 for domestic
        
        # Round to 2 decimal places
        predicted_price = round(max(predicted_price, 30), 2)
        
        logger.info(f"Prediction: {data.get('fromAirport')} -> {data.get('toAirport')} = ${predicted_price}")
        
        return jsonify({
            'success': True,
            'predictedPrice': predicted_price,
            'currency': 'USD',
            'features': features,
            'confidence': 0.85  # Placeholder confidence score
        })
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Predict prices for multiple flights"""
    try:
        data = request.get_json()
        
        if not data or 'flights' not in data:
            return jsonify({
                'success': False,
                'error': 'No flights data provided'
            }), 400
        
        predictions = []
        for flight in data['flights']:
            features = extract_features(flight)
            X = pd.DataFrame([features])
            
            if model is None:
                train_model()
            
            predicted_price = round(max(model.predict(X)[0], 30), 2)
            
            predictions.append({
                'fromAirport': flight.get('fromAirport'),
                'toAirport': flight.get('toAirport'),
                'departureDate': flight.get('departureDate'),
                'predictedPrice': predicted_price
            })
        
        return jsonify({
            'success': True,
            'predictions': predictions
        })
        
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    if model is None:
        return jsonify({
            'success': False,
            'error': 'Model not loaded'
        }), 404
    
    return jsonify({
        'success': True,
        'model_type': 'RandomForestRegressor',
        'n_estimators': model.n_estimators,
        'max_depth': model.max_depth,
        'feature_importance': dict(zip(
            ['duration_minutes', 'month', 'day_of_week', 'day_of_month', 
             'days_until_departure', 'is_weekend', 'is_peak_season', 
             'distance', 'is_international'],
            model.feature_importances_.tolist()
        ))
    })


@app.route('/model/retrain', methods=['POST'])
def retrain():
    """Retrain the model (requires authentication in production)"""
    try:
        train_model()
        return jsonify({
            'success': True,
            'message': 'Model retrained successfully'
        })
    except Exception as e:
        logger.error(f"Retrain error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# Initialize model on startup
with app.app_context():
    train_model()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('FLASK_ENV') == 'development')
