"""Frames each app clip in the phone (teal and white backgrounds): 1080x1920, 30 fps, H.264, real speed, no cuts.
Run after clips.mjs and frame.mjs. Output: deliverables/clips/<bg>/<clip>.mp4"""
import json, os, subprocess

D = os.path.dirname(os.path.abspath(__file__))
RAW, FR = f"{D}/clips-raw", f"{D}/frame"
OUT = os.path.join(D, "..", "..", "deliverables", "clips")
TMP = f"{D}/tmp-clips"
os.makedirs(TMP, exist_ok=True)
FPS, SX, SY, SW, SH = 30, 161, 139, 758, 1642


def ff(*a):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)


def screen_video(name):
    """Recorded frames → constant 30 fps screen video at real speed (each frame held until the next)."""
    fr = json.load(open(f"{RAW}/{name}/frames.json"))
    m = json.load(open(f"{RAW}/{name}/marks.json"))
    a, b = max(m["start"], fr[0]["t"]), m["end"]
    sel = [f for f in fr if a <= f["t"] < b]
    prev = [f for f in fr if f["t"] < a]
    if prev:
        sel = [dict(prev[-1], t=a)] + sel
    lines = ["ffconcat version 1.0"]
    for i, f in enumerate(sel):
        end = sel[i + 1]["t"] if i + 1 < len(sel) else b
        lines += [f"file '{f['file']}'", f"duration {max(end - f['t'], 0.001):.4f}"]
    lines.append(f"file '{sel[-1]['file']}'")
    open(f"{TMP}/{name}.txt", "w").write("\n".join(lines) + "\n")
    out = f"{TMP}/{name}.mp4"
    ff("-f", "concat", "-safe", "0", "-i", f"{TMP}/{name}.txt",
       "-vf", f"scale={SW}:{SH}:flags=lanczos,fps={FPS},format=yuv420p", "-t", f"{b - a:.3f}",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", out)
    return out, b - a


XF = 0.4  # crossfade between flows in the walkthrough (s)


def frame_it(src, dur, out, bg):
    ff("-loop", "1", "-framerate", str(FPS), "-i", f"{FR}/bg-{bg}.png",
       "-i", src,
       "-loop", "1", "-framerate", str(FPS), "-i", f"{FR}/mask.png",
       "-loop", "1", "-framerate", str(FPS), "-i", f"{FR}/overlay.png",
       "-filter_complex",
       f"[2:v]format=gray[m];[1:v]format=yuva420p[s];[s][m]alphamerge[sm];"
       f"[0:v][sm]overlay={SX}:{SY}:shortest=1[bgs];[bgs][3:v]overlay=0:0:shortest=1,fps={FPS},format=yuv420p[v]",
       "-map", "[v]", "-t", f"{dur:.3f}", "-r", str(FPS),
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out)


def walkthrough(parts):
    """Joins the walkthrough takes with short crossfades (screen only, before framing)."""
    vids = [screen_video(n) for n in parts]
    inputs = sum((["-i", v] for v, _ in vids), [])
    chain, last, off = "", "[0:v]", 0.0
    for k in range(1, len(vids)):
        off += vids[k - 1][1] - XF
        out = f"[x{k}]"
        chain += f"{last}[{k}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}{out};"
        last = out
    total = sum(d for _, d in vids) - XF * (len(vids) - 1)
    src = f"{TMP}/f-walkthrough.mp4"
    ff(*inputs, "-filter_complex", chain.rstrip(";"), "-map", last, "-t", f"{total:.3f}",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", src)
    return src, total


names = sorted(n for n in os.listdir(RAW) if os.path.exists(f"{RAW}/{n}/marks.json"))
singles = [n for n in names if not n.startswith("f-") or n == "f-walkthrough"]
parts = [n for n in names if n.startswith("f-") and n != "f-walkthrough"]
jobs = [(n, *screen_video(n)) for n in singles if n != "f-walkthrough"]
if parts:
    jobs.append(("f-walkthrough", *walkthrough(parts)))
for name, src, dur in jobs:
    for bg in ["teal", "white"]:
        os.makedirs(f"{OUT}/{bg}", exist_ok=True)
        frame_it(src, dur, f"{OUT}/{bg}/{name}.mp4", bg)
    print(f"{name}: {dur:.1f} s")
