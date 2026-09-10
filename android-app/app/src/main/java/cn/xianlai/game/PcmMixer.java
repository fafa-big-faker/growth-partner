package cn.xianlai.game;

import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

final class PcmMixer {
    private static final class Voice {
        final short[] samples;
        final float volume;
        final float rate;
        final boolean loop;
        double position;

        Voice(short[] samples, float volume, float rate, boolean loop) {
            this.samples = samples;
            this.volume = volume;
            this.rate = rate;
            this.loop = loop;
        }
    }

    private final int maxVoices;
    private final Map<Integer, short[]> sounds = new LinkedHashMap<>();
    private final LinkedHashMap<Integer, Voice> voices = new LinkedHashMap<>();
    private int nextStreamId = 1;

    PcmMixer(int maxVoices) {
        if (maxVoices < 1) throw new IllegalArgumentException("maxVoices");
        this.maxVoices = maxVoices;
    }

    synchronized void register(int soundId, short[] stereoSamples) {
        if (soundId <= 0 || stereoSamples == null || stereoSamples.length < 2 || (stereoSamples.length & 1) != 0) {
            throw new IllegalArgumentException("Invalid stereo sound");
        }
        sounds.put(soundId, stereoSamples.clone());
    }

    synchronized int play(int soundId, float volume, float rate, boolean loop) {
        short[] samples = sounds.get(soundId);
        if (samples == null) return 0;
        while (voices.size() >= maxVoices) {
            Iterator<Integer> oldest = voices.keySet().iterator();
            if (!oldest.hasNext()) break;
            oldest.next(); oldest.remove();
        }
        int streamId = nextStreamId++;
        if (nextStreamId <= 0) nextStreamId = 1;
        voices.put(streamId, new Voice(samples,
                Math.max(0f, Math.min(1f, volume)), Math.max(0.5f, Math.min(2f, rate)), loop));
        return streamId;
    }

    synchronized void stop(int streamId) {
        voices.remove(streamId);
    }

    synchronized void stopAll() {
        voices.clear();
    }

    synchronized int activeVoices() {
        return voices.size();
    }

    synchronized void mix(short[] output, int frames) {
        if (output == null || frames < 0 || output.length < frames * 2) throw new IllegalArgumentException("output");
        Arrays.fill(output, 0, frames * 2, (short) 0);
        for (int frame = 0; frame < frames; frame++) {
            int left = 0, right = 0;
            Iterator<Map.Entry<Integer, Voice>> iterator = voices.entrySet().iterator();
            while (iterator.hasNext()) {
                Voice voice = iterator.next().getValue();
                int clipFrames = voice.samples.length / 2;
                if (voice.position >= clipFrames) {
                    if (!voice.loop) { iterator.remove(); continue; }
                    voice.position %= clipFrames;
                }
                int first = (int) voice.position;
                int second = first + 1;
                if (second >= clipFrames) second = voice.loop ? 0 : first;
                double fraction = voice.position - first;
                left += Math.round(interpolate(voice.samples[first * 2], voice.samples[second * 2], fraction) * voice.volume);
                right += Math.round(interpolate(voice.samples[first * 2 + 1], voice.samples[second * 2 + 1], fraction) * voice.volume);
                voice.position += voice.rate;
                if (!voice.loop && voice.position >= clipFrames) iterator.remove();
                else if (voice.loop && voice.position >= clipFrames) voice.position %= clipFrames;
            }
            output[frame * 2] = clamp(left);
            output[frame * 2 + 1] = clamp(right);
        }
    }

    private static float interpolate(short first, short second, double fraction) {
        return (float) (first + (second - first) * fraction);
    }

    private static short clamp(int value) {
        if (value > Short.MAX_VALUE) return Short.MAX_VALUE;
        if (value < Short.MIN_VALUE) return Short.MIN_VALUE;
        return (short) value;
    }
}
