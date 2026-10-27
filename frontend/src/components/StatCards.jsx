// itens: [{ icone, rotulo, valor, tom? ('vermelho' | 'amarelo' | 'verde' | 'azul'), detalhe? }]
export default function StatCards({ itens }) {
  return (
    <div className="stats">
      {itens.map(({ icone: Icone, rotulo, valor, tom = 'cinza', detalhe }) => (
        <div key={rotulo} className={`stat stat-${tom}`}>
          <span className="stat-icone">
            <Icone size={22} />
          </span>
          <div>
            <strong>{valor}</strong>
            <span>{rotulo}</span>
            {detalhe && <small>{detalhe}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}
