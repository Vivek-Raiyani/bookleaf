'use client';

import React from 'react';

interface FormattedTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function FormattedText({ text, className, style }: FormattedTextProps) {
  if (!text) return null;

  // Split into paragraphs by double newlines
  const paragraphs = text.split(/\n\s*\n/);

  return (
    <div className={className} style={style}>
      {paragraphs.map((paragraph, pIdx) => {
        const lines = paragraph.split('\n');

        return (
          <p
            key={pIdx}
            style={{
              marginBottom: pIdx < paragraphs.length - 1 ? 12 : 0,
              lineHeight: 1.65,
            }}
          >
            {lines.map((line, lIdx) => {
              // Parse **bold** and *italic*
              const parts: React.ReactNode[] = [];
              const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
              let lastIndex = 0;
              let match: RegExpExecArray | null;

              while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                  parts.push(line.substring(lastIndex, match.index));
                }
                const token = match[0];
                if (token.startsWith('**') && token.endsWith('**')) {
                  parts.push(
                    <strong key={match.index} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {token.slice(2, -2)}
                    </strong>
                  );
                } else if (token.startsWith('*') && token.endsWith('*')) {
                  parts.push(
                    <em
                      key={match.index}
                      style={{
                        fontStyle: 'italic',
                        color: 'var(--brand-primary-light)',
                        fontWeight: 500,
                      }}
                    >
                      {token.slice(1, -1)}
                    </em>
                  );
                }
                lastIndex = regex.lastIndex;
              }

              if (lastIndex < line.length) {
                parts.push(line.substring(lastIndex));
              }

              return (
                <React.Fragment key={lIdx}>
                  {parts}
                  {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
