package cn.xianlai.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final int PAPER = Color.rgb(238, 238, 226);
    private static final int INK = Color.rgb(53, 74, 66);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private LinearLayout errorPanel;
    private TextView title;
    private TextView detail;
    private Button retry;
    private WebView webView;
    private NativeAudioBridge nativeAudio;
    private BundledAssetStore bundledAssets;
    private boolean failed;
    private boolean paused;
    private boolean awaitingBack;
    private AlertDialog exitDialog;
    private final Runnable loadDeadline = () -> showError(R.string.retry_hint);
    private final Runnable backDeadline = () -> {
        if (awaitingBack) {
            awaitingBack = false;
            confirmExit();
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);
        configureInsets();
        setContentView(root);
        createErrorView();
        connect();
    }

    private void configureInsets() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                return WindowInsets.CONSUMED;
            });
        } else {
            root.setFitsSystemWindows(true);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void createErrorView() {
        // LoginBoot in the web page owns normal startup. This panel is only for failures.
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(28), dp(24), dp(28), dp(24));
        errorPanel.setBackgroundColor(PAPER);
        errorPanel.setVisibility(View.GONE);
        title = new TextView(this);
        title.setTextColor(INK);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);
        title.setText(R.string.connection_error);
        title.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        errorPanel.addView(title, new LinearLayout.LayoutParams(-1, -2));
        detail = new TextView(this);
        detail.setTextColor(INK);
        detail.setTextSize(14);
        detail.setGravity(Gravity.CENTER);
        detail.setPadding(0, dp(12), 0, dp(12));
        errorPanel.addView(detail, new LinearLayout.LayoutParams(-1, -2));
        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setMinHeight(dp(48));
        retry.setOnClickListener(view -> connect());
        errorPanel.addView(retry, new LinearLayout.LayoutParams(dp(200), dp(52)));
        root.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
    }

    @SuppressWarnings("deprecation")
    private void createWebView() {
        webView = new WebView(this);
        bundledAssets = new BundledAssetStore(this);
        nativeAudio = new NativeAudioBridge(this);
        webView.addJavascriptInterface(bundledAssets, "XianlaiBundledAssets");
        webView.addJavascriptInterface(nativeAudio, "XianlaiNativeAudio");
        webView.setBackgroundColor(PAPER);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        // Treat user-activated target=_blank links as ordinary navigation through the same policy.
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " XianlaiAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse bundled = bundledAssets == null ? null : bundledAssets.responseFor(request);
                return bundled != null ? bundled : super.shouldInterceptRequest(view, request);
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (NavigationPolicy.isTrusted(url)) return false;
                if (request.isForMainFrame()) openExternal(url);
                return true;
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!NavigationPolicy.isTrusted(url)) {
                    view.stopLoading();
                    showError(R.string.retry_hint);
                }
            }

            @Override public void onPageCommitVisible(WebView view, String url) {
                revealPage(url);
            }

            @Override public void onPageFinished(WebView view, String url) {
                revealPage(url);
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError(R.string.retry_hint);
            }

            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showError(R.string.retry_hint);
            }

            @Override public void onReceivedSslError(WebView view, SslErrorHandler sslHandler, SslError error) {
                sslHandler.cancel();
                if (error.getUrl().equals(view.getUrl())) showError(R.string.retry_hint);
            }

            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail gone) {
                root.removeView(view);
                view.destroy();
                if (nativeAudio != null) {
                    nativeAudio.release();
                    nativeAudio = null;
                }
                if (webView == view) webView = null;
                showError(R.string.retry_hint);
                return true;
            }
        });
        root.addView(webView, 0, new FrameLayout.LayoutParams(-1, -1));
    }

    private void connect() {
        failed = false;
        errorPanel.setVisibility(View.GONE);
        try {
            boolean firstDocument = webView == null;
            if (webView == null) createWebView();
            webView.stopLoading();
            // Never flash the previous failed document during a retry.
            webView.setVisibility(firstDocument ? View.VISIBLE : View.INVISIBLE);
            handler.removeCallbacks(loadDeadline);
            handler.postDelayed(loadDeadline, 30000);
            // Revalidate the entry document on every fresh launch or explicit retry, without clearing user storage.
            webView.loadUrl(NavigationPolicy.HOME_URL + "?source=android&launch=" + System.currentTimeMillis());
        } catch (RuntimeException error) {
            showError(R.string.engine_error);
        }
    }

    private void revealPage(String url) {
        if (failed || webView == null || !NavigationPolicy.isTrusted(url)) return;
        handler.removeCallbacks(loadDeadline);
        webView.setVisibility(View.VISIBLE);
        errorPanel.setVisibility(View.GONE);
        if (nativeAudio != null) nativeAudio.initializeAsync();
        setPageBackgrounded(paused);
    }

    private void showError(int message) {
        if (isFinishing() || isDestroyed()) return;
        failed = true;
        handler.removeCallbacks(loadDeadline);
        if (webView != null) {
            webView.stopLoading();
            webView.setVisibility(View.INVISIBLE);
        }
        errorPanel.setVisibility(View.VISIBLE);
        errorPanel.bringToFront();
        title.setText(R.string.connection_error);
        detail.setText(message);
        detail.setVisibility(View.VISIBLE);
        retry.setVisibility(View.VISIBLE);
    }

    private void openExternal(String url) {
        if (!NavigationPolicy.isExternalWebLink(url)) {
            Toast.makeText(this, R.string.unsupported_link, Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            browser.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(browser);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, R.string.browser_missing, Toast.LENGTH_SHORT).show();
        }
    }

    @Override public void onBackPressed() {
        if (awaitingBack || (exitDialog != null && exitDialog.isShowing())) return;
        if (webView == null || failed || !NavigationPolicy.isTrusted(webView.getUrl())) {
            confirmExit();
            return;
        }
        awaitingBack = true;
        handler.postDelayed(backDeadline, 2000);
        webView.evaluateJavascript(
                "(function(){try{return !!(window.XianlaiShell && window.XianlaiShell.handleBack && window.XianlaiShell.handleBack());}catch(e){return false;}})()",
                result -> {
                    if (!awaitingBack || isFinishing() || isDestroyed()) return;
                    awaitingBack = false;
                    handler.removeCallbacks(backDeadline);
                    if (!"true".equals(result)) confirmExit();
                });
    }

    private void confirmExit() {
        if (paused || isFinishing() || isDestroyed()) return;
        if (exitDialog != null && exitDialog.isShowing()) return;
        exitDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.exit_title)
                .setMessage(R.string.exit_message)
                .setNegativeButton(R.string.stay, null)
                .setPositiveButton(R.string.exit, (dialog, which) -> finish())
                .create();
        exitDialog.show();
    }

    private void setPageBackgrounded(boolean backgrounded) {
        if (webView == null || !NavigationPolicy.isTrusted(webView.getUrl())) return;
        webView.evaluateJavascript(
                "window.XianlaiShell && window.XianlaiShell.setBackgrounded && window.XianlaiShell.setBackgrounded("
                        + backgrounded + ");", null);
    }

    @Override protected void onPause() {
        paused = true;
        awaitingBack = false;
        handler.removeCallbacks(backDeadline);
        setPageBackgrounded(true);
        if (nativeAudio != null) nativeAudio.setForeground(false);
        if (webView != null) webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        paused = false;
        if (webView != null) webView.onResume();
        if (nativeAudio != null) nativeAudio.setForeground(true);
        setPageBackgrounded(false);
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (exitDialog != null) exitDialog.dismiss();
        if (webView != null) {
            setPageBackgrounded(true);
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        if (nativeAudio != null) {
            nativeAudio.release();
            nativeAudio = null;
        }
        super.onDestroy();
    }
}
