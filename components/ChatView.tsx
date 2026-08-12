"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import { IconSparkles } from "./icons";
import type { UiMessage } from "./types";

export default function ChatView({
  messages,
  currentModel,
}: {
  messages: UiMessage[];
  currentModel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  });

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < 120;
  };

  if (!messages.length) {
    return (
      <div className="chat-scroll">
        <div className="empty">
          <div className="empty-mark">
            <IconSparkles size={30} />
          </div>
          <h1>Start a conversation</h1>
          <p>
            Chat with your local Ollama model. Ask anything, or upload a PDF,
            DOCX, or text file and I'll use it as context.
          </p>
          {currentModel && (
            <span className="empty-model">
              <IconSparkles size={13} />
              {currentModel}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
      <div className="chat-col">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}
