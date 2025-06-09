import sys
import cv2
import numpy as np
import subprocess
import os
import re

def main():
    img_path = sys.argv[1]
    output_svg = sys.argv[2]
    K = 4  # 可調整顏色數量

    img = cv2.imread(img_path)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    Z = img_rgb.reshape((-1,3))
    Z = np.float32(Z)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    ret,label,center=cv2.kmeans(Z,K,None,criteria,10,cv2.KMEANS_RANDOM_CENTERS)
    center = np.uint8(center)
    res = center[label.flatten()]
    res2 = res.reshape((img_rgb.shape))

    svg_paths = []
    for i, color in enumerate(center):
        mask = (label.flatten() == i).astype(np.uint8) * 255
        mask_img = mask.reshape((img.shape[0], img.shape[1]))
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