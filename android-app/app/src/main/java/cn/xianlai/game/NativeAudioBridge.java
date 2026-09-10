package cn.xianlai.game;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.webkit.JavascriptInterface;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** A deliberately narrow, low-latency sound output for the trusted game page. */
public final class NativeAudioBridge {
    private static final String AUDIO_ROOT = "xianlai/assets/runtime/audio/";
    private final SoundPool soundPool;
    private final Map<String, Integer> soundIds = new HashMap<>();
    private final AtomicInteger loaded = new AtomicInteger();
    private volatile boolean failed;
    private volatile boolean released;

    public NativeAudioBridge(Context context) {
        AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        soundPool = new SoundPool.Builder()
                .setMaxStreams(12)
                .setAudioAttributes(attributes)
                .build();
        soundPool.setOnLoadCompleteListener((pool, sampleId, status) -> {
            if (status == 0) loaded.incrementAndGet();
            else failed = true;
        });
        Map<String, String> files = new HashMap<>();
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
        for (Map.Entry<String, String> entry : files.entrySet()) {
            try (AssetFileDescriptor descriptor = context.getAssets().openFd(AUDIO_ROOT + entry.getValue())) {
                int soundId = soundPool.load(descriptor, 1);
                if (soundId == 0) failed = true;
                else soundIds.put(entry.getKey(), soundId);
            } catch (IOException error) {
                failed = true;
            }
        }
    }

    @JavascriptInterface public boolean isReady() {
        return !released && !failed && soundIds.size() == 12 && loaded.get() == soundIds.size();
    }

    @JavascriptInterface public int play(String name, double volume, double rate, boolean loop) {
        if (!isReady()) return 0;
        Integer soundId = soundIds.get(name);
        if (soundId == null) return 0;
        float safeVolume = Math.max(0.0f, Math.min(1.0f, (float) volume));
        float safeRate = Math.max(0.5f, Math.min(2.0f, (float) rate));
        return soundPool.play(soundId, safeVolume, safeVolume, 1, loop ? -1 : 0, safeRate);
    }

    @JavascriptInterface public void stop(int streamId) {
        if (!released && streamId > 0) soundPool.stop(streamId);
    }

    @JavascriptInterface public void stopAll() {
        if (!released) soundPool.autoPause();
    }

    public void release() {
        if (released) return;
        released = true;
        soundIds.clear();
        soundPool.release();
    }
}
