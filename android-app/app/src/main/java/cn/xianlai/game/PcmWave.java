package cn.xianlai.game;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

final class PcmWave {
    static final class Clip {
        final short[] samples;
        final int sampleRate;
        final int channels;

        Clip(short[] samples, int sampleRate) {
            this.samples = samples;
            this.sampleRate = sampleRate;
            this.channels = 2;
        }

        int frames() {
            return samples.length / channels;
        }
    }

    private PcmWave() {}

    static Clip read(InputStream input, int targetSampleRate) throws IOException {
        if (targetSampleRate < 8000 || targetSampleRate > 192000) {
            throw new IOException("Invalid target sample rate");
        }
        byte[] bytes = readAll(input);
        if (bytes.length < 44 || !ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WAVE")) {
            throw new IOException("Invalid RIFF/WAVE file");
        }

        int format = 0, channels = 0, sourceSampleRate = 0, bits = 0;
        int dataOffset = -1, dataSize = -1;
        int offset = 12;
        while (offset + 8 <= bytes.length) {
            int chunkSize = little32(bytes, offset + 4);
            if (chunkSize < 0 || chunkSize > bytes.length - offset - 8) throw new IOException("Invalid WAVE chunk");
            int payload = offset + 8;
            if (ascii(bytes, offset, "fmt ")) {
                if (chunkSize < 16) throw new IOException("Invalid WAVE format chunk");
                format = little16(bytes, payload);
                channels = little16(bytes, payload + 2);
                sourceSampleRate = little32(bytes, payload + 4);
                bits = little16(bytes, payload + 14);
            } else if (ascii(bytes, offset, "data") && dataOffset < 0) {
                dataOffset = payload;
                dataSize = chunkSize;
            }
            offset = payload + chunkSize + (chunkSize & 1);
        }

        if (format != 1 || (channels != 1 && channels != 2) || bits != 16
                || sourceSampleRate < 8000 || sourceSampleRate > 192000 || dataOffset < 0) {
            throw new IOException("Only mono/stereo PCM16 WAVE is supported");
        }
        int sourceFrames = dataSize / (channels * 2);
        if (sourceFrames <= 0 || sourceFrames > 4000000) throw new IOException("Invalid WAVE data length");
        int targetFrames = Math.max(1, (int) Math.round(sourceFrames * (double) targetSampleRate / sourceSampleRate));
        short[] stereo = new short[targetFrames * 2];
        for (int frame = 0; frame < targetFrames; frame++) {
            double sourcePosition = frame * (double) sourceSampleRate / targetSampleRate;
            int first = Math.min(sourceFrames - 1, (int) sourcePosition);
            int second = Math.min(sourceFrames - 1, first + 1);
            double fraction = sourcePosition - first;
            for (int channel = 0; channel < 2; channel++) {
                int sourceChannel = channels == 1 ? 0 : channel;
                short a = sample(bytes, dataOffset, channels, first, sourceChannel);
                short b = sample(bytes, dataOffset, channels, second, sourceChannel);
                stereo[frame * 2 + channel] = clamp((int) Math.round(a + (b - a) * fraction));
            }
        }
        return new Clip(stereo, targetSampleRate);
    }

    private static byte[] readAll(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            output.write(buffer, 0, count);
            if (output.size() > 16000000) throw new IOException("WAVE file is too large");
        }
        return output.toByteArray();
    }

    private static short sample(byte[] bytes, int dataOffset, int channels, int frame, int channel) {
        int offset = dataOffset + (frame * channels + channel) * 2;
        return (short) ((bytes[offset] & 255) | (bytes[offset + 1] << 8));
    }

    private static short clamp(int value) {
        return (short) Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, value));
    }

    private static boolean ascii(byte[] bytes, int offset, String expected) {
        if (offset < 0 || offset + expected.length() > bytes.length) return false;
        for (int i = 0; i < expected.length(); i++) if (bytes[offset + i] != expected.charAt(i)) return false;
        return true;
    }

    private static int little16(byte[] bytes, int offset) {
        return (bytes[offset] & 255) | ((bytes[offset + 1] & 255) << 8);
    }

    private static int little32(byte[] bytes, int offset) {
        long value = (bytes[offset] & 255L) | ((bytes[offset + 1] & 255L) << 8)
                | ((bytes[offset + 2] & 255L) << 16) | ((bytes[offset + 3] & 255L) << 24);
        return value > Integer.MAX_VALUE ? -1 : (int) value;
    }
}
