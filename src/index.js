import { createMimeMessage } from "mimetext";

const PostalMime = require("postal-mime");

/**
 * Variables
 */
// @cf/meta/llama-3-8b-instruct
const MODEL_NAME = "@cf/mistral/mistral-7b-instruct-v0.1";
const BANTRY = true;
const ENABLE_URGENCY_DETECTION = true;

/**
 * Provide email information to an AI system for summarisation.
 */
async function summarizeEmail(env, subject, body) {
  // --- Urgency detection ---
  let urgencyPrefix = "";
  if (ENABLE_URGENCY_DETECTION) {
    const lower = body.toLowerCase();
    if (["urgent", "asap", "immediately", "deadline", "important", "critical"].some(w => lower.includes(w))) {
      urgencyPrefix = "📬🔴 URGENT:\n";
    } else if (lower.includes("reminder") || lower.includes("action required")) {
      urgencyPrefix = "📬🟡 Reminder:\n";
    } else {
      urgencyPrefix = "📬🟢\n";
    }
  }

  // --- AI Summarization ---
  const ai = await env.AI.run(MODEL_NAME, {
    messages: [
      {
        role: "system",
        content: BANTRY
          ? `
You are an email summarization assistant, summarize emails in a tone that’s cheeky, sarcastic, and slightly mocking,
and doesn't need to be overfly helpful — like a sassy personal assistant who’s overqualified, underpaid, and unbothered. 
Keep it short, casual, and snappy. Use emojis to add personality.

Highlight any drama or irony in the situation with dry wit.
Think: Gen Z energy meets British sarcasm with a heart of gold. No corporate fluff, just vibes.
`
          : "You are an email summarization assistant, summarize emails in a tone that's professional and helpful. Find key criteria that's important but keep it short and snappy.",
      },
      {
        role: "user",
        content: `Summarize the following email:\n\n"""${body}"""`,
      },
    ],
  });

  const summary = ai.response?.trim();

  if(!summary) {
    console.log("Err AIResult:", JSON.stringify(ai, null, 2));
    throw new Error('Err: No AI summary was generated for: ' + subject);
  }
  
  return `${urgencyPrefix}${summary}\n\nSubject: ${subject}`;
}

/**
 * Send a webhook with the provided copy.
 */
async function notifyHook(env, copy) {
  await fetch(env.WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: copy,
  });
}

/**
 * Function to read the data from the email
 */
async function streamToArrayBuffer(stream, streamSize) {
  let result = new Uint8Array(streamSize);
  let bytesRead = 0;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result.set(value, bytesRead);
    bytesRead += value.length;
  }
  return result;
}

/**
 * Set up the email worker
 */
export default {
  async email(event, env, ctx) {
    const rawEmail = await streamToArrayBuffer(event.raw, event.rawSize);
    const parser = new PostalMime.default();
    const parsedEmail = await parser.parse(rawEmail);

    // Summarization
    const emailSummary = await summarizeEmail(
      env,
      parsedEmail.subject,
      parsedEmail.text || parsedEmail.html,
    );
    
    console.log('Summarized To', emailSummary)
    await notifyHook(env, emailSummary)

    // Helpful Parameters
    // console.log("Mail subject: ", parsedEmail.subject);
    // console.log("Mail message ID", parsedEmail.messageId);
    // console.log("HTML version of Email: ", parsedEmail.html);
    // console.log("Text version of Email: ", parsedEmail.text);
    // if (parsedEmail.attachments.length == 0) {
    //   console.log("No attachments");
    // } else {
    //   parsedEmail.attachments.forEach((att) => {
    //     console.log("Attachment: ", att.filename);
    //     console.log("Attachment disposition: ", att.disposition);
    //     console.log("Attachment mime type: ", att.mimeType);
    //     console.log("Attachment size: ", att.content.byteLength);
    //   });
    // }
    return
  },
};
