import 'dotenv/config';
import { GoogleAuth } from 'google-auth-library';
import https from 'https';

async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT!;
  console.log("Project:", projectId);

  const auth = new GoogleAuth({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });

  const token = await auth.getAccessToken();
  console.log("Got access token:", token ? "YES" : "NO");

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/test`;
  console.log("Calling:", url);

  await new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log("HTTP Status:", res.statusCode);
        console.log("Response:", body.slice(0, 300));
        resolve(null);
      });
    });
    req.write(JSON.stringify({ fields: { hello: { stringValue: "world" } } }));
    req.end();
  });
}

main().catch(console.error);
