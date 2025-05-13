// File: index.js
// ---------------------
// A Node.js + WebSocket server for Twilio Voice Streams
// Handles incoming calls, real-time audio streaming, STT → AI chat → TTS, and media playback.

const express = require('express');
const { WebSocketServer } = require('ws');
const { OpenAI } = require('openai');
const { Deepgram } = require('@deepgram/sdk');
const axios = require('axios');

// Initialize services with your API keys via environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 100 human-like outbound greetings
const outboundGreetings = [
  "Hey, did I catch you at a good time?",
  "What’s up? This is Onyx from Apex AI.",
  "Hey there! It’s Onyx—hope I’m not interrupting.",
  "Hi! Onyx here, thought I’d reach out to you.",
  "Good morning! Is now a good time to talk?",
  "Hey! I just wanted to say hello and see how things are going.",
  "Hello! Onyx from Apex AI—got a minute?",
  "Hi, this is Onyx—quick question for you.",
  "Hey, hope you’re well—this is Onyx calling.",
  "What’s going on? It’s Onyx from Apex AI.",
  "Hey! Onyx here—wanted to chat for a sec.",
  "Hi there! Did I catch you at a bad time?",
  "Good afternoon! Onyx calling from Apex AI.",
  "Hello! This is Onyx—how’s your day so far?",
  "Hey, it’s Onyx—got a quick idea to run by you.",
  "Hi! Onyx here and I’ve got something cool to share.",
  "What’s good? Onyx from Apex AI on the line.",
  "Hey, just checking in—Onyx calling.",
  "Hello there! Onyx here, hope I’m not catching you at a bad time.",
  "Hi! Onyx from Apex AI—do you have a second?",
  "Hey, just wanted to reach out—Onyx here.",
  "What’s up? I’m Onyx, and I have a quick question.",
  "Good day! Onyx calling—got a moment for me?",
  "Hey, it’s Onyx—saw something you might like.",
  "Hi there! Onyx from Apex AI—mind if I ask something?",
  "Hey, this is Onyx—are you free now for a quick chat?",
  "Hello! Onyx here—just wanted to connect.",
  "Hi! Onyx from Apex AI—can I steal 30 seconds?",
  "Hey there! Onyx calling—how are you today?",
  "Good morning—Onyx here from Apex AI.",
  "Hello! It’s Onyx, hope your day’s going well.",
  "Hey, Onyx here—wanted to touch base.",
  "Hi! Onyx calling—got a moment?",
  "Hey, just wanted to chat—Onyx here.",
  "Hello! This is Onyx—how’s everything on your end?",
  "Hi there! Onyx from Apex AI—quick talk?",
  "Hey! It’s Onyx—hope I’m not interrupting your day.",
  "What’s up? Onyx here—something you might find interesting.",
  "Hello! Onyx calling—are you available now?",
  "Hi! Onyx from Apex AI—do you have a minute?",
  "Hey, it’s Onyx—can we talk for a moment?",
  "Good afternoon—Onyx calling from Apex AI.",
  "Hello there, Onyx from Apex AI here—got a second?",
  "Hi! Onyx here—want to discuss something quick.",
  "Hey, it’s Onyx—how’s your day treating you so far?",
  "Hello! Onyx here—mind if I ask a quick question?",
  "Hi there! It’s Onyx—any chance you’re free now?",
  "Hey, Onyx from Apex AI—thought I’d reach out.",
  "Hello, this is Onyx—what’s going on today?",
  "Hi! Onyx calling—hope you can chat right now.",
  "Hey, just Onyx here—got a quick moment?",
  "Good morning! Onyx here—got a sec to talk?",
  "Hello there—Onyx from Apex AI, are you free?",
  "Hi! This is Onyx. Do you have a minute?",
  "Hey! Onyx here—how’s everything?",
  "Good day! Onyx from Apex AI—mind chatting?",
  "Hello! This is Onyx—got a moment?",
  "Hey—Onyx calling—can we talk?",
  "Hi there! Onyx here—just wanted to say hi.",
  "What’s up? Onyx here—check this out.",
  "Hi, it’s Onyx—quick chat?",
  "Hey! Onyx from Apex AI—let’s chat.",
  "Hello! Onyx here—how’s work going?",
  "Good afternoon! Onyx from Apex AI—available?",
  "Hey, it’s Onyx—what’s new?",
  "Hi there—Onyx calling—free now?",
  "Hello! This is Onyx—do you have time to talk?",
  "What’s good? Onyx here—got a question.",
  "Hey—Onyx calling—you there?",
  "Hi! Onyx from Apex AI—mind chatting?",
  "Good morning! Onyx here—how can I help?",
  "Hello there—Onyx calling—got a sec?",
  "Hey! This is Onyx—what’s up?",
  "Hi there! Onyx from Apex AI—touching base.",
  "Hello! Onyx here—ready to chat?",
  "Hey—Onyx calling—let’s talk.",
  "Hi! Onyx here—quick check-in.",
  "Hello! This is Onyx—can we talk?",
  "What’s new? Onyx here—got a sec?",
  "Hey, it’s Onyx—interested in a quick chat?",
  "Hi there! Onyx from Apex AI—talk now?",
  "Hello! Onyx here—how are you doing?",
  "Hey there—Onyx calling—free to talk?",
  "Good afternoon! Onyx here—got time now?",
  "Hi! Onyx from Apex AI—mind if I ask?",
  "Hello there! Onyx here—can we chat?",
  "Hey! Onyx calling—what’s going on?",
  "Hi! This is Onyx—hope I didn’t catch you at a bad time.",
  "Hello! Onyx here—do you have a moment?",
  "Hey—Onyx from Apex AI—quick talk?",
  "Hi there! Onyx here—anything new today?"
];

// 100 human-like inbound greetings
const inboundGreetings = [
  "Hey there! Onyx here at Apex AI Solutions, how can I help you today?",
  "Hi, you’ve reached Onyx at Apex AI—what can I do for you?",
  "Hello! This is Onyx speaking, how may I assist you?",
  "Good [morning/afternoon/evening]! Onyx here—what can I help with?",
  "Thanks for calling Apex AI Solutions—Onyx speaking, how can I assist?",
  "Hi there, Onyx from Apex AI—how’s it going?",
  "Hello! Onyx here—what can I do for you today?",
  "Onyx here at Apex AI—how may I help today?",
  "Hi, Onyx on the line—what’s up?",
  "Thanks for calling—Onyx here, how can I help?",
  "Hello! You’ve reached Onyx at Apex AI—how can I assist you?",
  "Good day! Onyx speaking—how may I be of service?",
  "Hi, this is Onyx—how can I help you today?",
  "Hey there! Onyx at your service—what do you need?",
  "Hello! It’s Onyx—what can I assist you with?",
  "Onyx here—thanks for calling. How can I help?",
  "Hi! Onyx from Apex AI—what can I do for you?",
  "Hello, Onyx here—what brings you to us today?",
  "Good [morning/afternoon/evening]! Onyx here—what can I do for you?",
  "Thanks for calling Apex AI—Onyx speaking. How can I assist?",
  "Hello, this is Onyx—what can I help you with today?",
  "Onyx here—thank you for calling. How may I help?",
  "Hi! You’re through to Onyx—how can I assist today?",
  "Hello there, Onyx from Apex AI—how can I make your day easier?",
  "Good [morning/afternoon/evening]! This is Onyx—how can I help?",
  "Thanks for calling—Onyx here, ready to assist. What can I do?",
  "Hi there! Onyx at Apex AI—what can I do for you?",
  "Hello! It’s Onyx—how may I assist you today?",
  "Onyx here—thank you for reaching out. What can I help with?",
  "Hello, this is Onyx—how can I support you today?",
  "Hi! Onyx speaking—how may I help?",
  "Thank you for calling Apex AI—Onyx here. How can I assist?",
  "Hello there! Onyx from Apex AI—what do you need help with?",
  "Onyx here—what can I do for you today?",
  "Good [morning/afternoon/evening]! Onyx speaking—how may I help?",
  "Hi! You’ve reached Onyx—what can I assist you with?",
  "Hello! Onyx here at Apex AI—how can I be of service?",
  "Onyx at your service—what can I help with today?",
  "Hi there, this is Onyx—how can I support you?",
  "Hello! Thanks for calling—Onyx here, how can I help?",
  "Good day! Onyx speaking—what can I do for you?",
  "Hi! Onyx here—what can I assist you with today?",
  "Hello! This is Onyx—how may I assist?",
  "Onyx here—thank you for calling. How can I help?",
  "Hi there! Onyx at Apex AI—what do you need assistance with?",
  "Hello, Onyx here—how may I be of service?",
  "Thank you for calling! Onyx speaking—how can I help?",
  "Good [morning/afternoon/evening]! Onyx here—what can I do for you?",
  "Hi! You’re through to Onyx—how can I assist today?",
  "Hello! Onyx from Apex AI—what do you need help with today?",
  "Onyx here at your service—how can I help?",
  "Hi there! This is Onyx—how can I assist you?",
  "Hello! Onyx speaking—what can I do for you?",
  "Onyx here—thanks for calling. What can I help you with?",
  "Hi! Onyx from Apex AI—how may I assist?",
  "Good day! Onyx here—how can I be of service?",
  "Hello! You’ve reached Onyx—what can I do for you today?",
  "Onyx here—what can I help you with today?",
  "Hi! Onyx speaking—what brings you to Apex AI today?",
  "Hello there, this is Onyx—how can I assist you?",
  "Onyx at your service—what can I do to help?",
  "Hi! Onyx here—how may I assist you?",
  "Hello! Onyx from Apex AI—how can I help you today?",
  "Thank you for calling—Onyx speaking. How may I help?",
  "Onyx here—what can I assist you with today?",
  "Hi there! It’s Onyx—how can I support you?",
  "Hello! Onyx here—what can I do to help?",
  "Onyx here—how can I make your day better?",
  "Hi! You’ve reached Onyx—what can I assist you with today?",
  "Hello, this is Onyx—how may I help you today?",
  "Onyx here—thank you for calling Apex AI. What can I do?",
  "Hi there! Onyx speaking—how can I help you?",
  "Hello! Onyx here—what assistance can I provide?",
  "Onyx at Apex AI—how may I help you today?",
  "Good [morning/afternoon/evening]! Onyx here—how can I assist?",
  "Hi! Onyx here—what can I do for you today?",
  "Hello! Onyx speaking—how may I assist you?",
  "Onyx here—what can I help you with?",
  "Hi there! Onyx at Apex AI—how can I be of service?",
  "Hello, this is Onyx—what can I help you with today?",
  "Onyx here—thanks for reaching out. How can I assist?",
  "Hi! Onyx here—what do you need help with?",
  "Hello! Onyx speaking—how can I support you today?",
  "Onyx here—what can I do for you?",
  "Hi there! Onyx here—how may I help?",
  "Hello! Onyx at your service—what can I assist with?",
  "Onyx speaking—how can I help you?",
  "Hi! Onyx here—what brings you to Apex AI today?",
  "Hello there! Onyx here—how may I assist?",
  "Onyx here—thanks for calling. What can I do for you?",
  "Hi! Onyx at Apex AI—how can I support you?",
  "Hello! This is Onyx—what can I help with?",
  "Onyx here—how can I assist you today?",
  "Hi there! Onyx speaking—what do you need assistance with?",
  "Hello! Onyx here—thank you for calling. How can I help?",
  "Onyx here—what can I do to assist you?"
];

// Handle incoming-call
app.post('/incoming-call', (req, res) => {
  const direction = req.body.Direction || 'outbound-api';
  const pool = direction === 'inbound' ? inboundGreetings : outboundGreetings;
  const greeting = pool[Math.floor(Math.random() * pool.length)];
  const twiml = `
    <Response>
      <Say voice=\"Polly.Matthew\">${greeting}</Say>
      <Start>
        <Stream url=\"wss://${process.env.RENDER_EXTERNAL_URL}/media-stream\" />
      </Start>
    </Response>`;
  res.type('application/xml').send(twiml);
});

// Health check
app.get('/', (req, res) => res.send('OK'));

// WebSocket setup
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/media-stream') {
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  } else socket.destroy();
});

// AI session state & processing
const sessions = {};
wss.on('connection', ws => {
  let streamSid;
  console.log('Media stream connected');
  ws.on('message', async msg => {
    const data = JSON.parse(msg);
    if (data.event === 'start') {
      streamSid = data.streamSid;
      sessions[streamSid] = [{ role: 'system', content: 'You are a friendly sales AI calling leads in Indiana.' }];
      return;
    }
    if (data.event === 'media') {
      try {
        const audioBuffer = Buffer.from(data.media.payload, 'base64');
        const dgRes = await deepgram.transcription.preRecorded({ buffer: audioBuffer, mimetype: 'audio/wav' }, { punctuate: true });
        const transcript = dgRes.results.channels[0].alternatives[0].transcript;
        sessions[streamSid].push({ role: 'user', content: transcript });
        const chatRes = await openai.chat.completions.create({ model: 'gpt-4o', messages: sessions[streamSid] });
        const aiReply = chatRes.choices[0].message.content;
        sessions[streamSid].push({ role: 'assistant', content: aiReply });
        const voiceId = process.env.ELEVENLABS_VOICE_ID;
        const elevenRes = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, { text: aiReply }, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, responseType: 'arraybuffer' });
        const audioB64 = Buffer.from(elevenRes.data, 'binary').toString('base64');
        ws.send(JSON.stringify({ event: 'media', media: { payload: audioB64 } }));
      } catch (err) {
        console.error('Processing error:', err);
      }
    }
    if (data.event === 'stop') {
      delete sessions[streamSid];
      ws.close();
    }
  });
});
