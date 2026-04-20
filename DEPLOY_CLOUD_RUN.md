# Deploy to Google Cloud Run (Webhook Backend)

This repo contains:
- A **Next.js** frontend (`npm run dev`)
- A **backend webhook** server in `whatsapp/whatsapp.ts` (Express `POST /webhook`)

This guide deploys the **backend webhook** to **Google Cloud Run**.

---

## Prereqs

- Install and authenticate the Google Cloud CLI:
  - `gcloud auth login`
  - `gcloud auth application-default login`
- Pick:
  - `PROJECT_ID` (your GCP project)
  - `REGION` (e.g. `asia-southeast1`)
  - `SERVICE_NAME` (e.g. `kai-webhook`)

Enable required APIs:

```bash
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com
```

If Firestore is not enabled yet, create it once (choose a region close to Cloud Run):

```bash
gcloud firestore databases create --location="$REGION"
```

---

## 1) Store secrets in Secret Manager

Create secrets:

```bash
printf %s "$GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-
printf %s "$TWILIO_ACCOUNT_SID" | gcloud secrets create TWILIO_ACCOUNT_SID --data-file=-
printf %s "$TWILIO_AUTH_TOKEN" | gcloud secrets create TWILIO_AUTH_TOKEN --data-file=-
```

If the secret already exists, update it:

```bash
printf %s "$GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
printf %s "$TWILIO_ACCOUNT_SID" | gcloud secrets versions add TWILIO_ACCOUNT_SID --data-file=-
printf %s "$TWILIO_AUTH_TOKEN" | gcloud secrets versions add TWILIO_AUTH_TOKEN --data-file=-
```

---

## 2) Deploy to Cloud Run (build from source)

From the repo root:

```bash
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest"
```

Notes:
- Cloud Run automatically sets `PORT` at runtime. The server uses `process.env.PORT` (defaults to `8080` locally).
- `--allow-unauthenticated` is needed for Twilio to reach your webhook.

---

## 3) Grant the Cloud Run runtime identity access to Firestore

Cloud Run runs as a service account. Find it:

```bash
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(spec.template.spec.serviceAccountName)"
```

If it prints nothing, the default is:

```bash
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

Grant Firestore access (choose least-privilege for your needs):

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/datastore.user"
```

---

## 4) Configure Twilio webhook URL

In Twilio WhatsApp config, set the incoming message webhook to:

`https://<your-cloud-run-url>/webhook`

You can verify the service responds:

- `GET /` → `KAI bot is running`
- `POST /webhook` → TwiML response (requires Twilio-style form fields)

