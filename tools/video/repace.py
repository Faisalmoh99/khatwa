"""Re-paces the demo videos from the scenes already composed in tmp/ and tmp-16x9/ (no re-filming, no new footage).

- Opening card: 3.5 s (was 8 s).
- Every still stretch (no visible change on screen) longer than 2 s is squeezed to 2 s:
  in the middle of a scene it is sped up and carries the «مسرّع» tag; the hold at the end of a scene is trimmed.
- Every scene (and so every caption band) stays on screen at least 2.5 s.
- Closing card: unchanged (tmp*/card7.mp4).

Run after compose.py / compose_16x9.py (and frame-16x9.mjs for the 16:9 card): python3 repace.py [9x16|16x9 ...]
Needs numpy (pip install numpy). Writes deliverables/khatwa-demo.mp4 and deliverables/khatwa-demo-16x9.mp4."""
import json, os, subprocess, sys

try:
    import numpy as np
except ImportError:
    raise SystemExit("repace.py needs numpy: pip install numpy")

D = os.path.dirname(os.path.abspath(__file__))
DELIV = os.path.join(D, "..", "..", "deliverables")
FPS = 30
CAP = 2.0          # longest still stretch allowed (s)
CARD1 = 3.5        # opening card (s); motion starts right after it
MIN_SCENE = 2.5    # a caption band stays at least this long
MIN_CHANGED = 40   # pixels (at quarter size, grey, > 10 levels) that must change between frames to count as motion
TAG = f"{D}/cards/tag-fast.png"
ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p"]


def ff(*a):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                          "-show_entries", "format=duration", "-of", "json", path], capture_output=True, text=True).stdout
    j = json.loads(out)
    return j["streams"][0]["width"], j["streams"][0]["height"], float(j["format"]["duration"])


def motion(path):
    """One bool per frame step: True if something visibly changed between frame i and i+1."""
    W, H, _ = probe(path)
    w, h = W // 4, H // 4
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
    return [int(n) >= MIN_CHANGED for n in (np.abs(np.diff(a, axis=0)) > 10).sum(axis=(1, 2))]


def still_runs(moving, blip=3, side=FPS):
    """[(start_s, end_s, reaches_end)] for every run of no-motion frame steps. Two still runs of at least `side`
    frames each, split only by a flicker of `blip` frames or fewer (cursor, simulator clock), count as one.
    (The footage was recorded below 30 fps, so real motion also has short still gaps: those stay motion.)"""
    runs, s = [], None
    for i, m in enumerate(moving + [True]):
        if not m and s is None:
            s = i
        elif m and s is not None:
            if runs and s - runs[-1][1] <= blip and i - s >= side and runs[-1][1] - runs[-1][0] >= side:
                s = runs.pop()[0]
            runs.append((s, i))
            s = None
    return [(a / FPS, b / FPS, b == len(moving)) for a, b in runs]


def plan(path):
    """Segments [(a, b, speed, tagged)] over the scene's own timeline."""
    _, _, dur = probe(path)
    segs, t = [], 0.0
    for a, b, at_end in still_runs(motion(path)):
        if b - a <= CAP:
            continue
        if a > t:
            segs.append((t, a, 1.0, False))
        if at_end:
            segs.append((a, a + CAP, 1.0, False))  # the final hold is trimmed
            b = dur
        else:
            segs.append((a, b, (b - a) / CAP, True))
        t = b
    if t < dur - 1e-3:
        segs.append((t, dur, 1.0, False))
    return segs


def repace_scene(src, out, tag_xy):
    segs = plan(src)
    f, outs, tagged, t = "", "", [], 0.0
    for i, (a, b, s, tg) in enumerate(segs):
        f += f"[0:v]trim=start={a:.4f}:end={b:.4f},setpts=(PTS-STARTPTS)/{s:.5f}[p{i}];"
        outs += f"[p{i}]"
        d = (b - a) / s
        if tg:
            tagged.append((t, t + d))
        t += d
    f += f"{outs}concat=n={len(segs)}:v=1:a=0,fps={FPS}[c]"
    if tagged:
        en = "+".join(f"between(t,{x:.3f},{y:.3f})" for x, y in tagged)
        f += f";[c][1:v]overlay=x={tag_xy[0]}:y={tag_xy[1]}:enable='{en}'[o]"
        last = "[o]"
    else:
        last = "[c]"
    ff("-i", src, "-loop", "1", "-framerate", str(FPS), "-i", TAG, "-filter_complex", f + f";{last}format=yuv420p[v]",
       "-map", "[v]", "-t", f"{max(t, MIN_SCENE):.3f}", *ENC, out)
    print(f"  {os.path.basename(src)}: {probe(src)[2]:.1f}s -> {t:.1f}s"
          + (f", sped up {', '.join(f'{x:.1f}-{y:.1f}s' for x, y in tagged)}" if tagged else ""))
    return out


def card(png, secs, out):
    ff("-loop", "1", "-framerate", str(FPS), "-i", png, "-vf",
       f"fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st={secs - 0.4}:d=0.4", "-t", str(secs), *ENC, out)
    return out


def join(parts, size, out):
    total = sum(probe(p)[2] for p in parts)
    ins = sum((["-i", p] for p in parts), [])
    chain = "".join(f"[{i}:v]fps={FPS},setpts=PTS-STARTPTS,scale={size},setsar=1,format=yuv420p[v{i}];" for i in range(len(parts)))
    chain += "".join(f"[v{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0[v]"
    ff(*ins, "-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
       "-filter_complex", chain, "-map", "[v]", "-map", f"{len(parts)}:a",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "96k", "-t", f"{total:.3f}", "-movflags", "+faststart", out)
    return total


def build(kind):
    if kind == "9x16":
        tmp, card_png, size, out = f"{D}/tmp", f"{D}/cards/card1.png", "1080:1920", f"{DELIV}/khatwa-demo.mp4"
        tag = lambda sc: (28, 722 + 150 if sc == "s2" else 150)  # same place as compose.py
    else:
        tmp, card_png, size, out = f"{D}/tmp-16x9", f"{D}/frame-16x9/card1.png", "1920:1080", f"{DELIV}/khatwa-demo-16x9.mp4"
        G = json.load(open(f"{D}/frame-16x9/geo.json"))
        tag = lambda sc: (G["right" if sc == "s2" else "center"]["x"] + 14, G["right" if sc == "s2" else "center"]["y"] + 120)
    print(kind)
    rp = f"{tmp}/repaced"
    os.makedirs(rp, exist_ok=True)
    parts = [card(card_png, CARD1, f"{rp}/card1.mp4")]
    parts += [repace_scene(f"{tmp}/{sc}.mp4", f"{rp}/{sc}.mp4", tag(sc)) for sc in ("s2", "s3", "s4", "s5", "s6")]
    parts.append(f"{tmp}/card7.mp4")
    total = join(parts, size, out)
    print(f"  wrote {os.path.abspath(out)} ({total:.1f} s)")


if __name__ == "__main__":
    for k in sys.argv[1:] or ["9x16", "16x9"]:
        build(k)
