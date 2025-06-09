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

    # 讀取圖片並轉為灰階
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)

    # 二值化
    if threshold is not None:
        _, mask_img = cv2.threshold(img, threshold, 255, cv2.THRESH_BINARY)
    else:
        _, mask_img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
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