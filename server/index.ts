import axios from 'axios';
import express from 'express';
import { Configuration, OpenAIApi } from 'openai';

const app = express();
const port = 3000;

app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});
const openai = new OpenAIApi(configuration);

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

  // 返信メッセージの生成処理パート ======================================================
  const gptMessages = convertChatHistoryToGptFormat(
    userChatHistories[lineUserId],
  );
  // FIXME: たまにタイムアウトすることがある
  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    temperature: 1,
    messages: [
      {
        role: 'system',
        content:
          'あなたは日本人です。陽気なおじさんです。私の友達として会話してください。ただし、語尾は常に「~だっちゃ！」とつけること。',
      },
      ...gptMessages,
    ],
  });
  const sendText = completion.data.choices[0].message?.content;
  // 返信メッセージの生成処理パート ======================================================

  // 返信メッセージの送信処理パート ======================================================
  if (!!sendText) {
    const accessToken = await getAccessToken();
    await pushMessage(accessToken, lineUserId, sendText);

    addUserChatHistory(lineUserId, 'bot', sendText, timestamp);
  }
  // 返信メッセージの送信処理パート終わり =================================================

  res.send(text);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

type ChatHistoryEntry = {
  userType: 'human' | 'bot';
  message: string;
  timestamp: number;
};

const userChatHistories: {
  [lineUserId: string]: ChatHistoryEntry[];
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

type GptMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const convertChatHistoryToGptFormat = (
  chatHistory: ChatHistoryEntry[],
): GptMessage[] => {
  // timestampでソート
  chatHistory.sort((a, b) => a.timestamp - b.timestamp);

  const gptChatHistory = chatHistory.map((chatEntry): GptMessage => {
    const role = chatEntry.userType === 'human' ? 'user' : 'assistant';
    return {
      role,
      content: chatEntry.message,
    };
  });

  return gptChatHistory;
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
