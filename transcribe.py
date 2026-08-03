import sys
import json
import whisper

def analyze_audio(audio_path):
    try:
        # Carrega o modelo base do Whisper (execução local rápida)
        model = whisper.load_model("tiny")
        result = model.transcribe(audio_path)
        
        timestamps = []
        for segment in result.get("segments", []):
            timestamps.append({
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"]
            })
            
        print(json.dumps({"success": True, "segments": timestamps}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_audio(sys.argv[1])
    else:
        print(json.dumps({"success": False, "error": "Caminho do áudio não fornecido"}))
