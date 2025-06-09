import sys
import cv2
import numpy as np
import subprocess
import os
import re

def remove_background(img):
    # 以簡單的「magic wand」方式：取四角平均色，將接近此色的區域視為背景
    h, w = img.shape[:2]
    corners = np.array([img[0,0], img[0,w-1], img[h-1,0], img[h-1,w-1]])
    bg_color = np.mean(corners, axis=0)
    diff = np.linalg.norm(img - bg_color, axis=2)
    mask = (diff > 30).astype(np.uint8) * 255  # 30 可調整
    # 邊緣平滑
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    return mask

def main():
    img_path = sys.argv[1]
    output_svg = sys.argv[2]
    n_colors = 4  # 主色數量，可依需求調整
    if len(sys.argv) > 3:
        try:
            n_colors = int(sys.argv[3])
        except:
            n_colors = 4

    # 1. 讀取原圖
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    if img.shape[2] == 4:
        # 已有 alpha，直接用
        alpha = img[:,:,3]
        img = img[:,:,:3]
    else:
        # 1. 背景去除
        mask = remove_background(img)
        alpha = mask

    # 2. 去除雜訊與壓縮痕跡（輕度降噪）
    img = cv2.fastNlMeansDenoisingColored(img, None, h=5, hColor=5, templateWindowSize=7, searchWindowSize=21)

    # 3. 對比與亮度優化（微調）
    img_yuv = cv2.cvtColor(img, cv2.COLOR_BGR2YUV)
    img_yuv[:,:,0] = cv2.equalizeHist(img_yuv[:,:,0])
    img = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2BGR)

    # 4. 銳利化（Unsharp Mask）
    gaussian = cv2.GaussianBlur(img, (0, 0), 3)
    img = cv2.addWeighted(img, 1.2, gaussian, -0.2, 0)

    # 5. 色彩簡化（K-means）
    Z = img.reshape((-1,3))
    Z = np.float32(Z)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, label, center = cv2.kmeans(Z, n_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    center = np.uint8(center)
    res = center[label.flatten()]
    poster = res.reshape((img.shape))

    # 6. 多色遮罩分層 + potrace
    svg_paths = []
    for i, color in enumerate(center):
        mask = (label.flatten() == i).astype(np.uint8) * 255
        mask_img = mask.reshape((img.shape[0], img.shape[1]))
        # 合併 alpha 遮罩
        mask_img = cv2.bitwise_and(mask_img, alpha)
        # 上下翻轉
        mask_img = cv2.flip(mask_img, 0)
        mask_path = f'mask_{i}.pgm'
        svg_path = f'path_{i}.svg'
        cv2.imwrite(mask_path, mask_img)
        subprocess.run(['potrace', mask_path, '-s', '-o', svg_path], check=True)
        with open(svg_path, 'r', encoding='utf-8') as f:
            svg_content = f.read()
        paths = re.findall(r'<path[^>]+/>', svg_content)
        color_hex = '#%02x%02x%02x' % tuple(color)
        for p in paths:
            if 'fill=' in p:
                p = re.sub(r'fill=\"[^\"]*\"', f'fill=\"{color_hex}\"', p)
            else:
                p = p.replace('/>', f' fill=\"{color_hex}\"/>')
            svg_paths.append(p)
        os.remove(mask_path)
        os.remove(svg_path)

    h, w = img.shape[:2]
    svg_header = f'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\">'
    svg_footer = '</svg>'
    with open(output_svg, 'w', encoding='utf-8') as f:
        f.write(svg_header + '\n')
        for p in svg_paths:
            f.write(p + '\n')
        f.write(svg_footer)

if __name__ == '__main__':
    main() 