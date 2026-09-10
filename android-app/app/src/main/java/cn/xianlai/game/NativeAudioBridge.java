package cn.xianlai.game;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Process;
import android.webkit.JavascriptInterface;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/** A narrow, continuously warm low-latency output for the trusted game page. */
public final class NativeAudioBridge {
    private static final String AUDIO_ROOT = "xianlai/assets/runtime/audio/";
    private static final int CHANNELS = 2;
    private static final int BYTES_PER_FRAME = CHANNELS * 2;
    private static final int MAX_VOICES = 12;

    private final Object lifecycleLock = new Object();
    private final Map<String, Integer> soundIds = new LinkedHashMap<>();
    private final PcmMixer mixer = new PcmMixer(MAX_VOICES);
    private final int sampleRate;
    private final int framesPerBuffer;
    private AudioTrack audioTrack;
    private Thread writerThread;
    private volatile boolean ready;
    private volatile boolean failed;
    private volatile boolean foreground;
    private volatile boolean released;
    private volatile int writerGeneration;

    public NativeAudioBridge(Context context) {
        AudioManager manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        sampleRate = boundedProperty(manager, AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE, 48000, 8000, 192000);
        framesPerBuffer = boundedProperty(manager, AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER, 192, 16, 2048);
        try {
            loadEffects(context);
            audioTrack = createTrack();
            ready = soundIds.size() == MAX_VOICES && audioTrack.getState() == AudioTrack.STATE_INITIALIZED;
            if (!ready) throw new IllegalStateException("Low-latency AudioTrack did not initialize");
            setForeground(true);
        } catch (IOException | RuntimeException error) {
            failed = true;
            ready = false;
            if (audioTrack != null) {
                audioTrack.release();
                audioTrack = null;
            }
        }
    }

    private void loadEffects(Context context) throws IOException {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("uiTap", "ui-tap.wav");
        files.put("uiOpen", "ui-open.wav");
        files.put("chopHit", "chop-hit.wav");
        files.put("itemDrop", "item-drop.wav");
        files.put("forgeProcess", "forge-process.wav");
        files.put("forgeSuccess", "forge-success.wav");
        files.put("dropRare", "drop-rare.wav");
        files.put("dropHigh", "drop-high.wav");
        files.put("rewardReveal", "reward-reveal.wav");
        files.put("rewardRare", "reward-arrival-rare.wav");
        files.put("rewardHigh", "reward-arrival-high.wav");
        files.put("skillTrigger", "skill-trigger.wav");
        int soundId = 1;
        for (Map.Entry<String, String> entry : files.entrySet()) {
            try (InputStream input = context.getAssets().open(AUDIO_ROOT + entry.getValue())) {
                PcmWave.Clip clip = PcmWave.read(input, sampleRate);
                mixer.register(soundId, clip.samples);
                soundIds.put(entry.getKey(), soundId++);
            }
        }
    }

    private AudioTrack createTrack() {
        int minimumBytes = AudioTrack.getMinBufferSize(sampleRate,
                AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT);
        if (minimumBytes < BYTES_PER_FRAME) minimumBytes = framesPerBuffer * BYTES_PER_FRAME * 2;
        int minimumFrames = (minimumBytes + BYTES_PER_FRAME - 1) / BYTES_PER_FRAME;
        int desiredFrames = framesPerBuffer * 2;
        int capacityFrames = Math.max(desiredFrames, minimumFrames);
        AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        AudioFormat format = new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                .build();
        AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(format)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setBufferSizeInBytes(capacityFrames * BYTES_PER_FRAME)
                .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                .build();
        if (track.getState() == AudioTrack.STATE_INITIALIZED) track.setBufferSizeInFrames(desiredFrames);
        return track;
    }

    @JavascriptInterface public boolean isReady() {
        return ready && !failed && !released;
    }

    @JavascriptInterface public String backend() {
        return isReady() ? "audio-track-low-latency" : "web-audio-fallback";
    }

    @JavascriptInterface public int play(String name, double volume, double rate, boolean loop) {
        if (!isReady() || !foreground) return 0;
        Integer soundId = soundIds.get(name);
        if (soundId == null) return 0;
        float safeVolume = Math.max(0.0f, Math.min(1.0f, (float) volume));
        float safeRate = Math.max(0.5f, Math.min(2.0f, (float) rate));
        return mixer.play(soundId, safeVolume, safeRate, loop);
    }

    @JavascriptInterface public void stop(int streamId) {
        if (!released && streamId > 0) mixer.stop(streamId);
    }

    @JavascriptInterface public void stopAll() {
        if (!released) mixer.stopAll();
    }

    public void setForeground(boolean active) {
        if (!active) {
            stopWriter();
            return;
        }
        synchronized (lifecycleLock) {
            if (!ready || failed || released || foreground || audioTrack == null) return;
            foreground = true;
            int generation = ++writerGeneration;
            try {
                audioTrack.play();
                writerThread = new Thread(() -> writeLoop(generation), "XianlaiAudio");
                writerThread.setDaemon(true);
                writerThread.start();
            } catch (RuntimeException error) {
                foreground = false;
                failed = true;
            }
        }
    }

    private void writeLoop(int generation) {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
        short[] buffer = new short[framesPerBuffer * CHANNELS];
        while (foreground && !released && generation == writerGeneration) {
            mixer.mix(buffer, framesPerBuffer);
            int offset = 0;
            while (offset < buffer.length && foreground && !released && generation == writerGeneration) {
                int written;
                try {
                    written = audioTrack.write(buffer, offset, buffer.length - offset, AudioTrack.WRITE_BLOCKING);
                } catch (RuntimeException error) {
                    written = AudioTrack.ERROR_INVALID_OPERATION;
                }
                if (written < 0) {
                    failed = true;
                    foreground = false;
                    return;
                }
                if (written == 0) Thread.yield();
                else offset += written;
            }
        }
    }

    private void stopWriter() {
        Thread stopping;
        synchronized (lifecycleLock) {
            foreground = false;
            writerGeneration++;
            mixer.stopAll();
            stopping = writerThread;
            writerThread = null;
            if (audioTrack != null && audioTrack.getState() == AudioTrack.STATE_INITIALIZED) {
                try { audioTrack.pause(); } catch (RuntimeException ignored) {}
                try { audioTrack.flush(); } catch (RuntimeException ignored) {}
            }
        }
        if (stopping != null && stopping != Thread.currentThread()) {
            try { stopping.join(250); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); }
        }
    }

    public void release() {
        if (released) return;
        stopWriter();
        synchronized (lifecycleLock) {
            released = true;
            ready = false;
            soundIds.clear();
            if (audioTrack != null) {
                audioTrack.release();
                audioTrack = null;
            }
        }
    }

    private static int boundedProperty(AudioManager manager, String key, int fallback, int minimum, int maximum) {
        if (manager == null) return fallback;
        try {
            int value = Integer.parseInt(manager.getProperty(key));
            return Math.max(minimum, Math.min(maximum, value));
        } catch (RuntimeException error) {
            return fallback;
        }
    }
}
