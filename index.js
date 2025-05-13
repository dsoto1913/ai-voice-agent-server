// File: index.js
// ----------------
// State‑of‑the‑Art AI Sales Agent “Onyx” Brain with Dynamic Memory

const express = require('express');
const { WebSocketServer } = require('ws');
const { OpenAI } = require('openai');
const { Deepgram } = require('@deepgram/sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// —— Dynamic Memory Store ——
const MEMORY_FILE = path.resolve(__dirname, 'memory.json');
let memory = {};
try {
  memory = JSON.parse(fs.readFileSync(MEMORY_FILE));
} catch {
  memory = {};
}
function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// —— Services Initialization ——
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

// —— Express + WebSocket Setup ——
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/media-stream') {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// —— Greeting Pools: 100 Outbound & 100 Inbound ——
const outboundGreetings = [
  "Yooo! Did I catch you at a good time?",
  "Heeeyyyyy, this is Onyx from Apex AI!",
  "Sup? Onyx here—hope your day’s awesome!",
  "Heyyy, got a sec? I’m Onyx.",
  "Yo! Quick question for you—Onyx calling!",
  "Hi there—Onyx here, hope I’m not interrupting.",
  "Hey! Onyx from Apex AI—got a minute?",
  "What’s up? This is Onyx on the line.",
  "Heeey, thought I’d check in—Onyx here.",
  "Yo! Onyx here, can we chat real quick?",
  // … repeat or add until you have 100 unique lines …
];

const inboundGreetings = [
  "Yoooo, thanks for calling Apex AI—Onyx speaking!",
  "Heeeyyyyy, you’ve reached Onyx—what’s up?",
  "Sup? This is Onyx at Apex AI—how can I help?",
  "Heyyy! Onyx on the line—what’s on your mind?",
  "Yo! Onyx here—thanks for calling.",
  "Hi there—Onyx from Apex AI speaking.",
  "Hey, it’s Onyx—what can I do for you today?",
  "What’s good? Onyx here—how may I assist?",
  "Hello! Onyx at your service—what do you need?",
  "Thanks for calling—Onyx here, how can I help?",
  // … repeat or add until you have 100 unique lines …
];

// —— Twilio Incoming‑Call Handler ——
app.post('/incoming-call', (req, res) => {
  const direction = req.body.Direction || 'outbound-api';
  const pool = direction === 'inbound' ? inboundGreetings : outboundGreetings;
  const greeting = pool[Math.floor(Math.random() * pool.length)];

  const twiml = `
<Response>
  <Say voice="Polly.Matthew">${greeting}</Say>
  <Start>
    <Stream url="wss://${process.env.RENDER_EXTERNAL_URL}/media-stream"/>
  </Start>
</Response>`;
  res.type('application/xml').send(twiml);
});

app.get('/', (req, res) => res.send('OK'));

// —— Session & Streaming Logic ——
const sessions = {};

wss.on('connection', ws => {
  let sid;

  ws.on('message', async raw => {
    const data = JSON.parse(raw);

    // Stream start
    if (data.event === 'start') {
      sid = data.streamSid;
      sessions[sid] = [{
        role: 'system',
        content: `
You are Onyx, a state-of-the-art AI sales agent:
- Persona: Charismatic, empathetic, consultative.
- Goal: Build rapport, qualify needs, pitch Apex AI marketing solutions.
- Tone: Human-like, slight humor, upbeat, never robotic.
- Behavior: Ask open-ended questions, handle objections gracefully.
`.trim()
      }];
      return;
    }

    // Audio media
    if (data.event === 'media') {
      try {
        // Decode audio (μ-law @ 8000 Hz)
        const audioBuf = Buffer.from(data.media.payload, 'base64');
        const dgRes = await deepgram.transcription.preRecorded(
          { buffer: audioBuf, mimetype: 'audio/raw;encoding=mulaw;rate=8000' },
          { punctuate: true }
        );
        const question = dgRes.results.channels[0].alternatives[0].transcript;

        // Memory lookup or AI chat
        let answer;
        if (memory[question]) {
          const variants = memory[question];
          answer = variants[Math.floor(Math.random() * variants.length)];
        } else {
          sessions[sid].push({ role: 'user', content: question });
          const chat = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: sessions[sid]
          });
          answer = chat.choices[0].message.content;
          memory[question] = memory[question] || [];
          memory[question].push(answer);
          saveMemory();
        }

        sessions[sid].push({ role: 'assistant', content: answer });

        // TTS via ElevenLabs
        const ttsRes = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
          { text: answer },
          {
            headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
            responseType: 'arraybuffer'
          }
        );
        const ttsB64 = Buffer.from(ttsRes.data, 'binary').toString('base64');

        ws.send(JSON.stringify({
          event: 'media',
          media: { payload: ttsB64 }
        }));

      } catch (err) {
        console.error('Processing error:', err);
      }
    }

    // Stream stop
    if (data.event === 'stop') {
      delete sessions[sid];
      ws.close();
    }
  });
});
