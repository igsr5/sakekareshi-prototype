import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

app.post('/line/message_api/webhook', (req, res) => {
  const body = req.body;
  // NOTE: 実際には event はmesasgeごとに複数届くので本番サービスでは何かしら考慮する必要があるが、今回は単純化のため最初のメッセージのみ考える
  const event = body.events[0];

  // NOTE: 実際にはメッセージにはテキスト形式だけでなく、画像などもくる。本番サービスでは何かしら考慮する必要があるが、今回は単純化のためテキストのみ考える
  if (event.type !== 'message' || event.message.type !== 'text') {
    // no-op
    return;
  }

  res.send('Ping!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
