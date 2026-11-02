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
