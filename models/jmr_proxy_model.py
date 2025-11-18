"""
=================================================================================
PIPELINE LEAK DETECTION - API MODE
=================================================================================

Execution via Node.js spawn with JSON input/output
Usage: python3 models/jmr_proxy_model.py <model_path>

Author: Pertamina EP Jambi Field - Team UWAK PO
Version: 4.1 - API Mode
Date: 2025-11-18
=================================================================================
"""

import pickle
import numpy as np
import pandas as pd
import json
import sys
from datetime import datetime
from scipy import interpolate

# =============================================================================
# LEAK DETECTION MODEL CLASS
# =============================================================================

class LeakDetectionModel:
    """
    Pipeline Leak Detection Model - Ensemble approach
    Handles adaptive sensor configuration
    """
    
    def __init__(self, pipeline_length, psi_per_meter, upstream_bias=0.5):
        self.pipeline_length = pipeline_length
        self.psi_per_meter = psi_per_meter
        self.upstream_bias = upstream_bias
        
        self.suspicion_index_func = None
        self.gradient_func = None
        self.pressure_drop_func = None
        self.interpolated_funcs = {}
        
        self.method_weights = {
            'suspicion_index': 0.25,
            'midpoint': 0.15,
            'gradient': 0.20,
            'pressure_drop': 0.20,
            'weighted_avg': 0.20
        }
    
    def train(self, sensor_locations, normal_pressure, drop_pressure):
        """Train model with sensor data"""
        pressure_changes = normal_pressure - drop_pressure
        pressure_ratios = drop_pressure / normal_pressure
        
        suspicion_scores = self._calculate_suspicion_index(
            sensor_locations, pressure_changes, pressure_ratios
        )
        
        self.suspicion_index_func = interpolate.interp1d(
            sensor_locations, 
            suspicion_scores,
            kind='cubic',
            fill_value='extrapolate'
        )
        
        gradients = np.gradient(pressure_changes, sensor_locations)
        self.gradient_func = interpolate.interp1d(
            sensor_locations,
            np.abs(gradients),
            kind='cubic',
            fill_value='extrapolate'
        )
        
        self.pressure_drop_func = interpolate.interp1d(
            sensor_locations,
            pressure_changes,
            kind='cubic',
            fill_value='extrapolate'
        )
        
        self.training_data = {
            'sensor_locations': sensor_locations,
            'normal_pressure': normal_pressure,
            'drop_pressure': drop_pressure,
            'pressure_changes': pressure_changes,
            'pressure_ratios': pressure_ratios,
            'suspicion_scores': suspicion_scores
        }
        
        return self
    
    def _calculate_suspicion_index(self, locations, changes, ratios):
        """Calculate suspicion index for each sensor"""
        n = len(locations)
        suspicion = np.zeros(n)
        
        norm_changes = changes / np.max(changes) if np.max(changes) > 0 else changes
        norm_ratios = (1 - ratios) / np.max(1 - ratios) if np.max(1 - ratios) > 0 else (1 - ratios)
        
        for i in range(n):
            change_score = norm_changes[i]
            ratio_score = norm_ratios[i]
            
            neighbor_score = 0
            if i > 0:
                neighbor_score += abs(changes[i] - changes[i-1])
            if i < n-1:
                neighbor_score += abs(changes[i] - changes[i+1])
            neighbor_score = neighbor_score / np.max(changes) if np.max(changes) > 0 else 0
            
            suspicion[i] = 0.4 * change_score + 0.3 * ratio_score + 0.3 * neighbor_score
        
        return suspicion
    
    def predict(self, sensor_locations, normal_pressure, drop_pressure):
        """Predict leak location from current sensor readings"""
        pressure_changes = normal_pressure - drop_pressure
        pressure_ratios = drop_pressure / normal_pressure
        
        suspicion_scores = self._calculate_suspicion_index(
            sensor_locations, pressure_changes, pressure_ratios
        )
        
        top_sensor_idx = np.argmax(suspicion_scores)
        
        # METHOD 1: Suspicion Index Peak
        estimate_suspicion = sensor_locations[top_sensor_idx] - self.upstream_bias
        
        # METHOD 2: Midpoint between sensors
        estimate_midpoint = np.nan
        if top_sensor_idx > 0:
            estimate_midpoint = (sensor_locations[top_sensor_idx] + 
                                sensor_locations[top_sensor_idx-1]) / 2
        
        # METHOD 3: Gradient peak
        if len(sensor_locations) >= 3:
            gradients = np.gradient(pressure_changes, sensor_locations)
            peak_gradient_idx = np.argmax(np.abs(gradients))
            estimate_gradient = sensor_locations[peak_gradient_idx]
        else:
            estimate_gradient = estimate_suspicion
        
        # METHOD 4: Maximum pressure drop
        max_drop_idx = np.argmax(pressure_changes)
        estimate_max_drop = sensor_locations[max_drop_idx] - self.upstream_bias
        
        # METHOD 5: Weighted average
        weights = suspicion_scores / np.sum(suspicion_scores)
        estimate_weighted = np.sum(sensor_locations * weights)
        
        # Combine all methods
        estimates = []
        weights_list = []
        
        estimates.append(estimate_suspicion)
        weights_list.append(self.method_weights['suspicion_index'])
        
        if not np.isnan(estimate_midpoint):
            estimates.append(estimate_midpoint)
            weights_list.append(self.method_weights['midpoint'])
        
        estimates.append(estimate_gradient)
        weights_list.append(self.method_weights['gradient'])
        
        estimates.append(estimate_max_drop)
        weights_list.append(self.method_weights['pressure_drop'])
        
        estimates.append(estimate_weighted)
        weights_list.append(self.method_weights['weighted_avg'])
        
        estimates = np.array(estimates)
        weights_list = np.array(weights_list)
        weights_list = weights_list / np.sum(weights_list)
        
        final_estimate = np.sum(estimates * weights_list)
        estimate_std = np.std(estimates)
        
        # Confidence
        if estimate_std < 1.0:
            confidence = "VERY HIGH"
        elif estimate_std < 3.0:
            confidence = "HIGH"
        elif estimate_std < 5.0:
            confidence = "MODERATE"
        else:
            confidence = "LOW"
        
        # Focus zones
        focus_start = max(0, final_estimate - 3.0)
        focus_end = min(self.pipeline_length, final_estimate + 3.0)
        
        critical_start = max(0, final_estimate - 1.5)
        critical_end = min(self.pipeline_length, final_estimate + 1.5)
        
        # Calculate severity
        avg_drop_pct = np.mean(pressure_changes) / 200 * 100
        if avg_drop_pct > 10:
            severity = "CRITICAL"
            action = "IMMEDIATE SHUTDOWN & INSPECTION"
            priority = "CRITICAL"
        elif avg_drop_pct > 5:
            severity = "HIGH"
            action = "URGENT INSPECTION REQUIRED"
            priority = "HIGH"
        elif avg_drop_pct > 2:
            severity = "MODERATE"
            action = "SCHEDULE INSPECTION"
            priority = "MEDIUM"
        else:
            severity = "LOW"
            action = "CONTINUE MONITORING"
            priority = "LOW"
        
        results = {
            'final_estimate': float(final_estimate),
            'estimate_std': float(estimate_std),
            'confidence': confidence,
            'top_sensor_idx': int(top_sensor_idx),
            'suspicion_index': suspicion_scores.tolist(),
            'pressure_changes': pressure_changes.tolist(),
            'pressure_ratios': pressure_ratios.tolist(),
            'individual_estimates': {
                'suspicion_index': float(estimate_suspicion),
                'midpoint': float(estimate_midpoint) if not np.isnan(estimate_midpoint) else None,
                'gradient': float(estimate_gradient),
                'max_drop': float(estimate_max_drop),
                'weighted_avg': float(estimate_weighted)
            },
            'focus_zone': {
                'start': float(focus_start),
                'end': float(focus_end),
                'width': float(focus_end - focus_start)
            },
            'critical_zone': {
                'start': float(critical_start),
                'end': float(critical_end),
                'width': float(critical_end - critical_start)
            },
            'severity': severity,
            'recommended_action': action,
            'inspection_priority': priority,
            'avg_pressure_drop_pct': float(avg_drop_pct)
        }
        
        return results
    
    def get_sensor_analysis(self, sensor_locations, normal_pressure, drop_pressure, 
                           sensor_names=None):
        """Get detailed sensor analysis for reporting"""
        pressure_changes = normal_pressure - drop_pressure
        pressure_ratios = drop_pressure / normal_pressure
        suspicion_scores = self._calculate_suspicion_index(
            sensor_locations, pressure_changes, pressure_ratios
        )
        
        if sensor_names is None:
            sensor_names = [f"Sensor {i+1}" for i in range(len(sensor_locations))]
        
        sensors_data = []
        for i in range(len(sensor_locations)):
            sensors_data.append({
                'sensor_name': sensor_names[i],
                'kp': float(sensor_locations[i]),
                'normal_pressure': float(normal_pressure[i]),
                'drop_pressure': float(drop_pressure[i]),
                'pressure_change': float(pressure_changes[i]),
                'pressure_ratio': float(pressure_ratios[i]),
                'suspicion_index': float(suspicion_scores[i])
            })
        
        # Sort by suspicion index
        sensors_ranked = sorted(sensors_data, key=lambda x: x['suspicion_index'], reverse=True)
        for idx, sensor in enumerate(sensors_ranked):
            sensor['rank'] = idx + 1
        
        return sensors_data, sensors_ranked


# =============================================================================
# LOAD MODEL
# =============================================================================

def load_model(model_path):
    """Load trained model from .sav file"""
    try:
        with open(model_path, 'rb') as f:
            model_package = pickle.load(f)
        
        model = model_package['model']
        metadata = model_package['metadata']
        
        return model, metadata, None
        
    except FileNotFoundError:
        return None, None, f"Model file not found: {model_path}"
    except Exception as e:
        return None, None, f"Error loading model: {str(e)}"


# =============================================================================
# MAIN EXECUTION FOR API MODE
# =============================================================================

def main():
    """Main execution for API mode - receives JSON from stdin"""
    
    try:
        # Get model path from command line argument
        if len(sys.argv) < 2:
            error_response = {
                'success': False,
                'error': 'Missing model path argument',
                'usage': 'python3 jmr_proxy_model.py <model_path>'
            }
            print(json.dumps(error_response))
            sys.exit(1)
        
        model_path = sys.argv[1]
        
        # Load model
        model, metadata, error = load_model(model_path)
        
        if error:
            error_response = {
                'success': False,
                'error': error
            }
            print(json.dumps(error_response))
            sys.exit(1)
        
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Extract required parameters
        sensor_locations = np.array(input_data['sensor_locations'])
        normal_pressure = np.array(input_data['normal_pressure'])
        drop_pressure = np.array(input_data['drop_pressure'])
        sensor_names = input_data.get('sensor_names', None)
        
        # Validate input
        if len(sensor_locations) != len(normal_pressure) or len(sensor_locations) != len(drop_pressure):
            error_response = {
                'success': False,
                'error': 'Sensor data arrays must have the same length'
            }
            print(json.dumps(error_response))
            sys.exit(1)
        
        # Run prediction
        results = model.predict(sensor_locations, normal_pressure, drop_pressure)
        
        # Get sensor analysis
        sensors_data, sensors_ranked = model.get_sensor_analysis(
            sensor_locations, normal_pressure, drop_pressure, sensor_names
        )
        
        # Prepare output
        output = {
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'model_info': {
                'version': metadata['version'],
                'pipeline_length': metadata['pipeline_length'],
                'inside_diameter': metadata['inside_diameter'],
                'created_date': metadata['created_date']
            },
            'prediction': results,
            'sensors': {
                'active_count': len(sensor_locations),
                'data': sensors_data,
                'ranked': sensors_ranked[:5]  # Top 5
            }
        }
        
        # Output JSON to stdout
        print(json.dumps(output, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        error_response = {
            'success': False,
            'error': f'Invalid JSON input: {str(e)}'
        }
        print(json.dumps(error_response))
        sys.exit(1)
        
    except KeyError as e:
        error_response = {
            'success': False,
            'error': f'Missing required field: {str(e)}'
        }
        print(json.dumps(error_response))
        sys.exit(1)
        
    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_response))
        sys.exit(1)


if __name__ == '__main__':
    main()