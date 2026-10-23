import os
import sys
import subprocess
import shutil
from PIL import Image
import numpy as np

WORKSPACE = r"C:\Users\gebel\.gemini\antigravity\scratch\zapitv_app"
MASTER_MOV = r"C:\Users\gebel\Downloads\zapi.mov"
PUBLIC_DIR = os.path.join(WORKSPACE, "public")
TEMP_FRAMES_DIR = os.path.join(WORKSPACE, "temp_master_frames_raw")
TEMP_480_DIR = os.path.join(WORKSPACE, "temp_master_frames_480")

def main():
    print("=== Geração de Assets da Logo ZapiTV com Antialiasing Perfeito ===")
    
    if not os.path.exists(MASTER_MOV):
        print(f"ERRO: Master {MASTER_MOV} não encontrado!")
        sys.exit(1)
        
    os.makedirs(TEMP_FRAMES_DIR, exist_ok=True)
    os.makedirs(TEMP_480_DIR, exist_ok=True)
    
    # 1. Extrair os 91 quadros do master lossless QuickTime Animation
    print("1. Extraindo quadros lossless do master MOV...")
    cmd_extract = [
        "ffmpeg", "-y", "-i", MASTER_MOV,
        "-pix_fmt", "rgba",
        os.path.join(TEMP_FRAMES_DIR, "frame_%03d.png")
    ]
    subprocess.run(cmd_extract, check=True, capture_output=True)
    
    frame_files = sorted([
        os.path.join(TEMP_FRAMES_DIR, f) 
        for f in os.listdir(TEMP_FRAMES_DIR) 
        if f.startswith("frame_") and f.endswith(".png")
    ])
    print(f"Total de quadros extraídos: {len(frame_files)}")
    assert len(frame_files) == 91, f"Esperado 91 quadros, obtido {len(frame_files)}"
    
    # 2. Processar cada quadro com recorte perfeitamente centralizado e supersampling Lanczos
    # Centro de rotação exato do master 1080x1080: (540, 540)
    # Recorte 760x760: [160, 160, 920, 920]
    # Resolução de saída: 480x480 (fator 1.583x supersampling com Lanczos)
    print("2. Redimensionando quadros para 480x480 com filtro Lanczos de alta fidelidade...")
    crop_box = (160, 160, 920, 920)
    
    processed_images = []
    for idx, fpath in enumerate(frame_files, start=1):
        im = Image.open(fpath)
        cropped = im.crop(crop_box)
        
        # Resample com Lanczos
        resized = cropped.resize((480, 480), Image.Resampling.LANCZOS)
        
        # Garantir que pixels externos 100% transparentes tenham RGB rigorosamente zerado
        # e que o canal alfa conserve o antialiasing gradual perfeito
        arr = np.array(resized)
        alpha = arr[:, :, 3]
        
        # Onde alfa == 0, zerar RGB para evitar halos e garantir transparência limpa
        arr[alpha == 0] = [0, 0, 0, 0]
        
        cleaned = Image.fromarray(arr, mode="RGBA")
        out_path = os.path.join(TEMP_480_DIR, f"frame_{idx:03d}.png")
        cleaned.save(out_path, format="PNG")
        processed_images.append(cleaned)
        
    print(f"Todos os {len(processed_images)} quadros processados com sucesso.")
    
    # 3. Gerar public/zapi-icon.png (Frame 1 estatico de fallback)
    png_target = os.path.join(PUBLIC_DIR, "zapi-icon.png")
    print(f"3. Gerando {png_target}...")
    processed_images[0].save(png_target, format="PNG")
    print(f"[OK] zapi-icon.png gerado: {os.path.getsize(png_target)} bytes")
    
    # 4. Gerar public/zapi-icon.webp (Animated WebP de altissima qualidade)
    # Usando ffmpeg libwebp_anim com bgra, lossless 0, qualidade 96 (ou Pillow)
    webp_target = os.path.join(PUBLIC_DIR, "zapi-icon.webp")
    print(f"4. Gerando {webp_target}...")
    cmd_webp = [
        "ffmpeg", "-y", "-framerate", "30",
        "-i", os.path.join(TEMP_480_DIR, "frame_%03d.png"),
        "-c:v", "libwebp_anim",
        "-lossless", "0",
        "-q:v", "96",
        "-loop", "0",
        webp_target
    ]
    subprocess.run(cmd_webp, check=True, capture_output=True)
    print(f"[OK] zapi-icon.webp gerado: {os.path.getsize(webp_target)} bytes")
    
    # 5. Gerar public/zapi-icon.apng (Animated PNG nativo 30fps)
    apng_target = os.path.join(PUBLIC_DIR, "zapi-icon.apng")
    print(f"5. Gerando {apng_target}...")
    cmd_apng = [
        "ffmpeg", "-y", "-framerate", "30",
        "-i", os.path.join(TEMP_480_DIR, "frame_%03d.png"),
        "-f", "apng",
        "-plays", "0",
        apng_target
    ]
    subprocess.run(cmd_apng, check=True, capture_output=True)
    print(f"[OK] zapi-icon.apng gerado: {os.path.getsize(apng_target)} bytes")
    
    # 6. Gerar public/zapi-icon.webm (VP9 yuva420p com canal alfa e alta qualidade)
    webm_target = os.path.join(PUBLIC_DIR, "zapi-icon.webm")
    print(f"6. Gerando {webm_target}...")
    cmd_webm = [
        "ffmpeg", "-y", "-framerate", "30",
        "-i", os.path.join(TEMP_480_DIR, "frame_%03d.png"),
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "0",
        "-crf", "14",
        "-auto-alt-ref", "0",
        webm_target
    ]
    subprocess.run(cmd_webm, check=True, capture_output=True)
    print(f"[OK] zapi-icon.webm gerado: {os.path.getsize(webm_target)} bytes")
    
    # Limpeza de arquivos temporarios
    shutil.rmtree(TEMP_FRAMES_DIR, ignore_errors=True)
    shutil.rmtree(TEMP_480_DIR, ignore_errors=True)
    print("[OK] Arquivos temporarios removidos.")
    print("=== Geracao concluida com sucesso! ===")

if __name__ == "__main__":
    main()
