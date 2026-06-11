'use client';

import {
  IconArrowLeftRight,
  IconBox,
  IconBuildingWarehouse,
  IconDroplet,
} from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';
import { ArticlesTable } from '@/components/admin/articles/articles-table';
import { DepositoView } from '@/components/admin/deposito/deposito-view';
import { GasBottlesList } from '@/components/admin/gas-bottles/gas-bottles-list';
import { MovementsTable } from '@/components/admin/movements/movements-table';

type DepositoViewProps = ComponentProps<typeof DepositoView>;
type ArticlesTableProps = ComponentProps<typeof ArticlesTable>;
type GasBottlesListProps = ComponentProps<typeof GasBottlesList>;
type MovementsTableProps = ComponentProps<typeof MovementsTable>;

type Props = {
  defaultTab: string;
  warehouseData: {
    warehouse: DepositoViewProps['warehouse'];
    items: DepositoViewProps['items'];
    movements: DepositoViewProps['movements'];
  };
  articlesData: ArticlesTableProps['initialData'];
  bottles: GasBottlesListProps['initialData'];
  movements: MovementsTableProps['initialData'];
  locations: GasBottlesListProps['locations'];
  drivers: MovementsTableProps['drivers'];
};

const TABS = [
  { id: 'deposito',      label: 'Depósito',       icon: IconBuildingWarehouse },
  { id: 'artigos',       label: 'Artigos',         icon: IconBox              },
  { id: 'movimentacoes', label: 'Movimentações',   icon: IconArrowLeftRight   },
  { id: 'gas',           label: 'Garrafas de gás', icon: IconDroplet          },
] as const;

type TabId = (typeof TABS)[number]['id'];

const VALID_TABS: readonly TabId[] = ['deposito', 'artigos', 'movimentacoes', 'gas'];

function isValidTab(v: string): v is TabId {
  return (VALID_TABS as readonly string[]).includes(v);
}

export function EstoqueScreen({
  defaultTab,
  warehouseData,
  articlesData,
  bottles,
  movements,
  locations,
  drivers,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get('tab') ?? defaultTab;
  const tab: TabId = isValidTab(rawTab) ? rawTab : 'deposito';

  const setTab = (id: TabId) => {
    router.push(`/estoque?tab=${id}`);
  };

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={'tab' + (tab === t.id ? ' active' : '')}
              onClick={() => setTab(t.id)}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'deposito' && (
        <DepositoView
          warehouse={warehouseData.warehouse}
          items={warehouseData.items}
          movements={warehouseData.movements}
        />
      )}

      {tab === 'artigos' && <ArticlesTable initialData={articlesData} />}

      {tab === 'movimentacoes' && (
        <MovementsTable
          initialData={movements}
          locations={locations}
          drivers={drivers}
        />
      )}

      {tab === 'gas' && (
        <GasBottlesList initialData={bottles} locations={locations} />
      )}
    </div>
  );
}
