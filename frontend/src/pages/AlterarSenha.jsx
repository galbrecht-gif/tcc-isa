import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { mensagemErro } from '../services/api';
import Marca from '../components/Marca';

export default function AlterarSenha() {
  const { home, refresh } = useAuth();
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (novaSenha !== confirmacao) {
      setErro('As novas senhas não conferem.');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/auth/senha/alterar', { senhaAtual, novaSenha });
      await refresh();
      navigate(home, { replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="publico-tela">
      <section className="publico-caixa">
        <div className="publico-marca">
          <Marca subtitulo="Segurança da conta" />
        </div>
        <h1>Troque sua senha temporária</h1>
        <p className="texto-suave">Para continuar, defina uma senha pessoal com pelo menos 8 caracteres.</p>
        {erro && <div className="alerta-erro" role="alert"><strong>{erro}</strong></div>}
        <form className="form" onSubmit={salvar}>
          <label>
            Senha temporária atual
            <input type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
          </label>
          <label>
            Nova senha
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
          </label>
          <label>
            Confirme a nova senha
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
          </label>
          <button className="btn btn-primario btn-grande" disabled={enviando}>
            {enviando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </section>
    </main>
  );
}
