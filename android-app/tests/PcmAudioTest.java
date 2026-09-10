package cn.xianlai.game;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

public final class PcmAudioTest {
    public static void main(String[] args) throws Exception {
        decodesMonoAndMatchesTheDeviceRate();
        preservesStereoSamplesAtTheDeviceRate();
        mixesIndependentVoicesWithoutMovingTheirRhythm();
        loopsChangesRateStopsAndClipsSafely();
        System.out.println("PCM audio: 24 checks passed.");
    }

    private static void decodesMonoAndMatchesTheDeviceRate() throws Exception {
        short[] source = { 0, 1000, 2000, 3000 };
        PcmWave.Clip clip = PcmWave.read(new ByteArrayInputStream(wave(1, 40000, source)), 80000);
        check(clip.sampleRate == 80000, "target sample rate not retained");
        check(clip.channels == 2, "decoded output must be stereo");
        check(clip.frames() == 8, "40 kHz to 80 kHz frame count is wrong");
        check(clip.samples[0] == 0 && clip.samples[1] == 0, "mono frame was not duplicated");
        check(clip.samples[2] == 500 && clip.samples[3] == 500, "linear upsampling is wrong");
        check(clip.samples[6] == 1500 && clip.samples[7] == 1500, "middle interpolation is wrong");
        check(clip.samples[14] == 3000 && clip.samples[15] == 3000, "last sample is not clamped");
    }

    private static void preservesStereoSamplesAtTheDeviceRate() throws Exception {
        short[] source = { 100, -100, 200, -200 };
        PcmWave.Clip clip = PcmWave.read(new ByteArrayInputStream(wave(2, 48000, source)), 48000);
        check(clip.frames() == 2, "stereo frame count is wrong");
        for (int i = 0; i < source.length; i++) check(clip.samples[i] == source[i], "stereo sample changed at " + i);
    }

    private static void mixesIndependentVoicesWithoutMovingTheirRhythm() {
        PcmMixer mixer = new PcmMixer(4);
        mixer.register(1, new short[] { 1000, -1000, 2000, -2000 });
        int first = mixer.play(1, 1f, 1f, false);
        int second = mixer.play(1, 0.5f, 1f, false);
        check(first > 0 && second > first, "stream IDs are not independent");
        short[] output = new short[6];
        mixer.mix(output, 3);
        check(output[0] == 1500 && output[1] == -1500, "first mixed frame is wrong");
        check(output[2] == 3000 && output[3] == -3000, "second mixed frame is wrong");
        check(output[4] == 0 && output[5] == 0, "finished voices did not return to silence");
        check(mixer.activeVoices() == 0, "finished voices were retained");
    }

    private static void loopsChangesRateStopsAndClipsSafely() {
        PcmMixer mixer = new PcmMixer(2);
        mixer.register(7, new short[] { 30000, 30000, -30000, -30000 });
        int loop = mixer.play(7, 1f, 2f, true);
        int loud = mixer.play(7, 1f, 1f, false);
        check(loud > loop, "a second voice was not accepted");
        short[] output = new short[4];
        mixer.mix(output, 2);
        check(output[0] == Short.MAX_VALUE && output[1] == Short.MAX_VALUE, "positive mix did not clip");
        check(output[2] == 0 && output[3] == 0, "rate-adjusted loop did not preserve timing");
        mixer.stop(loop);
        check(mixer.activeVoices() == 0, "stopped and finished voices remain active");
        check(mixer.play(99, 1f, 1f, false) == 0, "unknown cue should not play");
        mixer.stopAll();
        check(mixer.activeVoices() == 0, "stopAll did not clear voices");
    }

    private static byte[] wave(int channels, int sampleRate, short[] samples) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        int dataBytes = samples.length * 2;
        ascii(output, "RIFF"); little32(output, 36 + dataBytes); ascii(output, "WAVE");
        ascii(output, "fmt "); little32(output, 16); little16(output, 1); little16(output, channels);
        little32(output, sampleRate); little32(output, sampleRate * channels * 2);
        little16(output, channels * 2); little16(output, 16);
        ascii(output, "data"); little32(output, dataBytes);
        for (short sample : samples) little16(output, sample);
        return output.toByteArray();
    }

    private static void ascii(ByteArrayOutputStream output, String text) throws IOException {
        output.write(text.getBytes("US-ASCII"));
    }

    private static void little16(ByteArrayOutputStream output, int value) {
        output.write(value & 255); output.write((value >>> 8) & 255);
    }

    private static void little32(ByteArrayOutputStream output, int value) {
        little16(output, value); little16(output, value >>> 16);
    }

    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
}
