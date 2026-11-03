import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import api, { mensagemErro } from '../services/api';

export default function TurmaAlunos({ turma }) {
  const [aberta, setAberta] = useState(false);
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!aberta) return undefined;
    let ativa = true;
    const carregar = async () => {
      try {
        const { data } = await api.get(`/turmas/${turma.id}/alunos`);
        if (ativa) {
          setAlunos(data);
          setErro('');
        }
      } catch (err) {
        if (ativa) setErro(mensagemErro(err));
      } finally {
        if (ativa) setCarregando(false);
      }
    };

    setCarregando(true);
    carregar();
    const intervalo = setInterval(carregar, 10000);
    return () => {
      ativa = false;
      clearInterval(intervalo);
    };
  }, [aberta, turma.id]);

  return (
    <div className="turma-alunos">
      <button
        type="button"
        className="turma-alunos-toggle"
        aria-expanded={aberta}
        aria-controls={`turma-${turma.id}-alunos`}
        onClick={() => setAberta((atual) => !atual)}
      >
        <span><Users size={16} /> Alunos inscritos ({turma.alunos_count})</span>
        {aberta ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {aberta && (
        <div className="turma-alunos-lista" id={`turma-${turma.id}-alunos`}>
          {erro && <p className="texto-erro">{erro}</p>}
          {carregando && <p className="texto-suave">Carregando alunos...</p>}
          {!carregando && !erro && alunos.length === 0 && <p className="texto-suave">Nenhum aluno cadastrado nesta turma ainda.</p>}
          {!erro && alunos.length > 0 && (
            <ul>
              {alunos.map((aluno) => <li key={aluno.id}>{aluno.nome}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
