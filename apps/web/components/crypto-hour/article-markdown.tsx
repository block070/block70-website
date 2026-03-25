"use client";

import ReactMarkdown from "react-markdown";

type Props = {
  markdown: string;
};

export function ArticleMarkdown({ markdown }: Props) {
  return (
    <div className="crypto-hour-md max-w-none text-sm leading-relaxed text-slate-200">
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="mb-3 text-xl font-semibold text-slate-50">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-6 text-lg font-semibold text-slate-100">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-100">{children}</h3>,
        p: ({ children }) => <p className="mb-3 text-slate-300">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-inside list-disc space-y-1 text-slate-300">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-inside list-decimal space-y-1 text-slate-300">{children}</ol>,
        li: ({ children }) => <li className="pl-1">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300"
          >
            {children}
          </a>
        ),
        strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
        code: ({ children }) => (
          <code className="rounded bg-slate-800 px-1 py-0.5 text-[0.85em] text-emerald-200">{children}</code>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
    </div>
  );
}
