#!/usr/bin/env python3
"""Generate the extension's original triple-bell notification sound."""

import math
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 44_100
DURATION_SECONDS = 1.55
CHIMES = (
    (0.00, 880.00),
    (0.38, 1046.50),
    (0.76, 1318.51),
)


def envelope(age: float, length: float = 0.62) -> float:
    if age < 0 or age >= length:
        return 0.0
    attack = min(1.0, age / 0.008)
    release = min(1.0, (length - age) / 0.10)
    return attack * release * math.exp(-5.2 * age / length)


def chime_sample(age: float, frequency: float) -> float:
    level = envelope(age)
    if not level:
        return 0.0
    phase = 2.0 * math.pi * frequency * age
    tone = (
        math.sin(phase)
        + 0.24 * math.sin(2.01 * phase)
        + 0.09 * math.sin(3.97 * phase)
    )
    return level * tone


def main() -> None:
    sample_count = int(SAMPLE_RATE * DURATION_SECONDS)
    samples = []
    for index in range(sample_count):
        time = index / SAMPLE_RATE
        value = sum(chime_sample(time - start, frequency) for start, frequency in CHIMES)
        samples.append(value)

    peak = max(abs(value) for value in samples) or 1.0
    scale = 0.86 * 32767 / peak
    pcm = b''.join(struct.pack('<h', round(value * scale)) for value in samples)

    output = Path(__file__).resolve().parents[1] / 'alert.wav'
    with wave.open(str(output), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        audio.writeframes(pcm)

    print(f'Generated {output} ({DURATION_SECONDS:.2f}s, {SAMPLE_RATE} Hz)')


if __name__ == '__main__':
    main()
