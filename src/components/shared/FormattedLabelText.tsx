import React, { Fragment } from 'react';

interface FormattedLabelTextProps {
  value: string;
}

const HTTP_URL_REGEX = /^https?:\/\//i;

export const stripFormattedLabelSyntax = (value: string): string => {
  if (!value) return '';

  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*|__|\*/g, '');
};

const parseInlineFormatting = (line: string, lineIndex: number) => {
  type ActiveStyles = {
    bold: boolean;
    italic: boolean;
    underline: boolean;
  };

  const nodes: React.ReactNode[] = [];
  const activeStyles: ActiveStyles = {
    bold: false,
    italic: false,
    underline: false
  };
  let tokenIndex = 0;
  let cursor = 0;
  let textBuffer = '';

  const wrapWithActiveStyles = (content: React.ReactNode, key: string) => {
    let wrappedContent = content;

    if (activeStyles.bold) wrappedContent = <strong key={`${key}-bold`}>{wrappedContent}</strong>;
    if (activeStyles.italic) wrappedContent = <em key={`${key}-italic`}>{wrappedContent}</em>;
    if (activeStyles.underline) wrappedContent = <u key={`${key}-underline`}>{wrappedContent}</u>;

    return wrappedContent;
  };

  const flushTextBuffer = () => {
    if (!textBuffer) return;
    nodes.push(wrapWithActiveStyles(textBuffer, `text-${lineIndex}-${tokenIndex}`));
    tokenIndex += 1;
    textBuffer = '';
  };

  while (cursor < line.length) {
    const remainingText = line.slice(cursor);
    const linkMatch = remainingText.match(/^\[([^\]]+)\]\(([^)]+)\)/);

    if (linkMatch) {
      flushTextBuffer();

      const fullMatch = linkMatch[0];
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2].trim();

      const linkNode = HTTP_URL_REGEX.test(linkUrl)
        ? (
          <a
            key={`link-${lineIndex}-${tokenIndex}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-700"
          >
            {linkText}
          </a>
        )
        : fullMatch;

      nodes.push(wrapWithActiveStyles(linkNode, `link-wrap-${lineIndex}-${tokenIndex}`));
      tokenIndex += 1;
      cursor += fullMatch.length;
      continue;
    }

    if (remainingText.startsWith('**')) {
      flushTextBuffer();
      activeStyles.bold = !activeStyles.bold;
      cursor += 2;
      continue;
    }

    if (remainingText.startsWith('__')) {
      flushTextBuffer();
      activeStyles.underline = !activeStyles.underline;
      cursor += 2;
      continue;
    }

    if (remainingText.startsWith('*')) {
      flushTextBuffer();
      activeStyles.italic = !activeStyles.italic;
      cursor += 1;
      continue;
    }

    textBuffer += line[cursor];
    cursor += 1;
  }

  flushTextBuffer();

  if (!nodes.length) {
    return line;
  }

  return nodes;
};

const FormattedLabelText: React.FC<FormattedLabelTextProps> = ({ value }) => {
  if (!value) return null;

  const lines = value.split('\n');

  return (
    <>
      {lines.map((line, lineIndex) => (
        <Fragment key={`line-${lineIndex}`}>
          {parseInlineFormatting(line, lineIndex)}
          {lineIndex < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
};

export default FormattedLabelText;
