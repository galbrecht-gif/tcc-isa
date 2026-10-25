import { useEffect, useRef, useState } from 'react';
import { Eraser, Check, PenLine } from 'lucide-react';

// Assinatura digital em Canvas nativo. Chama onChange(dataUrl) ao confirmar e onChange(null) ao limpar.
export default function SignaturePad({ onChange, altura = 180 }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);
  const [confirmada, setConfirmada] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const largura = wrapRef.current.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    canvas.style.height = `${altura}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E1E1E';
  }, [altura]);

  const posicao = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const iniciar = (e) => {
    if (confirmada) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const { x, y } = posicao(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    setTemTraco(true);
  };

  const mover = (e) => {
    if (!desenhando.current) return;
    const { x, y } = posicao(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const parar = () => {
    desenhando.current = false;
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setTemTraco(false);
    setConfirmada(false);
    onChange(null);
  };

  const confirmar = () => {
    setConfirmada(true);
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="assinatura">
      <div className="assinatura-area" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={parar}
          onPointerLeave={parar}
          className={confirmada ? 'confirmada' : ''}
        />
        {!temTraco && (
          <span className="assinatura-dica">
            <PenLine size={16} /> Assine aqui
          </span>
        )}
      </div>
      <div className="assinatura-acoes">
        <button type="button" className="btn btn-secundario" onClick={limpar}>
          <Eraser size={16} /> Limpar
        </button>
        <button type="button" className="btn btn-primario" onClick={confirmar} disabled={!temTraco || confirmada}>
          <Check size={16} /> Confirmar Assinatura
        </button>
        {confirmada && <span className="texto-ok">Assinatura confirmada</span>}
      </div>
    </div>
  );
}
