import axios from 'axios';
import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

app.post('/line/message_api/webhook', async (req, res) => {
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

  // 返信メッセージの処理パート ======================================================
  const accessToken = await getAccessToken();
  const sendText = `「${text}」と言いましたね？`;
  await pushMessage(accessToken, lineUserId, sendText);

  addUserChatHistory(lineUserId, 'bot', sendText, timestamp);
  // 返信メッセージの処理パート終わり =================================================

  res.send(text);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const userChatHistories: {
  [lineUserId: string]: {
    userType: 'human' | 'bot'; // human → 受信、bot → 返信
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

const pushMessage = async (
  accessToken: AccessToken,
  lineUserId: string,
  sendText: string,
) => {
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: sendText,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken.access_token}`,
        },
      },
    );
  } catch (error) {
    console.error(`Error in pushMessage: ${error}`);
  }
};

type AccessToken = {
  access_token: string;
  expires_in: number;
  token_type: string;
};
const getAccessToken = async (): Promise<AccessToken> => {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.LINE_CHANNEL_ID || '');
    params.append('client_secret', process.env.LINE_CHANNEL_SECRET || '');

    const config = {
      method: 'post',
      url: 'https://api.line.me/v2/oauth/accessToken',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: params,
    };

    const response = await axios(config);
    return response.data as AccessToken;
  } catch (error) {
    console.error(`Error in getAccessToken: ${error}`);
    return { access_token: '', expires_in: 0, token_type: '' };
  }
};
