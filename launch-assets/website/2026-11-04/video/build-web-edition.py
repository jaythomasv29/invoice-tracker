"""Rebuild the prelaunch website ending while preserving the supplied film/audio."""
from pathlib import Path
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parents[3]
image = Image.new('RGB', (1920, 1080), '#123D30')
draw = ImageDraw.Draw(image)
for y in range(1080):
    t = y / 1080
    draw.line((0, y, 1920, y), fill=(round(22 - 6*t), round(70 - 14*t), round(54 - 11*t)))
icon = Image.open(root / 'launch-assets/brand/sift-icon-1024.png').convert('RGB').resize((164, 164), Image.Resampling.LANCZOS)
mask = Image.new('L', icon.size)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 163, 163), radius=36, fill=255)
image.paste(icon, (878, 160), mask)
def text(value, y, size, weight=700, color='#F5F5F0'):
    name = {800: '800ExtraBold', 700: '700Bold', 500: '500Medium'}[weight]
    font = ImageFont.truetype(str(root / f'node_modules/@expo-google-fonts/manrope/{name}/Manrope_{name}.ttf'), size)
    draw.text((960, y), value, anchor='mt', font=font, fill=color)
text('Sift', 365, 120, 800)
text('Your kitchen. In the clear.', 535, 52, 700, '#D5ECA0')
draw.rounded_rectangle((742, 675, 1178, 753), radius=39, fill='#F5F5F0')
text('Coming to iPhone', 693, 31, 800, '#123D30')
text('siftcosts.com', 814, 32, 700, '#C4D7CD')
text('Sample data shown. Price alerts and recipe costing are included with Sift Pro.', 978, 22, 500, '#C4D7CD')
card = here / 'web-closing-card.png'
image.save(card)
image.save(here / 'launch-film-poster.jpg', quality=92, optimize=True)
subprocess.run([
    os.environ.get('SIFT_FFMPEG', 'ffmpeg'), '-hide_banner', '-loglevel', 'error',
    '-i', str(here / 'Sift-launch-film-1920x1080-original.mp4'),
    '-loop', '1', '-framerate', '30', '-i', str(card),
    '-filter_complex', '[0:v]trim=end=37.5,setpts=PTS-STARTPTS[body];[1:v]trim=duration=7.5,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.45:color=0x123D30[end];[body][end]concat=n=2:v=1:a=0,format=yuv420p[v]',
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'copy', '-t', '45', '-movflags', '+faststart', '-y',
    str(here / 'Sift-launch-film-web-1920x1080.mp4'),
], check=True)
