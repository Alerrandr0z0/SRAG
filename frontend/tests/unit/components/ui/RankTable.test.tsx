import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RankTable from '../../../../src/components/ui/RankTable';

describe('RankTable', () => {
  it('filters rows by search and paginates top 10', () => {
    render(
      <RankTable
        title="Bairros com mais casos"
        searchPlaceholder="Buscar bairro"
        columns={[
          { key: 'name', label: 'Bairro' },
          { key: 'count', label: 'Notificados', align: 'right' },
        ]}
        rows={Array.from({ length: 12 }, (_, index) => ({
          key: `Bairro ${index + 1}`,
          values: {
            name: `Bairro ${index + 1}`,
            count: index + 1,
          },
        }))}
      />,
    );

    expect(screen.getByText('Bairro 1')).toBeInTheDocument();
    expect(screen.queryByText('Bairro 11')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar bairro'), { target: { value: '11' } });

    expect(screen.getByText('Bairro 11')).toBeInTheDocument();
    expect(screen.queryByText('Bairro 1')).not.toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });
});
