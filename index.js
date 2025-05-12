// File: index.js
// A minimal Node.js + WebSocket server for Twilio Voice Streams

const express = require('express');
const { WebSocketServer } = require('ws');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Twilio will POST here to start the media stream
app.post('/incoming-call', (req, res) => {
  const twiml = `
    <Response>
      <Start>
        <Stream url="wss://${process.env.RENDER_EXTERNAL_URL}/media-stream"/>
      </Start>
      <Say voice="Polly.Matthew">Connecting you to our AI agent now.</Say>
    </Response>`;
  res.type('application/xml').send(twiml);
});

// Health check
app.get('/', (req, res) => res.send('OK'));

// Start HTTP server
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// Upgrade `/media-stream` to WebSocket
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/media-stream') {
    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle incoming media
wss.on('connection', (ws) => {
  console.log('Media stream connected');
  ws.on('message', async (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'start') {
      console.log('Stream ' + data.streamSid + ' started');
    }
    // …snip…
    if (data.event === 'stop') {
      console.log('Stream ' + data.streamSid + ' ended');
      ws.close();
    }
  });
});
