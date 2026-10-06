#!/bin/sh
# Masters soundtrack.wav and encodes the rendered frames into X-ready MP4s:
#   out/mumbai-monsoon.mp4         cold open (18.8-21.0 s) then the full 36 s cut
#   out/mumbai-monsoon-plain.mp4   the 36 s cut as rendered
#   out/mumbai-monsoon-cockpit.mp4 the cockpit shot on its own
set -e
cd "$(dirname "$0")"
[ "$(ls frames | wc -l)" -ge 1080 ] || { echo "frames incomplete"; exit 1; }
mkdir -p out
V="-c:v libx264 -preset slow -crf 17 -maxrate 25M -bufsize 50M -profile:v high -level 4.2 -pix_fmt yuv420p -g 60"
A="-c:a aac -b:a 192k -ar 48000"

# About -15 LUFS with -1.4 dBTP; the fast limiter only catches the thunder cracks.
ffmpeg -loglevel error -y -i soundtrack.wav -af "volume=3.4dB,alimiter=limit=0.69:attack=0.5:release=20:level=false" \
  -ar 48000 -c:a pcm_s16le out/master.wav

ffmpeg -loglevel error -y -framerate 30 -i frames/f%04d.jpg -i out/master.wav \
  -map 0:v -map 1:a $V $A -shortest -movflags +faststart out/mumbai-monsoon-plain.mp4

# Cold open: hard picture cut at 2.2 s. The soundtrack fades in over its first 0.6 s, so the
# cold-open audio runs 0.6 s past the cut and crossfades over that fade-in to keep the rain steady.
ffmpeg -loglevel error -y -framerate 30 -i frames/f%04d.jpg -i out/master.wav -filter_complex "
  [0:v]split[v0][v1];
  [v0]trim=start=18.8:end=21.0,setpts=PTS-STARTPTS[vc];
  [v1]trim=start=0:end=36,setpts=PTS-STARTPTS[vm];
  [vc][vm]concat=n=2:v=1:a=0[v];
  [1:a]asplit[a0][a1];
  [a0]atrim=start=18.8:end=21.6,asetpts=PTS-STARTPTS,afade=t=in:d=0.05[ac];
  [a1]atrim=start=0:end=36,asetpts=PTS-STARTPTS[am];
  [ac][am]acrossfade=d=0.6:c1=tri:c2=tri[a]" \
  -map '[v]' -map '[a]' $V $A -movflags +faststart out/mumbai-monsoon.mp4

# First frame of the cockpit shot, found exactly as shotAt() does (tF + 1.1 is not exact in floats).
F0=$(node -e "const tD = require('./demo-info.json').tF + 1.1; let i = 0; while (i / 30 < tD) i++; console.log(i)")
ffmpeg -loglevel error -y -framerate 30 -i frames/f%04d.jpg -i out/master.wav -filter_complex "
  [0:v]trim=start_frame=$F0:end_frame=$((F0 + 168)),setpts=PTS-STARTPTS[v];
  [1:a]atrim=start=$(node -e "console.log($F0 / 30)"):duration=5.6,asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=5.3:d=0.3[a]" \
  -map '[v]' -map '[a]' $V $A -movflags +faststart out/mumbai-monsoon-cockpit.mp4

for f in out/mumbai-monsoon.mp4 out/mumbai-monsoon-plain.mp4 out/mumbai-monsoon-cockpit.mp4; do
  printf '%s  ' "$f"
  ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of csv=p=0 "$f" | tr '\n' ' '
  echo
done
