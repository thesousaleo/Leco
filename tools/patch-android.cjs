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
