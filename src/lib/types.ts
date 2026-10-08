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
  /** Display name of the model that generated an assistant reply. */
  model?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type ProviderRoute = "nara" | "openrouter";

export interface AppNotification {
  id: string;
  kind: "limit" | "global" | "failover" | "info";
  message: string;
  createdAt: number;
  read: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  route: ProviderRoute;
  description: string;
  vision: boolean;
}
