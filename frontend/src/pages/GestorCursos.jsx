import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, Plus, Users } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import useApi from '../components/useApi';
import TurmaAlunos from '../components/TurmaAlunos';

export default function GestorCursos() {
  const toast = useToast();
  const turmas = useApi('/turmas');
  const [professores, setProfessores] = useState([]);
  const [novaTurma, setNovaTurma] = useState({ nome: '', curso: '' });
  const [enviando, setEnviando] = useState(false);
  const [turmaAtualizando, setTurmaAtualizando] = useState(null);

  useEffect(() => {
    api.get('/usuarios', { params: { role: 'professor', ativo: 'true' } })
      .then(({ data }) => setProfessores(data))
      .catch((err) => toast.erro(mensagemErro(err)));
  }, [toast]);

  const criarTurma = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post('/turmas', novaTurma);
      setNovaTurma({ nome: '', curso: '' });
      await turmas.recarregar();
      toast.sucesso('Curso criado e disponível para novos cadastros de alunos.');
    } catch (err) {
      toast.erro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const atribuirProfessor = async (turma, professorId) => {
    setTurmaAtualizando(turma.id);
    try {
      await api.patch(`/turmas/${turma.id}/professor`, { professor_id: professorId ? Number(professorId) : null });
      await turmas.recarregar();
      toast.sucesso('Professor da turma atualizado.');
    } catch (err) {
      toast.erro(mensagemErro(err));
      turmas.recarregar();
    } finally {
      setTurmaAtualizando(null);
    }
  };

  const totalAlunos = (turmas.data || []).reduce((total, turma) => total + turma.alunos_count, 0);

  return (
    <>
      <div className="pagina-topo">
        <div>
          <h1>Cursos e turmas</h1>
          <p className="texto-suave">Cadastre turmas, acompanhe os alunos e vincule os professores responsáveis.</p>
        </div>
      </div>

      <section className="cartao cursos-criar">
        <div className="cursos-secao-titulo">
          <span className="cursos-icone"><Plus size={19} /></span>
          <div>
            <h2>Criar curso e turma</h2>
            <p className="texto-suave">A turma ficará disponível no cadastro dos alunos assim que for criada.</p>
          </div>
        </div>
        <form className="form cursos-form" onSubmit={criarTurma}>
          <label>
            Nome da turma
            <input
              value={novaTurma.nome}
              onChange={(e) => setNovaTurma({ ...novaTurma, nome: e.target.value })}
              minLength={2}
              maxLength={100}
              placeholder="Ex.: Desenvolvimento de Sistemas - 2º ano"
              required
            />
          </label>
          <label>
            Curso
            <input
              value={novaTurma.curso}
              onChange={(e) => setNovaTurma({ ...novaTurma, curso: e.target.value })}
              minLength={2}
              maxLength={150}
              placeholder="Ex.: Desenvolvimento de Sistemas"
              required
            />
          </label>
          <div className="form-acoes">
            <button className="btn btn-primario" disabled={enviando}>
              <Plus size={16} /> {enviando ? 'Criando...' : 'Criar curso'}
            </button>
          </div>
        </form>
      </section>

      <div className="cursos-resumo" aria-live="polite">
        <div className="cursos-resumo-item">
          <BookOpen size={19} />
          <span><strong>{(turmas.data || []).length}</strong> turmas cadastradas</span>
        </div>
        <div className="cursos-resumo-item">
          <GraduationCap size={19} />
          <span><strong>{totalAlunos}</strong> alunos inscritos</span>
        </div>
      </div>

      <section className="cursos-lista" aria-label="Cursos cadastrados">
        {turmas.loading && !turmas.data && <div className="cartao texto-suave">Carregando cursos...</div>}
        {!turmas.loading && !turmas.data?.length && (
          <div className="cartao cursos-vazio">
            <BookOpen size={28} />
            <strong>Nenhum curso cadastrado</strong>
            <span>Use o formulário acima para criar o primeiro curso e turma.</span>
          </div>
        )}
        {(turmas.data || []).map((turma) => (
          <article className="cartao curso-card" key={turma.id}>
            <div className="curso-card-topo">
              <div className="curso-card-identidade">
                <span className="cursos-icone"><BookOpen size={19} /></span>
                <div>
                  <h2>{turma.curso}</h2>
                  <p className="texto-suave">{turma.nome}</p>
                </div>
              </div>
              <span className="curso-contagem"><Users size={15} /> {turma.alunos_count} {turma.alunos_count === 1 ? 'aluno' : 'alunos'}</span>
            </div>
            <label className="curso-professor">
              Professor responsável
              <select
                value={turma.professor_id || ''}
                onChange={(e) => atribuirProfessor(turma, e.target.value)}
                disabled={turmaAtualizando === turma.id}
              >
                <option value="">Sem professor vinculado</option>
                {professores.map((professor) => (
                  <option key={professor.id} value={professor.id}>{professor.nome}</option>
                ))}
              </select>
            </label>
            {turmaAtualizando === turma.id && <small className="texto-suave">Salvando professor...</small>}
            <TurmaAlunos turma={turma} />
          </article>
        ))}
      </section>
    </>
  );
}
