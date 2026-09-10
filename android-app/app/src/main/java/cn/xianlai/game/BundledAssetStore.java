package cn.xianlai.game;

import android.content.Context;
import android.content.res.AssetManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Serves only build-time verified runtime assets that exactly match the live web manifest. */
public final class BundledAssetStore {
    private static final String MANIFEST = "xianlai/bundled-assets.tsv";
    private final AssetManager assets;
    private final Map<String, Entry> entries = new HashMap<>();

    private static final class Entry {
        final String path;
        final String mime;
        final long bytes;
        final String sha256;

        Entry(String path, String mime, long bytes, String sha256) {
            this.path = path;
            this.mime = mime;
            this.bytes = bytes;
            this.sha256 = sha256;
        }
    }

    public BundledAssetStore(Context context) {
        assets = context.getAssets();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                assets.open(MANIFEST), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String[] fields = line.split("\\t", -1);
                if (fields.length != 5 || !fields[0].startsWith("assets/runtime/")
                        || !fields[1].startsWith("xianlai/assets/runtime/")
                        || !fields[4].matches("[a-f0-9]{64}")) continue;
                long size = Long.parseLong(fields[3]);
                if (size > 0) entries.put(fields[0], new Entry(fields[1], fields[2], size, fields[4]));
            }
        } catch (IOException | NumberFormatException error) {
            entries.clear();
        }
    }

    @JavascriptInterface public boolean hasAsset(String url, long bytes, String sha256) {
        Entry entry = entries.get(url);
        return entry != null && entry.bytes == bytes && entry.sha256.equals(sha256);
    }

    public WebResourceResponse responseFor(WebResourceRequest request) {
        if (request == null || !"GET".equalsIgnoreCase(request.getMethod())) return null;
        String relative = relativeUrl(request.getUrl().toString());
        Entry entry = relative == null ? null : entries.get(relative);
        if (entry == null) return null;
        try {
            byte[] payload;
            try (InputStream input = assets.open(entry.path)) {
                payload = readExactly(input, entry.bytes);
            }
            if (payload == null) return null;
            String range = request.getRequestHeaders().get("Range");
            long[] bounds = parseRange(range, payload.length);
            Map<String, String> headers = new HashMap<>();
            headers.put("Accept-Ranges", "bytes");
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
            if (bounds == null) {
                headers.put("Content-Length", String.valueOf(payload.length));
                return new WebResourceResponse(entry.mime, null, 200, "OK", headers,
                        new ByteArrayInputStream(payload));
            }
            int start = (int) bounds[0];
            int end = (int) bounds[1];
            int length = end - start + 1;
            headers.put("Content-Length", String.valueOf(length));
            headers.put("Content-Range", "bytes " + start + "-" + end + "/" + payload.length);
            return new WebResourceResponse(entry.mime, null, 206, "Partial Content", headers,
                    new ByteArrayInputStream(payload, start, length));
        } catch (IOException error) {
            return null;
        }
    }

    private static String relativeUrl(String url) {
        if (!NavigationPolicy.isTrusted(url)) return null;
        try {
            URI base = new URI(NavigationPolicy.HOME_URL);
            URI request = new URI(url);
            String root = base.getRawPath();
            String path = request.getRawPath();
            if (!path.startsWith(root)) return null;
            String relative = path.substring(root.length());
            if (!relative.startsWith("assets/runtime/")) return null;
            return request.getRawQuery() == null ? relative : relative + "?" + request.getRawQuery();
        } catch (URISyntaxException error) {
            return null;
        }
    }

    private static byte[] readExactly(InputStream input, long expected) throws IOException {
        if (expected <= 0 || expected > Integer.MAX_VALUE) return null;
        byte[] bytes = new byte[(int) expected];
        int offset = 0;
        while (offset < bytes.length) {
            int count = input.read(bytes, offset, bytes.length - offset);
            if (count < 0) return null;
            offset += count;
        }
        return input.read() == -1 ? bytes : null;
    }

    private static long[] parseRange(String header, int total) {
        if (header == null || !header.toLowerCase(Locale.ROOT).startsWith("bytes=")) return null;
        String value = header.substring(6).trim();
        if (value.contains(",")) return null;
        int dash = value.indexOf('-');
        if (dash < 0) return null;
        try {
            long start;
            long end;
            if (dash == 0) {
                long suffix = Long.parseLong(value.substring(1));
                if (suffix <= 0) return null;
                start = Math.max(0, total - suffix);
                end = total - 1;
            } else {
                start = Long.parseLong(value.substring(0, dash));
                end = dash == value.length() - 1 ? total - 1 : Long.parseLong(value.substring(dash + 1));
            }
            if (start < 0 || start >= total || end < start) return null;
            return new long[] { start, Math.min(end, total - 1) };
        } catch (NumberFormatException error) {
            return null;
        }
    }
}
