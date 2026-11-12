"""deliverables/khatwa-demo-16x9.mp4: same story as khatwa-demo.mp4, 1920x1080 for judges on a laptop.
Wokwi scene: Wokwi large on the left, the app in the iPhone-style frame on the right. App-only scenes: the phone
centred with one large caption line beside it. Footage: raw-16x9/ (film.mjs with FILM_PHONE=1)."""
import json, os, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
# REUSE_SCENES=1: re-render only the closing card (card7) and re-join the scenes already in tmp/ (no re-filming).
REUSE = os.environ.get("REUSE_SCENES") == "1"
RAW, AS, TMP = f"{D}/raw-16x9", f"{D}/frame-16x9", f"{D}/tmp-16x9"
TAG = f"{D}/cards/tag-fast.png"
OUT = os.path.join(D, "..", "..", "deliverables", "khatwa-demo-16x9.mp4")
os.makedirs(TMP, exist_ok=True)
FPS = 30
M = json.load(open(f"{RAW}/marks.json"))
G = json.load(open(f"{AS}/geo.json"))
ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p"]


def ff(*a):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)


def clip(stream, a, b, speed, out, vf):
    fr = json.load(open(f"{RAW}/{stream}/frames.json"))
    sel = [f for f in fr if a <= f["t"] < b]
    prev = [f for f in fr if f["t"] < a]
    if prev:
        sel = [dict(prev[-1], t=a)] + sel
    lines = ["ffconcat version 1.0"]
    for i, f in enumerate(sel):
        end = sel[i + 1]["t"] if i + 1 < len(sel) else b
        lines += [f"file '{f['file']}'", f"duration {max(end - f['t'], 0.001) / speed:.4f}"]
    lines.append(f"file '{sel[-1]['file']}'")
    lst = f"{TMP}/{os.path.basename(out)}.txt"
    open(lst, "w").write("\n".join(lines) + "\n")
    dur = (b - a) / speed
    ff("-f", "concat", "-safe", "0", "-i", lst, "-vf", f"{vf},fps={FPS},format=yuv420p", "-t", f"{dur:.3f}", *ENC, out)
    return dur


def fit(pieces, total):
    fixed = sum((b - a) / s for a, b, s in pieces if s)
    flex = sum(b - a for a, b, s in pieces if not s)
    left = total - fixed
    if left <= 0.5:
        raise SystemExit(f"fixed pieces already {fixed:.1f}s > {total}s")
    k = flex / left if flex else 1
    return [(a, b, s or max(k, 1.0)) for a, b, s in pieces]


def layer(app_mp4, dur, pos, cap, cap_xy, out, wokwi_mp4=None, fast=False):
    """bg + (Wokwi panel) + app in the phone + frame + caption (+ «مسرّع» tag)."""
    a = G[pos]
    ins = ["-loop", "1", "-framerate", str(FPS), "-i", f"{AS}/bg.png", "-i", app_mp4,
           "-loop", "1", "-framerate", str(FPS), "-i", f"{AS}/mask.png",
           "-loop", "1", "-framerate", str(FPS), "-i", f"{AS}/overlay-{pos}.png",
           "-loop", "1", "-framerate", str(FPS), "-i", cap,
           "-loop", "1", "-framerate", str(FPS), "-i", TAG]
    f = (f"[2:v]format=gray[m];[1:v]format=yuva420p[s];[s][m]alphamerge[sm];"
         f"[0:v][sm]overlay={a['x']}:{a['y']}:shortest=1[v1];[v1][3:v]overlay=0:0:shortest=1[v2];"
         f"[v2][4:v]overlay={cap_xy[0]}:{cap_xy[1]}:shortest=1[v3];")
    last = "[v3]"
    if wokwi_mp4:
        w = G["wokwi"]
        ins += ["-i", wokwi_mp4, "-loop", "1", "-framerate", str(FPS), "-i", f"{AS}/wokwi-mask.png"]
        f += (f"[7:v]format=gray[wm];[6:v]format=yuva420p[w];[w][wm]alphamerge[wk];"
              f"{last}[wk]overlay={w['x']}:{w['y']}:shortest=1[v4];")
        last = "[v4]"
    if fast:
        f += f"{last}[5:v]overlay={a['x'] + 14}:{a['y'] + 120}:shortest=1[v5];"
        last = "[v5]"
    f += f"{last}fps={FPS},format=yuv420p[out]"
    ff(*ins, "-filter_complex", f, "-map", "[out]", "-t", f"{dur:.3f}", "-r", str(FPS), *ENC, out)


def scene(name, parts, total, layout):
    if REUSE and os.path.exists(f"{TMP}/{name}.mp4"):
        return f"{TMP}/{name}.mp4"  # closing-card-only re-render: keep the composed scene
    pieces = fit([(a, b, s) for _, a, b, s in parts], total)
    segs, t = [], 0.0
    for i, ((stream, _, _, _), (a, b, s)) in enumerate(zip(parts, pieces)):
        app = f"{TMP}/{name}-{i}-a.mp4"
        d = clip(stream, a, b, s, app, f"scale={G['center']['w']}:{G['center']['h']}:flags=lanczos")
        seg = f"{TMP}/{name}-{i}.mp4"
        if layout == "split":
            wk = f"{TMP}/{name}-{i}-w.mp4"
            clip("wokwi", a, b, s, wk, f"crop=720:481:720:142,scale={G['wokwi']['w']}:{G['wokwi']['h']}:flags=lanczos")
            layer(app, d, "right", f"{AS}/cap-{name}.png", (G["under"]["x"], G["under"]["y"]), seg, wk, s > 1.05)
        else:
            layer(app, d, "center", f"{AS}/cap-{name}.png", (G["side"]["x"], (1080 - 700) // 2), seg, None, s > 1.05)
        segs.append(seg)
        t += d
    lst = f"{TMP}/{name}.txt"
    open(lst, "w").write("".join(f"file '{p}'\n" for p in segs))
    out = f"{TMP}/{name}.mp4"
    ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out)
    print(f"{name}: {t:.2f}s, speeds {[round(p[2], 2) for p in pieces]}")
    return out


def card(name, secs):
    out = f"{TMP}/{name}.mp4"
    if REUSE and name != "card7" and os.path.exists(out):
        return out
    ff("-loop", "1", "-framerate", str(FPS), "-i", f"{AS}/{name}.png", "-vf",
       f"fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st={secs - 0.5}:d=0.5", "-t", str(secs), *ENC, out)
    return out


def frame_at(stream, t):
    fr = json.load(open(f"{RAW}/{stream}/frames.json"))
    return [f for f in fr if f["t"] <= t][-1]["file"]


def still(name, stream, t, pos, cap, cap_xy, out, wokwi=False):
    """One composited frame with the exact same layers as the video (for checking before the full render)."""
    a = G[pos]
    app = f"{TMP}/still-{name}-app.mp4"
    ff("-loop", "1", "-i", frame_at(stream, t), "-vf", f"scale={a['w']}:{a['h']}:flags=lanczos,format=yuv420p",
       "-t", "0.2", "-r", str(FPS), *ENC, app)
    wk = None
    if wokwi:
        wk = f"{TMP}/still-{name}-wk.mp4"
        ff("-loop", "1", "-i", frame_at("wokwi", t), "-vf",
           f"crop=720:481:720:142,scale={G['wokwi']['w']}:{G['wokwi']['h']}:flags=lanczos,format=yuv420p",
           "-t", "0.2", "-r", str(FPS), *ENC, wk)
    vid = f"{TMP}/still-{name}.mp4"
    layer(app, 0.2, pos, cap, cap_xy, vid, wk, False)
    ff("-i", vid, "-frames:v", "1", out)


if len(sys.argv) > 1 and sys.argv[1] == "--stills":
    d = os.path.join(D, "..", "..", "deliverables", "16x9-stills")
    os.makedirs(d, exist_ok=True)
    still("wokwi", "app-wokwi", M["s2_slider"] + 3.0, "right", f"{AS}/cap-s2.png",
          (G["under"]["x"], G["under"]["y"]), f"{d}/1-wokwi.png", wokwi=True)
    still("rafiq", "app-sim", M["s5_red"] + 2.0, "center", f"{AS}/cap-s5.png",
          (G["side"]["x"], (1080 - 700) // 2), f"{d}/2-rafiq.png")
    still("clinic", "app-sim", M["s6_start"] + 3.0, "center", f"{AS}/cap-s6.png",
          (G["side"]["x"], (1080 - 700) // 2), f"{d}/3-clinic.png")
    print("stills in", os.path.abspath(d))
    raise SystemExit(0)

s2 = scene("s2", [
    ("app-wokwi", M["s2_start"], M["s2_slider"] + 4.0, 1.0),
    ("app-wokwi", M["s2_slider"] + 4.0, M["s2_scan_shown"] - 1.0, None),
    ("app-wokwi", M["s2_scan_shown"] - 1.0, M["s2_result"] + 1.8, 1.0),
], 17, "split")
s3 = scene("s3", [
    ("app-wokwi", M["s3_day1"], M["s3_day1"] + 3.0, 1.0),
    ("app-wokwi", M["s3_scan2"], M["s3_scan2_shown"] - 0.5, None),
    ("app-wokwi", M["s3_scan2_shown"] - 0.5, M["s3_end"], 1.0),
], 15, "full")
s4 = scene("s4", [("app-sim", M["s4_start"], M["s5_start"], None)], 10, "full")
s5 = scene("s5", [("app-sim", M["s5_start"], M["s5_red"], None), ("app-sim", M["s5_red"], M["s5_end"], 1.0)], 15, "full")
s6 = scene("s6", [("app-sim", M["s6_start"], M["s6_end"], None)], 15, "full")
parts = [card("card1", 8), s2, s3, s4, s5, s6, card("card7", 10)]

total = sum(float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                 capture_output=True, text=True).stdout) for p in parts)
inputs = sum((["-i", p] for p in parts), [])
chain = "".join(f"[{i}:v]fps={FPS},setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,format=yuv420p[v{i}];" for i in range(len(parts)))
chain += "".join(f"[v{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0[v]"
ff(*inputs, "-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
   "-filter_complex", chain, "-map", "[v]", "-map", f"{len(parts)}:a",
   "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), "-pix_fmt", "yuv420p",
   "-c:a", "aac", "-b:a", "96k", "-t", f"{total:.3f}", "-movflags", "+faststart", OUT)
print(f"wrote {OUT} ({total:.1f} s)")
