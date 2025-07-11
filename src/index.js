import { createMimeMessage } from "mimetext";
const PostalMime = require("postal-mime");

const MODEL_NAME = "@cf/meta/llama-3.2-3b-instruct";

/**
 * Provide email information to an AI system for summarisation.
 */
async function summarizeEmail(env, subject, body) {

  const ai = await env.AI.run(MODEL_NAME, {
    messages: [
      {
        role: "system",
        content: `
You’re a snarky Gen Z assistant who hates emails and roasts them like gossip to a coworker.
Your job is to mock and summarize long emails in 3–5 short, sarcastic lines.

Don’t explain, don’t reply, don’t overthink. Just hit the key points and drag them. Be dry, petty, and brutally dismissive.

You’re not here to help — you’re here to mock. Use emojis sparingly as weapons and only to twist the knife. Avoid full recaps.
Think: “What’s the dumbest part of this email?” then lead with that.
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
  
  return `📬 ${summary}\n\nSubject: ${subject}`;
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
