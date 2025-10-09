import sys
import json
import pickle
import pandas as pd  # ⬅️ tambahin ini

def print_error(message, code=1):
    """Print error JSON ke stderr dan keluar dengan code != 0"""
    error_output = json.dumps({
        "status": "error",
        "message": message
    })
    print(error_output, file=sys.stderr)
    sys.exit(code)

def main():
    try:
        # === Ambil argument ===
        if len(sys.argv) < 3:
            print_error("Argumen tidak lengkap. Gunakan: python predict_model.py <parameterLength> <modelPath>")
        
        parameterLength = int(sys.argv[1])
        model_path = "./models/" + sys.argv[2]

        # === Load model ===
        try:
            with open(model_path, 'rb') as file:
                model = pickle.load(file)
        except Exception as e:
            print_error(f"Gagal load model: {str(e)}")

        # === Baca input JSON dari stdin ===
        try:
            data = json.load(sys.stdin)
        except Exception as e:
            print_error(f"Gagal baca input JSON: {str(e)}")

        # === Validasi input ===
        required_keys = [f"spot{i}" for i in range(1, parameterLength + 1)]
        if not all(k in data for k in required_keys):
            print_error(f"Input harus berisi semua titik: {', '.join(required_keys)}")

        # === Konversi ke float ===
        feature_names = [f"P{i}" for i in range(1, parameterLength + 1)]
        inputs = [float(data[f"spot{i}"]) for i in range(1, parameterLength + 1)]
        df_input = pd.DataFrame([inputs], columns=feature_names)
        # === Prediksi ===
        prediksi = model.predict(df_input)
        hasil = float(prediksi[0])  # karena single output

        # === Tentukan hasil ===
        if 0 < hasil < float(sys.argv[3]):
            result = {"lokasi": f"KM {hasil:.2f}", "status": "kebocoran"}
        else:
            result = {"lokasi": None, "status": "aman"}

        print(json.dumps({
            "status": "success",
            "result": result,
            "spots": {k: data[k] for k in required_keys},
            "model": model_path
        }))
        sys.exit(0)  # sukses ✅

    except Exception as e:
        print_error(f"Terjadi kesalahan: {str(e)}")

if __name__ == "__main__":
    main()
