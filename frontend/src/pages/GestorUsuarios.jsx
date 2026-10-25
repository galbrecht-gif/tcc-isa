import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Power, X } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import useApi from '../components/useApi';
import DataTable from '../components/DataTable';
import Modal, { ConfirmModal } from '../components/Modal';
import { ROLES } from '../utils/format';

const VAZIO = { nome: '', email: '', role: 'aluno', ativo: true, data_nascimento: '', turma_id: '', responsaveis: [], turma_ids: [] };

export default function GestorUsuarios() {
  const toast = useToast();
  const { user } = useAuth();
  const [filtroRole, setFiltroRole] = useState('');
  const usuarios = useApi('/usuarios', { role: filtroRole || undefined });
  const [turmas, setTurmas] = useState([]);
  const [form, setForm] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/turmas').then(({ data }) => setTurmas(data));
  }, []);

  const novo = () => setForm({ ...VAZIO, turma_id: turmas[0]?.id || '' });
  const editar = (u) =>
    setForm({
      ...VAZIO,
      ...u,
      data_nascimento: u.data_nascimento || '',
      turma_id: u.turma_id || '',
      responsaveis: (u.responsaveis || []).map(({ nome, email }) => ({ nome, email })),
      turma_ids: u.turma_ids || [],
    });

  const salvar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const corpo = { ...form, turma_id: form.turma_id ? Number(form.turma_id) : undefined };
      if (form.id) await api.put(`/usuarios/${form.id}`, corpo);
      else await api.post('/usuarios', corpo);
      toast.sucesso('Usuário salvo.');
      setForm(null);
      usuarios.recarregar();
    } catch (err) {
      toast.erro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const alternarAtivo = async (u) => {
    try {
      await api.patch(`/usuarios/${u.id}/ativo`, { ativo: !u.ativo });
      toast.sucesso(u.ativo ? 'Conta desativada.' : 'Conta ativada.');
      usuarios.recarregar();
    } catch (err) {
      toast.erro(mensagemErro(err));
    }
  };

  const confirmarExcluir = async () => {
    try {
      await api.delete(`/usuarios/${excluir.id}`);
      toast.sucesso('Usuário excluído.');
      usuarios.recarregar();
    } catch (err) {
      toast.erro(mensagemErro(err));
    }
    setExcluir(null);
  };

  const setResp = (i, campo, valor) =>
    setForm((f) => ({ ...f, responsaveis: f.responsaveis.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)) }));

  const alternarTurma = (id) =>
    setForm((f) => ({ ...f, turma_ids: f.turma_ids.includes(id) ? f.turma_ids.filter((t) => t !== id) : [...f.turma_ids, id] }));

  const columns = [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'role', label: 'Perfil', render: (u) => ROLES[u.role], sortValue: (u) => ROLES[u.role] },
    {
      key: 'detalhe',
      label: 'Detalhes',
      texto: (u) => `${u.turma_nome || ''} ${(u.responsaveis || []).map((r) => r.nome).join(' ')}`,
      sortValue: (u) => u.turma_nome || '',
      render: (u) =>
        u.role === 'aluno' ? (
          <span>
            {u.turma_nome} - {u.idade} anos ({u.maior_idade ? 'maior' : 'menor'})
            <br />
            <small>Resp.: {(u.responsaveis || []).map((r) => r.nome).join(', ') || 'nenhum'}</small>
          </span>
        ) : (
          '-'
        ),
    },
    {
      key: 'ativo',
      label: 'Situação',
      sortValue: (u) => (u.ativo ? 1 : 0),
      render: (u) => <span className={`badge ${u.ativo ? 'badge-verde' : 'badge-vermelho'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>,
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (u) => (
        <div className="acoes">
          <button className="icon-btn" title="Editar" onClick={() => editar(u)}>
            <Pencil size={16} />
          </button>
          <button className="icon-btn" title={u.ativo ? 'Desativar' : 'Ativar'} onClick={() => alternarAtivo(u)} disabled={u.id === user.id}>
            <Power size={16} />
          </button>
          <button className="icon-btn" title="Excluir" onClick={() => setExcluir(u)} disabled={u.id === user.id}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="pagina-topo">
        <h1>Gerenciar Usuários</h1>
        <div className="acoes">
          <select value={filtroRole} onChange={(e) => setFiltroRole(e.target.value)} aria-label="Perfil">
            <option value="">Todos os perfis</option>
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn btn-primario" onClick={novo}>
            <Plus size={16} /> Novo usuário
          </button>
        </div>
      </div>
      <section className="cartao">
        <DataTable columns={columns} rows={usuarios.data || []} vazio="Nenhum usuário encontrado." />
      </section>

      {form && (
        <Modal titulo={form.id ? 'Editar usuário' : 'Novo usuário'} onClose={() => setForm(null)} largo>
          <form className="form" onSubmit={salvar}>
            <label>
              Nome
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required minLength={3} />
            </label>
            <label>
              E-mail (Google)
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Perfil
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={form.id === user.id}>
                {Object.entries(ROLES).map(([k, v]) => (
                  <option key={k} value={k} disabled={k === 'responsavel' && !form.id}>
                    {v}
                  </option>
                ))}
              </select>
              {!form.id && <small className="texto-suave">Responsáveis são criados ao vincular a um aluno.</small>}
            </label>
            <label className="check">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} disabled={form.id === user.id} />
              Conta ativa
            </label>

            {form.role === 'aluno' && (
              <>
                <label>
                  Data de nascimento
                  <input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} required />
                </label>
                <label>
                  Turma
                  <select value={form.turma_id} onChange={(e) => setForm({ ...form, turma_id: e.target.value })} required>
                    <option value="">Selecione</option>
                    {turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} - {t.curso}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend>Responsáveis vinculados</legend>
                  {form.responsaveis.map((r, i) => (
                    <div className="linha-resp" key={i}>
                      <input placeholder="Nome" value={r.nome} onChange={(e) => setResp(i, 'nome', e.target.value)} required minLength={3} />
                      <input type="email" placeholder="E-mail" value={r.email} onChange={(e) => setResp(i, 'email', e.target.value)} required />
                      <button
                        type="button"
                        className="icon-btn"
                        title="Desvincular"
                        onClick={() => setForm({ ...form, responsaveis: form.responsaveis.filter((_, j) => j !== i) })}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => setForm({ ...form, responsaveis: [...form.responsaveis, { nome: '', email: '' }] })}>
                    <Plus size={14} /> Adicionar responsável
                  </button>
                </fieldset>
              </>
            )}

            {form.role === 'professor' && (
              <fieldset>
                <legend>Turmas do professor</legend>
                {turmas.map((t) => (
                  <label className="check" key={t.id}>
                    <input type="checkbox" checked={form.turma_ids.includes(t.id)} onChange={() => alternarTurma(t.id)} />
                    {t.nome} - {t.curso}
                  </label>
                ))}
              </fieldset>
            )}

            {form.role === 'responsavel' && form.dependentes?.length > 0 && (
              <p className="texto-suave">Dependentes: {form.dependentes.map((d) => d.nome).join(', ')} (vínculos são editados no cadastro do aluno).</p>
            )}

            <div className="form-acoes">
              <button type="button" className="btn btn-secundario" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button className="btn btn-primario" disabled={enviando}>
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {excluir && (
        <ConfirmModal
          titulo="Excluir usuário"
          mensagem={`Excluir ${excluir.nome}? Usuários com histórico de registros não podem ser excluídos; neste caso, desative a conta.`}
          confirmar="Excluir"
          perigo
          onConfirm={confirmarExcluir}
          onClose={() => setExcluir(null)}
        />
      )}
    </>
  );
}
