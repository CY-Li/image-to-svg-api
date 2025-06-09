import sys
import cv2
import numpy as np
import subprocess
import os
import re

def main():
    img_path = sys.argv[1]
    output_svg = sys.argv[2]
    # 新增：可選擇性傳入閾值
    threshold = None
    if len(sys.argv) > 3:
        try:
            threshold = int(sys.argv[3])
        except:
            threshold = None

    # 1. 讀取圖片並轉為灰階
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)

    # 2. 直方圖均衡化（自動對比度增強）
    #img = cv2.equalizeHist(img)

    # 3. 降噪（Non-local Means Denoising）
    #img = cv2.fastNlMeansDenoising(img, None, h=10, templateWindowSize=7, searchWindowSize=21)

    # 4. 高斯模糊（平滑雜訊）
    #img = cv2.GaussianBlur(img, (3, 3), 0)

    # 5. 銳化（Unsharp Mask）
    gaussian = cv2.GaussianBlur(img, (0, 0), 3)
    img = cv2.addWeighted(img, 1.5, gaussian, -0.5, 0)

    # 6. 邊緣增強（Laplacian）
    laplacian = cv2.Laplacian(img, cv2.CV_8U, ksize=3)
    img = cv2.addWeighted(img, 0.8, laplacian, 0.2, 0)

    # 7. 自動反相（若背景為黑則反相）
    #mean_val = np.mean(img)
    #if mean_val < 128:
    #    img = cv2.bitwise_not(img)

    # 8. 二值化
    if threshold is not None:
        _, mask_img = cv2.threshold(img, threshold, 255, cv2.THRESH_BINARY)
    else:
        _, mask_img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 9. 自動去背
    h, w = mask_img.shape
    corners = [mask_img[0,0], mask_img[0,w-1], mask_img[h-1,0], mask_img[h-1,w-1]]
    bg_color = 255 if np.mean(corners) > 127 else 0
    if bg_color == 0:
        mask_img = cv2.bitwise_not(mask_img)

    # 10. 上下翻轉，避免 SVG 鏡像
    mask_img = cv2.flip(mask_img, 0)

    mask_path = 'mask_bin.pgm'
    svg_path = 'path_bin.svg'
    cv2.imwrite(mask_path, mask_img)
    subprocess.run(['potrace', mask_path, '-s', '-o', svg_path], check=True)
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()
    paths = re.findall(r'<path[^>]+/>', svg_content)
    # 黑白圖，直接用黑色
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