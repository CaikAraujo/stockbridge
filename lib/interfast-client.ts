const BASE_URL = process.env.INTERFAST_API_URL ?? 'https://app.inter-fast.fr';
const API_KEY = process.env.INTERFAST_API_KEY ?? '';

const headers = {
  'X-API-KEY': API_KEY,
  'Content-Type': 'application/json',
};

export interface InterfastEvent {
  id: string;
  category: string;
  reference: string;
  title: string;
  finished: boolean;
  lifecycleState: string;
  end: string;
  primaryTechnicianId: number | null;
  users: {
    id: number;
    firstName: string;
    lastName: string;
  }[];
  client: {
    id: number;
    name: string;
  } | null;
}

export interface InterfastArticle {
  name: string;
  unit: string;
  quantity: number;
  price: string;
  tva: number;
  supplierCode: string;
  articleId: string;
}

export interface InterfastIntervention {
  id: number;
  reference: number;
  title: string;
  endDate: string | null;
  finishDate: string | null;
  primaryTechnicianId: number | null;
  users: {
    id: number;
    firstName: string;
    lastName: string;
  }[];
  client: {
    name: string;
  } | null;
  reports: {
    id: number;
    primaryReport: boolean;
    reportData: string; // JSON string
  }[];
}

export async function fetchRecentEvents(hoursBack = 2): Promise<InterfastEvent[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const allEvents: InterfastEvent[] = [];

  let page = 1;
  const count = 50;

  while (true) {
    const res = await fetch(`${BASE_URL}/v1/events?page=${page}&count=${count}`, { headers });

    if (!res.ok) throw new Error(`InterFast events error: ${res.status}`);

    const data = (await res.json()) as { items: InterfastEvent[]; count: number };

    const relevant = data.items.filter((e) => {
      if (e.category !== 'intervention') return false;
      if (!e.finished || e.lifecycleState !== 'completed') return false;
      return new Date(e.end) >= cutoff;
    });

    allEvents.push(...relevant);

    // Se o evento mais antigo desta página é anterior ao cutoff, para a paginação
    const oldest = data.items[data.items.length - 1];
    if (!oldest || new Date(oldest.end) < cutoff) break;

    // Se chegámos ao fim da lista
    if (page * count >= data.count) break;

    page++;
  }

  return allEvents;
}

export async function fetchIntervention(id: string): Promise<InterfastIntervention> {
  const res = await fetch(`${BASE_URL}/v1/intervention/${id}`, { headers });
  if (!res.ok) throw new Error(`InterFast intervention error: ${res.status}`);
  return res.json() as Promise<InterfastIntervention>;
}

export function extractArticles(intervention: InterfastIntervention): InterfastArticle[] {
  const primaryReport =
    intervention.reports.find((r) => r.primaryReport) ?? intervention.reports[0];

  if (!primaryReport?.reportData) return [];

  try {
    const data = JSON.parse(primaryReport.reportData) as {
      articles?: InterfastArticle[];
    };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export function extractTechnicianName(intervention: InterfastIntervention): string {
  const tech =
    intervention.users.find((u) => u.id === intervention.primaryTechnicianId) ??
    intervention.users[0];

  if (!tech) return '';
  return `${tech.firstName.trim()} ${tech.lastName.trim()}`.trim();
}
