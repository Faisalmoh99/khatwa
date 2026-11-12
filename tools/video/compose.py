"""Builds deliverables/khatwa-demo.mp4 (1080x1920, 30 fps, H.264) from the recorded frame streams.
Every app/Wokwi pixel comes from the screencast frames; cards and caption bands are rendered PNGs."""
import json, subprocess, os, sys

D = os.path.dirname(os.path.abspath(__file__))
# REUSE_SCENES=1: re-render only the closing card (card7) and re-join the scenes already in tmp/ (no re-filming).
REUSE = os.environ.get("REUSE_SCENES") == "1"
RAW, CARDS, TMP = f"{D}/raw", f"{D}/cards", f"{D}/tmp"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "..", "..", "deliverables", "khatwa-demo.mp4")
os.makedirs(TMP, exist_ok=True)
M = json.load(open(f"{RAW}/marks.json"))
FPS = 30


def ff(*args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def frames(stream):
    return json.load(open(f"{RAW}/{stream}/frames.json"))


def clip(stream, a, b, speed, out, vf):
    """Frames of `stream` between times a..b (s), played `speed`x, at 30 fps, filtered by vf."""
    fr = frames(stream)
    sel = [f for f in fr if a <= f["t"] < b]
    prev = [f for f in fr if f["t"] < a]
    if prev:  # what was on screen at time a
        sel = [dict(prev[-1], t=a)] + sel
    lines = ["ffconcat version 1.0"]
    for i, f in enumerate(sel):
        end = sel[i + 1]["t"] if i + 1 < len(sel) else b
        lines += [f"file '{f['file']}'", f"duration {max(end - f['t'], 0.001) / speed:.4f}"]
    lines.append(f"file '{sel[-1]['file']}'")
    lst = f"{TMP}/{os.path.basename(out)}.txt"
    open(lst, "w").write("\n".join(lines) + "\n")
    dur = (b - a) / speed
    ff("-f", "concat", "-safe", "0", "-i", lst, "-vf", f"{vf},fps={FPS},format=yuv420p",
       "-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out)
    return dur


def fit(pieces, total):
    """pieces: [(a, b, fixed_speed_or_None)]; None pieces share the time left to reach `total`."""
    fixed = sum((b - a) / s for a, b, s in pieces if s)
    flex = sum(b - a for a, b, s in pieces if not s)
    left = total - fixed
    if left <= 0.5:
        raise SystemExit(f"fixed pieces already {fixed:.1f}s > {total}s")
    k = flex / left if flex else 1
    return [(a, b, s or max(k, 1.0)) for a, b, s in pieces]


def band(name):
    return f"{CARDS}/band-{name}.png"


def tag_overlay(src, out, fast_ranges, y):
    """Puts the «مسرّع» tag on the clip during sped-up ranges (in output seconds)."""
    if not fast_ranges:
        os.replace(src, out)
        return
    en = "+".join(f"between(t,{s:.2f},{e:.2f})" for s, e in fast_ranges)
    ff("-i", src, "-i", f"{CARDS}/tag-fast.png", "-filter_complex",
       f"[0][1]overlay=x=28:y={y}:enable='{en}',fps={FPS}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out)


def scene(name, parts, total, band_name, layout):
    """parts: list of (stream_set, a, b, speed). layout 'split' or 'full'. Returns the scene file."""
    if REUSE and os.path.exists(f"{TMP}/{name}.mp4"):
        return f"{TMP}/{name}.mp4"  # closing-card-only re-render: keep the composed scene
    pieces = fit([(a, b, s) for _, a, b, s in parts], total)
    segs, fast, t = [], [], 0.0
    for i, ((streams, _, _, _), (a, b, s)) in enumerate(zip(parts, pieces)):
        if layout == "split":
            w = clip("wokwi", a, b, s, f"{TMP}/{name}-{i}-w.mp4",
                     "crop=720:481:720:142,scale=1080:722:flags=lanczos")
            ap = clip(streams, a, b, s, f"{TMP}/{name}-{i}-a.mp4", "scale=1080:878:flags=lanczos")
            seg = f"{TMP}/{name}-{i}.mp4"
            ff("-i", f"{TMP}/{name}-{i}-w.mp4", "-i", f"{TMP}/{name}-{i}-a.mp4", "-loop", "1", "-framerate", str(FPS), "-i", band(band_name),
               "-filter_complex", f"[0][1][2]vstack=3,fps={FPS},format=yuv420p", "-t", f"{w:.3f}",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", seg)
            d = w
        else:
            ap = clip(streams, a, b, s, f"{TMP}/{name}-{i}-a.mp4", "scale=1080:1600:flags=lanczos")
            seg = f"{TMP}/{name}-{i}.mp4"
            ff("-i", f"{TMP}/{name}-{i}-a.mp4", "-loop", "1", "-framerate", str(FPS), "-i", band(band_name),
               "-filter_complex", f"[0][1]vstack=2,fps={FPS},format=yuv420p", "-t", f"{ap:.3f}",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", seg)
            d = ap
        if s > 1.05:
            fast.append((t, t + d))
        segs.append(seg)
        t += d
    lst = f"{TMP}/{name}.txt"
    open(lst, "w").write("".join(f"file '{p}'\n" for p in segs))
    joined = f"{TMP}/{name}-joined.mp4"
    ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined)
    out = f"{TMP}/{name}.mp4"
    tag_overlay(joined, out, fast, 722 + 150 if layout == "split" else 150)
    print(f"{name}: {t:.2f}s, speeds {[round(p[2], 2) for p in pieces]}")
    return out


def card(name, secs):
    out = f"{TMP}/{name}.mp4"
    if REUSE and name != "card7" and os.path.exists(out):
        return out
    ff("-loop", "1", "-i", f"{CARDS}/{name}.png", "-vf",
       f"fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st={secs - 0.5}:d=0.5",
       "-t", str(secs), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out)
    return out


s2 = scene("s2", [
    # zoom in, open the sensor, temperature rises: real speed so the number is readable
    ("app-wokwi", M["s2_start"], M["s2_slider"] + 4.0, 1.0),
    # zoom out, heels down, measuring: sped up (tagged)
    ("app-wokwi", M["s2_slider"] + 4.0, M["s2_scan_shown"] - 1.0, None),
    ("app-wokwi", M["s2_scan_shown"] - 1.0, M["s2_result"] + 1.8, 1.0),
], 17, "s2", "split")
s3 = scene("s3", [
    ("app-wokwi", M["s3_day1"], M["s3_day1"] + 3.0, 1.0),
    ("app-wokwi", M["s3_scan2"], M["s3_scan2_shown"] - 0.5, None),
    ("app-wokwi", M["s3_scan2_shown"] - 0.5, M["s3_end"], 1.0),
], 15, "s3", "full")
s4 = scene("s4", [("app-sim", M["s4_start"], M["s5_start"], None)], 10, "s4", "full")
s5 = scene("s5", [("app-sim", M["s5_start"], M["s5_red"], None), ("app-sim", M["s5_red"], M["s5_end"], 1.0)], 15, "s5", "full")
s6 = scene("s6", [("app-sim", M["s6_start"], M["s6_end"], None)], 15, "s6", "full")
c1, c7 = card("card1", 8), card("card7", 10)

parts = [c1, s2, s3, s4, s5, s6, c7]
total = sum(float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                 capture_output=True, text=True).stdout) for p in parts)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
inputs = sum((["-i", p] for p in parts), [])
chain = "".join(f"[{i}:v]fps={FPS},setpts=PTS-STARTPTS,scale=1080:1920,setsar=1,format=yuv420p[v{i}];" for i in range(len(parts)))
chain += "".join(f"[v{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0[v]"
ff(*inputs, "-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
   "-filter_complex", chain, "-map", "[v]", "-map", f"{len(parts)}:a",
   "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), "-pix_fmt", "yuv420p",
   "-c:a", "aac", "-b:a", "96k", "-t", f"{total:.3f}", "-movflags", "+faststart", OUT)
print("wrote", OUT)
