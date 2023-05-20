import express from 'express';

const app = express();
const port = 3000;

const userChatHistories: {
  [lineUserId: string]: {
    userType: 'human' | 'bot';
    message: string;
    timestamp: EpochTimeStamp;
  }[];
} = {};
// NOTE: 実際には何かしらの形で永続化される必要があるが、今回は単純化のためにon memoryで管理する
const addUserChatHistory = (
  lineUserId: string,
  userType: 'human' | 'bot',
  message: string,
  timestamp: EpochTimeStamp,
) => {
  if (!userChatHistories[lineUserId]) {
    userChatHistories[lineUserId] = [{ userType, message, timestamp }];
  } else {
    userChatHistories[lineUserId].push({ userType, message, timestamp });
  }
};

app.use(express.json());

app.post('/line/message_api/webhook', (req, res) => {
  // 前処理パート ================================================================
  const body = req.body;
  // NOTE: 実際には event はmesasgeごとに複数届くので本番サービスでは何かしら考慮する必要があるが、今回は単純化のため最初のメッセージのみ考える
  const event = body.events[0];

  // NOTE: 実際にはメッセージにはテキスト形式だけでなく、画像などもくる。本番サービスでは何かしら考慮する必要があるが、今回は単純化のためテキストのみ考える
  if (event.type !== 'message' || event.message.type !== 'text') {
    // no-op
    return;
  }
  // 前処理パート終わり ============================================================

  // 受信メッセージの処理パート ======================================================
  const lineUserId = event.source.userId;
  const text = event.message.text;
  const timestamp = event.timestamp;

  addUserChatHistory(lineUserId, 'human', text, timestamp);
  // 受信メッセージの処理パート終わり =================================================

  // WIP:
  // 返信メッセージの処理パート ======================================================
  // 返信メッセージの処理パート終わり =================================================
  res.send(text);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
