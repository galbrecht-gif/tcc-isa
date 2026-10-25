import { useEffect, useState } from 'react';
import { Search, Clock, Save, ArrowLeft } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import SignaturePad from '../components/SignaturePad';
import { agoraInputLocal, fmtHora } from '../utils/format';

export default function PortariaEntrada() {
  const toast = useToast();
  const [turmas, setTurmas] = useState([]);
  const [filtro, setFiltro] = useState({ busca: '', curso: '', turma_id: '' });
  const [resultados, setResultados] = useState([]);
  const [aluno, setAluno] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [ajustar, setAjustar] = useState(false);
  const [horario, setHorario] = useState(agoraInputLocal());
  const [assinatura, setAssinatura] = useState(null);
  const [relogio, setRelogio] = useState(new Date());
  const [enviando, setEnviando] = useState(false);
  const [chaveForm, setChaveForm] = useState(0);

  useEffect(() => {
    api.get('/turmas').then(({ data }) => setTurmas(data));
    const t = setInterval(() => setRelogio(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const buscar = async (e) => {
    e?.preventDefault();
    try {
      const { data } = await api.get('/alunos', { params: { busca: filtro.busca, curso: filtro.curso, turma_id: filtro.turma_id || undefined } });
      setResultados(data);
    } catch (err) {
      toast.erro(mensagemErro(err));
    }
  };

  useEffect(() => {
    buscar();
    // busca inicial para listar os alunos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selecionar = (a) => {
    setAluno(a);
    setMotivo('');
    setAjustar(false);
    setHorario(agoraInputLocal());
    setAssinatura(null);
    setChaveForm((k) => k + 1);
  };

  const registrar = async (e) => {
    e.preventDefault();
    if (!assinatura) {
      toast.erro('O aluno deve assinar e confirmar a assinatura.');
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post('/entradas', {
        aluno_id: aluno.id,
        motivo,
        assinatura,
        horario_ajustado: ajustar ? horario : undefined,
      });
      toast.sucesso(data.horario_alterado_log || `Entrada de ${aluno.nome} registrada. Gestor e professor notificados.`);
      setAluno(null);
    } catch (err) {
      toast.erro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  if (aluno) {
    return (
      <>
        <div className="pagina-topo">
          <h1>Registrar entrada atrasada</h1>
          <button className="btn btn-secundario" onClick={() => setAluno(null)}>
            <ArrowLeft size={16} /> Voltar à busca
          </button>
        </div>
        <form className="cartao form" onSubmit={registrar} key={chaveForm}>
          <p>
            <strong>{aluno.nome}</strong> - {aluno.turma_nome} ({aluno.curso})
          </p>
          <div className="relogio">
            <Clock size={18} /> Horário atual: <strong>{fmtHora(relogio)}</strong>
          </div>
          <label className="check">
            <input type="checkbox" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} />
            Ajustar horário manualmente
          </label>
          {ajustar && (
            <label>
              Horário de entrada
              <input type="datetime-local" value={horario} max={agoraInputLocal()} onChange={(e) => setHorario(e.target.value)} required />
              <small className="texto-suave">A alteração ficará registrada no log com o horário original e o novo.</small>
            </label>
          )}
          <label>
            Motivo do atraso
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} minLength={3} required />
          </label>
          <div>
            <span className="rotulo">Assinatura digital do aluno</span>
            <SignaturePad onChange={setAssinatura} />
          </div>
          <div className="form-acoes">
            <button className="btn btn-primario" disabled={enviando}>
              <Save size={16} /> Registrar entrada
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="pagina-topo">
        <h1>Registrar entrada atrasada</h1>
      </div>
      <form className="cartao filtros-busca" onSubmit={buscar}>
        <label>
          Nome
          <input value={filtro.busca} onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })} />
        </label>
        <label>
          Curso
          <input value={filtro.curso} onChange={(e) => setFiltro({ ...filtro, curso: e.target.value })} />
        </label>
        <label>
          Turma
          <select value={filtro.turma_id} onChange={(e) => setFiltro({ ...filtro, turma_id: e.target.value })}>
            <option value="">Todas</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primario">
          <Search size={16} /> Pesquisar
        </button>
      </form>
      <section className="cartao">
        <table className="tabela">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Turma</th>
              <th>Curso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {resultados.length === 0 && (
              <tr>
                <td colSpan={4} className="tabela-vazia">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
            {resultados.map((a) => (
              <tr key={a.id}>
                <td data-label="Aluno">{a.nome}</td>
                <td data-label="Turma">{a.turma_nome}</td>
                <td data-label="Curso">{a.curso}</td>
                <td>
                  <button className="btn btn-primario btn-pequeno" onClick={() => selecionar(a)}>
                    Registrar entrada
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
