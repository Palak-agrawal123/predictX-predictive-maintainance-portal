import React from 'react';

/**
 * Parses inline markdown:
 * - ***bold italic***
 * - **bold**
 * - *italic*
 * - `code`
 * - links [label](url)
 */
function renderInline(text, isUser = false) {
  if (!text) return null;

  // Split text by markdown tokens:
  // 1: `code`
  // 2: ***bold-italic***
  // 3: **bold**
  // 4: *italic*
  // 5: [text](url)
  const tokenRegex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
            isUser
              ? 'bg-white/20 text-white font-semibold'
              : 'bg-[#EEF2EE] text-[#1D634B] border border-[#D5E0D7]'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold-italic: ***text***
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong
          key={idx}
          className={`font-bold italic ${isUser ? 'text-white' : 'text-[#151D19]'}`}
        >
          {part.slice(3, -3)}
        </strong>
      );
    }

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong
          key={idx}
          className={`font-semibold ${isUser ? 'text-white' : 'text-[#151D19]'}`}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Links: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-medium ${
            isUser ? 'text-white' : 'text-[#176B52] hover:text-[#0F4E3A]'
          }`}
        >
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}

/**
 * Splits text into markdown blocks:
 * - Code blocks
 * - Headings (h1, h2, h3, h4)
 * - Bullet lists (ul)
 * - Numbered lists (ol)
 * - Blockquotes
 * - Paragraphs
 */
function parseBlocks(markdown) {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let currentList = null;
  let inCode = false;
  let codeBuffer = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block (```)
    if (line.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', lang: codeLang, content: codeBuffer.join('\n') });
        codeBuffer = [];
        codeLang = '';
        inCode = false;
      } else {
        if (currentList) {
          blocks.push(currentList);
          currentList = null;
        }
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Headings
    const h4Match = line.match(/^####\s+(.*)$/);
    const h3Match = line.match(/^###\s+(.*)$/);
    const h2Match = line.match(/^##\s+(.*)$/);
    const h1Match = line.match(/^#\s+(.*)$/);

    if (h1Match || h2Match || h3Match || h4Match) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      if (h4Match) blocks.push({ type: 'h4', text: h4Match[1] });
      else if (h3Match) blocks.push({ type: 'h3', text: h3Match[1] });
      else if (h2Match) blocks.push({ type: 'h2', text: h2Match[1] });
      else if (h1Match) blocks.push({ type: 'h1', text: h1Match[1] });
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      blocks.push({ type: 'quote', text: quoteMatch[1] });
      continue;
    }

    // Bullet list item (- or * or +)
    const bulletMatch = line.match(/^[\*\-\+]\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'ul') {
        if (currentList) blocks.push(currentList);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Ordered list item (1. 2. etc.)
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!currentList || currentList.type !== 'ol') {
        if (currentList) blocks.push(currentList);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(orderedMatch[1]);
      continue;
    }

    // If we were inside a list and hit a non-list item
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }

    // Empty blank line separates paragraphs
    if (!line.trim()) {
      continue;
    }

    // Paragraph: collect consecutive lines
    const pLines = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !lines[i + 1].trim().startsWith('```') &&
      !lines[i + 1].match(/^#{1,4}\s+/) &&
      !lines[i + 1].match(/^>\s?/) &&
      !lines[i + 1].match(/^[\*\-\+]\s+/) &&
      !lines[i + 1].match(/^\d+\.\s+/)
    ) {
      i++;
      pLines.push(lines[i]);
    }
    blocks.push({ type: 'p', lines: pLines });
  }

  if (currentList) blocks.push(currentList);
  if (inCode && codeBuffer.length > 0) {
    blocks.push({ type: 'code', lang: codeLang, content: codeBuffer.join('\n') });
  }

  return blocks;
}

/**
 * MarkdownMessage: Rich, professional markdown renderer for chat bubbles.
 */
export function MarkdownMessage({ content, isUser = false }) {
  if (!content) return null;

  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-2.5 ${isUser ? 'text-white' : 'text-[#202A27]'}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <h1
                key={idx}
                className={`text-base font-bold tracking-tight pb-1 border-b ${
                  isUser
                    ? 'text-white border-white/20'
                    : 'text-[#151D19] border-[#E0E6E0]'
                } ${idx > 0 ? 'mt-3' : 'mt-0'}`}
              >
                {renderInline(block.text, isUser)}
              </h1>
            );

          case 'h2':
            return (
              <h2
                key={idx}
                className={`text-sm font-bold tracking-tight ${
                  isUser ? 'text-white' : 'text-[#151D19]'
                } ${idx > 0 ? 'mt-2.5' : 'mt-0'}`}
              >
                {renderInline(block.text, isUser)}
              </h2>
            );

          case 'h3':
            return (
              <h3
                key={idx}
                className={`text-[13.5px] font-bold tracking-tight ${
                  isUser ? 'text-white' : 'text-[#176B52]'
                } ${idx > 0 ? 'mt-2' : 'mt-0'}`}
              >
                {renderInline(block.text, isUser)}
              </h3>
            );

          case 'h4':
            return (
              <h4
                key={idx}
                className={`text-xs font-bold tracking-tight uppercase ${
                  isUser ? 'text-white/90' : 'text-[#2A3832]'
                } ${idx > 0 ? 'mt-1.5' : 'mt-0'}`}
              >
                {renderInline(block.text, isUser)}
              </h4>
            );

          case 'ul':
            return (
              <ul
                key={idx}
                className={`list-disc list-inside space-y-1 pl-1 text-xs ${
                  isUser ? 'text-white' : 'text-[#202A27]'
                }`}
              >
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    {renderInline(item, isUser)}
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol
                key={idx}
                className={`list-decimal list-inside space-y-1 pl-1 text-xs ${
                  isUser ? 'text-white' : 'text-[#202A27]'
                }`}
              >
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    {renderInline(item, isUser)}
                  </li>
                ))}
              </ol>
            );

          case 'quote':
            return (
              <blockquote
                key={idx}
                className={`border-l-3 pl-3 py-1 text-xs italic rounded-r ${
                  isUser
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-[#176B52] bg-[#F2F7F3] text-[#3D4D46]'
                }`}
              >
                {renderInline(block.text, isUser)}
              </blockquote>
            );

          case 'code':
            return (
              <div key={idx} className="my-2 rounded-lg overflow-hidden border border-[#2D3E35] bg-[#1A2520] shadow-2xs">
                {block.lang && (
                  <div className="px-3 py-1 bg-[#141E1A] text-[10px] font-mono text-[#8CA397] uppercase tracking-wider border-b border-[#2D3E35]">
                    {block.lang}
                  </div>
                )}
                <pre className="p-3 font-mono text-[11px] leading-relaxed text-[#E1EAE4] overflow-x-auto whitespace-pre">
                  <code>{block.content}</code>
                </pre>
              </div>
            );

          case 'p':
          default:
            return (
              <p
                key={idx}
                className={`text-xs leading-relaxed ${
                  isUser ? 'text-white' : 'text-[#202A27]'
                }`}
              >
                {block.lines.map((line, lineIdx) => (
                  <React.Fragment key={lineIdx}>
                    {renderInline(line, isUser)}
                    {lineIdx < block.lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

export default MarkdownMessage;
