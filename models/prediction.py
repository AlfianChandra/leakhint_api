import sys
import json
import pickle
import pandas as pd
import traceback
import os

def print_error(message):
    """Print error dalam format JSON dan keluar"""
    print(json.dumps({
        "status": "error",
        "message": message
    }))
    sys.exit(1)

def debug_log(message):
    """Log debug ke stderr"""
    print(f"Debug: {message}", file=sys.stderr)

def validate_arguments():
    """Validasi argumen command line"""
    if len(sys.argv) < 6:
        print_error("Argumen tidak lengkap. Gunakan: python predict_model.py <parameterLength> <modelName> <tline_length> <infix> <outputType> [trainingInfix]")
    
    try:
        parameterLength = int(sys.argv[1])
        if parameterLength <= 0:
            print_error("parameterLength harus bilangan positif")
    except ValueError:
        print_error("parameterLength harus berupa integer")
    
    model_name = sys.argv[2]
    model_path = os.path.join("./models", model_name)
    
    try:
        tline_length = float(sys.argv[3])
        if tline_length <= 0:
            print_error("tline_length harus bilangan positif")
    except ValueError:
        print_error("tline_length harus berupa angka")
    
    infix = sys.argv[4]
    if "{x}" not in infix:
        print_error("infix harus mengandung placeholder '{x}'")
    
    output_type = sys.argv[5].lower()
    if output_type not in ["single", "multiple"]:
        print_error("outputType harus 'single' atau 'multiple'")
    
    # Optional: training_infix (nama kolom saat training model)
    # Jika tidak disediakan atau kosong, pakai infix yang sama
    training_infix = None
    if len(sys.argv) > 6 and sys.argv[6].strip():
        training_infix = sys.argv[6]
        if "{x}" not in training_infix:
            print_error("trainingInfix harus mengandung placeholder '{x}'")
    else:
        training_infix = infix  # Default: sama dengan infix
    
    return parameterLength, model_path, tline_length, infix, output_type, training_infix

def load_model(model_path):
    """Load model dari file pickle"""
    if not os.path.exists(model_path):
        print_error(f"File model tidak ditemukan: {model_path}")
    
    try:
        with open(model_path, 'rb') as file:
            model = pickle.load(file)
        debug_log(f"Model berhasil dimuat dari {model_path}")
        return model
    except Exception as e:
        print_error(f"Gagal load model: {str(e)}")

def read_input_data():
    """Baca input JSON dari stdin"""
    try:
        data = json.load(sys.stdin)
        if not isinstance(data, dict):
            print_error("Input JSON harus berupa object/dictionary")
        return data
    except json.JSONDecodeError as e:
        print_error(f"Format JSON tidak valid: {str(e)}")
    except Exception as e:
        print_error(f"Gagal baca input: {str(e)}")

def prepare_features(data, parameterLength, infix, training_infix):
    """Generate key dan konversi data menjadi DataFrame"""
    # Generate input keys dari infix pattern (nama kolom dari user input)
    input_keys = [infix.replace("{x}", str(i)) for i in range(1, parameterLength + 1)]
    
    # Generate training keys dari training_infix (nama kolom saat training model)
    training_keys = [training_infix.replace("{x}", str(i)) for i in range(1, parameterLength + 1)]
    
    debug_log(f"Input keys: {input_keys}")
    debug_log(f"Training keys: {training_keys}")
    
    # Validasi kelengkapan input
    missing = [k for k in input_keys if k not in data]
    if missing:
        print_error(f"Input kurang lengkap, key hilang: {', '.join(missing)}")
    
    # Konversi ke float dengan error handling per-key
    inputs = []
    for k in input_keys:
        try:
            value = float(data[k])
            inputs.append(value)
        except (ValueError, TypeError):
            print_error(f"Nilai untuk key '{k}' harus berupa angka valid, diterima: {data[k]}")
    
    # Buat DataFrame dengan nama kolom TRAINING (yang model expect)
    df_input = pd.DataFrame([inputs], columns=training_keys)
    debug_log(f"DataFrame Input:\n{df_input.to_string()}")
    
    return df_input, input_keys

def make_prediction(model, df_input):
    """Lakukan prediksi menggunakan model"""
    try:
        prediksi = model.predict(df_input)
        debug_log(f"Hasil prediksi mentah: {prediksi}")
        return prediksi
    except Exception as e:
        debug_log(f"Error detail:\n{traceback.format_exc()}")
        print_error(f"Error saat prediksi: {str(e)}")

def format_output(prediksi, output_type, tline_length):
    """Format hasil prediksi sesuai output_type"""
    if output_type == "single":
        hasil = float(prediksi[0])
        
        if 0 < hasil < tline_length:
            return {"lokasi": f"KM {hasil:.2f}", "status": "kebocoran"}
        else:
            return {"lokasi": None, "status": "aman"}
    
    elif output_type == "multiple":
        # Pastikan prediksi adalah array 2D
        if len(prediksi.shape) == 1:
            hasil_prediksi = prediksi
        else:
            hasil_prediksi = prediksi[0]
        
        result = []
        for i, val in enumerate(hasil_prediksi, start=1):
            val = float(val)
            if 0 < val < tline_length:
                result.append({
                    "titik": i,
                    "lokasi": f"KM {val:.2f}",
                    "status": "kebocoran"
                })
            else:
                result.append({
                    "titik": i,
                    "lokasi": None,
                    "status": "aman"
                })
        
        return result

def main():
    try:
        # Validasi dan parse argumen
        parameterLength, model_path, tline_length, infix, output_type, training_infix = validate_arguments()
        debug_log(f"Params: length={parameterLength}, tline={tline_length}, infix={infix}, training_infix={training_infix}, output={output_type}")
        
        # Load model
        model = load_model(model_path)
        
        # Baca input data
        data = read_input_data()
        debug_log(f"Input data: {json.dumps(data, indent=2)}")
        
        # Prepare features
        df_input, input_keys = prepare_features(data, parameterLength, infix, training_infix)
        
        # Prediksi
        prediksi = make_prediction(model, df_input)
        
        # Format output
        result = format_output(prediksi, output_type, tline_length)
        
        # Return hasil JSON
        output = {
            "status": "success",
            "result": result,
            "spots": {k: data[k] for k in input_keys},
            "model": model_path
        }
        
        print(json.dumps(output, indent=2))
        sys.exit(0)
        
    except SystemExit:
        # Biarkan SystemExit dari print_error() lewat
        raise
    except Exception as e:
        debug_log(f"Fatal error:\n{traceback.format_exc()}")
        print_error(f"Terjadi kesalahan fatal: {str(e)}")

if __name__ == "__main__":
    main()