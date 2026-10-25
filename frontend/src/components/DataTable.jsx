import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, Search } from 'lucide-react';
import { paraYMD } from '../utils/format';

// columns: [{ key, label, render?(row), sortValue?(row), texto?(row) }]
// filtros: [{ key, label, opcoes: [{ valor, rotulo }] }]  (filtra por igualdade em row[key])
export default function DataTable({ columns, rows, filtros = [], dataKey, vazio = 'Nenhum registro encontrado.', busca = true }) {
  const [texto, setTexto] = useState('');
  const [valores, setValores] = useState({});
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [ordem, setOrdem] = useState({ key: null, dir: 'asc' });

  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    let lista = rows.filter((r) => {
      for (const f of filtros) if (valores[f.key] && String(r[f.key]) !== valores[f.key]) return false;
      if (dataKey && r[dataKey]) {
        const ymd = paraYMD(r[dataKey]);
        if (de && ymd < de) return false;
        if (ate && ymd > ate) return false;
      }
      if (t) {
        const alvo = columns.map((c) => (c.texto ? c.texto(r) : r[c.key])).join(' ').toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
    if (ordem.key) {
      const col = columns.find((c) => c.key === ordem.key);
      const val = (r) => (col.sortValue ? col.sortValue(r) : r[col.key]) ?? '';
      lista = [...lista].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
        return ordem.dir === 'asc' ? c : -c;
      });
    }
    return lista;
  }, [rows, columns, filtros, valores, texto, de, ate, ordem, dataKey]);

  const alternar = (key) =>
    setOrdem((o) => (o.key === key ? { key, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className="tabela-bloco">
      <div className="tabela-filtros">
        {busca && (
          <label className="campo-busca">
            <Search size={16} />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar" aria-label="Buscar" />
          </label>
        )}
        {filtros.map((f) => (
          <select
            key={f.key}
            value={valores[f.key] || ''}
            onChange={(e) => setValores((v) => ({ ...v, [f.key]: e.target.value }))}
            aria-label={f.label}
          >
            <option value="">{f.label}: todos</option>
            {f.opcoes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        ))}
        {dataKey && (
          <>
            <label className="campo-data">
              De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </label>
            <label className="campo-data">
              Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              {columns.map((c) => {
                const ordenavel = c.sortValue || c.key !== 'acoes';
                const Icone = ordem.key === c.key ? (ordem.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                return (
                  <th key={c.key}>
                    {ordenavel && c.key !== 'acoes' ? (
                      <button className="th-ordenar" onClick={() => alternar(c.key)}>
                        {c.label} <Icone size={14} />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="tabela-vazia">
                  {vazio}
                </td>
              </tr>
            )}
            {filtradas.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
