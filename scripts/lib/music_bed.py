"""Original synthesized music bed for Sift videos.

Provenance: copied from launch-assets/previews/launch-film/source/music.py (the
launch-film source). Every sample is generated here from sine waves and seeded
noise; no third-party recordings, loops or samples are used, so there is nothing
to license. Changes from the original: scipy is optional (numpy fallback for the
one-pole low-pass), the ffmpeg binary comes from $SIFT_FFMPEG, and a CLI was added.

  python3 scripts/lib/music_bed.py --dur 28 --bar 2.5 --arp-from 0 --drums-from 2.5 \
      --drums-to 25 --outro-at 26.5 --out bed.wav
"""
import argparse, os, subprocess, sys
import numpy as np

SR = 48000


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# C major-ish warm progression: Cmaj9, Am9, Fmaj7#11-ish, Gsus/6
CHORDS = [
    dict(root=36, pad=[48, 52, 55, 59, 62], arp=[72, 76, 79, 83, 79, 76, 74, 79]),
    dict(root=33, pad=[45, 52, 55, 60, 64], arp=[69, 72, 76, 79, 76, 72, 71, 76]),
    dict(root=29, pad=[41, 48, 52, 57, 60], arp=[69, 72, 76, 77, 76, 72, 67, 72]),
    dict(root=31, pad=[43, 50, 55, 59, 64], arp=[67, 71, 74, 76, 74, 71, 72, 74]),
]


def onepole(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    try:
        from scipy.signal import lfilter
        return lfilter([1 - a], [1, -a], x)
    except ImportError:  # identical IIR, pure Python (a few seconds for ~45 s of audio)
        y = np.empty_like(x); acc = 0.0; b = 1 - a
        for i, v in enumerate(x.tolist()):
            acc = b * v + a * acc; y[i] = acc
        return y


def music(dur, bar, arp_from, drums_from, drums_to, outro_at, out):
    n = int(dur * SR) + SR
    L = np.zeros(n); R = np.zeros(n)
    t_all = np.arange(n) / SR
    beat = bar / 4
    nbars = int(np.ceil(dur / bar)) + 1
    rng = np.random.default_rng(7)
    for bi in range(nbars):
        ch = CHORDS[bi % 4]
        if bi * bar >= outro_at:
            ch = CHORDS[0]
        s0 = bi * bar
        if s0 > dur + 1:
            break
        # pad
        seg_len = int((bar + 1.2) * SR)
        i0 = int(s0 * SR)
        i1 = min(n, i0 + seg_len)
        tt = np.arange(i1 - i0) / SR
        env = np.minimum(1, tt / 0.6) * np.exp(-np.maximum(0, tt - bar) / 0.35)
        if bi * bar >= outro_at:
            env = np.minimum(1, tt / 0.4) * np.exp(-tt / 2.2)
        for k, m in enumerate(ch['pad']):
            f = mtof(m)
            for det, pan in ((-0.12, 0.3), (0.12, 0.7)):
                ff = f * 2 ** (det / 12 / 4)
                w = (np.sin(2 * np.pi * ff * tt + k) + 0.35 * np.sin(4 * np.pi * ff * tt) +
                     0.12 * np.sin(6 * np.pi * ff * tt)) * env * 0.032
                L[i0:i1] += w * (1 - pan); R[i0:i1] += w * pan
        # bass
        for off, ln in ((0, beat * 1.6), (beat * 2.5, beat * 1.3)):
            j0 = int((s0 + off) * SR); j1 = min(n, j0 + int(ln * SR))
            tb = np.arange(j1 - j0) / SR
            f = mtof(ch['root'])
            eb = np.minimum(1, tb / 0.01) * np.exp(-tb / 0.5)
            wb = (np.sin(2 * np.pi * f * tb) + 0.25 * np.sin(4 * np.pi * f * tb)) * eb * 0.16
            if s0 >= drums_from - 0.01 and s0 < drums_to:
                L[j0:j1] += wb; R[j0:j1] += wb
            elif s0 >= arp_from - 0.01 and bi * bar < outro_at:
                L[j0:j1] += wb * 0.6; R[j0:j1] += wb * 0.6
        # arpeggio (8ths)
        if s0 >= arp_from - 0.01 and bi * bar < outro_at + bar:
            for k, m in enumerate(ch['arp']):
                st = s0 + k * beat / 2
                j0 = int(st * SR); j1 = min(n, j0 + int(0.9 * SR))
                ta = np.arange(j1 - j0) / SR
                f = mtof(m)
                ea = np.minimum(1, ta / 0.004) * np.exp(-ta / 0.22)
                vel = 0.9 if k % 2 == 0 else 0.65
                wa = (np.sin(2 * np.pi * f * ta) + 0.3 * np.sin(4 * np.pi * f * ta) * np.exp(-ta / 0.05)) * ea * 0.05 * vel
                pan = 0.35 + 0.3 * (k % 2)
                L[j0:j1] += wa * (1 - pan); R[j0:j1] += wa * pan
                # echo
                e0 = j0 + int(beat * 0.75 * SR); e1 = min(n, e0 + (j1 - j0))
                if e1 > e0:
                    L[e0:e1] += wa[:e1 - e0] * 0.25 * pan; R[e0:e1] += wa[:e1 - e0] * 0.25 * (1 - pan)
        # drums
        if drums_from - 0.01 <= s0 < drums_to:
            for b in range(4):
                st = s0 + b * beat
                if b in (0, 2):
                    j0 = int(st * SR); j1 = min(n, j0 + int(0.35 * SR))
                    tk = np.arange(j1 - j0) / SR
                    fk = 45 + 75 * np.exp(-tk / 0.035)
                    ph = 2 * np.pi * np.cumsum(fk) / SR
                    wk = np.sin(ph) * np.exp(-tk / 0.16) * 0.42
                    L[j0:j1] += wk; R[j0:j1] += wk
                if b in (1, 3):  # soft clap/snap
                    j0 = int(st * SR); j1 = min(n, j0 + int(0.2 * SR))
                    tc = np.arange(j1 - j0) / SR
                    nz = rng.standard_normal(j1 - j0)
                    nz = np.diff(np.concatenate([[0], nz]))
                    wc = nz * np.exp(-tc / 0.045) * 0.05
                    L[j0:j1] += wc * 0.8; R[j0:j1] += wc
                # offbeat hat
                st2 = st + beat / 2
                j0 = int(st2 * SR); j1 = min(n, j0 + int(0.08 * SR))
                th = np.arange(j1 - j0) / SR
                nz = rng.standard_normal(j1 - j0)
                nz = np.diff(np.concatenate([[0], nz]))
                wh = nz * np.exp(-th / 0.018) * 0.035
                L[j0:j1] += wh * 0.6; R[j0:j1] += wh
    # riser into outro / subtle swell at start
    L = onepole(L, 9000); R = onepole(R, 9000)
    st = np.stack([L, R], 1)[:int(dur * SR)]
    tt = np.arange(len(st)) / SR
    fin = np.clip((dur - tt) / 1.2, 0, 1) ** 1.5
    fi = np.clip(tt / 0.25, 0, 1)
    st *= (fin * fi)[:, None]
    st = np.tanh(st * 1.6) / 1.6
    st *= 0.89 / np.max(np.abs(st))
    pcm = (st * 32767).astype('<i2').tobytes()
    subprocess.run([os.environ.get('SIFT_FFMPEG', 'ffmpeg'), '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', str(SR), out], input=pcm, check=True)



if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--dur', type=float, required=True)
    p.add_argument('--bar', type=float, default=2.5)
    p.add_argument('--arp-from', type=float, default=0.0)
    p.add_argument('--drums-from', type=float, default=2.5)
    p.add_argument('--drums-to', type=float, required=True)
    p.add_argument('--outro-at', type=float, required=True)
    p.add_argument('--out', required=True)
    a = p.parse_args()
    music(a.dur, a.bar, a.arp_from, a.drums_from, a.drums_to, a.outro_at, a.out)
