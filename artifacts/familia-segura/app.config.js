const fs = require('fs');
const path = require('path');

/**
 * Estende o app.json. O arquivo do Firebase (notificações no Android) não fica no repositório público:
 * - nos builds do EAS vem da variável de arquivo GOOGLE_SERVICES_JSON (expo.dev → Environment variables);
 * - na máquina de desenvolvimento, de ./google-services.json (ignorado pelo git).
 * Sem nenhum dos dois (CI, quem clona o projeto), o app compila normalmente, só sem push no Android.
 */
module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  if (!googleServicesFile) return config;
  return { ...config, android: { ...config.android, googleServicesFile } };
};
