"use client";

import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageBubble } from "@/components/MessageBubble";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { staggerContainerVariants } from "@/lib/motion";
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
        <motion.div
          className="message-list"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence initial={false}>
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
            {isWaitingForFirstToken ? (
              <ThinkingIndicator key="thinking-indicator" model={selectedModel} />
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
