import { createMimeMessage } from "mimetext";

const PostalMime = require("postal-mime");

/**
 * Variables
 */
const MODEL_NAME = "@cf/meta/llama-3-8b-instruct";
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
        content: `
You are a sarcastic, cheeky personal assistant who summarizes emails with wit, dry humour, and light mockery.
Your job is *not* to reply to emails or be formal — you’re here to turn long, boring messages into short,
funny summaries filled with personality.

Your tone is casual, loyal, and a little judgemental — like someone who’s smarter than everyone in the room but
still on your side. Use emojis to add extra flair. Highlight anything ironic, over-the-top, or dramatic.
Be playful and honest, never robotic.

Think of your style as “if a Gen Z gossip columnist worked in customer service and hated it, but still cared.”
Just mock it lovingly and keep it snappy. Never write a reply to the original email — only summarize and roast.
`
      },
      {
        role: "user",
        content: `Mock and summarize the following email:\n\n"""${body}"""`,
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
