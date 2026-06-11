"use client";

import type { RefObject } from "react";
import { MessageBubble } from "@/components/MessageBubble";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import type { UiMessage } from "@/store/useChatStore";
import type { AionModelId } from "@/types/aion";

type MessageListProps = {
  messages: UiMessage[];
  isLoading: boolean;
  selectedModel: AionModelId;
  debugEnabled: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function MessageList({
  messages,
  isLoading,
  selectedModel,
  debugEnabled,
  scrollRef
}: MessageListProps) {
  const lastMessage = messages[messages.length - 1];
  const isWaitingForFirstToken =
    isLoading &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      (lastMessage.role === "assistant" &&
        !lastMessage.content.trim() &&
        !lastMessage.workLog?.length &&
        !lastMessage.webSearchActivity));

  return (
    <div className="chat-scroll" ref={scrollRef}>
      <div className="conversation">
        <div className="message-list">
          {messages.map((message, index) =>
            isLoading &&
            message.role === "assistant" &&
            !message.content.trim() &&
            !message.workLog?.length &&
            !message.webSearchActivity ? null : (
              <MessageBubble
                key={message.id}
                message={message}
                fallbackModel={selectedModel}
                debugEnabled={debugEnabled}
                isStreaming={
                  isLoading &&
                  index === messages.length - 1 &&
                  message.role === "assistant" &&
                  Boolean(message.content.trim())
                }
              />
            )
          )}
          {isWaitingForFirstToken ? <ThinkingIndicator model={selectedModel} /> : null}
        </div>
      </div>
    </div>
  );
}
