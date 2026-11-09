package com.ncstudio.app;

import android.Manifest;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
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
 * NC Studio: tres entradas. Clientes (la página), Zona VIP (cada cliente con su
 * número y contraseña) y Admin (Nelson y Charlie; se confirma con la huella).
 */
public class MainActivity extends AppCompatActivity {
    private static final String SITE = "https://ncstudio507.github.io/";
    private static final String OWNER = SITE + "agendar.html";
    private static final String VIP = SITE + "vip.html?cliente=1";
    private static final int CLIENTE = 0, ZONA = 1, ADMIN = 2;

    private static final int ORANGE = Color.parseColor("#F99824");
    private static final int DARK = Color.parseColor("#222020");
    private static final int BEIGE = Color.parseColor("#F2E4D2");

    private FrameLayout root;
    private View homeView, webWrap;
    private final WebView[] webs = new WebView[3];
    private WebView current;
    private TextView webTitle;
    private boolean prompting = false;

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
        root.addView(homeView);
        root.addView(webWrap);
        webWrap.setVisibility(View.GONE);
        buscarVersion();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webWrap.getVisibility() == View.VISIBLE) {
                    if (current != null && current.canGoBack()) current.goBack();
                    else showHome();
                } else { setEnabled(false); getOnBackPressedDispatcher().onBackPressed(); setEnabled(true); }
            }
        });
    }

    /* ---------- huella para entrar como administrador (la pide la página de Admin) ---------- */
    private void pedirHuella(WebView w) {
        if (prompting) return;
        int auth = Build.VERSION.SDK_INT >= 30
                ? BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                : BiometricManager.Authenticators.BIOMETRIC_WEAK;
        if (BiometricManager.from(this).canAuthenticate(auth) != BiometricManager.BIOMETRIC_SUCCESS) {
            Toast.makeText(this, "Activa la huella o el bloqueo de pantalla de tu teléfono para entrar como administrador.", Toast.LENGTH_LONG).show();
            responder(w, false); return;
        }
        BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Admin · NC Studio")
                .setSubtitle("Confirma que eres tú con tu huella");
        if (Build.VERSION.SDK_INT >= 30) info.setAllowedAuthenticators(auth);
        else info.setDeviceCredentialAllowed(true);
        BiometricPrompt p = new BiometricPrompt(this, ContextCompat.getMainExecutor(this), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult r) { prompting = false; responder(w, true); }
            @Override public void onAuthenticationError(int code, @NonNull CharSequence msg) { prompting = false; responder(w, false); }
        });
        prompting = true;
        p.authenticate(info.build());
    }

    private void responder(WebView w, boolean ok) { w.evaluateJavascript("window.ncHuella && window.ncHuella(" + ok + ")", null); }

    /* ---------- aviso de versión nueva: revisa en GitHub si hay una app más reciente ---------- */
    private static final String RELEASE_API = "https://api.github.com/repos/ncstudio507/ncstudio507.github.io/releases/tags/app";
    private static final String APK_URL = "https://github.com/ncstudio507/ncstudio507.github.io/releases/download/app/NCStudio.apk";
    private boolean versionRevisada = false;

    private void buscarVersion() {
        if (versionRevisada) return;
        versionRevisada = true;
        new Thread(() -> {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(RELEASE_API).openConnection();
                c.setConnectTimeout(15000); c.setReadTimeout(15000);
                c.setRequestProperty("Accept", "application/vnd.github+json");
                if (c.getResponseCode() != 200) return;
                java.io.InputStream in = c.getInputStream();
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[8192]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                in.close();
                String body = new JSONObject(out.toString("UTF-8")).optString("body", "");
                Matcher m = Pattern.compile("Versi[oó]n 1\\.(\\d+)").matcher(body);
                if (!m.find()) return;
                int nueva = Integer.parseInt(m.group(1));
                int actual = (int) (Build.VERSION.SDK_INT >= 28
                        ? getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode()
                        : getPackageManager().getPackageInfo(getPackageName(), 0).versionCode);
                if (nueva <= actual) return;
                SharedPreferences sp = getSharedPreferences("nc", MODE_PRIVATE);
                long hoy = System.currentTimeMillis() / 86400000L;
                if (sp.getInt("avisada", 0) == nueva && sp.getLong("dia", 0) == hoy) return; // máximo un aviso al día
                sp.edit().putInt("avisada", nueva).putLong("dia", hoy).apply();
                runOnUiThread(() -> new AlertDialog.Builder(this)
                        .setTitle("Hay una versión nueva de la app")
                        .setMessage("La versión 1." + nueva + " ya está lista (tienes la 1." + actual + "). Se descarga y la instalas encima: no pierdes nada.")
                        .setPositiveButton("Descargar", (d, w) -> external(Uri.parse(APK_URL)))
                        .setNegativeButton("Después", null)
                        .show());
            } catch (Exception ignored) { }
        }).start();
    }

    /* ---------- pantallas ---------- */
    private View buildHome() {
        LinearLayout l = column();
        l.addView(logo());
        l.addView(text("¿A dónde quieres entrar?", 22, Color.WHITE, true), lp(0, 28));
        Button cli = bigButton("📸  Clientes");
        cli.setOnClickListener(v -> open(CLIENTE));
        l.addView(cli, lp(0, 28));
        l.addView(text("Experiencias, paquetes y reservas", 14, BEIGE, false), lp(0, 8));
        Button vip = bigButton("👑  Zona VIP");
        vip.setOnClickListener(v -> open(ZONA));
        l.addView(vip, lp(0, 24));
        l.addView(text("Tu sesión, tus pagos y tus fotos", 14, BEIGE, false), lp(0, 8));
        Button adm = bigButton("🔑  Admin");
        GradientDrawable g = new GradientDrawable(); g.setColor(DARK); g.setStroke(dp(2), BEIGE); g.setCornerRadius(dp(10));
        adm.setBackground(g); adm.setTextColor(Color.WHITE);
        adm.setOnClickListener(v -> open(ADMIN));
        l.addView(adm, lp(0, 24));
        l.addView(text("Solo Nelson y Charlie · con tu huella", 14, BEIGE, false), lp(0, 8));
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
        Button reload = flatButton("↻");
        reload.setContentDescription("Recargar");
        reload.setOnClickListener(v -> { if (current != null) current.reload(); });
        bar.addView(home);
        bar.addView(webTitle, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
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

    private void open(int cual) {
        FrameLayout holder = webWrap.findViewWithTag("holder");
        if (webs[cual] == null) {
            webs[cual] = newWeb();
            webs[cual].loadUrl(cual == ADMIN ? OWNER : cual == ZONA ? VIP : SITE);
            holder.addView(webs[cual]);
        }
        current = webs[cual];
        for (int i = 0; i < webs.length; i++) if (webs[i] != null) webs[i].setVisibility(i == cual ? View.VISIBLE : View.GONE);
        webTitle.setText(cual == ADMIN ? "Admin" : cual == ZONA ? "Zona VIP" : "Clientes");
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
        w.addJavascriptInterface(new Puente(w), "NCApp");
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

    /* ---------- fotos elegidas: guardarlas en la galería y compartirlas a Instagram ---------- */
    private class Puente {
        private final WebView web;
        Puente(WebView w) { web = w; }

        @JavascriptInterface
        public void huella() { runOnUiThread(() -> pedirHuella(web)); }

        @JavascriptInterface
        public void descargar(String json) {
            new Thread(() -> {
                try {
                    JSONObject o = new JSONObject(json);
                    JSONArray fotos = o.getJSONArray("fotos");
                    int total = fotos.length();
                    if (Build.VERSION.SDK_INT < 29 && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        runOnUiThread(() -> ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 7));
                        avisar(total, total, "Acepta el permiso de fotos y vuelve a tocar el botón.");
                        return;
                    }
                    ArrayList<Uri> uris = new ArrayList<>();
                    for (int i = 0; i < total; i++) {
                        avisar(i, total, null);
                        String url = o.getString("base") + "?a=foto&pin=" + enc(o.getString("pin")) + "&id=" + enc(o.getString("id")) + "&f=" + enc(fotos.getString(i));
                        JSONObject r = new JSONObject(bajar(url));
                        if (!r.optBoolean("ok")) continue;
                        byte[] bytes = Base64.decode(r.getString("b64"), Base64.DEFAULT);
                        Uri u = guardar(r.optString("name", "NC_" + i + ".jpg"), r.optString("mime", "image/jpeg"), bytes);
                        if (u != null) uris.add(u);
                    }
                    avisar(total, total, "✓ " + uris.size() + (uris.size() == 1 ? " foto guardada" : " fotos guardadas") + " en tu galería (álbum NC Studio).");
                    if (o.optBoolean("compartir") && !uris.isEmpty()) runOnUiThread(() -> compartir(uris));
                } catch (Exception e) {
                    avisar(1, 1, "No se pudieron descargar: " + e.getMessage());
                }
            }).start();
        }

        private void avisar(int hechas, int total, String msg) {
            String js = "window.ncProgreso && window.ncProgreso(" + hechas + "," + total + "," + (msg == null ? "null" : JSONObject.quote(msg)) + ")";
            runOnUiThread(() -> web.evaluateJavascript(js, null));
        }
    }

    private static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8"); }

    private static String bajar(String url) throws Exception {
        for (int i = 0; i < 5; i++) { // Apps Script redirige a otro dominio: se sigue a mano
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(30000); c.setReadTimeout(120000);
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { url = c.getHeaderField("Location"); c.disconnect(); continue; }
            InputStream in = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            in.close(); c.disconnect();
            return out.toString("UTF-8");
        }
        throw new Exception("demasiadas redirecciones");
    }

    private Uri guardar(String name, String mime, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            v.put(MediaStore.Images.Media.MIME_TYPE, mime);
            v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/NC Studio");
            v.put(MediaStore.Images.Media.IS_PENDING, 1);
            Uri u = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (u == null) return null;
            OutputStream os = getContentResolver().openOutputStream(u);
            os.write(bytes); os.close();
            v.clear(); v.put(MediaStore.Images.Media.IS_PENDING, 0);
            getContentResolver().update(u, v, null, null);
            return u;
        }
        Bitmap bm = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        String s = MediaStore.Images.Media.insertImage(getContentResolver(), bm, name, "NC Studio");
        return s == null ? null : Uri.parse(s);
    }

    private void compartir(ArrayList<Uri> uris) {
        Intent i = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
        i.setType("image/*");
        if (uris.size() == 1) i.putExtra(Intent.EXTRA_STREAM, uris.get(0)); else i.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent ig = new Intent(i).setPackage("com.instagram.android");
        try { startActivity(ig); }
        catch (Exception e) { startActivity(Intent.createChooser(i, "Compartir fotos")); }
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
