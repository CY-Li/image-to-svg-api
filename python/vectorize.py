import sys
import cv2
import numpy as np
import subprocess
import os
import re

def remove_background(img):
    h, w = img.shape[:2]
    corners = np.array([img[0,0], img[0,w-1], img[h-1,0], img[h-1,w-1]])
    bg_color = np.mean(corners, axis=0)
    diff = np.linalg.norm(img - bg_color, axis=2)
    mask = (diff > 30).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    return mask

def main():
    img_path = sys.argv[1]
    output_svg = sys.argv[2]
    threshold = None
    if len(sys.argv) > 3:
        try:
            threshold = int(sys.argv[3])
        except:
            threshold = None

    # 1. 讀取原圖
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    if img.shape[2] == 4:
        alpha = img[:,:,3]
        img = img[:,:,:3]
    else:
        mask = remove_background(img)
        alpha = mask

    # 2. 輕度降噪
    #img = cv2.fastNlMeansDenoisingColored(img, None, h=5, hColor=5, templateWindowSize=7, searchWindowSize=21)

    # 3. 對比與亮度優化（微調）
    #img_yuv = cv2.cvtColor(img, cv2.COLOR_BGR2YUV)
    #img_yuv[:,:,0] = cv2.equalizeHist(img_yuv[:,:,0])
    #img = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2BGR)

    # 4. 銳利化（Unsharp Mask）
    #gaussian = cv2.GaussianBlur(img, (0, 0), 3)
    #img = cv2.addWeighted(img, 1.2, gaussian, -0.2, 0)

    # 5. 色彩簡化（Posterize）
    #div = 64  # 4色
    #img = img // div * div + div // 2

    # 6. 保持比例縮放（這裡假設不縮放，若需縮放可加參數）
    # img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    # 7. 檢查邊緣平滑度（自動：再做一次輕度降噪）
    img = cv2.fastNlMeansDenoisingColored(img, None, h=3, hColor=3, templateWindowSize=7, searchWindowSize=21)

    # 8. 合成 alpha，將背景設為白色
    bg = np.ones_like(img) * 255
    alpha_mask = (alpha > 127).astype(np.uint8)
    img = img * alpha_mask[:,:,None] + bg * (1 - alpha_mask[:,:,None])

    # 9. 轉灰階
    gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY)

    # 10. 二值化
    if threshold is not None:
        _, mask_img = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
    else:
        _, mask_img = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 11. 上下翻轉，避免 SVG 鏡像
    mask_img = cv2.flip(mask_img, 0)

    # 12. 輸出 PGM
    mask_path = 'mask_bin.pgm'
    svg_path = 'path_bin.svg'
    cv2.imwrite(mask_path, mask_img)
    subprocess.run(['potrace', mask_path, '-s', '-o', svg_path], check=True)
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()
    paths = re.findall(r'<path[^>]+/>', svg_content)
    color_hex = '#000000'
    svg_paths = []
    for p in paths:
        if 'fill=' in p:
            p = re.sub(r'fill=\"[^\"]*\"', f'fill=\"{color_hex}\"', p)
        else:
            p = p.replace('/>', f' fill=\"{color_hex}\"/>')
        svg_paths.append(p)
    os.remove(mask_path)
    os.remove(svg_path)

    h, w = mask_img.shape[:2]
    svg_header = f'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\">'
    svg_footer = '</svg>'
    with open(output_svg, 'w', encoding='utf-8') as f:
        f.write(svg_header + '\n')
        for p in svg_paths:
            f.write(p + '\n')
        f.write(svg_footer)

if __name__ == '__main__':
    main() 