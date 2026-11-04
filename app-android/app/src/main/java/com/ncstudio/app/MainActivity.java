package com.ncstudio.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

/**
 * NC Studio: app privada. Se abre con tu huella (o el PIN/patrón del teléfono)
 * y tiene dos vistas: la página como la ven los clientes y tu página de dueño.
 */
public class MainActivity extends AppCompatActivity {
    private static final String SITE = "https://ncstudio507.github.io/";
    private static final String OWNER = SITE + "agendar.html";
    private static final long RELOCK_MS = 60_000; // se vuelve a bloquear si la dejas en segundo plano 1 minuto

    private static final int ORANGE = Color.parseColor("#F99824");
    private static final int DARK = Color.parseColor("#222020");
    private static final int BEIGE = Color.parseColor("#F2E4D2");

    private FrameLayout root;
    private View lockView, homeView, webWrap;
    private WebView clientWeb, ownerWeb, current;
    private TextView webTitle;
    private boolean unlocked = false, prompting = false;
    private long hiddenAt = 0;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(DARK);
        getWindow().setNavigationBarColor(DARK);
        root = new FrameLayout(this);
        root.setBackgroundColor(DARK);
        setContentView(root);
        homeView = buildHome();
        webWrap = buildWebWrap();
        lockView = buildLock();
        root.addView(homeView);
        root.addView(webWrap);
        root.addView(lockView);
        webWrap.setVisibility(View.GONE);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webWrap.getVisibility() == View.VISIBLE) {
                    if (current != null && current.canGoBack()) current.goBack();
                    else showHome();
                } else { setEnabled(false); getOnBackPressedDispatcher().onBackPressed(); setEnabled(true); }
            }
        });
    }

    @Override protected void onStart() {
        super.onStart();
        if (unlocked && hiddenAt > 0 && SystemClock.elapsedRealtime() - hiddenAt > RELOCK_MS) unlocked = false;
        if (!unlocked) { lockView.setVisibility(View.VISIBLE); askUnlock(); }
    }

    @Override protected void onStop() { super.onStop(); hiddenAt = SystemClock.elapsedRealtime(); }

    /* ---------- desbloqueo ---------- */
    private void askUnlock() {
        if (prompting) return;
        int auth = Build.VERSION.SDK_INT >= 30
                ? BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                : BiometricManager.Authenticators.BIOMETRIC_WEAK;
        int can = BiometricManager.from(this).canAuthenticate(auth);
        if (can != BiometricManager.BIOMETRIC_SUCCESS && Build.VERSION.SDK_INT >= 30) {
            Toast.makeText(this, "Tu teléfono no tiene bloqueo de pantalla: actívalo para proteger la app.", Toast.LENGTH_LONG).show();
            unlock(); return;
        }
        BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("NC Studio")
                .setSubtitle("Usa tu huella para entrar");
        if (Build.VERSION.SDK_INT >= 30) info.setAllowedAuthenticators(auth);
        else info.setDeviceCredentialAllowed(true);
        BiometricPrompt p = new BiometricPrompt(this, ContextCompat.getMainExecutor(this), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult r) { prompting = false; unlock(); }
            @Override public void onAuthenticationError(int code, @NonNull CharSequence msg) { prompting = false; }
        });
        prompting = true;
        p.authenticate(info.build());
    }

    private void unlock() { unlocked = true; lockView.setVisibility(View.GONE); }

    /* ---------- pantallas ---------- */
    private View buildLock() {
        LinearLayout l = column();
        l.setBackgroundColor(DARK);
        l.addView(logo());
        TextView t = text("App privada de NC Studio", 18, BEIGE, false);
        l.addView(t, lp(0, 24));
        Button b = bigButton("🔒  Desbloquear");
        b.setOnClickListener(v -> askUnlock());
        l.addView(b, lp(0, 32));
        l.setClickable(true);
        return l;
    }

    private View buildHome() {
        LinearLayout l = column();
        l.addView(logo());
        l.addView(text("¿Qué quieres abrir?", 22, Color.WHITE, true), lp(0, 28));
        Button cli = bigButton("👀  Vista cliente");
        cli.setOnClickListener(v -> open(false));
        l.addView(cli, lp(0, 28));
        l.addView(text("La página tal como la ven tus clientes", 14, BEIGE, false), lp(0, 8));
        Button own = bigButton("🔑  Mi página de dueño");
        own.setOnClickListener(v -> open(true));
        l.addView(own, lp(0, 28));
        l.addView(text("Agendar, clientes, finanzas, publicar y experiencias", 14, BEIGE, false), lp(0, 8));
        return l;
    }

    private View buildWebWrap() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        LinearLayout bar = new LinearLayout(this);
        bar.setBackgroundColor(DARK);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(4), dp(4), dp(4), dp(4));
        Button home = flatButton("‹ Inicio");
        home.setOnClickListener(v -> showHome());
        webTitle = text("", 16, Color.WHITE, true);
        webTitle.setGravity(Gravity.CENTER);
        Button swap = flatButton("⇄");
        swap.setContentDescription("Cambiar de vista");
        swap.setOnClickListener(v -> open(current != ownerWeb));
        Button reload = flatButton("↻");
        reload.setContentDescription("Recargar");
        reload.setOnClickListener(v -> { if (current != null) current.reload(); });
        bar.addView(home);
        bar.addView(webTitle, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        bar.addView(swap);
        bar.addView(reload);
        View line = new View(this);
        line.setBackgroundColor(ORANGE);
        FrameLayout holder = new FrameLayout(this);
        holder.setId(View.generateViewId());
        holder.setTag("holder");
        l.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        l.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4)));
        l.addView(holder, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        return l;
    }

    private void open(boolean owner) {
        FrameLayout holder = webWrap.findViewWithTag("holder");
        if (owner && ownerWeb == null) { ownerWeb = newWeb(); ownerWeb.loadUrl(OWNER); holder.addView(ownerWeb); }
        if (!owner && clientWeb == null) { clientWeb = newWeb(); clientWeb.loadUrl(SITE); holder.addView(clientWeb); }
        current = owner ? ownerWeb : clientWeb;
        if (ownerWeb != null) ownerWeb.setVisibility(owner ? View.VISIBLE : View.GONE);
        if (clientWeb != null) clientWeb.setVisibility(owner ? View.GONE : View.VISIBLE);
        webTitle.setText(owner ? "Dueño" : "Vista cliente");
        homeView.setVisibility(View.GONE);
        webWrap.setVisibility(View.VISIBLE);
    }

    private void showHome() { webWrap.setVisibility(View.GONE); homeView.setVisibility(View.VISIBLE); }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView newWeb() {
        WebView w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
        w.setBackgroundColor(BEIGE);
        w.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return external(r.getUrl()); }
        });
        w.setDownloadListener((url, ua, cd, mime, len) -> external(Uri.parse(url)));
        return w;
    }

    /* WhatsApp, Instagram, correos, Pixieset, Google, PDFs: se abren en su app */
    private boolean external(Uri u) {
        String host = u.getHost() == null ? "" : u.getHost();
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        if (("https".equals(scheme) || "http".equals(scheme)) && (host.endsWith("ncstudio507.github.io") || host.endsWith("script.google.com") || host.endsWith("script.googleusercontent.com"))) return false;
        try {
            Intent i = "intent".equals(scheme) ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "No hay una app para abrir ese enlace.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    /* ---------- utilidades de diseño ---------- */
    private LinearLayout column() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setGravity(Gravity.CENTER);
        l.setPadding(dp(28), dp(28), dp(28), dp(28));
        l.setBackgroundColor(DARK);
        return l;
    }
    private ImageView logo() {
        ImageView iv = new ImageView(this);
        iv.setImageResource(R.drawable.logo);
        iv.setAdjustViewBounds(true);
        iv.setLayoutParams(new LinearLayout.LayoutParams(dp(200), ViewGroup.LayoutParams.WRAP_CONTENT));
        return iv;
    }
    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color); t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }
    private Button bigButton(String s) {
        Button b = new Button(this);
        b.setText(s); b.setAllCaps(false); b.setTextSize(18); b.setTextColor(DARK); b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable g = new GradientDrawable(); g.setColor(ORANGE); g.setCornerRadius(dp(10));
        b.setBackground(g); b.setMinHeight(dp(60)); b.setPadding(dp(20), 0, dp(20), 0);
        return b;
    }
    private Button flatButton(String s) {
        Button b = new Button(this);
        b.setText(s); b.setAllCaps(false); b.setTextSize(16); b.setTextColor(BEIGE); b.setBackgroundColor(Color.TRANSPARENT);
        b.setMinWidth(dp(48)); b.setMinimumWidth(dp(48));
        return b;
    }
    private LinearLayout.LayoutParams lp(int w, int top) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(w == 0 ? ViewGroup.LayoutParams.MATCH_PARENT : dp(w), ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = dp(top);
        return p;
    }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
