import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

export function renderMarkdown(text: string): string {
  return md.render(text);
}
