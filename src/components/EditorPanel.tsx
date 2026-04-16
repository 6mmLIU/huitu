'use client';

import type { ErrorResponse } from '@/lib/error-handler';
import { ERROR_CODES, isErrorResponse } from '@/lib/error-handler';
import { useState } from 'react';
import styles from './EditorPanel.module.css';

export interface EditorPanelProps {
  onGenerate: (text: string) => void;
  isLoading?: boolean;
  /** Error response from the last generate attempt */
  error?: ErrorResponse | null;
  /** Called when the user clicks the retry button */
  onRetry?: () => void;
  /** Called when the user dismisses the error banner */
  onDismissError?: () => void;
}

export default function EditorPanel({
  onGenerate,
  isLoading = false,
  error = null,
  onRetry,
  onDismissError,
}: EditorPanelProps) {
  const [text, setText] = useState('');

  const handleGenerate = () => {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      onGenerate(trimmed);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>PaperFlow Editor</span>
      </div>

      {/* Error banner */}
      {error && isErrorResponse(error) && (
        <div className={styles.errorBanner} role="alert" aria-live="assertive">
          <div className={styles.errorContent}>
            <span className={styles.errorMessage}>{error.error.message}</span>

            {/* Suggestions for parse failures */}
            {error.error.code === ERROR_CODES.PARSE_FAILED &&
              error.error.suggestions &&
              error.error.suggestions.length > 0 && (
                <ul className={styles.errorSuggestions}>
                  {error.error.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
          </div>

          <div className={styles.errorActions}>
            {/* Retry button for retryable errors (LLM timeout, LLM error, schema invalid) */}
            {error.error.retryable && onRetry && (
              <button
                className={styles.retryButton}
                onClick={onRetry}
                aria-label="Retry generation"
              >
                重试
              </button>
            )}
            {onDismissError && (
              <button
                className={styles.dismissButton}
                onClick={onDismissError}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      <div className={styles.editorArea}>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此输入自然语言描述，例如：首先读取数据，然后判断数据是否有效，如果有效则处理数据，否则报告错误，最后结束流程。"
          disabled={isLoading}
          aria-label="Natural language input for flowchart generation"
        />
      </div>
      <div className={styles.footer}>
        <button
          className={styles.generateButton}
          onClick={handleGenerate}
          disabled={isLoading || text.trim().length === 0}
          aria-label="Generate flowchart"
        >
          {isLoading ? '生成中...' : '生成'}
        </button>
      </div>
    </div>
  );
}
