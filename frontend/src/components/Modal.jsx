import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ titulo, onClose, children, rodape, largo = false }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${largo ? 'modal-largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal-topo">
          <h3>{titulo}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
        {rodape && <footer className="modal-rodape">{rodape}</footer>}
      </div>
    </div>
  );
}

export function ConfirmModal({ titulo, mensagem, confirmar = 'Confirmar', perigo = false, carregando = false, onConfirm, onClose }) {
  return (
    <Modal
      titulo={titulo}
      onClose={onClose}
      rodape={
        <>
          <button className="btn btn-secundario" onClick={onClose} disabled={carregando}>
            Cancelar
          </button>
          <button className={`btn ${perigo ? 'btn-perigo' : 'btn-primario'}`} onClick={onConfirm} disabled={carregando}>
            {confirmar}
          </button>
        </>
      }
    >
      <p>{mensagem}</p>
    </Modal>
  );
}
