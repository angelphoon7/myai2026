import 'dotenv/config';
import express, { Request, Response } from "express";
import { getAIResponse } from "./ai";

const app = express();
app.use(express.urlencoded({ extended: false }));

function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

app.post("/webhook", async (req: Request, res: Response) => {
  try {
    const incomingMsg = req.body.Body || "";
    console.log("Incoming:", incomingMsg);

    const aiReply = await getAIResponse(incomingMsg);
    console.log("AI reply:", aiReply);

    const safeReply = escapeXml(aiReply);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safeReply}</Message>
</Response>`;

    res.set("Content-Type", "text/xml");
    res.status(200).send(twiml);
  } catch (error) {
    console.error("Webhook error:", error);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, KAI hit an error. Please try again.</Message>
</Response>`;

    res.set("Content-Type", "text/xml");
    res.status(200).send(twiml);
  }
});

app.get("/", (_req: Request, res: Response) => {
  res.send("KAI bot is running");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});