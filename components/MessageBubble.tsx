"use client";

import Markdown from "./Markdown";
import { IconSparkles } from "./icons";
import { formatTime } from "./format";
import type { UiMessage } from "./types";

export default function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  const streaming = message.status === "streaming";
  const isError = message.status === "error";

  return (
    <div className={`msg ${isUser ? "user" : "assistant"}`}>
      {!isUser && (
        <div className="msg-avatar">
          <IconSparkles size={15} />
        </div>
      )}
      <div className="msg-body">
        <div className="msg-content">
          {message.content ? (
            <Markdown>{message.content}</Markdown>
          ) : streaming ? (
            <span className="msg-thinking">
              Thinking
              <span className="dots">
                <span />
                <span />
                <span />
              </span>
            </span>
          ) : null}
          {streaming && !!message.content && <span className="caret" />}
        </div>
        {isError && <div className="msg-error">{message.error}</div>}
        {!!message.content && !streaming && (
          <div className="msg-time">{formatTime(message.createdAt)}</div>
        )}
      </div>
    </div>
  );
}
