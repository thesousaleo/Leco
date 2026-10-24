// Ajustes no projeto Android gerado pelo Capacitor:
// abre o app quando o login do Google volta para br.com.leco.app://auth
const fs = require('fs');
const file = 'android/app/src/main/AndroidManifest.xml';
let xml = fs.readFileSync(file, 'utf8');
if (!xml.includes('android:scheme="br.com.leco.app"')) {
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="br.com.leco.app" android:host="auth" />
            </intent-filter>
`;
  const i = xml.indexOf('</activity>');
  if (i < 0) throw new Error('AndroidManifest sem <activity>');
  xml = xml.slice(0, i) + filter + '        ' + xml.slice(i);
  fs.writeFileSync(file, xml);
}
console.log('AndroidManifest ajustado');

// Tela cheia (edge-to-edge): o app desenha atrás da barra de status, da câmera e da barra de navegação.
// O Android informa o tamanho dessas áreas e o app recebe em --safe-top/--safe-bottom/... para não esconder nada.
const path = require('path');
const actDir = 'android/app/src/main/java/br/com/leco/app';
const act = path.join(actDir, 'MainActivity.java');
fs.mkdirSync(actDir, { recursive: true });
fs.writeFileSync(act, `package br.com.leco.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private String insetsJs = null;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        ctl.setAppearanceLightStatusBars(true);
        ctl.setAppearanceLightNavigationBars(true);

        final WebView wv = getBridge().getWebView();
        wv.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setDarkBars(boolean dark) { MainActivity.this.setDarkBars(dark); }
            @JavascriptInterface
            public void setSecure(boolean on) { MainActivity.this.setSecure(on); }
        }, "LecoAndroid");
        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, insets) -> {
            Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            float d = getResources().getDisplayMetrics().density;
            insetsJs = String.format(Locale.US,
                "(function(){var s=document.documentElement.style;s.setProperty('--safe-top','%.1fpx');s.setProperty('--safe-bottom','%.1fpx');s.setProperty('--safe-left','%.1fpx');s.setProperty('--safe-right','%.1fpx');window.LECO_INSETS=true;})()",
                i.top / d, i.bottom / d, i.left / d, i.right / d);
            pushInsets();
            return insets;
        });
    }

    // Reenvia algumas vezes: a página pode ainda estar carregando quando o Android informa as áreas.
    private void pushInsets() {
        if (insetsJs == null) return;
        final WebView wv = getBridge().getWebView();
        long[] delays = {0, 300, 1000, 2500, 5000};
        for (long ms : delays) handler.postDelayed(() -> wv.evaluateJavascript(insetsJs, null), ms);
    }

    @Override
    public void onResume() {
        super.onResume();
        pushInsets();
    }

    // Com PIN ativo, o conteúdo não aparece na tela de apps recentes nem em capturas
    public void setSecure(boolean on) {
        runOnUiThread(() -> {
            if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        });
    }

    // Ícones da barra de status claros ou escuros conforme o tema do app
    public void setDarkBars(boolean dark) {
        runOnUiThread(() -> {
            WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            ctl.setAppearanceLightStatusBars(!dark);
            ctl.setAppearanceLightNavigationBars(!dark);
        });
    }
}
`);
console.log('MainActivity em tela cheia');
