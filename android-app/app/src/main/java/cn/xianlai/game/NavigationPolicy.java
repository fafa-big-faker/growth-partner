package cn.xianlai.game;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Keeps executable game pages inside the one approved HTTPS site. */
public final class NavigationPolicy {
    public static final String HOME_URL = "https://fafa-big-faker.github.io/growth-partner/";
    private static final String HOST = "fafa-big-faker.github.io";

    private NavigationPolicy() {}

    public static boolean isTrusted(String url) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !HOST.equalsIgnoreCase(uri.getHost())
                    || uri.getRawUserInfo() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)) return false;
            String raw = uri.getRawPath().toLowerCase(Locale.ROOT);
            // Reject ambiguous separators and encoded dot segments before WebView normalizes them.
            if (raw.contains("%2f") || raw.contains("%5c") || raw.contains("%25")) return false;
            String path = uri.getPath();
            if (path.indexOf('\\') >= 0) return false;
            for (String part : path.split("/")) {
                if (".".equals(part) || "..".equals(part)) return false;
            }
            return "/growth-partner".equals(path) || path.startsWith("/growth-partner/");
        } catch (URISyntaxException | NullPointerException error) {
            return false;
        }
    }

    public static boolean isExternalWebLink(String url) {
        try {
            URI uri = new URI(url);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getRawUserInfo() == null;
        } catch (URISyntaxException | NullPointerException error) {
            return false;
        }
    }
}
