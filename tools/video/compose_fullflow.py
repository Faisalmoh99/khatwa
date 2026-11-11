"""deliverables/khatwa-full-flow.mp4: the full-flow takes, crossfaded, in the iPhone-style frame on teal.
1080x1920, 30 fps, H.264, real speed, no captions. Run after fullflow.mjs and flow-frame.mjs."""
import json, os, subprocess

D = os.path.dirname(os.path.abspath(__file__))
RAW, FR, TMP = f"{D}/flow-raw", f"{D}/frame-flow", f"{D}/tmp-flow"
OUT = os.path.join(D, "..", "..", "deliverables", "khatwa-full-flow.mp4")
os.makedirs(TMP, exist_ok=True)
FPS, XF = 30, 0.45
G = json.load(open(f"{FR}/geo.json"))


def ff(*a):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)


def take(name):
    """Frames → constant 30 fps at real speed (each frame held until the next one)."""
    fr = json.load(open(f"{RAW}/{name}/frames.json"))
    m = json.load(open(f"{RAW}/{name}/marks.json"))
    # skip the blank page before the first real frame of the cold start
    a, b = max(m["start"], fr[0]["t"]), m["end"]
    sel = [f for f in fr if a <= f["t"] < b]
    lines = ["ffconcat version 1.0"]
    for i, f in enumerate(sel):
        end = sel[i + 1]["t"] if i + 1 < len(sel) else b
        lines += [f"file '{f['file']}'", f"duration {max(end - f['t'], 0.001):.4f}"]
    lines.append(f"file '{sel[-1]['file']}'")
    open(f"{TMP}/{name}.txt", "w").write("\n".join(lines) + "\n")
    out = f"{TMP}/{name}.mp4"
    ff("-f", "concat", "-safe", "0", "-i", f"{TMP}/{name}.txt",
       "-vf", f"scale={G['w']}:{G['h']}:flags=lanczos,fps={FPS},format=yuv420p", "-t", f"{b - a:.3f}",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", out)
    return out, b - a


names = sorted(n for n in os.listdir(RAW) if os.path.exists(f"{RAW}/{n}/marks.json"))
vids = [take(n) for n in names]
for n, (_, d) in zip(names, vids):
    print(f"{n}: {d:.1f} s")
inputs = sum((["-i", v] for v, _ in vids), [])
chain, last, off = "", "[0:v]", 0.0
for k in range(1, len(vids)):
    off += vids[k - 1][1] - XF
    chain += f"{last}[{k}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{k}];"
    last = f"[x{k}]"
total = sum(d for _, d in vids) - XF * (len(vids) - 1)
screen = f"{TMP}/screen.mp4"
ff(*inputs, "-filter_complex", chain.rstrip(";"), "-map", last, "-t", f"{total:.3f}",
   "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", screen)
ff("-loop", "1", "-framerate", str(FPS), "-i", f"{FR}/bg.png",
   "-i", screen,
   "-loop", "1", "-framerate", str(FPS), "-i", f"{FR}/mask.png",
   "-loop", "1", "-framerate", str(FPS), "-i", f"{FR}/overlay.png",
   "-filter_complex",
   f"[2:v]format=gray[m];[1:v]format=yuva420p[s];[s][m]alphamerge[sm];"
   f"[0:v][sm]overlay={G['x']}:{G['y']}:shortest=1[a];[a][3:v]overlay=0:0:shortest=1,fps={FPS},format=yuv420p[v]",
   "-map", "[v]", "-t", f"{total:.3f}", "-r", str(FPS),
   "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT)
print(f"wrote {OUT} ({total:.1f} s)")
