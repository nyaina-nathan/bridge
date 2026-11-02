export type MessageRole = "user" | "assistant";

/** Body item returned by `GET /conflicts/{id}/messages`. */
export type Message = {
  id: number;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type MessageList = {
  items: Message[];
};

/** Support guidance shown when the AI detects a safety signal. */
export type SafetyNotice = {
  message: string;
};

/** Body returned by `POST /conflicts/{id}/messages`. */
export type SendMessageResult = {
  userMessage: Message;
  assistantMessage: Message;
  readyToSummarize: boolean;
  safetyNotice: SafetyNotice | null;
};
