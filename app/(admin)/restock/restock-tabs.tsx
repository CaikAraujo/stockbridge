'use client';

import { useState } from 'react';
import { CriticalArticlesTab } from './critical-articles-tab';
import { EmailTemplateTab } from './email-template-tab';

type CriticalArticle = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_qty: string;
  min_stock: string;
  supplier_id: string | null;
  supplier_name: string | null;
};

type Template = {
  emailTemplateSubject: string;
  emailTemplateGreeting: string;
  emailTemplateBody: string;
  emailTemplateFooter: string;
  name: string;
} | null;

interface Props {
  articles: CriticalArticle[];
  template: Template;
}

const TABS = [
  { id: 'critical', label: 'Articles critiques' },
  { id: 'template', label: "Modèle d'email" },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function RestockTabs({ articles, template }: Props) {
  const [active, setActive] = useState<TabId>('critical');

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: active === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: active === tab.id ? 'var(--primary)' : 'var(--muted)',
              marginBottom: -1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
            {tab.id === 'critical' && articles.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: 'var(--danger)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {articles.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {active === 'critical' && <CriticalArticlesTab articles={articles} template={template} />}
      {active === 'template' && <EmailTemplateTab template={template} />}
    </div>
  );
}
