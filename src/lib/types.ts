export interface FileAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  kind: "text" | "image" | "pdf";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  vision: boolean;
}
