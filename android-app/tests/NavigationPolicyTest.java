package cn.xianlai.game;

public final class NavigationPolicyTest {
    public static void main(String[] args) {
        String[] accepted = {
            NavigationPolicy.HOME_URL,
            "https://fafa-big-faker.github.io/growth-partner",
            "https://FAFA-BIG-FAKER.github.io:443/growth-partner/?source=android&launch=1#player",
            "https://fafa-big-faker.github.io/growth-partner/index.html",
        };
        String[] rejected = {
            "http://fafa-big-faker.github.io/growth-partner/",
            "https://fafa-big-faker.github.io/growth-partner-evil/",
            "https://fafa-big-faker.github.io/other/",
            "https://fafa-big-faker.github.io/growth-partner/../other/",
            "https://fafa-big-faker.github.io/growth-partner/%2e%2e/other/",
            "https://fafa-big-faker.github.io/growth-partner/%252e%252e/other/",
            "https://fafa-big-faker.github.io/growth-partner%2fother/",
            "https://fafa-big-faker.github.io/growth-partner/%5cother/",
            "https://fafa-big-faker.github.io.evil.test/growth-partner/",
            "https://fafa-big-faker.github.io@evil.test/growth-partner/",
            "https://evil.test@fafa-big-faker.github.io/growth-partner/",
            "https://fafa-big-faker.github.io:444/growth-partner/",
            "javascript:alert(1)", "file:///growth-partner/index.html",
            "content://growth-partner/index.html", "intent://example/#Intent;end", "", null,
        };
        for (String url : accepted) check(NavigationPolicy.isTrusted(url), "Allowed game URL rejected: " + url);
        for (String url : rejected) check(!NavigationPolicy.isTrusted(url), "Unsafe URL accepted: " + url);
        check(NavigationPolicy.isExternalWebLink("https://example.com/help"), "HTTPS external link blocked");
        check(NavigationPolicy.isExternalWebLink("http://example.com/help"), "HTTP browser link blocked");
        check(!NavigationPolicy.isExternalWebLink("javascript:alert(1)"), "Javascript escaped to browser");
        check(!NavigationPolicy.isExternalWebLink("intent://example/#Intent;end"), "Intent escaped to browser");
        check(!NavigationPolicy.isExternalWebLink("https://user:pass@example.com/"), "Credential URL accepted");
        System.out.println("Navigation policy: " + (accepted.length + rejected.length + 5) + " checks passed.");
    }

    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
}
